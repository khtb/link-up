Course.register({
  id: 'timestamping',
  title: 'Timestamping: when and how',
  section: 'Timestamping',
  minutes: 25,
  render: () => `
    <h1>Timestamping: when and how</h1>
    <p>Everything in gPTP depends on one measurement: <i>the instant a frame crossed a well-defined point</i>. A protocol
    exchange can only be as good as its timestamps. This lesson answers three questions: <b>which</b> frames are
    timestamped, <b>when</b> exactly (the message timestamp point), and <b>how</b> (where in the stack, one-step or two-step).</p>

    <h2>Which frames: event vs. general messages</h2>
    <div class="grid2">
      <div class="card"><b>Event messages: timestamped on TX and RX</b><br>
        <span class="pill sync">Sync</span> <span class="pill pd">Pdelay_Req</span> <span class="pill pd">Pdelay_Resp</span>
        <p class="muted" style="margin:.5em 0 0">messageType 0x0–0x3 (Delay_Req, 0x1, is not used by gPTP). Hardware filters such as
        <code>HWTSTAMP_FILTER_PTP_V2_L2_EVENT</code> match exactly these.</p></div>
      <div class="card"><b>General messages: never timestamped</b><br>
        <span class="pill fu">Follow_Up</span> <span class="pill pd">Pdelay_Resp_Follow_Up</span> <span class="pill ann">Announce</span> <span class="pill ann">Signaling</span>
        <p class="muted" style="margin:.5em 0 0">They carry timestamps taken earlier, so their own transit time doesn't matter.</p></div>
    </div>

    <h2>When: the message timestamp point</h2>
    <p>IEEE 1588 and 802.1AS define the timestamp as the instant the <b>message timestamp point</b> (the leading edge of the
    <b>first bit after the Start Frame Delimiter</b>) passes the <b>reference plane</b>, the boundary between the node and the
    medium (the MDI, i.e. the connector). Hardware rarely sits exactly there, so implementations measure somewhere else and
    correct by a known latency.</p>

    <div id="anim-tsp"></div>

    <div class="callout warn"><b>Why "after the SFD"?</b>
      The preamble is used by the receiver to lock its clock recovery and may be shortened, regenerated or (on some PHYs) partly
      consumed. The SFD is the first unambiguous, repeatable event in the frame. Timestamping "on the SFD" also means the
      timestamp is independent of frame length, which is why Pdelay_Req is padded to the same length as Pdelay_Resp: the
      latency through PHY FIFOs then stays symmetric.</div>

    <h2>How: where the timestamp is taken</h2>
    <div class="table-wrap"><table>
      <tr><th>Location</th><th>Mechanism</th><th>Error sources</th><th>Typical accuracy</th></tr>
      <tr><td><b>Software</b> (kernel)</td><td><code>skb_tx_timestamp()</code> in the driver before DMA, and on RX when the driver processes the packet. Clock: CLOCK_REALTIME.</td><td>Interrupt latency, NAPI, queuing, DMA, cache misses, scheduler.</td><td>1–100 µs</td></tr>
      <tr><td><b>MAC</b> (TSU in the Ethernet controller)</td><td>A Time Stamp Unit watches the (R)(G/X)MII and latches the PHC counter when the SFD passes.</td><td>PHY latency (often hundreds of ns) and its variation, PHC resolution.</td><td>5–50 ns</td></tr>
      <tr><td><b>PHY</b> (PTP-capable PHY)</td><td>The PHY latches its own PHC close to the line, after PCS/PMA.</td><td>Residual PHY latency variation (sub-ns to few ns), PHY ↔ MAC clock sync if two PHCs exist.</td><td>1–10 ns</td></tr>
      <tr><td><b>Switch port</b></td><td>Per-port TSU in the switch MAC, usually one PHC for all ports.</td><td>Same as MAC timestamping; internal PHYs can be calibrated at design time.</td><td>5–20 ns</td></tr>
    </table></div>

    <h2>Two-step transmit timestamps, step by step (Linux)</h2>
    <p>The hard part of hardware timestamping is on the transmit side. The timestamp only exists after the frame started
    leaving, so it must travel <i>back up</i> to the application.</p>
    <div id="anim-twostep"></div>

    <h2>One-step: write the timestamp into the frame on the fly</h2>
    <div class="grid2">
      <div class="card"><b>One-step Sync</b> <span class="tag">802.1AS-2020, optional</span><br><span class="muted">
        The TSU latches the time at the SFD, and a <b>timestamp insertion unit</b> overwrites the <code>originTimestamp</code> field
        (or adds to <code>correctionField</code>) while the bytes are still being serialized, then recomputes the FCS (and the UDP checksum for
        1588-over-UDP). No Follow_Up is needed, and there's no TX timestamp path back to software. Linux: <code>HWTSTAMP_TX_ONESTEP_SYNC</code>,
        ptp4l <code>time_stamping onestep</code>.</span></div>
      <div class="card"><b>One-step P2P</b><br><span class="muted">
        A one-step <b>Pdelay responder</b> sends no Resp_Follow_Up. It puts the turnaround time <code>t3 − t2</code> into the
        Pdelay_Resp <code>correctionField</code> on the fly. Linux: <code>HWTSTAMP_TX_ONESTEP_P2P</code>, ptp4l <code>time_stamping p2p1step</code>.
        In 2020 a port advertises <code>oneStepReceiveCapable</code> in Signaling so the neighbour knows it may send one-step.</span></div>
    </div>
    <div class="table-wrap"><table>
      <tr><th></th><th>Two-step</th><th>One-step</th></tr>
      <tr><td>Messages per sync</td><td>Sync + Follow_Up</td><td>Sync only</td></tr>
      <tr><td>Hardware complexity</td><td>Latch + FIFO / register</td><td>Latch + on-the-fly field rewrite + FCS recompute</td></tr>
      <tr><td>Software load</td><td>Must fetch every TX timestamp (risk: <code>timed out while polling for tx timestamp</code>)</td><td>None on TX</td></tr>
      <tr><td>Residence time in a bridge</td><td>Can be long; the Follow_Up waits for the TX timestamp</td><td>Short; relevant for 2020 syncLocked operation</td></tr>
      <tr><td>802.1AS-2011</td><td>Mandatory</td><td>Not supported</td></tr>
      <tr><td>802.1AS-2020</td><td>Must always be able to <b>receive</b> two-step</td><td>Optional TX, negotiated</td></tr>
    </table></div>

    <h2>Lab: per-hop timestamp error budget</h2>
    <p>A rough model. Random errors add as root-sum-square across hops, static asymmetries add linearly. It is meant for
    building intuition, not for sign-off.</p>
    <div class="card lab">
      <div class="row">
        <div><label>Timestamp location</label><select id="eb-loc">
          <option value="sw">Software (kernel)</option><option value="mac">MAC TSU</option><option value="phy" selected>PTP PHY</option><option value="sw-switch">Switch port TSU</option></select></div>
        <div><label>PHC clock [MHz] (timestamp granularity)</label><input type="number" id="eb-f" value="250" min="1" max="2000"></div>
        <div><label>Hops from GM</label><input type="number" id="eb-n" value="3" min="1" max="10"></div>
      </div>
      <div class="row">
        <div><label>Uncompensated TX/RX latency difference per link [ns]</label><input type="number" id="eb-asym" value="4" step="any"></div>
        <div><label>Local oscillator wander during a Sync interval [ppb]</label><input type="number" id="eb-ppb" value="20" step="any"></div>
        <div><label>logSyncInterval</label><input type="number" id="eb-log" value="-3" min="-7" max="3"></div>
      </div>
      <label class="chk"><input type="checkbox" id="eb-interp"> Sub-cycle interpolation in the TSU (e.g. multi-phase sampling)</label>
      <div class="out" id="eb-out"></div>
    </div>
  `,
  mount: (root) => {
    const box = (id, x, w, t, sub, c = 'var(--node-stroke)') => `<g id="${id}"><rect class="node" x="${x}" y="40" width="${w}" height="58" rx="7" style="stroke:${c}"/><text x="${x + w / 2}" y="64" text-anchor="middle" font-size="12" font-weight="700">${t}</text><text x="${x + w / 2}" y="82" text-anchor="middle" font-size="10" class="t-muted">${sub}</text></g>`;
    const tap = (id, x, label, c, y = 118) => `<g id="${id}" class="f"><line x1="${x}" y1="100" x2="${x}" y2="${y + 92}" stroke="${c}" stroke-width="2" stroke-dasharray="4 3"/><circle cx="${x}" cy="${y + 92}" r="5" fill="${c}"/><text x="${x}" y="${y + 110}" text-anchor="middle" font-size="11" font-weight="700" style="fill:${c}">${label}</text></g>`;
    Course.stepper(root.querySelector('#anim-tsp'), {
      title: 'A Sync frame on its way to the wire, and where it can be timestamped',
      svg: `
      <svg viewBox="0 0 900 270" role="img" aria-label="Timestamp points along the transmit path">
        ${box('b-app', 10, 92, 'ptp4l', 'user space')}
        ${box('b-krn', 112, 92, 'Kernel', 'socket, qdisc')}
        ${box('b-drv', 214, 92, 'Driver', 'DMA ring')}
        ${box('b-mac', 316, 130, 'MAC + TSU', 'adds preamble/SFD')}
        ${box('b-phy', 486, 150, 'PHY', 'PCS · PMA · (MACsec?)')}
        <line x1="466" y1="30" x2="466" y2="108" stroke="var(--border-2)" stroke-width="2"/><text x="466" y="24" text-anchor="middle" font-size="10" class="t-muted">xMII</text>
        <line id="mdi" x1="656" y1="22" x2="656" y2="112" stroke="var(--accent)" stroke-width="3"/><text x="656" y="16" text-anchor="middle" font-size="11" font-weight="700" style="fill:var(--accent)">MDI = reference plane</text>
        <path class="wire" d="M656,69 L890,69"/><text x="770" y="60" text-anchor="middle" font-size="10" class="t-muted">cable</text>

        <g id="frm" class="mv">
          <rect x="20" y="124" width="46" height="22" rx="3" fill="var(--fcs)"/><text x="43" y="139" text-anchor="middle" font-size="9" style="fill:#fff">preamble</text>
          <rect x="66" y="124" width="14" height="22" fill="var(--c-ts)"/><text x="73" y="139" text-anchor="middle" font-size="9" style="fill:#fff">S</text>
          <rect x="80" y="124" width="78" height="22" rx="3" fill="var(--c-sync)"/><text x="119" y="139" text-anchor="middle" font-size="9" style="fill:#fff">DA SA 88F7 Sync…</text>
        </g>
        ${tap('tap-sw', 160, 'SW ts', 'var(--warn)')}
        ${tap('tap-mac', 456, 'MAC ts', 'var(--c-gm)')}
        ${tap('tap-phy', 640, 'PHY ts', 'var(--accent-2)')}
        <g id="lat" class="f"><path d="M466,166 L656,166" stroke="var(--c-ts)" stroke-width="2" marker-start="url(#ah4)" marker-end="url(#ah4)"/><text x="561" y="160" text-anchor="middle" font-size="11" font-weight="700" style="fill:var(--c-ts)">egressLatency (PHY TX)</text></g>
        <g id="jit" class="f"><text x="160" y="250" text-anchor="middle" font-size="10" class="t-muted">± µs jitter</text></g>
        <g id="ideal" class="f"><text x="760" y="250" text-anchor="middle" font-size="12" font-weight="700" style="fill:var(--accent)">t = instant SFD's next bit crosses the MDI</text></g>
        <defs><marker id="ah4" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--c-ts)"/></marker></defs>
      </svg>`,
      steps: [
        { caption: 'The transmit path: ptp4l builds a Sync and calls <code>sendmsg()</code>. The frame passes the kernel, the driver and DMA, then the MAC serializes it onto the xMII towards the PHY, which drives the cable. The <b>reference plane</b> is the MDI.',
          do: s => {} },
        { caption: '<b>Software timestamp</b>: the driver calls <code>skb_tx_timestamp()</code> just before handing the frame to DMA. The frame still has to wait in the DMA ring and the MAC FIFO, so the real departure is microseconds later, and varies.',
          do: s => { s.move('frm', 160, 0); s.show(['tap-sw', 'jit']); } },
        { caption: 'The MAC adds <b>preamble and SFD</b> and serializes the frame onto the xMII. Its <b>Time Stamp Unit</b> detects the SFD and latches the PHC counter in the same clock cycle: a <b>MAC timestamp</b>.',
          do: s => { s.move('frm', 382, 0); s.show('tap-mac'); s.hl('b-mac'); } },
        { caption: 'The frame still has to cross the PHY: PCS encoding, scrambling, FIFOs and maybe a <b>MACsec engine</b> in the PHY. This <b>egress latency</b> must be added to the MAC timestamp (ptp4l: <code>egressLatency</code>, or the driver compensates). If the latency varies (FIFO fill, MACsec queuing), the error shows up directly in the time.',
          do: s => { s.move('frm', 540, 0); s.show('lat'); s.unhl('b-mac'); s.hl('b-phy'); } },
        { caption: 'A <b>PTP-capable PHY</b> latches its own clock right next to the line, after all variable stages, so it is the closest practical point to the reference plane, with only a small, fixed latency left.',
          do: s => { s.move('frm', 570, 0); s.show('tap-phy'); s.unhl('b-phy'); } },
        { caption: 'What the protocol <i>means</i> by the timestamp: the instant the first bit after the SFD crosses the MDI. Whatever the location, the reported value must be corrected to this point. RX is the mirror image: subtract <code>ingressLatency</code>.',
          do: s => { s.move('frm', 600, 0); s.show('ideal'); s.hl('mdi'); } },
      ]
    });

    // two-step path
    const lane = (y, t) => `<text x="12" y="${y + 4}" font-size="11" font-weight="700">${t}</text><line x1="110" y1="${y}" x2="890" y2="${y}" stroke="var(--border)" stroke-width="1.5"/>`;
    const ev = (id, x, y, w, t, c) => `<g id="${id}" class="f"><rect x="${x}" y="${y - 13}" width="${w}" height="26" rx="5" fill="${c}"/><text x="${x + w / 2}" y="${y + 4}" text-anchor="middle" font-size="10" style="fill:#fff" font-weight="700">${t}</text></g>`;
    const arr = (id, x1, y1, x2, y2) => `<path id="${id}" class="f" d="M${x1},${y1} L${x2},${y2}" stroke="var(--text)" stroke-width="1.5" marker-end="url(#ah5)" fill="none"/>`;
    const Y = { app: 40, krn: 95, drv: 150, hw: 205, wire: 255 };
    Course.stepper(root.querySelector('#anim-twostep'), {
      title: 'The TX timestamp round trip in a two-step sender',
      svg: `
      <svg viewBox="0 0 900 280" role="img" aria-label="Two-step TX timestamp path">
        <defs><marker id="ah5" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--text)"/></marker></defs>
        ${lane(Y.app, 'ptp4l')}${lane(Y.krn, 'kernel')}${lane(Y.drv, 'driver')}${lane(Y.hw, 'MAC / TSU')}${lane(Y.wire, 'wire')}
        ${ev('e1', 120, Y.app, 120, 'sendmsg(Sync)', 'var(--c-sync)')}
        ${arr('a1', 180, Y.app + 13, 180, Y.krn - 13)}
        ${ev('e2', 140, Y.krn, 150, 'SKBTX_HW_TSTAMP set', 'var(--plain-2)')}
        ${arr('a2', 215, Y.krn + 13, 250, Y.drv - 13)}
        ${ev('e3', 220, Y.drv, 160, 'descriptor: "stamp me"', 'var(--plain-2)')}
        ${arr('a3', 300, Y.drv + 13, 340, Y.hw - 13)}
        ${ev('e4', 330, Y.hw, 130, 'SFD → latch PHC', 'var(--c-ts)')}
        ${ev('e4w', 330, Y.wire, 130, 'Sync on the wire', 'var(--c-sync)')}
        ${arr('a5', 460, Y.hw - 13, 490, Y.drv + 13)}
        ${ev('e5', 470, Y.drv, 160, 'IRQ / poll: read TS reg', 'var(--c-ts)')}
        ${arr('a6', 560, Y.drv - 13, 590, Y.krn + 13)}
        ${ev('e6', 560, Y.krn, 170, 'skb_tstamp_tx → errqueue', 'var(--plain-2)')}
        ${arr('a7', 660, Y.krn - 13, 690, Y.app + 13)}
        ${ev('e7', 650, Y.app, 150, 'recvmsg(MSG_ERRQUEUE)', 'var(--c-ts)')}
        ${ev('e8', 760, Y.wire, 120, 'Follow_Up(t1)', 'var(--c-fu)')}
        ${arr('a8', 800, Y.app + 13, 820, Y.wire - 13)}
        <g id="to" class="f"><text x="725" y="${Y.drv + 4}" text-anchor="middle" font-size="11" font-weight="700" style="fill:var(--bad)">tx_timestamp_timeout (10 ms)</text></g>
      </svg>`,
      steps: [
        { caption: 'Five layers take part. Each box appears in the order things happen; horizontal position is time.', do: s => {} },
        { caption: 'ptp4l opened its socket with <code>SO_TIMESTAMPING</code> (<code>SOF_TIMESTAMPING_TX_HARDWARE | RAW_HARDWARE</code>) and sends the Sync.',
          do: s => s.show(['e1', 'a1', 'e2']) },
        { caption: 'The driver sees the flag and asks the hardware for a timestamp: a bit in the TX descriptor, or a PTP-aware classifier that recognises the frame by itself.',
          do: s => s.show(['a2', 'e3', 'a3']) },
        { caption: 'When the SFD goes out, the TSU latches the PHC into a TX timestamp register or FIFO, tagged with an ID or the sequenceId so it can be matched to the frame.',
          do: s => s.show(['e4', 'e4w']) },
        { caption: 'Some time later the driver collects it (completion interrupt, polling worker, or over MDIO/SPI for an external PHY or switch, which can take milliseconds) and attaches it to the original skb.',
          do: s => s.show(['a5', 'e5']) },
        { caption: 'The kernel queues a copy of the frame plus the timestamp on the socket\'s <b>error queue</b>. ptp4l reads it with <code>recvmsg(MSG_ERRQUEUE)</code> and gets <code>t1</code> in an <code>SCM_TIMESTAMPING</code> control message.',
          do: s => s.show(['a6', 'e6', 'a7', 'e7']) },
        { caption: 'Only now can ptp4l send the <b>Follow_Up</b> carrying t1. If the timestamp doesn\'t arrive within <code>tx_timestamp_timeout</code>, ptp4l logs <i>"timed out while polling for tx timestamp"</i> and faults the port, the most common hardware-timestamping problem in the field.',
          do: s => s.show(['e8', 'a8', 'to']) },
      ]
    });

    // error budget
    const q = s => root.querySelector(s);
    const ids = ['#eb-loc', '#eb-f', '#eb-n', '#eb-asym', '#eb-ppb', '#eb-log', '#eb-interp'];
    const JIT = { sw: 8000, mac: 6, phy: 1, 'sw-switch': 3 };   // ns RMS of location-dependent noise
    function eb() {
      const loc = q('#eb-loc').value, f = Math.max(1, +q('#eb-f').value), n = Math.max(1, +q('#eb-n').value | 0);
      const asym = Math.abs(+q('#eb-asym').value || 0), ppb = Math.abs(+q('#eb-ppb').value || 0), log = +q('#eb-log').value;
      const period = 1000 / f, interp = q('#eb-interp').checked;
      const quant = (interp ? period / 8 : period) / Math.sqrt(12);
      const tsRms = Math.hypot(quant, JIT[loc]);                // one timestamp
      const syncRms = Math.SQRT2 * tsRms;                      // egress + ingress
      const pdRms = tsRms;                                     // 4 timestamps / 2, filtered → roughly one
      const hopRand = Math.hypot(syncRms, pdRms);
      const drift = ppb * 1e-9 * PTPMath.logToMs(log) * 1e6;    // ns lost between two Syncs
      const totRand = hopRand * Math.sqrt(n), totStatic = asym / 2 * n;
      const total = 3 * totRand + totStatic + drift;
      const verdict = total < 100 ? '<span class="ok">excellent (< 100 ns)</span>' : total < 1000 ? '<span class="ok">within the 802.1AS 1 µs target</span>' : '<span class="bad">exceeds the 1 µs target</span>';
      q('#eb-out').innerHTML = `<span class="k">PHC period</span>             ${period.toFixed(2)} ns → quantization ${quant.toFixed(2)} ns RMS${interp ? ' (with 8× interpolation)' : ''}
<span class="k">location noise</span>         ${JIT[loc]} ns RMS (${loc === 'sw' ? 'IRQ/queueing jitter' : 'latency variation'})
<span class="k">per hop, random</span>        ${hopRand.toFixed(2)} ns RMS (Sync: 2 timestamps, Pdelay: filtered)
<span class="k">per hop, static</span>        ${(asym / 2).toFixed(2)} ns (half the uncompensated TX/RX latency difference)
<span class="k">drift between Syncs</span>    ${drift.toFixed(2)} ns (${ppb} ppb × ${PTPMath.logToMs(log)} ms)
<span class="k">after ${n} hop(s)</span>         3σ random ${(3 * totRand).toFixed(1)} ns + static ${totStatic.toFixed(1)} ns + drift ${drift.toFixed(1)} ns
<span class="k">≈ worst-case error</span>     ${total.toFixed(1)} ns → ${verdict}`;
    }
    ids.forEach(i => q(i).addEventListener('input', eb)); eb();
  }
});
