Course.register({
  id: 'pdelay',
  title: 'Peer delay & rate ratio',
  section: 'Timestamping',
  minutes: 20,
  render: () => `
    <h1>Peer delay and rate ratio</h1>
    <p>gPTP uses the <b>peer-to-peer delay mechanism</b>: every port measures the cable to its direct neighbour, all the time,
    independently of who the GM is and in both directions. When the synchronization tree changes, every link delay is already known.
    The same exchange also measures the <b>frequency ratio</b> between the two neighbours.</p>

    <div id="anim-pd"></div>

    <h2>The formulas</h2>
    <div class="card">
      <div class="out">meanLinkDelay      = ( neighborRateRatio · (t4 − t1) − (t3 − t2) ) / 2
neighborRateRatio  = (t3[N] − t3[0]) / (t4[N] − t4[0])       ≈ f_responder / f_initiator
asCapable          = neighbour is 802.1AS-capable  ∧  meanLinkDelay ≤ neighborPropDelayThresh  ∧  exactly one response per request</div>
      <p class="muted" style="margin:.6em 0 0"><code>t4 − t1</code> is measured with the initiator's clock and <code>t3 − t2</code> (the
      turnaround) with the responder's. Multiplying by the rate ratio converts the first interval into responder time before subtracting.
      Lab 2 below shows why this matters.</p>
    </div>

    <h2>Lab 1: compute the link delay</h2>
    <div class="card lab">
      <div class="row">
        <div><label>t1 Pdelay_Req TX (initiator) [ns]</label><input type="number" id="p-t1" value="1000"></div>
        <div><label>t2 Pdelay_Req RX (responder) [ns]</label><input type="number" id="p-t2" value="58250"></div>
        <div><label>t3 Pdelay_Resp TX (responder) [ns]</label><input type="number" id="p-t3" value="5058250"></div>
        <div><label>t4 Pdelay_Resp RX (initiator) [ns]</label><input type="number" id="p-t4" value="5001250"></div>
      </div>
      <div class="row">
        <div><label>Responder frequency relative to initiator [ppm] (neighborRateRatio − 1)</label><input type="number" id="p-ppm" value="0" step="any"></div>
      </div>
      <div class="out" id="p-out"></div>
    </div>

    <h2>Lab 2: why neighborRateRatio is needed</h2>
    <p>Simulate a 5 m automotive cable (≈ 25 ns) between two clocks with a frequency difference. Change the turnaround time and the ppm difference.</p>
    <div class="card lab">
      <div class="row">
        <div><label>True cable delay [ns]</label><input type="number" id="r-d" value="25" step="any"></div>
        <div><label>Responder turnaround t3 − t2 [µs]</label><input type="number" id="r-turn" value="1000" step="any"></div>
        <div><label>Frequency offset responder vs initiator [ppm]</label><input type="number" id="r-ppm" value="100" step="any"></div>
      </div>
      <div class="out" id="r-out"></div>
    </div>
    <div class="callout warn"><b>Turnaround time matters</b>
      The error from ignoring the rate ratio is about <code>turnaround × Δf / 2</code>. With a 10 ms software turnaround (the
      upper limit 802.1AS allows) and 100 ppm, that is 500 ns on a 25 ns cable. Measuring and applying neighborRateRatio removes it,
      and so does a fast hardware or firmware responder.</div>

    <h2>Lab 3: is the port asCapable?</h2>
    <div class="card lab">
      <label class="chk"><input type="checkbox" id="a-resp" checked> Pdelay_Resp and Resp_Follow_Up received (fewer than allowedLostResponses missed)</label>
      <label class="chk"><input type="checkbox" id="a-sdo" checked> Responses carry majorSdoId = 1 (gPTP) and correct requestingPortIdentity</label>
      <label class="chk"><input type="checkbox" id="a-multi"> More than one response to the same request</label>
      <label class="chk"><input type="checkbox" id="a-self"> Response has my own clockIdentity (port looped back)</label>
      <label class="chk"><input type="checkbox" id="a-nrr" checked> neighborRateRatio valid (two or more exchanges completed)</label>
      <label>Measured meanLinkDelay [ns]: <b id="a-dv">60</b></label><input type="range" id="a-dly" min="0" max="2000" value="60">
      <label class="chk"><input type="checkbox" id="a-auto"> Automotive profile: <code>asCapable true</code> by configuration</label>
      <div class="out" id="a-out"></div>
    </div>

    <h2>Things that go wrong</h2>
    <div class="table-wrap"><table>
      <tr><th>Symptom</th><th>Cause</th></tr>
      <tr><td>Link delay jumps between ~0 and a few µs</td><td>Software timestamping, or the TX timestamp of Pdelay_Resp is late (two-step responder overloaded).</td></tr>
      <tr><td>Negative link delay</td><td>Uncompensated ingress/egress latency (PHY), or wrong <code>delayAsymmetry</code>. ptp4l accepts down to <code>min_neighbor_prop_delay</code> (−20 ms in gPTP.cfg) so this does not drop asCapable on its own.</td></tr>
      <tr><td>"received PDELAY_RESP with multiple responses" / asCapable false</td><td>A non-gPTP switch or hub in the path is <i>forwarding</i> the link-local frames, so two neighbours answer.</td></tr>
      <tr><td>asCapable never becomes true</td><td>The neighbour runs plain 1588 (majorSdoId 0), uses E2E (Delay_Req), or uses UDP. Or link delay is above 800 ns (long fibre: raise the threshold).</td></tr>
      <tr><td>Delay ok but time offset has a constant bias</td><td><b>Asymmetry</b>: the two directions differ (PHY TX ≠ RX latency, different lanes). Pdelay cannot see it; it must be calibrated and configured as delayAsymmetry.</td></tr>
    </table></div>
  `,
  mount: (root) => {
    const I = 170, R = 730;
    Course.stepper(root.querySelector('#anim-pd'), {
      title: 'One Pdelay exchange (two-step responder)',
      svg: `
      <svg viewBox="0 0 900 360" role="img" aria-label="Pdelay timing diagram">
        <defs><marker id="ah7" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--text)"/></marker></defs>
        <text x="${I}" y="24" text-anchor="middle" font-weight="700" font-size="13">Initiator (any port)</text>
        <text x="${R}" y="24" text-anchor="middle" font-weight="700" font-size="13">Responder (neighbour port)</text>
        <line x1="${I}" y1="36" x2="${I}" y2="340" stroke="var(--border-2)" stroke-width="2"/>
        <line x1="${R}" y1="36" x2="${R}" y2="340" stroke="var(--border-2)" stroke-width="2"/>
        <g id="req" class="f"><line x1="${I}" y1="60" x2="${R}" y2="100" stroke="var(--c-pd)" stroke-width="2.5" marker-end="url(#ah7)"/><text x="450" y="72" text-anchor="middle" font-size="12" font-weight="700" style="fill:var(--c-pd)">Pdelay_Req</text></g>
        <g id="t1" class="f"><circle cx="${I}" cy="60" r="6" class="ts-dot"/><text x="${I - 12}" y="64" text-anchor="end" class="mono" font-size="12" style="fill:var(--c-ts)">t1</text></g>
        <g id="t2" class="f"><circle cx="${R}" cy="100" r="6" class="ts-dot"/><text x="${R + 12}" y="104" class="mono" font-size="12" style="fill:var(--c-ts)">t2</text></g>
        <g id="turn" class="f"><path d="M${R + 40},100 L${R + 40},170" stroke="var(--muted)" stroke-width="1.5" marker-start="url(#ah7)" marker-end="url(#ah7)"/><text x="${R + 50}" y="140" font-size="11" class="t-muted">turnaround</text><text x="${R + 50}" y="154" font-size="11" class="t-muted">(responder clock)</text></g>
        <g id="resp" class="f"><line x1="${R}" y1="170" x2="${I}" y2="210" stroke="var(--c-pd)" stroke-width="2.5" marker-end="url(#ah7)"/><text x="450" y="174" text-anchor="middle" font-size="12" font-weight="700" style="fill:var(--c-pd)">Pdelay_Resp { requestReceiptTimestamp = t2 }</text></g>
        <g id="t3" class="f"><circle cx="${R}" cy="170" r="6" class="ts-dot"/><text x="${R + 12}" y="174" class="mono" font-size="12" style="fill:var(--c-ts)">t3</text></g>
        <g id="t4" class="f"><circle cx="${I}" cy="210" r="6" class="ts-dot"/><text x="${I - 12}" y="214" text-anchor="end" class="mono" font-size="12" style="fill:var(--c-ts)">t4</text></g>
        <g id="rfu" class="f"><line x1="${R}" y1="235" x2="${I}" y2="275" stroke="var(--c-fu)" stroke-width="2.5" marker-end="url(#ah7)"/><text x="450" y="238" text-anchor="middle" font-size="12" font-weight="700" style="fill:var(--c-fu)">Pdelay_Resp_Follow_Up { responseOriginTimestamp = t3 }</text></g>
        <g id="rt" class="f"><path d="M${I - 40},60 L${I - 40},210" stroke="var(--muted)" stroke-width="1.5" marker-start="url(#ah7)" marker-end="url(#ah7)"/><text x="${I - 48}" y="140" text-anchor="end" font-size="11" class="t-muted">round trip</text><text x="${I - 48}" y="154" text-anchor="end" font-size="11" class="t-muted">(initiator clock)</text></g>
        <g id="res" class="f"><rect x="220" y="294" width="460" height="44" rx="8" fill="var(--accent-soft)" stroke="var(--accent)"/><text x="450" y="321" text-anchor="middle" font-size="13" class="mono" font-weight="700">D = ( r·(t4 − t1) − (t3 − t2) ) / 2</text></g>
      </svg>`,
      steps: [
        { caption: 'Both ports of a link run this exchange independently (each is initiator once per second by default). Here the left port measures.', do: s => {} },
        { caption: 'The initiator sends <b>Pdelay_Req</b> and timestamps it on TX: <code>t1</code> (initiator clock).', do: s => s.show(['req', 't1']) },
        { caption: 'The responder timestamps its arrival: <code>t2</code> (responder clock).', do: s => s.show('t2') },
        { caption: 'After some turnaround time it sends <b>Pdelay_Resp</b>, which carries <code>t2</code>, and timestamps its TX: <code>t3</code>. The initiator timestamps the arrival: <code>t4</code>.', do: s => s.show(['turn', 'resp', 't3', 't4']) },
        { caption: 'Like Sync, <code>t3</code> is only known after the fact, so a two-step responder sends it in <b>Pdelay_Resp_Follow_Up</b>. (A one-step responder instead puts <code>t3 − t2</code> into the Pdelay_Resp correctionField.)', do: s => s.show('rfu') },
        { caption: 'The initiator has all four. The round trip minus the turnaround, halved, is the one-way <b>link delay</b>, assuming the two directions are symmetric. <code>r</code> is the neighborRateRatio, from comparing t3 and t4 across successive exchanges.', do: s => s.show(['rt', 'res']) },
      ]
    });

    const q = s => root.querySelector(s);
    function p() {
      const [t1, t2, t3, t4] = ['#p-t1', '#p-t2', '#p-t3', '#p-t4'].map(i => +q(i).value || 0);
      const r = PTPMath.ppmToRatio(+q('#p-ppm').value || 0);
      const d = PTPMath.meanLinkDelay({ t1, t2, t3, t4, nrr: r }), d1 = PTPMath.meanLinkDelay({ t1, t2, t3, t4, nrr: 1 });
      q('#p-out').innerHTML = `round trip   t4 − t1 = ${t4 - t1} ns (initiator clock)
turnaround   t3 − t2 = ${t3 - t2} ns (responder clock)
<span class="k">meanLinkDelay</span> = (${r.toFixed(9)} × ${t4 - t1} − ${t3 - t2}) / 2 = <span class="ok">${d.toFixed(3)} ns</span>
` + (r !== 1 ? `without the rate ratio: ${d1.toFixed(3)} ns (error ${(d1 - d).toFixed(3)} ns)\n` : '') +
      (d < 0 ? '<span class="bad">Negative: check latency compensation</span>' : d > 800 ? '<span class="bad">Above neighborPropDelayThresh (800 ns): not asCapable</span>' : `<span class="ok">≈ ${(d / 5).toFixed(1)} m of cable at ~5 ns/m</span>`);
    }
    ['#p-t1', '#p-t2', '#p-t3', '#p-t4', '#p-ppm'].forEach(i => q(i).addEventListener('input', p)); p();

    function r() {
      const D = +q('#r-d').value || 0, turn = (+q('#r-turn').value || 0) * 1000, ppm = +q('#r-ppm').value || 0;
      const rr = PTPMath.ppmToRatio(ppm);           // responder ticks per initiator tick
      // initiator reference: t1 = 0
      const t1 = 0, t2 = 5e6 + D * rr;              // responder clock arbitrary epoch 5 ms
      const t3 = t2 + turn;                         // turnaround measured in responder time
      const t4 = t1 + D + turn / rr + D;            // initiator clock
      const good = PTPMath.meanLinkDelay({ t1, t2, t3, t4, nrr: rr });
      const bad = PTPMath.meanLinkDelay({ t1, t2, t3, t4, nrr: 1 });
      q('#r-out').innerHTML = `t1 = ${t1.toFixed(1)}   t2 = ${t2.toFixed(1)}   t3 = ${t3.toFixed(1)}   t4 = ${t4.toFixed(1)}  (ns)
<span class="k">with neighborRateRatio</span>    D = ${good.toFixed(3)} ns   <span class="ok">(true ${(D * rr).toFixed(3)} ns in responder time)</span>
<span class="k">assuming ratio = 1</span>        D = ${bad.toFixed(3)} ns   ${Math.abs(bad - D) > 5 ? '<span class="bad">' : '<span class="w">'}error ${(bad - D).toFixed(3)} ns</span>
rule of thumb: turnaround × Δf / 2 = ${(turn * ppm * 1e-6 / 2).toFixed(3)} ns`;
    }
    ['#r-d', '#r-turn', '#r-ppm'].forEach(i => q(i).addEventListener('input', r)); r();

    function a() {
      const c = id => q(id).checked, d = +q('#a-dly').value;
      q('#a-dv').textContent = d;
      const why = [];
      if (c('#a-auto')) {
        q('#a-out').innerHTML = `<span class="ok">asCapable = TRUE</span> (forced by configuration; ptp4l <code>asCapable true</code> skips the 802.1AS 10.2.4.1 checks)\n<span class="w">Pdelay still runs (or a stored value is used), but a failing link will not be detected by asCapable. Monitor the delay separately.</span>`;
        return;
      }
      if (!c('#a-resp')) why.push('no (or too many lost) Pdelay responses');
      if (!c('#a-sdo')) why.push('neighbour is not gPTP (wrong majorSdoId / identity)');
      if (c('#a-multi')) why.push('multiple responses: a non-time-aware device is forwarding gPTP frames');
      if (c('#a-self')) why.push('own clockIdentity in the response: loopback');
      if (!c('#a-nrr')) why.push('neighborRateRatio not yet valid');
      if (d > 800) why.push(`meanLinkDelay ${d} ns > neighborPropDelayThresh 800 ns`);
      q('#a-out').innerHTML = why.length ? `<span class="bad">asCapable = FALSE</span>\n` + why.map(w => '  • ' + w).join('\n') + '\nNo Sync is sent or accepted on this port.' :
        `<span class="ok">asCapable = TRUE</span>\nThe port can take a master or slave role in the synchronization tree.`;
    }
    ['#a-resp', '#a-sdo', '#a-multi', '#a-self', '#a-nrr', '#a-dly', '#a-auto'].forEach(i => q(i).addEventListener('input', a)); a();
  }
});
