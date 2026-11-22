Course.register({
  id: 't1s',
  title: '10BASE-T1S: MACsec on a shared medium',
  section: 'Automotive',
  minutes: 30,
  render: () => `
    <h1>10BASE-T1S: MACsec on a shared medium</h1>
    <p><b>10BASE-T1S</b> (IEEE 802.3cg-2019) runs 10 Mbit/s Ethernet over a single unshielded twisted pair. It can work
    point-to-point, but what makes it interesting for cars is the <b>multidrop</b> mode: one pair of wires, at least
    25 m long, with at least 8 nodes tapped onto it. One cable replaces a star of point-to-point links, and the edge nodes
    (lights, seat and mirror controllers, small sensors and actuators) stay cheap. Usually one <b>head node</b> (a zone
    controller, switch or gateway) connects the bus to the rest of the car.</p>

    <div class="grid3">
      <div class="card"><b>Medium</b><br><span class="muted">One UTP pair, a <i>mixing segment</i> with many taps. The bus is half-duplex: only one node transmits at a time.</span></div>
      <div class="card"><b>Access</b><br><span class="muted"><b>PLCA</b> (Physical Layer Collision Avoidance, Clause 148) gives each node a turn in order, so there are no collisions and latency is bounded.</span></div>
      <div class="card"><b>Interfaces</b><br><span class="muted">A PHY attached to an MCU MAC, or an OPEN Alliance <b>TC6 MAC-PHY</b> (MAC and PHY in one chip, connected over SPI) for MCUs without an Ethernet MAC.</span></div>
    </div>

    <h2>How PLCA shares the wire</h2>
    <div id="anim-plca"></div>
    <div class="table-wrap"><table>
      <tr><th>PLCA parameter</th><th>Meaning</th><th>Typical / default</th></tr>
      <tr><td><b>node-id</b></td><td>The node's place in the round. <b>ID 0 is the coordinator</b>, which sends the BEACON that starts each cycle.</td><td>0 … node-cnt−1</td></tr>
      <tr><td><b>node-cnt</b></td><td>Number of transmit opportunities per cycle (set on the coordinator).</td><td>8</td></tr>
      <tr><td><b>to-tmr</b></td><td>How long a node's opportunity lasts if it has nothing to send.</td><td>32 bit times (3.2 µs)</td></tr>
      <tr><td><b>burst-cnt / burst-tmr</b></td><td>Lets a node send more than one frame per opportunity.</td><td>0 (one frame) / 128 bit times</td></tr>
    </table></div>

    <h2>MACsec on a shared medium</h2>
    <p>IEEE 802.1AE already describes shared media (clause 7): a CA with <b>N members</b>, in which every member has
    <b>one Tx SC</b> and <b>N−1 Rx SCs</b>. On a T1S bus every node physically receives every frame, so the bus behaves
    exactly like a multipoint CA. The question is how many channels and keys each node has to hold, and small edge
    nodes have very little hardware.</p>

    <div class="card lab">
      <div class="row">
        <div><label>End nodes on the bus (plus one head node)</label><input type="number" id="cf-n" value="3" min="1" max="15"></div>
        <div><label>Configuration</label>
          <select id="cf-c">
            <option value="1">1: single CA, everyone talks to everyone</option>
            <option value="2">2: one CA per end node (pairwise with head)</option>
            <option value="3" selected>3: single CA, end nodes listen only to the head</option>
          </select></div>
      </div>
      <div id="cf-svg"></div>
      <div class="out" id="cf-out"></div>
      <p class="src">The three configurations come from J. McIntosh (Microchip), <i>MACsec with Shared Media</i>, IEEE 802.1 contribution, July 2023. That deck refers to an earlier TC17 discussion by P. Axer (NXP), February 2023.</p>
    </div>

    <div class="callout warn"><b>A group SAK authenticates the group, not the sender</b>
      In a single CA (configurations 1 and 3), every member holds the <i>same</i> SAK. Any member can therefore create a valid
      frame carrying another member's SCI, and an end node could even decrypt traffic it was never meant to read. The
      SCI only keeps the GCM IVs unique. It does not prove who sent the frame. If you need per-node authenticity on the
      bus, you need one CA per node pair (configuration 2), at the cost of more keys in the head node.</div>

    <h2>Why MKA struggles on a multidrop bus</h2>
    <p>On a two-station link, an automotive-tuned MKA secures in under 10 ms. With 7 stations on one bus, the startup
    time becomes a problem again. Standard MKA (802.1X-2020 clause 9.8) says the key server <b>distributes a new SAK
    whenever a member joins</b>, so that a key, salt and PN combination is never reused. ECUs on a bus boot at
    slightly different times, so each late arrival triggers another rekey.</p>

    <div class="card lab">
      <div class="row">
        <div><label>Stations joining after the first pair</label><input type="number" id="rj-n" value="3" min="0" max="7"></div>
        <div><label>Time per SAK distribution (ms)</label><input type="number" id="rj-t" value="30" min="1" max="500"></div>
        <div><label>Startup target (ms)</label><input type="number" id="rj-g" value="30" min="1" max="2000"></div>
      </div>
      <div id="rj-tl" style="margin-top:10px"></div>
      <div class="out" id="rj-out"></div>
    </div>

    <h3>Other problems raised for automotive shared-medium MKA</h3>
    <ul>
      <li><b>XPN and the SSCI.</b> With XPN cipher suites the key server gives each member a Short SCI. A member joining or leaving changes the SSCI assignment, and that forces a new SAK.</li>
      <li><b>Detecting a departure.</b> A station that silently disappears is only noticed after the <b>6 s MKA Life Time</b>.</li>
      <li><b>Undervoltage while cranking.</b> Several ECUs drop off and come back together. The key server can't tell which SAK a returning station last used, because a SAK Use message may have been lost, so it has to rekey on every rejoin.</li>
      <li><b>Runtime load.</b> ECUs start up quickly, but once the application is running MKA gets fewer CPU cycles, so repeated rekeys hurt more.</li>
      <li><b>Peer count.</b> Some implementations assume at most 8 peers per CA. That limit has been raised as an issue for shared-medium use.</li>
    </ul>

    <h3>Approaches investigated (IEEE 802.1, 2025)</h3>
    <div class="table-wrap"><table>
      <tr><th>Approach</th><th>Idea</th><th>Outcome</th></tr>
      <tr><td><b>1 · Don't rekey on join</b></td><td>On a join, redistribute the current SAK with the same KN. Rekey only on a leave.</td><td>Fails with XPN (SSCI changes) and leaves are detected late. After an undervoltage event it falls back to rekeying on every join. <span class="tag no">no help</span></td></tr>
      <tr><td><b>2 · Key server holds state and fast-forwards</b></td><td>The key server keeps every station's SAK Use state and sends it, plus a PN margin, to a returning station, which then sets up its Rx PNs.</td><td>Works, but changes MKA incompatibly. <span class="tag warn">incompatible</span></td></tr>
      <tr><td><b>3 · SSCI bumping</b></td><td>Never reuse or re-order SSCIs. Mark departed ones invalid and give a rejoining station a new SSCI.</td><td>XPN only (more expensive), and not quite MKA-compatible. <span class="tag warn">partial</span></td></tr>
      <tr><td><b>Explicit SSCI / MKA optimizations</b></td><td>Further 2025 contributions propose carrying the SSCI explicitly so one SAK can stay in use while members change, together with other MKA timing optimizations.</td><td>Under discussion in IEEE 802.1. <span class="tag">open</span></td></tr>
    </table></div>
    <p class="src">Sources: L. Völker (Technica Engineering), <i>Automotive Requirements for MKA</i>, IEEE 802.1, 2025-03-12. Its conclusion was that no working solution fully compatible with MKA had yet been identified. Also IEEE 802.1 2025 contributions <i>x-molina-mka-explicit-ssci</i> and <i>x-seaman-mka-optimizations</i>, and the ePrint paper <i>MKA Meets Multidrop</i> (2026/1661).</p>

    <div class="callout"><b>Where things stand</b>
      The OPEN Alliance Automotive MACsec Specification v1.0 covers 10BASE-T1S point-to-point only. Shared-medium mode
      is planned for a later revision by the TC17 10BASE-T1S subgroup. Software MKA has been demonstrated on 10BASE-T1S, but no formal
      standard for MACsec on a multidrop bus exists yet. Treat everything multidrop as work in progress and check the
      current TC17 documents before you design for it.</div>

    <h2>10BASE-T1S on Linux</h2>
    <p>Linux supports 10BASE-T1S PHYs and MAC-PHYs, and its software <code>macsec</code> driver runs on top of any Ethernet
    netdev, including a T1S interface. PLCA is configured through ethtool (kernel 6.3 or later, with a recent ethtool):</p>
<pre><code><span class="c"># Head node = PLCA coordinator (ID 0) for a bus with 4 nodes</span>
ethtool --set-plca-cfg eth1 enable on node-id 0 node-cnt 4

<span class="c"># Edge nodes take IDs 1..3 (node-cnt only matters on the coordinator)</span>
ethtool --set-plca-cfg eth1 enable on node-id 2

ethtool --get-plca-cfg eth1      <span class="c"># show settings (to-tmr, burst-cnt …)</span>
ethtool --get-plca-status eth1   <span class="c"># is the PLCA beacon being seen?</span></code></pre>
    <ul>
      <li><b>Drivers to look for:</b> the OPEN Alliance TC6 MAC-PHY framework (<code>oa_tc6</code>) with the Microchip LAN865x MAC-PHY driver, and T1S PHY drivers such as Microchip LAN867x (<code>microchip_t1s</code>) and onsemi NCN26000. Check your kernel version, because support arrived over several releases.</li>
      <li><b>Multipoint MACsec on Linux:</b> create one <code>macsec</code> device and add one <code>rx</code> channel per peer SCI. That gives you configuration 1 or 3 with a shared SAK. <code>labs/03-shared-medium-netns.sh</code> simulates a 4-node bus with network namespaces and a bridge, so you can try it without hardware.</li>
    </ul>
  `,
  mount: (root) => {
    // ---------- PLCA animation ----------
    const X = [130, 340, 550, 760];
    const node = (i, label, sub) => `
      <g id="n${i}"><line x1="${X[i]}" y1="110" x2="${X[i]}" y2="160" class="wire"/>
        <rect x="${X[i] - 75}" y="160" width="150" height="62" rx="10" class="node"/>
        <text x="${X[i]}" y="184" text-anchor="middle" font-weight="700" font-size="13">${label}</text>
        <text x="${X[i]}" y="203" text-anchor="middle" font-size="10.5" class="mono t-muted">${sub}</text></g>
      <g id="rx${i}" class="f"><rect x="${X[i] - 79}" y="156" width="158" height="70" rx="12" fill="none" stroke="var(--accent-2)" stroke-width="2.5"/></g>`;
    Course.stepper(root.querySelector('#anim-plca'), {
      title: 'One PLCA cycle on a 4-node 10BASE-T1S bus',
      svg: `
      <svg viewBox="0 0 900 290" role="img" aria-label="PLCA round robin on a multidrop bus">
        <g font-size="12">
          <line x1="40" y1="110" x2="860" y2="110" stroke="var(--wire)" stroke-width="6" stroke-linecap="round"/>
          <text x="40" y="100" font-size="11" class="t-muted">single twisted pair · mixing segment · 10 Mbit/s half duplex</text>
          ${node(0, 'Head · zone ctrl', 'PLCA ID 0 · coordinator')}
          ${node(1, 'Rear light', 'PLCA ID 1')}
          ${node(2, 'Seat module', 'PLCA ID 2')}
          ${node(3, 'Rain sensor', 'PLCA ID 3')}
          <g id="beacon" class="f"><circle cx="130" cy="110" r="16" fill="var(--warn)" opacity=".35"/><circle cx="130" cy="110" r="7" fill="var(--warn)"/>
            <text x="130" y="72" text-anchor="middle" font-size="11" font-weight="700" style="fill:var(--warn)">BEACON</text></g>
          <g id="tok" class="mv f"><polygon points="120,124 140,124 130,140" fill="var(--accent)"/><text x="130" y="154" text-anchor="middle" font-size="10" font-weight="700" style="fill:var(--accent)">TO</text></g>
          <g id="f0" class="f"><rect x="170" y="96" width="120" height="28" rx="5" fill="var(--plain)"/><text x="230" y="114" text-anchor="middle" font-size="10.5" style="fill:#fff" font-weight="700">frame → ID 3</text></g>
          <g id="f2" class="f"><rect x="590" y="96" width="140" height="28" rx="5" fill="var(--cipher)"/><text x="660" y="114" text-anchor="middle" font-size="10.5" style="fill:#fff" font-weight="700">🔒 MACsec · SCI=ID2</text></g>
          <g id="y1" class="f"><text x="340" y="248" text-anchor="middle" font-size="11" class="t-muted">nothing to send → yields after 3.2 µs</text></g>
          <g id="y3" class="f"><text x="760" y="248" text-anchor="middle" font-size="11" class="t-muted">nothing to send → yields</text></g>
          <g id="sec" class="f"><text x="450" y="278" text-anchor="middle" font-size="12" font-weight="700">Every node hears every frame, so MACsec must work as a multipoint CA</text></g>
        </g>
      </svg>`,
      steps: [
        { caption: 'Four nodes share one twisted pair. The head node (zone controller) is the PLCA <b>coordinator, ID 0</b>, and the others take IDs 1–3.',
          do: s => {} },
        { caption: 'The coordinator sends a <b>BEACON</b>. It starts a new cycle and synchronizes everyone.',
          do: s => { s.show('beacon'); s.pulse('beacon'); } },
        { caption: 'Transmit opportunity <b>TO 0</b> belongs to the head. It has a frame queued and sends it. Because the medium is shared, <b>every node receives it</b>.',
          do: s => { s.show(['tok', 'f0', 'rx1', 'rx2', 'rx3']); } },
        { caption: '<b>TO 1</b>: the rear light has nothing to send. After the TO timer (32 bit times = 3.2 µs) the opportunity passes on. This round robin is what makes latency bounded.',
          do: s => { s.hide(['f0', 'rx1', 'rx2', 'rx3', 'beacon']); s.move('tok', 210, 0); s.show('y1'); } },
        { caption: '<b>TO 2</b>: the seat module sends a <b>MACsec-protected</b> frame, with its own SCI in the SecTAG. Nodes that have an Rx SC for that SCI check and decrypt it. The rest drop it.',
          do: s => { s.move('tok', 420, 0); s.show(['f2', 'rx0', 'rx1', 'rx3']); } },
        { caption: '<b>TO 3</b> yields, the cycle ends, and the coordinator sends the next BEACON. No collisions occurred, and each node waits at most one cycle for its turn.',
          do: s => { s.hide(['f2', 'rx0', 'rx1', 'rx3']); s.move('tok', 630, 0); s.show(['y3', 'beacon', 'sec']); } },
      ]
    });

    // ---------- SC configuration calculator ----------
    const nIn = root.querySelector('#cf-n'), cIn = root.querySelector('#cf-c');
    const svgHost = root.querySelector('#cf-svg'), out = root.querySelector('#cf-out');
    function drawCfg() {
      const E = Math.max(1, Math.min(15, parseInt(nIn.value, 10) || 1));
      const c = cIn.value;
      const head = c === '1' ? { tx: 1, rx: E, cas: 1 } : c === '2' ? { tx: E, rx: E, cas: E } : { tx: 1, rx: E, cas: 1 };
      const end = c === '1' ? { tx: 1, rx: E } : { tx: 1, rx: 1 };
      const shown = Math.min(E, 6);
      const w = 900, gap = (w - 100) / Math.max(1, shown);
      let g = `<line x1="40" y1="120" x2="860" y2="120" stroke="var(--wire)" stroke-width="5" stroke-linecap="round"/>`;
      g += `<rect x="370" y="20" width="160" height="56" rx="10" class="node"/><text x="450" y="44" text-anchor="middle" font-weight="700" font-size="13">Head node</text>
            <text x="450" y="63" text-anchor="middle" font-size="11" class="mono t-muted">Tx ${head.tx} · Rx ${head.rx}</text><line x1="450" y1="76" x2="450" y2="120" class="wire"/>`;
      for (let i = 0; i < shown; i++) {
        const x = 50 + gap * i + gap / 2;
        g += `<line x1="${x}" y1="120" x2="${x}" y2="160" class="wire"/><rect x="${x - 55}" y="160" width="110" height="54" rx="9" class="node"/>
              <text x="${x}" y="183" text-anchor="middle" font-weight="700" font-size="12">End ${String.fromCharCode(65 + i)}</text>
              <text x="${x}" y="201" text-anchor="middle" font-size="10.5" class="mono t-muted">Tx ${end.tx} · Rx ${end.rx}</text>`;
      }
      if (E > shown) g += `<text x="860" y="240" text-anchor="end" font-size="11" class="t-muted">+${E - shown} more end nodes</text>`;
      svgHost.innerHTML = `<div class="stage-svg"><svg viewBox="0 0 900 250" role="img" aria-label="Secure channels per node" style="display:block;width:100%;min-width:520px">${g}</svg></div>`;
      const totalSC = head.tx + head.rx + E * (end.tx + end.rx);
      const notes = {
        '1': 'All nodes talk to all nodes with full privacy and authentication. Each end node needs N−1 Rx SCs, which exceeds the AutoMACsec-01002 minimum of 1 Tx + 1 Rx per port.',
        '2': 'Each end node has its own CA (its own CAK and SAK) with the head. This gives per-node authenticity and stops end nodes from reading each other, but the head needs a Tx SC per end node, and every end node needs its own CAK provisioned.',
        '3': 'The head "broadcasts" to the end nodes, and the end nodes only listen to the head. End nodes keep the AutoMACsec minimum of 1 Tx and 1 Rx SC. They all share one SAK, though, so they are authenticated as a group, not individually.',
      };
      out.innerHTML = `<span class="k">Head node</span>    Tx SCs ${head.tx}   Rx SCs ${head.rx}   CAs ${head.cas}
<span class="k">Each end node</span> Tx SCs ${end.tx}   Rx SCs ${end.rx}   CAs 1
<span class="k">Whole bus</span>     ${totalSC} secure channels, ${c === '2' ? E + ' CAKs / SAKs' : '1 CAK, 1 shared SAK'}

${notes[c]}`;
    }
    nIn.addEventListener('input', drawCfg); cIn.addEventListener('change', drawCfg); drawCfg();

    // ---------- rekey-on-join timeline ----------
    const rn = root.querySelector('#rj-n'), rt = root.querySelector('#rj-t'), rg = root.querySelector('#rj-g');
    const tlHost = root.querySelector('#rj-tl'), rOut = root.querySelector('#rj-out');
    function drawRj() {
      const n = Math.max(0, Math.min(7, parseInt(rn.value, 10) || 0));
      const t = Math.max(1, parseInt(rt.value, 10) || 30), goal = Math.max(1, parseInt(rg.value, 10) || 30);
      const total = t * (n + 1);
      const scale = Math.max(total, goal) * 1.08;
      const rows = [{ n: 'KS + first peer', s: 0, d: t, c: 'var(--accent)', l: 'SAK KN 1' }];
      for (let i = 0; i < n; i++) rows.push({ n: `Station ${String.fromCharCode(66 + i)} joins`, s: t * (i + 1), d: t, c: 'var(--k-sak)', l: `rekey → KN ${i + 2}` });
      rows.push({ n: 'Target', s: 0, d: goal, c: 'var(--accent-2)', l: `${goal} ms` });
      tlHost.innerHTML = rows.map(r => `<div class="tl-row"><span>${r.n}</span><div class="tl-track"><div class="tl-bar" style="left:${r.s / scale * 100}%;width:${Math.max(1, r.d / scale * 100)}%;background:${r.c}">${r.l}</div></div></div>`).join('');
      rOut.innerHTML = total <= goal
        ? `<span class="ok">Everyone secured after ${total} ms, within the ${goal} ms target.</span>`
        : `<span class="bad">The last station is secured after ${total} ms, ${total - goal} ms over the ${goal} ms target.</span>
Every join triggers a fresh SAK distribution, and the joins don't overlap, so the delays add up.
Cutting a rekey short to start the next one would drop connectivity, or make the newest station join even later.`;
    }
    [rn, rt, rg].forEach(e => e.addEventListener('input', drawRj)); drawRj();
  }
});
