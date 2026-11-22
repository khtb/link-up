Course.register({
  id: 'auto-profile',
  title: 'The Automotive Profile (AVnu)',
  section: 'Automotive',
  minutes: 25,
  render: () => `
    <h1>The gPTP Automotive Profile</h1>
    <p>The first widely deployed automotive gPTP definition came from the <b>AVnu Alliance</b>, in the
    <i>Automotive Ethernet AVB Functional and Interoperability Specification</i> (the "Automotive Profile"). It is a profile of
    <b>802.1AS-2011</b>: the same messages on the wire, but with all dynamic behaviour replaced by configuration, so time is
    available within a few hundred milliseconds of power-up. AUTOSAR EthTSyn and the linuxptp <code>automotive-*.cfg</code>
    files follow the same model, and 802.1AS-2020 later standardised the key pieces (lesson 11).</p>

    <div class="callout"><b>The design principle</b>
      A vehicle network is <b>static</b>: the GM, every port role and every cable length are known when the car is designed.
      Anything that gPTP would normally <i>discover</i> at run time can be <i>configured</i> instead, and every discovery step
      removed from the startup path saves seconds.</div>

    <h2>What the profile changes</h2>
    <div class="table-wrap"><table>
      <tr><th style="width:190px">Area</th><th>Standard 802.1AS-2011</th><th>Automotive Profile (paraphrased)</th><th>linuxptp option</th></tr>
      <tr><td><b>Grandmaster</b></td><td>Elected by BMCA</td><td><b>Static GM</b>, chosen at design time. No BMCA.</td><td><code>BMCA noop</code></td></tr>
      <tr><td><b>Port roles</b></td><td>From BMCA</td><td><b>Static</b>: every port configured master or slave</td><td><code>serverOnly 1</code> (per port) / <code>clientOnly 1</code></td></tr>
      <tr><td><b>Announce</b></td><td>Sent every 1 s, timeout 3 s</td><td><b>Not sent</b>, ignored if received. Slaves therefore cannot check the sender identity.</td><td><code>inhibit_announce 1</code>, <code>ignore_source_id 1</code></td></tr>
      <tr><td><b>asCapable</b></td><td>Computed from Pdelay</td><td><b>TRUE</b> on configured ports as soon as the link is up</td><td><code>asCapable true</code></td></tr>
      <tr><td><b>Link delay at startup</b></td><td>Measured first</td><td>Use a <b>stored (persistent) neighborPropDelay</b>, e.g. from NVM, so Sync can be used immediately. Keep measuring and update the stored value when it changes noticeably.</td><td><i>not available</i> (ptp4l always measures)</td></tr>
      <tr><td><b>Sync interval</b></td><td>125 ms fixed (initial)</td><td>Fast <b>initialLogSyncInterval</b> (down to −5 = 31.25 ms) until synchronized, then the slave asks for a slower <b>operLogSyncInterval</b> (up to 0 = 1 s)</td><td><code>logSyncInterval -3</code>, <code>operLogSyncInterval 0</code>, <code>msg_interval_request 1</code></td></tr>
      <tr><td><b>Pdelay interval</b></td><td>1 s</td><td>initialLogPdelayReqInterval 0, then slower operLogPdelayReqInterval (up to 3 = 8 s): the cable doesn't change</td><td><code>operLogPdelayReqInterval 2</code></td></tr>
      <tr><td><b>Interval change</b></td><td>Signaling (optional)</td><td>Slave sends <b>Signaling</b> with a Message Interval Request TLV once stable; reverts to initial after a link or sync loss</td><td><code>servo_offset_threshold</code>, <code>servo_num_offset_values</code></td></tr>
      <tr><td><b>GM Pdelay</b></td><td>GM initiates Pdelay too</td><td>The GM only needs to <i>respond</i>; it never uses a link delay itself</td><td><code>inhibit_delay_req 1</code> (GM)</td></tr>
      <tr><td><b>Sync loss</b></td><td>syncReceiptTimeout → BMCA → maybe new GM</td><td>No new GM. The slave keeps running on its last frequency (holdover) and reports the loss (e.g. AUTOSAR StbM TIMEOUT status).</td><td><code>syncReceiptTimeout 3</code></td></tr>
      <tr><td><b>GM time jumps</b></td><td>Rare</td><td>Expected (e.g. GM resynchronises to GNSS). Slaves must step quickly; gmTimeBaseIndicator signals the change.</td><td><code>step_threshold 1</code></td></tr>
    </table></div>
    <p class="src">Paraphrased from the AVnu Automotive Profile and the linuxptp <code>configs/automotive-master.cfg</code> / <code>automotive-slave.cfg</code>. Check the specification revision your OEM references for exact values and ranges.</p>

    <h2>Startup: standard gPTP vs. Automotive Profile</h2>
    <p>Illustrative timelines for one end station after link-up. Switch between the tabs to compare.</p>
    <div class="card">
      <div class="tabs" id="tl-tabs"><button class="on" data-m="std">802.1AS default</button><button data-m="auto">Automotive Profile</button></div>
      <div id="tl" style="margin-top:12px"></div>
      <div class="out" id="tl-out" style="word-break:normal"></div>
    </div>

    <h2>Interval renegotiation with Signaling</h2>
    <div id="anim-sig"></div>

    <h2>Lab: generate a linuxptp configuration</h2>
    <div class="card lab">
      <div class="row">
        <div><label>Role of this ECU</label><select id="g-role"><option value="gm">Grandmaster (e.g. central HPC)</option><option value="br">Bridge (zone switch on Linux)</option><option value="es" selected>End station (sensor / ECU)</option></select></div>
        <div><label>Initial logSyncInterval</label><select id="g-isync"><option>-5</option><option>-4</option><option selected>-3</option></select></div>
        <div><label>operLogSyncInterval (after lock)</label><select id="g-osync"><option>-3</option><option>-2</option><option>-1</option><option selected>0</option></select></div>
        <div><label>operLogPdelayReqInterval</label><select id="g-opd"><option>0</option><option>1</option><option selected>2</option><option>3</option></select></div>
      </div>
      <div class="row">
        <div><label>Slave interface</label><input type="text" id="g-sif" value="eth0"></div>
        <div><label>Master interfaces (space-separated, bridge/GM)</label><input type="text" id="g-mif" value="sw0p2 sw0p3"></div>
      </div>
      <pre id="g-out"></pre>
    </div>
  `,
  mount: (root) => {
    const q = s => root.querySelector(s);
    // ---- timeline ----
    const T = {
      std: { max: 7000, rows: [
        ['Link up', [[0, 40, 'var(--accent-2)', 'up']]],
        ['Pdelay', [[0, 1000, 'var(--c-pd)', '#1'], [1000, 1000, 'var(--c-pd)', '#2'], [2000, 1000, 'var(--c-pd)', '#3 …']]],
        ['asCapable', [[2000, 5000, 'var(--accent-2)', 'true after NRR valid']]],
        ['Announce / BMCA', [[2000, 3000, 'var(--c-ann)', 'listening, Announce, BMCA → SLAVE']]],
        ['Sync accepted', [[5000, 2000, 'var(--c-sync)', '8/s']]],
        ['Servo', [[5000, 250, 'var(--warn)', 'step'], [5250, 1250, 'var(--c-gm)', 'converging'], [6500, 500, 'var(--accent-2)', 'locked']]],
      ], text: 'asCapable needs at least two Pdelay exchanges (neighborRateRatio), then the port listens for Announce, waits for the BMCA, and only then accepts Sync. Typical: <span class="w">3–7 s</span> to a locked clock, longer if a GM change happens on the way.' },
      auto: { max: 7000, rows: [
        ['Link up', [[0, 40, 'var(--accent-2)', 'up']]],
        ['Pdelay', [[0, 1000, 'var(--c-pd)', '#1 (background)'], [1000, 1000, 'var(--c-pd)', '#2'], [2000, 4000, 'var(--c-pd)', 'oper: every 4 s']]],
        ['asCapable', [[0, 7000, 'var(--accent-2)', 'true by configuration · stored delay']]],
        ['Announce / BMCA', [[0, 7000, 'var(--cipher)', 'none: static roles']]],
        ['Sync accepted', [[30, 1000, 'var(--c-sync)', '32/s'], [1030, 5970, 'var(--c-sync)', 'oper 1/s after Signaling']]],
        ['Servo', [[30, 90, 'var(--warn)', 'step'], [120, 400, 'var(--c-gm)', 'conv.'], [520, 6480, 'var(--accent-2)', 'locked']]],
      ], text: 'Sync is used from the first Follow_Up, with the stored link delay. The first offset steps the clock, a fast Sync rate lets the servo converge in a few hundred ms, then Signaling slows everything down. Typical: <span class="ok">≈ 100–500 ms</span>.' },
    };
    function tl(m) {
      const d = T[m];
      q('#tl').innerHTML = d.rows.map(([n, bars]) => `<div class="tl-row"><span>${n}</span><div class="tl-track">${bars.map(([a, w, c, t]) =>
        `<div class="tl-bar" style="left:${a / d.max * 100}%;width:${Math.max(.6, w / d.max * 100)}%;background:${c}">${t}</div>`).join('')}</div></div>`).join('')
        + `<div class="tl-row"><span></span><div class="muted mono" style="display:flex;justify-content:space-between;font-size:.72rem"><span>0 s</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7 s</span></div></div>`;
      q('#tl-out').innerHTML = d.text;
      root.querySelectorAll('#tl-tabs button').forEach(b => b.classList.toggle('on', b.dataset.m === m));
    }
    root.querySelectorAll('#tl-tabs button').forEach(b => b.addEventListener('click', () => tl(b.dataset.m)));
    tl('std');

    // ---- signaling animation ----
    const M = 170, S = 730;
    Course.stepper(root.querySelector('#anim-sig'), {
      title: 'Fast start, then slow down (Message Interval Request TLV)',
      svg: `
      <svg viewBox="0 0 900 330" role="img" aria-label="Signaling interval change">
        <defs><marker id="ah9" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--text)"/></marker></defs>
        <text x="${M}" y="22" text-anchor="middle" font-weight="700" font-size="13">GM / master port</text>
        <text x="${S}" y="22" text-anchor="middle" font-weight="700" font-size="13">End station / slave port</text>
        <line x1="${M}" y1="32" x2="${M}" y2="320" stroke="var(--border-2)" stroke-width="2"/><line x1="${S}" y1="32" x2="${S}" y2="320" stroke="var(--border-2)" stroke-width="2"/>
        <g id="fast" class="f">${[0, 1, 2, 3, 4].map(i => `<line x1="${M}" y1="${44 + i * 22}" x2="${S}" y2="${52 + i * 22}" stroke="var(--c-sync)" stroke-width="2" marker-end="url(#ah9)"/>`).join('')}
          <text x="450" y="38" text-anchor="middle" font-size="11" font-weight="700" style="fill:var(--c-sync)">Sync + Follow_Up every 31.25 ms (logSyncInterval −5)</text></g>
        <g id="lock" class="f"><rect x="${S + 14}" y="120" width="150" height="40" rx="6" fill="var(--accent-soft)" stroke="var(--accent-2)"/><text x="${S + 89}" y="137" text-anchor="middle" font-size="11" font-weight="700" style="fill:var(--accent-2)">servo locked &amp; stable</text><text x="${S + 89}" y="152" text-anchor="middle" font-size="10" class="t-muted">N offsets &lt; threshold</text></g>
        <g id="sig" class="f"><line x1="${S}" y1="170" x2="${M}" y2="196" stroke="var(--c-ann)" stroke-width="2.5" marker-end="url(#ah9)"/><text x="450" y="174" text-anchor="middle" font-size="11" font-weight="700" style="fill:var(--c-ann)">Signaling { timeSyncInterval = 0, linkDelayInterval = −128 (no change) }</text></g>
        <g id="slow" class="f">${[0, 1].map(i => `<line x1="${M}" y1="${220 + i * 60}" x2="${S}" y2="${228 + i * 60}" stroke="var(--c-sync)" stroke-width="2" marker-end="url(#ah9)"/>`).join('')}
          <text x="450" y="216" text-anchor="middle" font-size="11" font-weight="700" style="fill:var(--c-sync)">Sync + Follow_Up every 1 s (operLogSyncInterval 0)</text></g>
        <g id="pd" class="f"><text x="${S + 14}" y="250" font-size="11" style="fill:var(--c-pd)" font-weight="700">Pdelay: slave switches</text><text x="${S + 14}" y="264" font-size="11" style="fill:var(--c-pd)" font-weight="700">its own interval locally</text></g>
        <g id="loss" class="f"><text x="450" y="312" text-anchor="middle" font-size="11" font-weight="700" style="fill:var(--bad)">link down / sync lost → both sides return to the initial intervals</text></g>
      </svg>`,
      steps: [
        { caption: 'Right after link-up the master sends Sync at the fast <b>initial</b> rate, so the slave gets many samples quickly.', do: s => s.show('fast') },
        { caption: 'The slave\'s servo reaches a stable lock: the last <code>servo_num_offset_values</code> offsets are all below <code>servo_offset_threshold</code>.', do: s => s.show('lock') },
        { caption: 'The slave sends a <b>Signaling</b> message with a Message Interval Request TLV asking for the <b>operational</b> Sync interval. The value −128 means "don\'t change", 126 "back to initial", 127 "stop".', do: s => s.show('sig') },
        { caption: 'The master switches to the slower rate. This reduces CPU and bus load across the vehicle network while time is maintained. The Pdelay interval is changed locally by the initiator; no message is needed.', do: s => s.show(['slow', 'pd']) },
        { caption: 'On link loss, a sync timeout or a restart, both sides fall back to the initial (fast) intervals so the next start is fast again.', do: s => s.show('loss') },
      ]
    });

    // ---- config generator ----
    function gen() {
      const role = q('#g-role').value, isync = q('#g-isync').value, osync = q('#g-osync').value, opd = q('#g-opd').value;
      const sif = q('#g-sif').value.trim() || 'eth0', mifs = q('#g-mif').value.trim().split(/\s+/).filter(Boolean);
      const common = `[global]
# --- carried over from gPTP (802.1AS) ---
gmCapable               1
priority1               248
priority2               248
logSyncInterval         ${isync}
syncReceiptTimeout      3
neighborPropDelayThresh 800
min_neighbor_prop_delay -20000000
assume_two_step         1
path_trace_enabled      1
follow_up_info          1
transportSpecific       0x1
ptp_dst_mac             01:80:C2:00:00:0E
network_transport       L2
delay_mechanism         P2P
# --- Automotive Profile: static roles, no Announce ---
BMCA                    noop
inhibit_announce        1
asCapable               true
`;
      let cfg, cmd;
      if (role === 'gm') {
        const ports = mifs.length ? mifs : [sif];
        cfg = common + `inhibit_delay_req       1      # GM only responds to Pdelay\n\n` + ports.map(i => `[${i}]\nserverOnly              1\n`).join('\n');
        cmd = `ptp4l -f gm.cfg ${(mifs.length ? mifs : [sif]).map(i => '-i ' + i).join(' ')} -m`;
      } else if (role === 'es') {
        cfg = common + `clientOnly              1
ignore_source_id        1      # no Announce, so the GM identity is unknown
step_threshold          1      # step on GM time jumps > 1 s
operLogSyncInterval     ${osync}
operLogPdelayReqInterval ${opd}
msg_interval_request    1
servo_offset_threshold  30
servo_num_offset_values 10
`;
        cmd = `ptp4l -f es.cfg -i ${sif} -m\nphc2sys -s ${sif} -c CLOCK_REALTIME -O 0 -m   # optional: system clock follows the PHC`;
      } else {
        cfg = common + `clientOnly              1      # all ports default to slave …
ignore_source_id        1
step_threshold          1
operLogSyncInterval     ${osync}
operLogPdelayReqInterval ${opd}
msg_interval_request    1
servo_offset_threshold  30
servo_num_offset_values 10

[${sif}]
# upstream (towards the GM): slave
` + mifs.map(i => `\n[${i}]\nserverOnly              1      # … except the master ports\n`).join('');
        cmd = `ptp4l -f br.cfg -i ${sif} ${mifs.map(i => '-i ' + i).join(' ')} -m   # all ports must share one PHC (else boundary_clock_jbod 1)`;
      }
      q('#g-out').innerHTML = `<span class="c"># ${role === 'gm' ? 'gm' : role === 'es' ? 'es' : 'br'}.cfg (generated)</span>\n` + Course.esc(cfg).replace(/(#[^\n]*)/g, '<span class="c">$1</span>') + `\n<span class="c"># run</span>\n<span class="k">${Course.esc(cmd)}</span>`;
    }
    ['#g-role', '#g-isync', '#g-osync', '#g-opd', '#g-sif', '#g-mif'].forEach(i => q(i).addEventListener('input', gen)); gen();
  }
});
