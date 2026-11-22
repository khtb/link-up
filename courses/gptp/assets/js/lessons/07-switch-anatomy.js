Course.register({
  id: 'switch-anatomy',
  title: 'Timestamping inside a switch',
  section: 'Bridges',
  minutes: 30,
  render: () => `
    <h1>Timestamping inside a switch: a detailed anatomy</h1>
    <p>A time-aware bridge has one job: tell the next hop what time it was at the GM when the Sync left this bridge.
    To do that it has to know <b>exactly</b> how long the timing information spent inside it (the <b>residence time</b>)
    and how long it spent on the upstream cable. This lesson follows one Sync through a typical automotive switch.</p>

    <div id="anim-sw"></div>

    <div class="callout tip"><b>The key insight: queuing does not hurt, timestamps do</b>
      The Sync may wait microseconds behind a jumbo frame, or the CPU may need milliseconds to build the new Sync. None of that
      reduces accuracy, because the bridge does not estimate the residence time; it <b>measures</b> it with two hardware timestamps
      from the same clock. What hurts is anything between the timestamp point and the wire that varies, and any error in the
      rate ratio used to convert local time to GM time.</div>

    <h2>The correction arithmetic (two-step relay)</h2>
    <div class="card">
      <div class="out">upstreamTxTime   = syncEventIngressTimestamp − meanLinkDelay(upstream) / neighborRateRatio
rateRatio_out    = rateRatio_in × neighborRateRatio(upstream port)
correction_out   = correction_in + rateRatio_out × (syncEventEgressTimestamp − upstreamTxTime)
                 = correction_in + rateRatio_out × (residence time + upstream link delay in local time)
preciseOriginTimestamp  → copied unchanged</div>
      <p class="muted" style="margin:.6em 0 0">Clause 11.1.3 / 11.2.14 (802.1AS-2020; same structure in 2011). All timestamps are in the bridge's
      LocalClock. Multiplying by rateRatio converts local nanoseconds to GM nanoseconds, so the bridge never has to adjust its own oscillator.</p>
    </div>

    <h2>Lab: one relay hop</h2>
    <div class="card lab">
      <div class="row">
        <div><label>correctionField received in upstream Follow_Up [ns]</label><input type="number" id="s-cin" value="2500" step="any"></div>
        <div><label>Upstream meanLinkDelay [ns]</label><input type="number" id="s-dly" value="48" step="any"></div>
        <div><label>Upstream neighborRateRatio offset [ppm]</label><input type="number" id="s-nrr" value="-20" step="any"></div>
      </div>
      <div class="row">
        <div><label>Upstream rateRatio offset (from received Follow_Up) [ppm]</label><input type="number" id="s-rr" value="35" step="any"></div>
        <div><label>Sync ingress timestamp, port 1 [ns]</label><input type="number" id="s-in" value="100000"></div>
        <div><label>Sync egress timestamp, port 2 [ns]</label><input type="number" id="s-out" value="1100000"></div>
      </div>
      <div class="out" id="s-res"></div>
    </div>

    <h2>Lab: why rateRatio must travel with the time</h2>
    <p>Chain several bridges. Each holds the Sync for a residence time and has its own crystal error. Compare the error at the
    last hop with and without the rate-ratio conversion.</p>
    <div class="card lab">
      <div class="row">
        <div><label>Bridges between GM and end station</label><input type="number" id="c-n" value="4" min="1" max="10"></div>
        <div><label>Residence time per bridge [ms]</label><input type="number" id="c-res" value="2" step="any"></div>
        <div><label>Max crystal error per device [± ppm]</label><input type="number" id="c-ppm" value="50" step="any"></div>
      </div>
      <button class="btn" id="c-roll">🎲 New random crystals</button>
      <div class="out" id="c-out"></div>
    </div>

    <h2>How the timestamp reaches the gPTP stack</h2>
    <p>In an integrated SoC switch the TSU writes into the frame descriptor. With an external switch connected to a host CPU
    (Linux <b>DSA</b>), the timestamp has to cross a management interface, and every driver solves this differently:</p>
    <div class="table-wrap"><table>
      <tr><th>Mechanism</th><th>How it works</th><th>Example drivers</th><th>Consequence</th></tr>
      <tr><td><b>Descriptor / buffer</b></td><td>RX timestamp in the DMA descriptor or prepended to the frame</td><td>Integrated SoC switches/NICs (NETC, CPSW, stmmac, igc)</td><td>Fast, no extra traffic</td></tr>
      <tr><td><b>In-band tag</b></td><td>The CPU-port tag (DSA header) carries the RX timestamp or a TX timestamp ID</td><td>ocelot/felix, Microchip KSZ</td><td>Fast; the tagger must parse it</td></tr>
      <tr><td><b>Meta frames</b></td><td>The switch sends a separate "meta" frame with the timestamp right after the trapped PTP frame</td><td>sja1105</td><td>Frames must be paired; reordering breaks it</td></tr>
      <tr><td><b>Register polling</b></td><td>The driver reads per-port timestamp registers over MDIO/SPI after an interrupt or periodically</td><td>mv88e6xxx</td><td>Slow (ms): raise <code>tx_timestamp_timeout</code>; one outstanding TX timestamp per port</td></tr>
      <tr><td><b>Embedded firmware</b></td><td>gPTP runs on a core inside the switch; the host only configures it</td><td>Many automotive switches (vendor SDKs)</td><td>Fast startup independent of host boot; less visibility from Linux</td></tr>
    </table></div>

    <h2>One clock or many?</h2>
    <div class="grid2">
      <div class="card"><b>Shared PHC</b> <span class="tag ok">preferred</span><br><span class="muted">One time counter distributed to every port's TSU.
        Ingress and egress timestamps come from the same clock, so the residence time is exact. <code>ethtool -T</code> shows the same PHC index on every port.</span></div>
      <div class="card"><b>Per-port clocks</b> <span class="tag warn">needs care</span><br><span class="muted">For example, PTP PHYs in front of a switch, each with its own counter.
        Residence time = egress (clock B) − ingress (clock A), so A and B must be synchronized to each other (ts2phc with a shared PPS, or a common time bus).
        In ptp4l: <code>boundary_clock_jbod 1</code> plus phc2sys between the clocks.</span></div>
    </div>

    <h2>Implementation limits worth knowing</h2>
    <ul>
      <li><b>Residence time ≤ 10 ms</b> and <b>Pdelay turnaround ≤ 10 ms</b> (802.1AS Annex B), so rate errors stay small.</li>
      <li><b>Sync forwarding</b>: a bridge either forwards when the next Sync interval expires, or immediately on receipt. 2020 calls the latter <b>syncLocked</b>: the downstream Sync interval locks to the upstream one, keeping residence time minimal.</li>
      <li><b>Per-port Sync generation</b>: each master port gets its own Sync and Follow_Up with that port's <code>sourcePortIdentity</code> and sequenceId; nothing is copied byte-for-byte except preciseOriginTimestamp and the GM-related TLV fields.</li>
      <li><b>No forwarding of link-local frames</b>: the classifier traps <code>01-80-C2-00-00-0E</code>. If the trap is missing, the frame may be flooded, and neighbours see multiple Pdelay responders.</li>
      <li><b>Cut-through vs store-and-forward</b>: irrelevant to gPTP accuracy (the frame is terminated in the CPU anyway), but very relevant for a 1588 transparent clock (lesson 8).</li>
    </ul>
  `,
  mount: (root) => {
    const b = (id, x, y, w, h, t, sub, c) => `<g id="${id}"><rect class="node" x="${x}" y="${y}" width="${w}" height="${h}" rx="7" ${c ? `style="stroke:${c}"` : ''}/><text x="${x + w / 2}" y="${y + h / 2 - (sub ? 3 : -4)}" text-anchor="middle" font-size="11.5" font-weight="700">${t}</text>${sub ? `<text x="${x + w / 2}" y="${y + h / 2 + 12}" text-anchor="middle" font-size="9.5" class="t-muted">${sub}</text>` : ''}</g>`;
    const badge = (id, x, y, t, c = 'var(--c-ts)') => `<g id="${id}" class="f"><rect x="${x}" y="${y}" width="${t.length * 6.6 + 14}" height="20" rx="10" fill="${c}"/><text x="${x + (t.length * 6.6 + 14) / 2}" y="${y + 14}" text-anchor="middle" font-size="10.5" class="mono" style="fill:#fff" font-weight="700">${t}</text></g>`;
    const ar = (id, d, c = 'var(--text)', dash = '') => `<path id="${id}" class="f" d="${d}" stroke="${c}" stroke-width="1.8" fill="none" marker-end="url(#ah8)" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`;
    const pkt = (id, x, y, t, c) => `<g id="${id}" class="mv f"><rect x="${x - 22}" y="${y - 10}" width="44" height="20" rx="4" fill="${c}"/><text x="${x}" y="${y + 4}" text-anchor="middle" font-size="9.5" style="fill:#fff" font-weight="700">${t}</text></g>`;
    Course.stepper(root.querySelector('#anim-sw'), {
      title: 'One Sync through a time-aware bridge (two-step, shared PHC)',
      autoplayMs: 3600,
      svg: `
      <svg viewBox="0 0 980 430" role="img" aria-label="Anatomy of timestamping in a switch">
        <defs><marker id="ah8" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--text)"/></marker></defs>
        <g><rect x="10" y="175" width="80" height="60" rx="8" class="node" style="stroke:var(--c-gm)"/><text x="50" y="201" text-anchor="middle" font-size="11.5" font-weight="700">Upstream</text><text x="50" y="216" text-anchor="middle" font-size="9.5" class="t-muted">GM side</text></g>
        <path class="wire" d="M90,205 L122,205"/>
        <rect x="112" y="14" width="790" height="404" rx="14" fill="none" stroke="var(--border-2)" stroke-width="1.5" stroke-dasharray="6 4"/>
        <text x="124" y="34" font-size="12" font-weight="700" class="t-muted">Time-aware bridge (zone switch)</text>

        ${b('phy1', 122, 175, 56, 60, 'PHY', 'port 1')}
        ${b('tsu1', 186, 175, 82, 60, 'MAC+TSU', 'ingress', 'var(--c-ts)')}
        ${b('cls', 280, 175, 104, 60, 'Classifier', 'DA · EtherType')}
        ${b('fab', 420, 270, 180, 54, 'Forwarding fabric', 'FDB · VLAN · queues')}
        <g id="cpu"><rect class="node" x="420" y="52" width="210" height="118" rx="7" style="stroke:var(--accent)"/><text x="525" y="72" text-anchor="middle" font-size="11.5" font-weight="700">gPTP stack (CPU)</text>
          <text x="525" y="94" text-anchor="middle" font-size="9.5" class="mono t-muted">MDSyncReceive → PortSyncSyncRcv</text><text x="525" y="108" text-anchor="middle" font-size="9.5" class="mono t-muted">→ SiteSyncSync → PortSyncSyncSend</text><text x="525" y="122" text-anchor="middle" font-size="9.5" class="mono t-muted">→ MDSyncSend (per master port)</text></g>
        ${b('phc', 250, 352, 150, 52, 'Shared PHC', 'one counter, all ports', 'var(--c-gm)')}
        ${b('q2', 650, 120, 64, 50, 'Queue', 'TC7')}
        ${b('tsu2', 722, 120, 82, 50, 'MAC+TSU', 'egress', 'var(--c-ts)')}
        ${b('phy2', 812, 120, 56, 50, 'PHY', 'port 2')}
        ${b('q3', 650, 230, 64, 50, 'Queue', 'TC7')}
        ${b('tsu3', 722, 230, 82, 50, 'MAC+TSU', 'egress', 'var(--c-ts)')}
        ${b('phy3', 812, 230, 56, 50, 'PHY', 'port 3')}
        <path class="wire" d="M868,145 L975,145"/><path class="wire" d="M868,255 L975,255"/>
        <text x="925" y="136" text-anchor="middle" font-size="9.5" class="t-muted">master</text><text x="925" y="246" text-anchor="middle" font-size="9.5" class="t-muted">master</text>
        <text x="150" y="250" text-anchor="middle" font-size="9.5" class="t-muted">slave</text>

        <g id="phc-lines" class="f"><path d="M325,352 L227,237" stroke="var(--c-gm)" stroke-width="1.2" stroke-dasharray="3 3" fill="none"/><path d="M400,378 L763,172" stroke="var(--c-gm)" stroke-width="1.2" stroke-dasharray="3 3" fill="none"/><path d="M400,385 L763,282" stroke="var(--c-gm)" stroke-width="1.2" stroke-dasharray="3 3" fill="none"/></g>
        ${ar('trap', 'M332,175 L332,112 L418,112', 'var(--c-sync)')}
        <g id="trap-l" class="f"><text x="340" y="148" font-size="9.5" font-weight="700" style="fill:var(--c-sync)">trap</text><text x="340" y="160" font-size="9" class="t-muted">01-80-C2-00-00-0E</text></g>
        ${ar('data', 'M384,215 L470,268', 'var(--muted)', '5 4')}
        <g id="data-l" class="f"><text x="610" y="300" font-size="10" class="t-muted">data frames: hardware path,</text><text x="610" y="313" font-size="10" class="t-muted">never seen by the CPU</text></g>
        ${ar('to2', 'M630,128 L648,140', 'var(--c-sync)')}${ar('to3', 'M630,160 L648,248', 'var(--c-sync)')}
        ${ar('txts', 'M763,120 L763,98 L632,98', 'var(--c-ts)', '4 3')}
        <g id="txts-l" class="f"><text x="700" y="90" text-anchor="middle" font-size="9.5" font-weight="700" style="fill:var(--c-ts)">TX timestamp</text></g>

        ${pkt('sync', 50, 205, 'Sync', 'var(--c-sync)')}
        ${pkt('fuin', 50, 205, 'FU in', 'var(--c-fu)')}
        ${pkt('s3', 930, 270, 'Sync', 'var(--c-sync)')}
        ${pkt('fuout', 580, 152, 'FU out', 'var(--c-fu)')}
        ${badge('ts-in', 160, 146, 'ingress = 100 000.0 ns')}
        ${badge('ts-out', 690, 186, 'egress = 1 100 000.0 ns')}
        <g id="frm" class="f"><rect x="628" y="340" width="342" height="78" rx="8" fill="var(--accent-soft)" stroke="var(--accent)"/>
          <text x="799" y="362" text-anchor="middle" font-size="11" class="mono" font-weight="700">residence = egress − ingress</text>
          <text x="799" y="380" text-anchor="middle" font-size="11" class="mono">corr += rateRatio × (residence</text>
          <text x="799" y="396" text-anchor="middle" font-size="11" class="mono">        + linkDelay/nrr)</text>
          <text x="799" y="411" text-anchor="middle" font-size="9.5" class="t-muted">preciseOriginTimestamp unchanged</text></g>
      </svg>`,
      steps: [
        { caption: 'The blocks of a typical automotive switch: per-port PHY and MAC with a <b>TSU</b>, a frame <b>classifier</b>, the hardware <b>forwarding fabric</b>, a <b>CPU</b> (internal core or host) running the gPTP stack, and one <b>PHC</b>. Port 1 is the slave port (towards the GM); ports 2 and 3 are master ports.',
          do: s => {} },
        { caption: 'All TSUs are fed by the <b>same PHC</b>, so every timestamp in this bridge is in one time base, the bridge\'s LocalClock. It does not have to be synchronized to the GM.',
          do: s => s.show('phc-lines') },
        { caption: 'A <b>Sync</b> arrives from upstream on port 1 and passes the PHY.',
          do: s => { s.show('sync'); s.move('sync', 100, 0); s.hl('phy1'); } },
        { caption: 'The ingress <b>TSU</b> sees the SFD and latches the PHC: <code>syncEventIngressTimestamp</code>. The PHY RX latency (<code>ingressLatency</code>) is subtracted so the value refers to the MDI.',
          do: s => { s.unhl('phy1'); s.move('sync', 178, 0); s.hl('tsu1'); s.show('ts-in'); } },
        { caption: 'The <b>classifier</b> matches DA <code>01-80-C2-00-00-0E</code> and EtherType <code>0x88F7</code> and <b>traps</b> the frame to the CPU port with the timestamp attached as metadata. A time-aware bridge never forwards gPTP frames through the fabric.',
          do: s => { s.unhl('tsu1'); s.move('sync', 282, 0); s.hl('cls'); s.show(['trap', 'trap-l']); } },
        { caption: 'For contrast: ordinary data frames take the hardware path through the fabric, at line rate, and the CPU never sees them.',
          do: s => { s.show(['data', 'data-l']); s.hl('fab'); } },
        { caption: 'The gPTP stack receives the Sync and then the upstream <b>Follow_Up</b> (preciseOriginTimestamp, correctionField, rateRatio). It computes <code>upstreamTxTime</code> from the ingress timestamp and port 1\'s Pdelay results, and multiplies the rateRatio by port 1\'s neighborRateRatio.',
          do: s => { s.unhl(['cls', 'fab']); s.dim(['data', 'data-l']); s.move('sync', 420, -53); s.hl('cpu'); s.show('fuin'); s.move('fuin', 530, -53); } },
        { caption: 'It builds a <b>new Sync for every master port</b>, with that port\'s own sourcePortIdentity and sequenceId. When it sends them depends on the implementation: at the next Sync interval, or immediately (2020 <code>syncLocked</code>).',
          do: s => { s.dim('fuin'); s.show(['to2', 'to3', 's3']); s.move('sync', 632, -60); } },
        { caption: 'The Sync waits in the egress queue, typically the highest traffic class, but possibly behind a frame already being transmitted (up to ≈ 12 µs at 1 Gb/s or ≈ 123 µs at 100 Mb/s for 1522 bytes). That delay is fine: it will be measured.',
          do: s => { s.unhl('cpu'); s.hl(['q2', 'q3']); } },
        { caption: 'The egress <b>TSU</b> latches the PHC as the SFD leaves: <code>syncEventEgressTimestamp</code>, corrected by <code>egressLatency</code>. In two-step mode this TX timestamp goes back to the CPU.',
          do: s => { s.unhl(['q2', 'q3']); s.move('sync', 712, -60); s.hl('tsu2'); s.show(['ts-out', 'txts', 'txts-l']); } },
        { caption: 'The CPU now computes the residence time and the new correctionField, and sends a <b>Follow_Up</b> on port 2 with preciseOriginTimestamp unchanged, the new correction and the new cumulativeScaledRateOffset. Port 3 is handled the same way with its own egress timestamp.',
          do: s => { s.unhl('tsu2'); s.move('sync', 900, -60); s.show(['fuout', 'frm']); s.move('fuout', 345, 13); } },
      ]
    });

    const q = s => root.querySelector(s);
    function hop() {
      const cin = +q('#s-cin').value || 0, dly = +q('#s-dly').value || 0;
      const nrr = PTPMath.ppmToRatio(+q('#s-nrr').value || 0), rrIn = PTPMath.ppmToRatio(+q('#s-rr').value || 0);
      const tin = +q('#s-in').value || 0, tout = +q('#s-out').value || 0;
      const rr = rrIn * nrr;
      const r = PTPMath.relayCorrection({ correctionIn: cin, syncIngress: tin, syncEgress: tout, linkDelay: dly, nrr, rateRatio: rr });
      const naive = cin + (tout - tin) + dly;
      q('#s-res').innerHTML = `<span class="k">residence time</span> (local)     ${r.residence.toFixed(3)} ns ${r.residence > 1e7 ? '<span class="bad">> 10 ms limit</span>' : r.residence < 0 ? '<span class="bad">negative?</span>' : ''}
<span class="k">upstreamTxTime</span>             ${r.upstreamTxTime.toFixed(3)} ns
<span class="k">rateRatio_out</span>              ${rr.toFixed(12)}  (${PTPMath.ratioToPpm(rr).toFixed(4)} ppm) → cumulativeScaledRateOffset ${PTPMath.encodeRateOffset(rr)}
<span class="k">added to correction</span>        ${r.added.toFixed(3)} ns (GM time)
<span class="k">correction_out</span>             <span class="ok">${r.correctionOut.toFixed(3)} ns</span>  → hex ${PTPMath.hex(PTPMath.encodeCorrection(r.correctionOut))}
naive (no rate ratio)       ${naive.toFixed(3)} ns   difference ${(naive - r.correctionOut).toFixed(3)} ns`;
    }
    ['#s-cin', '#s-dly', '#s-nrr', '#s-rr', '#s-in', '#s-out'].forEach(i => q(i).addEventListener('input', hop)); hop();

    let crystals = [];
    function roll() { crystals = Array.from({ length: 11 }, () => (Math.random() * 2 - 1)); chain(); }
    function chain() {
      const n = Math.max(1, Math.min(10, +q('#c-n').value | 0)), res = (+q('#c-res').value || 0) * 1e6, maxp = +q('#c-ppm').value || 0;
      const ppm = crystals.map(c => c * maxp);   // [0] = GM, [1..n] = bridges
      let lines = [`GM crystal ${ppm[0] >= 0 ? '+' : ''}${ppm[0].toFixed(1)} ppm`], errNo = 0;
      for (let i = 1; i <= n; i++) {
        // bridge i measures residence `res` GM-ns as local ns: local = gm * (1+ppm_i)/(1+ppm_gm)
        const rateToGm = PTPMath.ppmToRatio(ppm[0]) / PTPMath.ppmToRatio(ppm[i]);
        const local = res / rateToGm;
        const e = local - res;   // error if local ns are used as GM ns
        errNo += e;
        lines.push(`bridge ${i}: ${ppm[i] >= 0 ? '+' : ''}${ppm[i].toFixed(1)} ppm  residence ${res / 1e6} ms  error without rateRatio ${e >= 0 ? '+' : ''}${e.toFixed(1)} ns`);
      }
      q('#c-out').innerHTML = lines.join('\n') + `\n\n<span class="k">accumulated error without rateRatio</span>  ${Math.abs(errNo) > 1000 ? '<span class="bad">' : '<span class="w">'}${errNo.toFixed(1)} ns</span>
<span class="k">with rateRatio (exact here)</span>          <span class="ok">≈ 0 ns</span> (in practice limited by rate-ratio measurement noise, ~ppb)`;
    }
    q('#c-roll').addEventListener('click', roll);
    ['#c-n', '#c-res', '#c-ppm'].forEach(i => q(i).addEventListener('input', chain));
    roll();
  }
});
