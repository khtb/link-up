Course.register({
  id: 'bmca',
  title: 'BMCA, Announce & port roles',
  section: 'Bridges',
  minutes: 15,
  render: () => `
    <h1>Choosing the grandmaster: BMCA, Announce and port roles</h1>
    <p>Standard gPTP is plug-and-play: every GM-capable system advertises itself in <b>Announce</b> messages and a distributed
    <b>Best Master Clock Algorithm</b> picks one GM and sets every port's role. 802.1AS uses a simplified version of the 1588
    BMCA, comparing <b>priority vectors</b>. The automotive profile turns all of this off (next section); you still need to
    understand it to see <i>why</i>.</p>

    <h2>The systemIdentity: compared field by field, lower wins</h2>
    <div class="table-wrap"><table>
      <tr><th>#</th><th>Field</th><th>gPTP defaults / meaning</th></tr>
      <tr><td>1</td><td><b>priority1</b></td><td>Set by the operator. 802.1AS: <b>246</b> network-infrastructure system, <b>248</b> other, <b>250</b> portable, <b>255</b> not GM-capable.</td></tr>
      <tr><td>2</td><td><b>clockClass</b></td><td>248 default (no external source), 6 when locked to GNSS, 255 slave-only.</td></tr>
      <tr><td>3</td><td><b>clockAccuracy</b></td><td>0xFE = unknown (default), 0x21 = within 100 ns, …</td></tr>
      <tr><td>4</td><td><b>offsetScaledLogVariance</b></td><td>0x436A default, the stability of the free-running clock.</td></tr>
      <tr><td>5</td><td><b>priority2</b></td><td>Fine tie-breaker set by the operator (default 248).</td></tr>
      <tr><td>6</td><td><b>clockIdentity</b></td><td>Final tie-breaker: unique EUI-64, so the result is always deterministic.</td></tr>
      <tr><td>7</td><td>stepsRemoved</td><td>Between paths to the <i>same</i> GM: fewer hops wins.</td></tr>
    </table></div>

    <h2>Lab: who becomes GM?</h2>
    <div class="card lab">
      <div class="bmca-row hdr"><span>System</span><span>priority1</span><span>clockClass</span><span>accuracy</span><span>variance</span><span>priority2</span><span>clockIdentity</span></div>
      <div id="bm-rows"></div>
      <div class="row" style="margin-top:8px"><div><button class="btn" id="bm-p1">Preset: all defaults</button> <button class="btn" id="bm-p2">Preset: HPC with GNSS</button> <button class="btn" id="bm-p3">Preset: automotive intent</button></div></div>
      <div class="out" id="bm-out"></div>
    </div>

    <h2>Port roles from the comparison</h2>
    <div class="grid2">
      <div class="card"><b>Slave</b><br><span class="muted">The one port per system that receives the best Announce (the path to the GM). In a GM: none.</span></div>
      <div class="card"><b>Master</b><br><span class="muted">Ports where this system's own information is better than what arrives: it sends Sync and Announce there.</span></div>
      <div class="card"><b>Passive</b><br><span class="muted">Receives an equally good path to the same GM via another route; blocked to avoid a timing loop.</span></div>
      <div class="card"><b>Disabled</b><br><span class="muted">Not asCapable, or administratively disabled.</span></div>
    </div>

    <h2>Why cars don't use BMCA</h2>
    <div class="table-wrap"><table>
      <tr><th>Property of BMCA</th><th>Problem in a vehicle</th></tr>
      <tr><td>Waits for <code>announceReceiptTimeout</code> × announce interval (3 s by default) before declaring itself GM or picking a new one</td><td>The car has to be ready to drive about a second or two after wake-up, and it restarts many times a day.</td></tr>
      <tr><td>Any device can win by advertising better values</td><td>A faulty or compromised ECU could take over the vehicle time base.</td></tr>
      <tr><td>The topology is discovered at run time</td><td>A car's topology is fixed at design time and never changes, so there is nothing to discover.</td></tr>
      <tr><td>A GM change causes a phase step in the time base</td><td>Applications want a predictable, single time source, and redundancy designed in deliberately.</td></tr>
    </table></div>
    <p>The answer since 802.1AS-2011 automotive profiles is <b>static configuration</b>; 802.1AS-2020 standardised it as
    <b>external port configuration</b> (<code>externalPortConfigurationEnabled</code>, per-port <code>desiredState</code>), see lesson 11.</p>
  `,
  mount: (root) => {
    const q = s => root.querySelector(s);
    const presets = {
      p1: [
        ['Central HPC', 248, 248, 0xFE, 0x436A, 248, '001b21fffe000001'],
        ['Zone switch L', 248, 248, 0xFE, 0x436A, 248, '00049ffffe010203'],
        ['Zone switch R', 248, 248, 0xFE, 0x436A, 248, '00049ffffe010204'],
        ['Camera ECU', 248, 248, 0xFE, 0x436A, 248, '0001c0fffe00aa00'],
      ],
      p2: [
        ['Central HPC (GNSS)', 248, 6, 0x21, 0x4E5D, 248, '001b21fffe000001'],
        ['Zone switch L', 248, 248, 0xFE, 0x436A, 248, '00049ffffe010203'],
        ['Zone switch R', 248, 248, 0xFE, 0x436A, 248, '00049ffffe010204'],
        ['Camera ECU', 248, 248, 0xFE, 0x436A, 248, '0001c0fffe00aa00'],
      ],
      p3: [
        ['Central HPC', 246, 248, 0xFE, 0x436A, 100, '001b21fffe000001'],
        ['Zone switch L', 246, 248, 0xFE, 0x436A, 200, '00049ffffe010203'],
        ['Zone switch R', 255, 255, 0xFE, 0xFFFF, 255, '00049ffffe010204'],
        ['Camera ECU', 255, 255, 0xFE, 0xFFFF, 255, '0001c0fffe00aa00'],
      ],
    };
    let rows = presets.p1.map(r => r.slice());
    const hx = (v, n) => v.toString(16).toUpperCase().padStart(n, '0');
    function draw() {
      q('#bm-rows').innerHTML = rows.map((r, i) => `<div class="bmca-row" data-i="${i}">
        <input data-k="0" value="${r[0]}"><input data-k="1" type="number" min="0" max="255" value="${r[1]}"><input data-k="2" type="number" min="0" max="255" value="${r[2]}">
        <input data-k="3" value="0x${hx(r[3], 2)}"><input data-k="4" value="0x${hx(r[4], 4)}"><input data-k="5" type="number" min="0" max="255" value="${r[5]}"><input data-k="6" value="${r[6]}"></div>`).join('');
      decide();
    }
    function decide() {
      const sys = rows.map((r, i) => ({ i, name: r[0], priority1: +r[1], clockClass: +r[2], clockAccuracy: +r[3], variance: +r[4], priority2: +r[5], clockIdentity: r[6], stepsRemoved: 0 }));
      const capable = sys.filter(s => s.priority1 < 255);
      root.querySelectorAll('.bmca-row[data-i]').forEach(el => el.classList.remove('win'));
      if (!capable.length) { q('#bm-out').innerHTML = '<span class="bad">No GM-capable system (all priority1 = 255): no time in this domain.</span>'; return; }
      const sorted = capable.slice().sort(PTPMath.compareSystem);
      const best = sorted[0];
      root.querySelector(`.bmca-row[data-i="${best.i}"]`).classList.add('win');
      let out = `<span class="ok">Grandmaster: ${Course.esc(best.name)}</span>\n`;
      sorted.slice(1).forEach(o => { out += `  beats ${Course.esc(o.name).padEnd(20)} on <span class="k">${PTPMath.decidingField(best, o)}</span>\n`; });
      sys.filter(s => s.priority1 >= 255).forEach(s => { out += `  ${Course.esc(s.name)}: priority1 255 → not GM-capable, never sends Announce as GM\n`; });
      out += `\nIn a running network this decision is reached only after Announce messages have propagated and\nannounceReceiptTimeout (3 × 1 s) has expired on ports with no better information.`;
      q('#bm-out').innerHTML = out;
    }
    q('#bm-rows').addEventListener('input', e => {
      const inp = e.target.closest('input'); if (!inp) return;
      const i = +inp.closest('.bmca-row').dataset.i, k = +inp.dataset.k;
      let v = inp.value;
      if (k === 3 || k === 4) v = parseInt(v, 16) || 0; else if (k !== 0 && k !== 6) v = Math.max(0, Math.min(255, +v | 0));
      rows[i][k] = v; decide();
    });
    ['p1', 'p2', 'p3'].forEach(p => q('#bm-' + p).addEventListener('click', () => { rows = presets[p].map(r => r.slice()); draw(); }));
    draw();
  }
});
