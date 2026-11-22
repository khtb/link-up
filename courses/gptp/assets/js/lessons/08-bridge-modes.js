Course.register({
  id: 'bridge-modes',
  title: 'Boundary clocks, transparent clocks & gPTP relays',
  section: 'Bridges',
  minutes: 25,
  render: () => `
    <h1>Boundary clocks, transparent clocks and gPTP relays</h1>
    <p>IEEE 1588 offers several ways for a switch to handle time. 802.1AS picks one, the <b>time-aware relay</b>, which takes
    something from each of the 1588 options. Knowing all of them matters because automotive networks mix gPTP bridges with
    1588 devices (cameras, lidars, test equipment) and because many datasheets describe their switch in 1588 terms.</p>

    <div id="anim-modes"></div>

    <h2>Side by side</h2>
    <div class="table-wrap"><table class="cmp">
      <tr><th></th><th>Boundary clock (BC)</th><th>E2E transparent clock</th><th>P2P transparent clock</th><th>gPTP time-aware relay</th></tr>
      <tr><td>Standard</td><td>1588</td><td>1588</td><td>1588</td><td>802.1AS (≈ 1588-2019 PTP Relay Instance with gPTP profile)</td></tr>
      <tr><td>Sync handling</td><td>Terminates; generates its own Sync from its <b>disciplined</b> clock</td><td>Forwards the same message</td><td>Forwards the same message</td><td>Terminates; generates new Sync per master port</td></tr>
      <tr><td>Adds to correctionField</td><td>Nothing (new origin timestamp instead)</td><td>Residence time</td><td>Residence time + upstream link delay</td><td>rateRatio × (residence + upstream link delay)</td></tr>
      <tr><td>Delay mechanism</td><td>E2E or P2P per port</td><td>E2E, end to end (Delay_Req also corrected)</td><td>P2P per link</td><td>P2P per link (mandatory)</td></tr>
      <tr><td>Own clock locked to GM?</td><td><span class="yes">Yes</span>, a servo per BC</td><td><span class="no">No</span> (should be syntonized for accuracy)</td><td><span class="no">No</span> (should be syntonized)</td><td><span class="no">Not required</span>: frequency handled by rateRatio</td></tr>
      <tr><td>Announce / BMCA</td><td>Yes, per port states</td><td>Transparent (forwarded)</td><td>Transparent (forwarded)</td><td>Yes, per port roles (or static in automotive)</td></tr>
      <tr><td>Error accumulation</td><td>Servo cascade: noise and gain peaking per hop</td><td>Timestamp noise per hop, plus delay changes on long paths</td><td>Timestamp noise per hop</td><td>Timestamp noise + rate-ratio noise per hop, one servo at the end</td></tr>
      <tr><td>Scales with</td><td>Hops (servo bandwidth must shrink)</td><td>Number of slaves (Delay_Req load on the GM)</td><td>Hops</td><td>Hops</td></tr>
      <tr><td>Linux ptp4l</td><td><code>clock_type BC</code> (automatic with 2+ ports)</td><td><code>clock_type E2E_TC</code></td><td><code>clock_type P2P_TC</code></td><td>gPTP.cfg with 2+ ports (implemented on the BC code path, PHC disciplined)</td></tr>
    </table></div>

    <h2>Lab: error accumulation over hops (toy model)</h2>
    <p>Each hop adds independent timestamp noise. In a <b>BC chain</b> every hop runs its own servo, which filters the upstream
    error but adds its own noise and wander, and the next servo has to track it. In a <b>relay chain</b> the corrections simply add up and only the end station runs a servo.
    The numbers come from a small time-domain simulation run in your browser.</p>
    <div class="card lab">
      <div class="row">
        <div><label>Hops</label><input type="number" id="m-n" value="6" min="1" max="12"></div>
        <div><label>Timestamp noise per hop [ns RMS]</label><input type="number" id="m-s" value="8" step="any"></div>
        <div><label>Servo gain per Sync (0.05 = slow … 0.7 = fast)</label><input type="number" id="m-k" value="0.3" step="0.05" min="0.01" max="1"></div>
        <div><label>Oscillator wander [ns per Sync, RMS]</label><input type="number" id="m-w" value="2" step="any"></div>
      </div>
      <button class="btn" id="m-run">▶ Run simulation</button>
      <div class="out" id="m-out"></div>
    </div>

    <h2>Mixing modes in a vehicle</h2>
    <div class="table-wrap"><table>
      <tr><th>What sits between two gPTP devices</th><th>What happens</th></tr>
      <tr><td><b>gPTP time-aware bridge</b></td><td><span class="yes">Works as designed.</span></td></tr>
      <tr><td><b>802.1Q bridge without gPTP</b></td><td><span class="no">Breaks the chain.</span> It drops <code>01-80-C2-00-00-0E</code> frames, so neither side ever sees a Pdelay response and asCapable stays false.</td></tr>
      <tr><td><b>Device that floods link-local frames</b> (hub, misconfigured switch)</td><td><span class="no">asCapable false</span> on multiple responses; if not, an unknown, variable residence time ends up in the "link delay".</td></tr>
      <tr><td><b>1588 P2P transparent clock</b> using the gPTP profile (majorSdoId 1, L2 P2P)</td><td><span class="opt">Close to a relay</span>, but without rateRatio and without per-port Sync regeneration. Accuracy suffers with long residence times and unsyntonized clocks.</td></tr>
      <tr><td><b>1588 BC bridging gPTP to a 1588 UDP/E2E sensor network</b></td><td><span class="yes">Common in practice:</span> a gateway ECU runs gPTP on one side and a 1588 profile (e.g. for a lidar) on the other, one PHC shared by both.</td></tr>
    </table></div>
  `,
  mount: (root) => {
    const row = (y, label) => `<text x="12" y="${y + 5}" font-size="12" font-weight="700">${label}</text>`;
    const nd = (id, x, y, w, t, sub, c) => `<g id="${id}"><rect class="node" x="${x}" y="${y - 24}" width="${w}" height="48" rx="7" ${c ? `style="stroke:${c}"` : ''}/><text x="${x + w / 2}" y="${y - 4}" text-anchor="middle" font-size="11.5" font-weight="700">${t}</text><text x="${x + w / 2}" y="${y + 12}" text-anchor="middle" font-size="9.5" class="t-muted">${sub}</text></g>`;
    const note = (id, x, y, t, c = 'var(--text)') => `<g id="${id}" class="f"><text x="${x}" y="${y}" text-anchor="middle" font-size="10.5" font-weight="700" style="fill:${c}">${t}</text></g>`;
    const Y = [70, 175, 280, 385];
    let svg = '';
    const labels = ['Boundary clock', 'E2E TC', 'P2P TC', 'gPTP relay'];
    const mids = [['BC', 'slave port · servo · master port'], ['E2E TC', 'forward + residence'], ['P2P TC', 'forward + residence + link'], ['Relay', 'terminate · regenerate · rateRatio']];
    Y.forEach((y, i) => {
      svg += `<g id="row${i}">${row(y, labels[i])}
        <path class="wire" d="M240,${y} L360,${y}"/><path class="wire" d="M560,${y} L680,${y}"/>
        ${nd('gm' + i, 140, y, 100, 'GM', 'master', 'var(--c-gm)')}
        ${nd('mid' + i, 360, y, 200, mids[i][0], mids[i][1], 'var(--accent)')}
        ${nd('sl' + i, 680, y, 110, 'Slave', 'end station')}</g>`;
    });
    Course.stepper(root.querySelector('#anim-modes'), {
      title: 'Four ways a switch can handle time',
      autoplayMs: 3400,
      svg: `
      <svg viewBox="0 0 900 430" role="img" aria-label="BC, E2E TC, P2P TC and gPTP relay compared">
        ${svg}
        ${note('bc1', 460, Y[0] + 40, 'servo locks the BC clock to the GM, then it acts as a master', 'var(--c-gm)')}
        ${note('bc2', 820, Y[0] - 30, 'servo #2', 'var(--warn)')}
        ${note('bc3', 410, Y[0] - 30, 'servo #1', 'var(--warn)')}
        ${note('e2e1', 460, Y[1] + 40, 'Sync and Delay_Req pass through; correction += residence', 'var(--c-sync)')}
        ${note('e2e2', 460, Y[1] - 30, 'slave measures the whole GM ↔ slave path (Delay_Req/Resp)', 'var(--c-pd)')}
        ${note('p2p1', 460, Y[2] + 40, 'correction += residence + upstream link delay', 'var(--c-sync)')}
        ${note('p2p2', 300, Y[2] - 30, 'Pdelay', 'var(--c-pd)')}${note('p2p3', 620, Y[2] - 30, 'Pdelay', 'var(--c-pd)')}
        ${note('r1', 460, Y[3] + 40, 'new Sync/Follow_Up: correction += rateRatio × (residence + link)', 'var(--c-fu)')}
        ${note('r2', 300, Y[3] - 30, 'Pdelay + NRR', 'var(--c-pd)')}${note('r3', 620, Y[3] - 30, 'Pdelay + NRR', 'var(--c-pd)')}
        ${note('r4', 840, Y[3] + 5, 'one servo', 'var(--accent-2)')}
      </svg>`,
      steps: [
        { caption: 'Four chains: GM, one switch, one slave. Only the behaviour of the switch differs.', do: s => {} },
        { caption: '<b>Boundary clock</b>: the switch is a slave on its upstream port. A servo steers its own clock to the GM, then it acts as a master on its other ports and sends Sync with <i>its own</i> timestamps. Simple and robust, but each BC adds a servo, and the errors of a cascade of servos add up.',
          do: s => { s.dim(['row1', 'row2', 'row3']); s.show(['bc1', 'bc2', 'bc3']); s.hl('mid0'); } },
        { caption: '<b>End-to-end transparent clock</b>: the switch forwards Sync (and the slave\'s Delay_Req) and adds its <b>residence time</b> to the correctionField. The slave measures the whole path to the GM with Delay_Req/Delay_Resp, and the GM has to answer every slave.',
          do: s => { s.unhl('mid0'); s.dim('row0'); s.undim('row1'); s.show(['e2e1', 'e2e2']); s.hl('mid1'); } },
        { caption: '<b>Peer-to-peer transparent clock</b>: every link measures its own delay with Pdelay. The TC adds residence time <b>plus the upstream link delay</b> to the correctionField, so the slave only needs its own link delay. Topology changes need no re-measurement.',
          do: s => { s.unhl('mid1'); s.dim('row1'); s.undim('row2'); s.show(['p2p1', 'p2p2', 'p2p3']); s.hl('mid2'); } },
        { caption: '<b>gPTP time-aware relay</b>: like a P2P TC it measures every link and accumulates residence and link delay in the correctionField. Like a BC it terminates Sync and regenerates it per port, with BMCA port roles. In addition, it carries the cumulative <b>rateRatio</b> so every interval is converted into GM time. The relay needs no servo; only the end station steers its clock.',
          do: s => { s.unhl('mid2'); s.dim('row2'); s.undim('row3'); s.show(['r1', 'r2', 'r3', 'r4']); s.hl('mid3'); } },
        { caption: 'In practice, many gPTP bridges <i>also</i> discipline their PHC to the GM, because the same clock drives 802.1Qbv gates and local applications. The correction arithmetic stays the same; with a syntonized clock, rateRatio just ends up close to 1.',
          do: s => { s.undim(['row0', 'row1', 'row2']); s.unhl('mid3'); } },
      ]
    });

    // toy simulation
    const q = s => root.querySelector(s);
    const randn = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    function run() {
      const N = Math.max(1, Math.min(12, +q('#m-n').value | 0)), sig = +q('#m-s').value || 0, K = Math.min(1, Math.max(0.01, +q('#m-k').value || 0.3)), W = +q('#m-w').value || 0;
      const T = 6000, burn = 1000;
      // x[k]: phase error of node k against the GM. Each Sync interval the oscillator wanders (random walk),
      // then a proportional servo removes K × (measured offset). Measurement = true offset + timestamp noise.
      const bc = new Array(N + 1).fill(0), rl = new Array(N + 1).fill(0);
      const sumBc = new Array(N + 1).fill(0), sumRl = new Array(N + 1).fill(0);
      for (let t = 0; t < T; t++) {
        let acc = 0;
        for (let k = 1; k <= N; k++) {
          const noise = sig * Math.SQRT2 * randn();     // egress + ingress timestamp of this hop
          // BC chain: node k follows node k-1 (whose own error is bc[k-1])
          bc[k] += W * randn();
          bc[k] -= K * (bc[k] - bc[k - 1] + noise);
          // Relay chain: an end station k hops away follows the GM through k accumulated corrections
          acc += noise;
          rl[k] += W * randn();
          rl[k] -= K * (rl[k] + acc);
          if (t > burn) { sumBc[k] += bc[k] * bc[k]; sumRl[k] += rl[k] * rl[k]; }
        }
      }
      const n = T - burn - 1;
      let out = `hop   BC chain RMS     relay RMS\n`;
      for (let k = 1; k <= N; k++) {
        const a = Math.sqrt(sumBc[k] / n), b = Math.sqrt(sumRl[k] / n);
        out += `${String(k).padStart(3)}   ${a.toFixed(1).padStart(8)} ns     ${b.toFixed(1).padStart(8)} ns   ${a > b * 1.15 ? '<span class="w">BC worse</span>' : a < b / 1.15 ? '<span class="ok">BC better</span>' : 'similar'}\n`;
      }
      out += `\nAt the last hop, BC/relay = ${(Math.sqrt(sumBc[N] / n) / Math.sqrt(sumRl[N] / n)).toFixed(2)}.  Try a fast servo (0.7) with many hops: each BC passes on its own noise and the cascade amplifies it.`;
      q('#m-out').innerHTML = out;
    }
    q('#m-run').addEventListener('click', run); run();
  }
});
