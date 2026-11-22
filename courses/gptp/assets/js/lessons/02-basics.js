Course.register({
  id: 'basics',
  title: 'gPTP building blocks',
  section: 'Foundations',
  minutes: 15,
  render: () => `
    <h1>gPTP building blocks</h1>
    <p>Before looking at bytes and timestamps, fix the vocabulary. 802.1AS-2020 renamed some objects (a "time-aware
    system" may now contain several <b>PTP Instances</b>, one per domain), but the ideas are the same as in 2011.</p>

    <div class="table-wrap"><table>
      <tr><th style="width:210px">Object</th><th>Meaning</th></tr>
      <tr><td><b>Time-aware system</b></td><td>Any device taking part in gPTP: a <b>time-aware end station</b> (one port) or a <b>time-aware bridge</b> (several ports). In 2020 terms: a PTP End Instance or a PTP Relay Instance.</td></tr>
      <tr><td><b>Grandmaster (GM)</b></td><td>The single source of time in a <b>gPTP domain</b>. Chosen by the BMCA (standard gPTP) or by configuration (automotive).</td></tr>
      <tr><td><b>gPTP domain</b></td><td>A set of systems that share one GM and one time. 2011: only domain 0. 2020: domain numbers 0–127, so a car can run, for example, a working-clock domain and a redundant or a global (GNSS) domain in parallel.</td></tr>
      <tr><td><b>Port roles</b></td><td><b>Master</b> (sends Sync down the tree), <b>Slave</b> (receives time from upstream, at most one per instance), <b>Passive</b> (would create a loop), <b>Disabled</b>.</td></tr>
      <tr><td><b>Synchronization tree</b></td><td>The spanning tree formed by master→slave links from the GM. It is independent of the data-plane spanning tree (RSTP/MSTP), and gPTP frames never pass through a bridge unchanged.</td></tr>
      <tr><td><b>asCapable</b></td><td>Per-port flag: "the neighbour on this link runs 802.1AS and the link delay is plausible". Sync is only sent and accepted on asCapable ports.</td></tr>
      <tr><td><b>LocalClock / PHC</b></td><td>The free-running hardware counter that timestamps frames. Its frequency differs from the GM's. gPTP measures that ratio instead of assuming it is 1.</td></tr>
    </table></div>

    <h2>The four message families</h2>
    <div class="grid2">
      <div class="card"><span class="pill sync">Sync</span> + <span class="pill fu">Follow_Up</span><br><span class="muted">Carry the GM time down the tree. Sync is an <b>event</b> message (timestamped); Follow_Up carries the precise origin timestamp, correction and rate ratio. Default 8 per second (logSyncInterval = −3).</span></div>
      <div class="card"><span class="pill pd">Pdelay_Req / Resp / Resp_Follow_Up</span><br><span class="muted">Measure the cable delay and the neighbour's frequency ratio on <b>every link</b>, independent of Sync. Default once per second.</span></div>
      <div class="card"><span class="pill ann">Announce</span><br><span class="muted">Advertises the GM's quality (priority1, clockClass, …) and the path. Input to the BMCA. Default once per second. Not used by the automotive profile.</span></div>
      <div class="card"><span class="pill ann">Signaling</span><br><span class="muted">Asks the neighbour to change message intervals (Message Interval Request TLV). The automotive profile uses it to slow Sync after startup. 2020 adds the gPTP-capable TLV.</span></div>
    </div>

    <h2>Two-step synchronization: Sync then Follow_Up</h2>
    <div id="anim-sync"></div>

    <div class="callout"><b>Synchronize vs. syntonize</b>
      <b>Syntonization</b> means matching <i>frequency</i>: my second is as long as the GM's second. <b>Synchronization</b> means
      matching <i>phase</i>: my clock reads the same value as the GM's at the same instant. gPTP explicitly measures frequency
      ratios (neighborRateRatio per link, rateRatio cumulative) so that a bridge does not have to discipline its own oscillator
      to compute GM time correctly. That is the key difference from a classic 1588 boundary clock (lesson 8).</div>

    <h2>Lab: compute the slave offset</h2>
    <p>The slave knows its own ingress timestamp <code>t2</code>, the GM origin time <code>t1</code> and the accumulated
    <code>correctionField</code> from the Follow_Up, and the delay of its own upstream link from Pdelay.</p>
    <div class="card lab">
      <div class="row">
        <div><label>preciseOriginTimestamp (t1) [ns, GM time]</label><input type="number" id="o-t1" value="1000000000"></div>
        <div><label>Follow_Up correctionField [ns]</label><input type="number" id="o-corr" value="1250.5" step="0.1"></div>
      </div>
      <div class="row">
        <div><label>Upstream meanLinkDelay [ns]</label><input type="number" id="o-dly" value="215" step="0.1"></div>
        <div><label>Sync ingress timestamp (t2) [ns, local time]</label><input type="number" id="o-t2" value="1000002000"></div>
      </div>
      <div class="out" id="o-out"></div>
    </div>

    <h2>Message intervals are powers of two</h2>
    <p>Every interval is carried as a signed 8-bit <b>log₂ of seconds</b> (<code>logMessageInterval</code> in the header).</p>
    <div class="card lab">
      <label>logMessageInterval: <b id="li-v">-3</b></label>
      <input type="range" id="li" min="-7" max="4" value="-3">
      <div class="out" id="li-out"></div>
    </div>
    <div class="table-wrap"><table>
      <tr><th>Parameter (802.1AS defaults)</th><th>Value</th><th>Meaning</th></tr>
      <tr><td>initialLogSyncInterval</td><td>−3</td><td>125 ms, 8 Sync per second</td></tr>
      <tr><td>initialLogPdelayReqInterval</td><td>0</td><td>1 s</td></tr>
      <tr><td>initialLogAnnounceInterval</td><td>0</td><td>1 s</td></tr>
      <tr><td>syncReceiptTimeout</td><td>3</td><td>Missing 3 Sync intervals → the slave considers the GM lost</td></tr>
      <tr><td>announceReceiptTimeout</td><td>3</td><td>3 Announce intervals</td></tr>
      <tr><td>allowedLostResponses</td><td>3 (2011) · 9 (2020)</td><td>Pdelay responses that may be missed before asCapable drops</td></tr>
      <tr><td>allowedFaults</td><td>9 (2020)</td><td>Pdelay faults tolerated (e.g. delay above threshold) before asCapable drops</td></tr>
      <tr><td>neighborPropDelayThresh</td><td>800 ns</td><td>For 802.3 copper/fibre links; above this the link is not asCapable</td></tr>
    </table></div>
  `,
  mount: (root) => {
    const M = 230, S = 670;
    Course.stepper(root.querySelector('#anim-sync'), {
      title: 'Sync, Follow_Up and the offset calculation',
      svg: `
      <svg viewBox="0 0 900 340" role="img" aria-label="Two-step sync timing diagram">
        <text x="${M}" y="24" text-anchor="middle" font-weight="700" font-size="13">Master port (GM time)</text>
        <text x="${S}" y="24" text-anchor="middle" font-weight="700" font-size="13">Slave port (local time)</text>
        <line x1="${M}" y1="36" x2="${M}" y2="320" stroke="var(--border-2)" stroke-width="2"/>
        <line x1="${S}" y1="36" x2="${S}" y2="320" stroke="var(--border-2)" stroke-width="2"/>
        <text x="${M - 14}" y="330" text-anchor="end" font-size="10" class="t-muted">time ↓</text>

        <g id="sync" class="f"><line x1="${M}" y1="70" x2="${S}" y2="120" stroke="var(--c-sync)" stroke-width="2.5" marker-end="url(#ah)"/>
          <text x="450" y="80" text-anchor="middle" font-size="12" font-weight="700" style="fill:var(--c-sync)">Sync (event message)</text></g>
        <g id="t1" class="f"><circle cx="${M}" cy="70" r="6" class="ts-dot"/><text x="${M - 12}" y="74" text-anchor="end" font-size="12" class="mono" style="fill:var(--c-ts)">t1 (egress)</text></g>
        <g id="t2" class="f"><circle cx="${S}" cy="120" r="6" class="ts-dot"/><text x="${S + 12}" y="124" font-size="12" class="mono" style="fill:var(--c-ts)">t2 (ingress)</text></g>
        <g id="tsu" class="f"><text x="${M - 12}" y="90" text-anchor="end" font-size="10" class="t-muted">HW, at the SFD</text></g>

        <g id="fu" class="f"><line x1="${M}" y1="150" x2="${S}" y2="200" stroke="var(--c-fu)" stroke-width="2.5" marker-end="url(#ah)"/>
          <text x="450" y="146" text-anchor="middle" font-size="12" font-weight="700" style="fill:var(--c-fu)">Follow_Up { preciseOriginTimestamp = t1, correctionField, rateRatio }</text></g>

        <g id="pd" class="f"><rect x="${S + 10}" y="215" width="150" height="34" rx="6" fill="var(--panel-2)" stroke="var(--c-pd)"/>
          <text x="${S + 85}" y="236" text-anchor="middle" font-size="11" style="fill:var(--c-pd)" font-weight="700">meanLinkDelay (Pdelay)</text></g>

        <g id="calc" class="f"><rect x="210" y="260" width="480" height="54" rx="8" fill="var(--accent-soft)" stroke="var(--accent)"/>
          <text x="450" y="282" text-anchor="middle" font-size="13" class="mono" font-weight="700">GM time at t2 = t1 + correction + linkDelay</text>
          <text x="450" y="302" text-anchor="middle" font-size="13" class="mono">offset = t2 − (t1 + correction + linkDelay)</text></g>
        <defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--text)"/></marker></defs>
      </svg>`,
      steps: [
        { caption: 'Master and slave each have a clock. Time runs downwards. Diagonal arrows are frames on the wire; the slope is the propagation delay (exaggerated).', do: s => {} },
        { caption: 'The master sends <b>Sync</b>. Its hardware records the exact instant the frame left, <code>t1</code>, in the master\'s clock. In two-step mode the Sync itself carries no useful timestamp, because <code>t1</code> is only known after the frame has started leaving.',
          do: s => { s.show(['sync', 't1', 'tsu']); } },
        { caption: 'The slave\'s hardware records the arrival instant <code>t2</code>, in its own clock.',
          do: s => s.show('t2') },
        { caption: 'The master then sends <b>Follow_Up</b> carrying <code>t1</code> as <code>preciseOriginTimestamp</code>, plus the <code>correctionField</code> (time spent in bridges and on upstream links) and the cumulative <code>rateRatio</code>. Follow_Up is a general message: it is not timestamped.',
          do: s => s.show('fu') },
        { caption: 'The cable delay from master to slave is not in the Sync. The slave measures it separately with <b>Pdelay</b> on this link (lesson 6).',
          do: s => s.show('pd') },
        { caption: 'Now the slave knows what the GM clock read when the Sync arrived, and the difference to its own clock is the <b>offset</b>. A servo (usually PI) steers the local clock to drive the offset to zero, adjusting frequency and occasionally stepping phase.',
          do: s => s.show('calc') },
      ]
    });

    // offset lab
    const g = id => root.querySelector(id);
    const ids = ['#o-t1', '#o-corr', '#o-dly', '#o-t2'];
    function calc() {
      const [t1, corr, dly, t2] = ids.map(i => parseFloat(g(i).value) || 0);
      const gm = t1 + corr + dly;
      const off = PTPMath.offsetFromMaster({ syncIngress: t2, preciseOrigin: t1, correction: corr, linkDelay: dly });
      g('#o-out').innerHTML = `<span class="k">GM time when Sync arrived</span> = ${t1} + ${corr} + ${dly} = ${gm.toFixed(1)} ns
<span class="k">Local time at that instant</span>  = ${t2} ns
<span class="k">offsetFromMaster</span>           = ${off >= 0 ? '+' : ''}${off.toFixed(1)} ns  → local clock is ${off > 0 ? '<span class="w">ahead</span> of' : off < 0 ? '<span class="w">behind</span>' : '<span class="ok">exactly on</span>'} the GM
` + (Math.abs(off) > 20000 ? '<span class="w">|offset| > 20 µs: on the first update ptp4l steps the clock (first_step_threshold). Later it only steps if step_threshold is set (the automotive client config uses 1 s); otherwise it slews.</span>' : '<span class="ok">Small offset: the servo slews the frequency (no step).</span>');
    }
    ids.forEach(i => g(i).addEventListener('input', calc)); calc();

    const li = g('#li'), lv = g('#li-v'), lo = g('#li-out');
    function li_() {
      const l = +li.value, ms = PTPMath.logToMs(l);
      lv.textContent = l;
      lo.innerHTML = `interval = 2^${l} s = <span class="ok">${ms >= 1000 ? (ms / 1000) + ' s' : ms + ' ms'}</span>   → ${(1000 / ms).toFixed(ms > 1000 ? 3 : 0)} messages per second\nhex in header: 0x${((l + 256) % 256).toString(16).padStart(2, '0').toUpperCase()}   \nSpecial values in a Signaling interval request: 127 = stop sending, 126 = return to the initial value, −128 = no change`;
    }
    li.addEventListener('input', li_); li_();
  }
});
