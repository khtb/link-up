Course.register({
  id: 'hw-capabilities',
  title: 'Hardware capabilities: the PHC and TSU',
  section: 'Timestamping',
  minutes: 25,
  render: () => `
    <h1>Hardware capabilities: the PHC and the TSU</h1>
    <p>"Supports IEEE 1588" on a datasheet can mean anything from "has a counter" to "full one-step transparent clock".
    This lesson takes the timestamping hardware apart so you can read a datasheet (or the output of <code>ethtool -T</code>) and
    know what you are getting.</p>

    <div id="anim-phc"></div>

    <h2>Adjusting the clock: three operations</h2>
    <div class="grid3">
      <div class="card"><b>Frequency</b> <code>adjfine</code><br><span class="muted">Change the increment (or addend) so the counter runs faster or slower. The servo uses this continuously. Range given by <code>max_adj</code> (ppb), e.g. ±500 000 ppb. No discontinuity.</span></div>
      <div class="card"><b>Phase</b> <code>adjtime</code><br><span class="muted">Add a signed offset atomically. Good hardware applies it in one clock cycle; poor hardware needs read-modify-write, which loses the time spent in software.</span></div>
      <div class="card"><b>Step</b> <code>settime</code><br><span class="muted">Load an absolute value: initial alignment, or after a GM time jump. Breaks monotonicity, so applications have to cope (gmTimeBaseIndicator, AUTOSAR time-leap detection).</span></div>
    </div>

    <h2>Lab: the fractional increment</h2>
    <p>A common TSU design adds a fixed-point increment to the nanosecond counter on every clock cycle. Frequency adjustment
    changes the fractional part. (Some controllers instead use a 32-bit "addend" accumulator that overflows into the counter; both are shown.)</p>
    <div class="card lab">
      <div class="row">
        <div><label>PHC clock frequency [MHz]</label><input type="number" id="pi-f" value="250" step="any" min="1"></div>
        <div><label>Frequency correction requested by the servo [ppb]</label><input type="number" id="pi-ppb" value="-12345" step="any"></div>
        <div><label>Fraction bits</label><select id="pi-bits"><option>24</option><option selected>32</option><option>40</option></select></div>
      </div>
      <div class="row">
        <div><label>Addend model: source clock [MHz]</label><input type="number" id="pi-src" value="300" step="any"></div>
      </div>
      <div class="out" id="pi-out"></div>
    </div>

    <h2>Capability checklist</h2>
    <p>Ask these questions about every MAC, PHY and switch in an automotive time-sync path.</p>
    <div class="table-wrap"><table>
      <tr><th>Capability</th><th>What to look for</th><th>Why it matters in a car</th></tr>
      <tr><td><b>Timestamp location</b></td><td>MAC (xMII) or PHY (near MDI); documented ingress/egress latency per speed and mode</td><td>Directly sets the per-hop error. Automotive PHYs (100BASE-T1, 1000BASE-T1) have hundreds of ns of latency; it must be fixed and documented.</td></tr>
      <tr><td><b>Resolution</b></td><td>PHC period (e.g. 8 ns at 125 MHz, 4 ns at 250 MHz), sub-cycle interpolation</td><td>Quantization noise per timestamp ≈ period/√12.</td></tr>
      <tr><td><b>Message filter</b></td><td>RX: timestamp all frames, or only PTPv2 L2 event messages; per-majorSdoId / per-domain</td><td>2020 multi-domain and CMLDS (majorSdoId 2) must still be timestamped; some older filters only match sdoId 1.</td></tr>
      <tr><td><b>TX timestamp delivery</b></td><td>In descriptor, register, FIFO depth, matching by sequenceId; latency to software</td><td>One register means only one outstanding event message per port; Sync and Pdelay_Resp can collide. External PHYs over MDIO/SPI add ms.</td></tr>
      <tr><td><b>One-step</b></td><td>One-step Sync TX, one-step P2P (turnaround in correctionField), FCS recompute</td><td>Optional in 2020; reduces CPU load and residence time.</td></tr>
      <tr><td><b>Number of PHCs</b></td><td>One shared PHC for all switch ports vs per-port clocks; virtual clocks</td><td>Residence time is only exact if ingress and egress are stamped by the same clock. Multi-domain (2020) needs one time per domain: separate PHCs or Linux <b>PHC vclocks</b>.</td></tr>
      <tr><td><b>Frequency adjust</b></td><td><code>max_adj</code>, granularity (sub-ppb), atomic <code>adjtime</code></td><td>Servo stability; fast lock after start-up.</td></tr>
      <tr><td><b>Pins</b></td><td>PPS / periodic output (<code>perout</code>), external timestamp input (<code>extts</code>)</td><td>Triggering cameras and lidars from gPTP time, lab measurement with an oscilloscope, syncing two PHCs (ts2phc).</td></tr>
      <tr><td><b>Cross-timestamping</b></td><td>PCIe PTM or precise device↔system time (<code>PTP_SYS_OFFSET_PRECISE</code>)</td><td>Accurate <code>phc2sys</code> transfer to CLOCK_REALTIME for applications on the SoC.</td></tr>
      <tr><td><b>MACsec interaction</b></td><td>Is the timestamp taken after the MACsec engine? Is MACsec latency constant?</td><td>A PHY-integrated MACsec between TSU and wire adds 24–32 bytes and possibly variable queuing. gPTP frames are often sent via a bypass rule.</td></tr>
      <tr><td><b>TSN use of the same clock</b></td><td>Does the 802.1Qbv gate control list run from the PHC?</td><td>Gates must open in gPTP time, so the PHC must be the scheduler clock.</td></tr>
      <tr><td><b>10BASE-T1S</b></td><td>Timestamping in a MAC-PHY (OPEN Alliance TC6) and on a PLCA multidrop bus</td><td>Timestamps cross the SPI; the half-duplex bus is not covered by 802.1AS-2020 (see lesson 12).</td></tr>
    </table></div>

    <h2>Reading <code>ethtool -T</code></h2>
    <p>Click a line to see what it tells you.</p>
    <div class="card"><pre id="eth-t" style="cursor:pointer"></pre><div id="eth-d" class="muted">Click a line above.</div></div>

    <h2>Where the hardware lives (examples)</h2>
    <div class="table-wrap"><table>
      <tr><th>Class</th><th>Examples</th><th>Notes</th></tr>
      <tr><td>Automotive SoC with TSN switch</td><td>NXP i.MX 95 and S32 (NETC), TI Jacinto (CPSW), Renesas R-Car (RSwitch)</td><td>Integrated switch with a shared 1588 timer, Qbv gating and per-port timestamps; Linux drivers expose a PHC per timer.</td></tr>
      <tr><td>Automotive Ethernet switches</td><td>NXP SJA1105/SJA1110, Marvell 88Q5xxx/88Q6xxx, Microchip LAN937x, Broadcom BCM8956x</td><td>Embedded gPTP firmware or a host stack via DSA. TX/RX timestamps reach the host over SPI/MDIO or in meta frames.</td></tr>
      <tr><td>Automotive PHYs with PTP</td><td>NXP TJA1103/TJA1120, other 100/1000BASE-T1 PHYs</td><td>PHY timestamping near the MDI; Linux selects PHY vs MAC timestamping.</td></tr>
      <tr><td>PC / lab NICs</td><td>Intel i210/i225/i226, Mellanox/NVIDIA ConnectX</td><td>Good references for HIL benches and the Linux labs in lesson 13.</td></tr>
    </table></div>
    <p class="src">Device examples are illustrative; check each datasheet for the exact timestamping features of a given part and revision.</p>
  `,
  mount: (root) => {
    Course.stepper(root.querySelector('#anim-phc'), {
      title: 'Inside a PTP hardware clock (PHC) and time stamp unit (TSU)',
      svg: `
      <svg viewBox="0 0 900 320" role="img" aria-label="PHC and TSU block diagram">
        <defs><marker id="ah6" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--text)"/></marker></defs>
        <g id="osc"><rect class="node" x="20" y="120" width="100" height="56" rx="8"/><text x="70" y="144" text-anchor="middle" font-size="12" font-weight="700">XO 25 MHz</text><text x="70" y="161" text-anchor="middle" font-size="10" class="t-muted">±50…100 ppm</text></g>
        <path d="M120,148 L150,148" stroke="var(--text)" stroke-width="1.5" marker-end="url(#ah6)"/>
        <g id="pll"><rect class="node" x="150" y="120" width="90" height="56" rx="8"/><text x="195" y="144" text-anchor="middle" font-size="12" font-weight="700">PLL</text><text x="195" y="161" text-anchor="middle" font-size="10" class="t-muted">→ 250 MHz</text></g>
        <path d="M240,148 L280,148" stroke="var(--text)" stroke-width="1.5" marker-end="url(#ah6)"/>

        <g id="acc"><rect class="node" x="280" y="96" width="230" height="104" rx="8" style="stroke:var(--accent)"/>
          <text x="395" y="116" text-anchor="middle" font-size="12" font-weight="700">Time counter</text>
          <rect x="296" y="126" width="94" height="26" rx="4" fill="var(--c-gm)"/><text x="343" y="143" text-anchor="middle" font-size="11" class="mono" style="fill:#fff">seconds 48 b</text>
          <rect x="396" y="126" width="98" height="26" rx="4" fill="var(--plain)"/><text x="445" y="143" text-anchor="middle" font-size="11" class="mono" style="fill:#fff">ns 30 b · frac</text>
          <text x="395" y="176" text-anchor="middle" font-size="11" class="mono">+= increment every cycle</text>
          <text x="395" y="191" text-anchor="middle" font-size="10" class="t-muted">4.000000 ns × (1 + adj)</text></g>
        <g id="inc" class="f"><rect x="300" y="226" width="190" height="40" rx="6" fill="var(--panel-2)" stroke="var(--accent)"/><text x="395" y="243" text-anchor="middle" font-size="11" font-weight="700">increment / addend register</text><text x="395" y="258" text-anchor="middle" font-size="10" class="t-muted">written by adjfine()</text>
          <path d="M395,226 L395,202" stroke="var(--accent)" stroke-width="1.5" marker-end="url(#ah6)"/></g>
        <g id="adj" class="f"><rect x="300" y="20" width="190" height="44" rx="6" fill="var(--panel-2)" stroke="var(--warn)"/><text x="395" y="38" text-anchor="middle" font-size="11" font-weight="700">offset / load registers</text><text x="395" y="54" text-anchor="middle" font-size="10" class="t-muted">adjtime() · settime()</text>
          <path d="M395,64 L395,94" stroke="var(--warn)" stroke-width="1.5" marker-end="url(#ah6)"/></g>

        <g id="tsu" class="f"><rect class="node" x="590" y="60" width="150" height="80" rx="8" style="stroke:var(--c-ts)"/><text x="665" y="82" text-anchor="middle" font-size="12" font-weight="700">TSU (per port)</text>
          <text x="665" y="100" text-anchor="middle" font-size="10" class="t-muted">SFD detect on TX / RX</text><text x="665" y="116" text-anchor="middle" font-size="10" class="t-muted">PTP parser · seqId · type</text><text x="665" y="132" text-anchor="middle" font-size="10" class="t-muted">latch counter</text>
          <path d="M510,120 L588,100" stroke="var(--c-ts)" stroke-width="1.5" marker-end="url(#ah6)"/></g>
        <g id="fifo" class="f"><rect x="780" y="60" width="104" height="80" rx="6" fill="var(--panel-2)" stroke="var(--c-ts)"/><text x="832" y="84" text-anchor="middle" font-size="11" font-weight="700">TX TS FIFO</text><text x="832" y="102" text-anchor="middle" font-size="10" class="t-muted">RX: in descriptor</text><text x="832" y="118" text-anchor="middle" font-size="10" class="t-muted">→ driver / IRQ</text>
          <path d="M740,100 L778,100" stroke="var(--c-ts)" stroke-width="1.5" marker-end="url(#ah6)"/></g>
        <g id="pins" class="f"><rect class="node" x="590" y="180" width="150" height="76" rx="8" style="stroke:var(--accent-2)"/><text x="665" y="202" text-anchor="middle" font-size="12" font-weight="700">Event pins</text>
          <text x="665" y="220" text-anchor="middle" font-size="10" class="t-muted">PPS / perout: compare</text><text x="665" y="236" text-anchor="middle" font-size="10" class="t-muted">extts: latch on edge</text>
          <path d="M510,170 L588,210" stroke="var(--accent-2)" stroke-width="1.5" marker-end="url(#ah6)"/>
          <path d="M740,218 L800,218" stroke="var(--accent-2)" stroke-width="1.5" marker-end="url(#ah6)"/><text x="840" y="214" text-anchor="middle" font-size="10" style="fill:var(--accent-2)" font-weight="700">camera trigger</text><text x="840" y="228" text-anchor="middle" font-size="10" style="fill:var(--accent-2)">scope · ts2phc</text></g>
        <g id="xts" class="f"><rect x="590" y="276" width="294" height="34" rx="6" fill="var(--panel-2)" stroke="var(--plain-2)"/><text x="737" y="297" text-anchor="middle" font-size="11" font-weight="700">cross-timestamp: PHC ↔ system clock (PTM)</text></g>
      </svg>`,
      steps: [
        { caption: 'It starts with a crystal oscillator. A cheap automotive XO is accurate to ±50–100 ppm and drifts with temperature. gPTP never assumes it is correct.', do: s => s.hl('osc') },
        { caption: 'A PLL multiplies it to the timestamp clock. The clock period sets the timestamp <b>granularity</b>: 4 ns at 250 MHz.', do: s => { s.unhl('osc'); s.hl('pll'); } },
        { caption: 'The <b>time counter</b> holds seconds and nanoseconds (plus fraction bits). It never stops; it is the port\'s <code>LocalClock</code>. In Linux it appears as <code>/dev/ptpN</code>.', do: s => { s.unhl('pll'); s.hl('acc'); } },
        { caption: 'Every cycle the counter adds an <b>increment</b>. Writing a slightly different increment speeds the clock up or slows it down. That is the frequency adjustment the servo uses (<code>clock_adjtime</code> → driver <code>adjfine</code>).', do: s => s.show('inc') },
        { caption: 'Phase adjustments add an offset or load a new value. Good hardware applies them atomically so no counts are lost.', do: s => s.show('adj') },
        { caption: 'The <b>TSU</b> sits on each port\'s data path. It recognises PTP event messages, detects the SFD, and latches the counter in the same cycle. Some TSUs parse the PTP header so they can filter by messageType and record the sequenceId.', do: s => { s.unhl('acc'); s.show('tsu'); } },
        { caption: 'RX timestamps usually travel with the frame (in the RX descriptor, or prepended to the buffer). TX timestamps go into a register or FIFO that the driver reads later. Its depth limits how many event messages can be in flight.', do: s => s.show('fifo') },
        { caption: '<b>Event pins</b> connect the clock to the physical world: a periodic output in gPTP time can trigger camera exposure, and an external-timestamp input latches the counter on an edge (to measure a PPS from another device, or to sync two PHCs with <code>ts2phc</code>).', do: s => s.show('pins') },
        { caption: 'Finally, <b>cross-timestamping</b> reads the PHC and the CPU clock at the same instant, so <code>phc2sys</code> can copy gPTP time into <code>CLOCK_REALTIME</code> for applications with little error.', do: s => s.show('xts') },
      ]
    });

    // increment calculator
    const q = s => root.querySelector(s);
    function inc() {
      const f = Math.max(0.001, +q('#pi-f').value || 1), ppb = +q('#pi-ppb').value || 0, bits = +q('#pi-bits').value;
      const src = Math.max(0.001, +q('#pi-src').value || 1);
      const period = 1000 / f, adj = period * (1 + ppb * 1e-9);
      const scale = Math.pow(2, bits);
      const iInt = Math.floor(adj), frac = Math.round((adj - iInt) * scale);
      const nomFrac = Math.round((period - Math.floor(period)) * scale);
      const resPpb = 1 / (period * scale) * 1e9;
      const addend = Math.round(Math.pow(2, 32) * (f / src) * (1 + ppb * 1e-9));
      const addNom = Math.round(Math.pow(2, 32) * (f / src));
      q('#pi-out').innerHTML = `<span class="k">nominal increment</span>  ${period.toFixed(9)} ns = ${Math.floor(period)} ns + 0x${nomFrac.toString(16)} / 2^${bits}
<span class="k">adjusted (${ppb} ppb)</span> ${adj.toFixed(9)} ns = ${iInt} ns + 0x${frac.toString(16)} / 2^${bits}
<span class="k">adjust granularity</span>  ${resPpb.toPrecision(3)} ppb per LSB${resPpb > 1 ? '  <span class="w">(coarse: the servo will dither)</span>' : '  <span class="ok">(fine enough)</span>'}
<span class="k">time error after 1 s if not corrected</span> ${(ppb).toFixed(0)} ns
` + (f > src ? `<span class="bad">Addend model needs f_src ≥ f_PHC.</span>` :
`<span class="k">addend model</span>  ADDEND = 2^32 × f_PHC/f_src → nominal 0x${addNom.toString(16).toUpperCase()}, adjusted 0x${addend.toString(16).toUpperCase()} (Δ ${addend - addNom})`);
    }
    ['#pi-f', '#pi-ppb', '#pi-bits', '#pi-src'].forEach(s => q(s).addEventListener('input', inc)); inc();

    // ethtool -T explorer
    const L = [
      ['Time stamping parameters for eth0:', 'The interface whose capabilities are being reported (kernel <code>ETHTOOL_GET_TS_INFO</code>).'],
      ['Capabilities:', 'SO_TIMESTAMPING flags the driver supports.'],
      ['\thardware-transmit', '<b>SOF_TIMESTAMPING_TX_HARDWARE</b>: TX timestamps from the TSU. Required for ptp4l <code>time_stamping hardware</code>.'],
      ['\tsoftware-transmit', 'SOF_TIMESTAMPING_TX_SOFTWARE: the driver calls <code>skb_tx_timestamp()</code>. Enough for <code>ptp4l -S</code> (µs accuracy).'],
      ['\thardware-receive', '<b>SOF_TIMESTAMPING_RX_HARDWARE</b>: RX timestamps from the TSU.'],
      ['\tsoftware-receive', 'SOF_TIMESTAMPING_RX_SOFTWARE.'],
      ['\tsoftware-system-clock', 'Software timestamps are taken from CLOCK_REALTIME.'],
      ['\thardware-raw-clock', '<b>SOF_TIMESTAMPING_RAW_HARDWARE</b>: timestamps are reported in the PHC\'s own time base, which is what ptp4l uses.'],
      ['PTP Hardware Clock: 0', 'The PHC index: <code>/dev/ptp0</code>. Several ports with the <b>same index</b> share one clock (typical for a switch); different indices need <code>phc2sys</code>/<code>ts2phc</code> or ptp4l <code>boundary_clock_jbod</code>.'],
      ['Hardware timestamp provider index: 0', 'Newer kernels/ethtool print the PHC as a <b>timestamp provider</b>. Same meaning as "PTP Hardware Clock".'],
      ['Hardware timestamp provider qualifier: Precise (IEEE 1588 quality)', 'Precise = a real 1588 timestamper; "Approximate" is used for e.g. DMA-time stamps.'],
      ['Hardware timestamp source: MAC', '<b>MAC</b> or <b>PHY</b>. When both a MAC and a PTP PHY can timestamp, recent kernels let you pick the provider (ethtool netlink <code>tsconfig</code>). For automotive PHYs with PTP, prefer the PHY.'],
      ['Hardware Transmit Timestamp Modes:', '<code>hwtstamp_config.tx_type</code> values the driver accepts.'],
      ['\toff', 'HWTSTAMP_TX_OFF.'],
      ['\ton', '<b>HWTSTAMP_TX_ON</b>: two-step. Every frame the socket flags gets a TX timestamp.'],
      ['\tonestep-sync', '<b>HWTSTAMP_TX_ONESTEP_SYNC</b>: hardware inserts the timestamp into Sync on the fly.'],
      ['\tonestep-p2p', '<b>HWTSTAMP_TX_ONESTEP_P2P</b>: one-step Sync and one-step Pdelay_Resp (turnaround in correctionField).'],
      ['Hardware Receive Filter Modes:', '<code>hwtstamp_config.rx_filter</code> values.'],
      ['\tnone', 'No RX timestamps.'],
      ['\tall', 'HWTSTAMP_FILTER_ALL: every received frame is stamped. Always works for gPTP, including CMLDS and new domains.'],
      ['\tptpv2-l2-event', '<b>HWTSTAMP_FILTER_PTP_V2_L2_EVENT</b>: PTPv2 Sync/Delay_Req/Pdelay_Req/Pdelay_Resp over Ethernet. Exactly what gPTP needs (ptp4l <code>hwts_filter normal</code> requests this for L2).'],
    ];
    const pre = q('#eth-t'), det = q('#eth-d');
    pre.innerHTML = L.map((l, i) => `<span data-i="${i}" style="display:block">${Course.esc(l[0].replace('\t', '        '))}</span>`).join('');
    pre.addEventListener('click', e => {
      const sp = e.target.closest('span[data-i]'); if (!sp) return;
      pre.querySelectorAll('span').forEach(x => x.style.background = ''); sp.style.background = 'rgba(129,140,248,.25)';
      det.innerHTML = L[+sp.dataset.i][1];
    });
  }
});
