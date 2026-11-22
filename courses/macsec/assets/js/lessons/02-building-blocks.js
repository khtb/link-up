Course.register({
  id: 'building-blocks',
  title: 'Building blocks: SecY, CA, SC, SA',
  section: 'Foundations',
  minutes: 15,
  render: () => `
    <h1>Building blocks: SecY, CA, SC, SA</h1>
    <p>MACsec has its own vocabulary, and the rest of the course depends on it. Each term names a container that sits
    inside the one before it:</p>
    <p style="font-size:1.05rem"><b>CA</b> ⟶ contains <b>SecY</b>s ⟶ each has <b>SC</b>s ⟶ each SC carries <b>SA</b>s ⟶ each SA has one <b>SAK</b> and a <b>PN</b> counter.</p>

    <div id="anim-blocks"></div>

    <h2>The terms</h2>
    <div class="table-wrap"><table>
      <tr><th>Term</th><th>Stands for</th><th>What it is</th></tr>
      <tr><td><b>SecY</b></td><td>MAC Security Entity</td><td>The MACsec engine on one port. It encrypts outgoing frames, validates incoming ones, and keeps counters. It provides a <i>controlled port</i> (protected traffic) and an <i>uncontrolled port</i> (used by MKA's own EAPoL frames).</td></tr>
      <tr><td><b>CA</b></td><td>Secure Connectivity Association</td><td>The group of SecYs that hold the same long-term key (<span class="pill cak">CAK</span>). On a point-to-point link that is 2 members; on a shared LAN it can be more.</td></tr>
      <tr><td><b>SC</b></td><td>Secure Channel</td><td>A <b>one-way</b> channel from one transmitter to every receiver in the CA. Each SecY has <b>one Tx SC</b> and <b>one Rx SC per peer</b>. The Tx SC is named by its SCI.</td></tr>
      <tr><td><b>SCI</b></td><td>Secure Channel Identifier</td><td>64 bits: the 48-bit system MAC address plus a 16-bit port identifier. It goes into the GCM IV, so every transmitter's IVs are distinct.</td></tr>
      <tr><td><b>SA</b></td><td>Secure Association</td><td>One key's lifetime inside an SC. It has one <span class="pill sak">SAK</span> and a packet number counter. Each SC holds up to 4 SAs, and rekeying moves traffic from one SA to the next.</td></tr>
      <tr><td><b>AN</b></td><td>Association Number</td><td>2 bits (0–3) carried in every frame's SecTAG that tell the receiver which SA, and so which key, to use.</td></tr>
      <tr><td><b>PN</b></td><td>Packet Number</td><td>Goes up by one for each frame sent on an SA. It is part of the IV and is the basis of replay protection. 32 bits, or 64 bits with XPN.</td></tr>
      <tr><td><b>SAK</b></td><td>Secure Association Key</td><td>The AES key that actually encrypts frames. The MKA key server creates it and hands it out.</td></tr>
    </table></div>

    <h2>Try it: build an SCI</h2>
    <div class="card lab">
      <div class="row">
        <div><label>System MAC address</label><input type="text" id="sci-mac" value="00:1a:2b:3c:4d:5e"></div>
        <div><label>Port identifier (1–65535)</label><input type="number" id="sci-port" value="1" min="0" max="65535"></div>
      </div>
      <div class="out" id="sci-out"></div>
    </div>

    <div class="callout tip"><b>Why does the SCI matter?</b>
      GCM breaks completely if the same key and IV are ever used twice. In a CA every member encrypts with the
      <i>same</i> SAK, so the IV (SCI ‖ PN) has to be unique across all transmitters. Each transmitter has a different SCI,
      so two peers can use the same PN at the same moment without producing the same IV.</div>

    <h2>Point-to-point vs. multipoint</h2>
    <p>With <b>N</b> members in a CA, each SecY keeps 1 Tx SC and <b>N−1</b> Rx SCs. Most deployments are
    point-to-point (N = 2): a switch-to-switch link, a host-to-switch port, or a WAN circuit. Multipoint CAs exist
    for shared media and E-LAN services, and the key server sends one SAK to every member.</p>
  `,
  mount: (root) => {
    Course.stepper(root.querySelector('#anim-blocks'), {
      title: 'Assembling a Secure Connectivity Association',
      svg: `
      <svg viewBox="0 0 900 400" role="img" aria-label="CA, SecY, SC and SA diagram">
        <defs>
          <marker id="b-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="var(--accent)"/></marker>
          <marker id="b-arr2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="var(--accent-2)"/></marker>
        </defs>
        <g id="ca" class="f">
          <rect x="8" y="8" width="884" height="384" rx="18" fill="none" stroke="var(--k-cak)" stroke-width="2.5" stroke-dasharray="9 6"/>
          <rect x="300" y="0" width="300" height="20" rx="6" fill="var(--k-cak)"/>
          <text x="450" y="14" text-anchor="middle" font-size="12" style="fill:#fff">CA: both members hold CAK + CKN</text>
        </g>
        <!-- SecYs -->
        <g id="secy-a" class="f">
          <rect class="node" x="30" y="40" width="350" height="340" rx="14"/>
          <text x="205" y="64" text-anchor="middle" font-size="15" font-weight="700">Switch A · SecY (port Te1/0/1)</text>
        </g>
        <g id="secy-b" class="f">
          <rect class="node" x="520" y="40" width="350" height="340" rx="14"/>
          <text x="695" y="64" text-anchor="middle" font-size="15" font-weight="700">Switch B · SecY (port Te1/0/1)</text>
        </g>
        <!-- wire -->
        <line class="wire" x1="380" y1="210" x2="520" y2="210"/>
        <text x="450" y="200" text-anchor="middle" font-size="11" class="t-muted">physical link</text>

        <!-- Tx SC A -->
        <g id="txa" class="f">
          <rect x="50" y="80" width="310" height="130" rx="10" fill="none" stroke="var(--accent)" stroke-width="2"/>
          <text x="60" y="100" font-size="13" font-weight="700" style="fill:var(--accent)">Tx SC</text>
          <text x="60" y="118" font-size="11" class="mono">SCI 001a2b3c4d5e · 0001</text>
        </g>
        <g id="rxa" class="f">
          <rect x="50" y="230" width="310" height="130" rx="10" fill="none" stroke="var(--accent-2)" stroke-width="2"/>
          <text x="60" y="250" font-size="13" font-weight="700" style="fill:var(--accent-2)">Rx SC (from B)</text>
          <text x="60" y="268" font-size="11" class="mono">SCI 00aabbccddee · 0001</text>
        </g>
        <g id="txb" class="f">
          <rect x="540" y="80" width="310" height="130" rx="10" fill="none" stroke="var(--accent)" stroke-width="2"/>
          <text x="550" y="100" font-size="13" font-weight="700" style="fill:var(--accent)">Tx SC</text>
          <text x="550" y="118" font-size="11" class="mono">SCI 00aabbccddee · 0001</text>
        </g>
        <g id="rxb" class="f">
          <rect x="540" y="230" width="310" height="130" rx="10" fill="none" stroke="var(--accent-2)" stroke-width="2"/>
          <text x="550" y="250" font-size="13" font-weight="700" style="fill:var(--accent-2)">Rx SC (from A)</text>
          <text x="550" y="268" font-size="11" class="mono">SCI 001a2b3c4d5e · 0001</text>
        </g>
        <path id="arr-ab" class="f" d="M360,150 C450,150 450,300 540,300" fill="none" stroke="var(--accent)" stroke-width="2.5" marker-end="url(#b-arr)"/>
        <path id="arr-ba" class="f" d="M540,160 C450,160 450,310 360,310" fill="none" stroke="var(--accent-2)" stroke-width="2.5" marker-end="url(#b-arr2)"/>

        <!-- SAs AN0 -->
        <g id="sa0" class="f">
          <g><rect x="62" y="130" width="140" height="66" rx="8" fill="var(--k-sak)" opacity=".15" stroke="var(--k-sak)"/>
            <text x="72" y="150" font-size="12" font-weight="700">SA · AN 0</text><text x="72" y="168" font-size="11" class="mono">SAK #1</text><text id="pn-a" x="72" y="186" font-size="11" class="mono">next PN 1</text></g>
          <g><rect x="62" y="280" width="140" height="66" rx="8" fill="var(--k-sak)" opacity=".15" stroke="var(--k-sak)"/>
            <text x="72" y="300" font-size="12" font-weight="700">SA · AN 0</text><text x="72" y="318" font-size="11" class="mono">SAK #1</text><text x="72" y="336" font-size="11" class="mono">lowest PN 1</text></g>
          <g><rect x="552" y="130" width="140" height="66" rx="8" fill="var(--k-sak)" opacity=".15" stroke="var(--k-sak)"/>
            <text x="562" y="150" font-size="12" font-weight="700">SA · AN 0</text><text x="562" y="168" font-size="11" class="mono">SAK #1</text><text x="562" y="186" font-size="11" class="mono">next PN 1</text></g>
          <g><rect x="552" y="280" width="140" height="66" rx="8" fill="var(--k-sak)" opacity=".15" stroke="var(--k-sak)"/>
            <text x="562" y="300" font-size="12" font-weight="700">SA · AN 0</text><text x="562" y="318" font-size="11" class="mono">SAK #1</text><text x="562" y="336" font-size="11" class="mono">lowest PN 1</text></g>
        </g>
        <g id="sa1" class="f">
          <g><rect x="210" y="130" width="140" height="66" rx="8" fill="none" stroke="var(--k-sak)" stroke-dasharray="5 4"/>
            <text x="220" y="150" font-size="12" font-weight="700">SA · AN 1</text><text x="220" y="168" font-size="11" class="mono">SAK #2 (next)</text></g>
          <g><rect x="210" y="280" width="140" height="66" rx="8" fill="none" stroke="var(--k-sak)" stroke-dasharray="5 4"/>
            <text x="220" y="300" font-size="12" font-weight="700">SA · AN 1</text><text x="220" y="318" font-size="11" class="mono">SAK #2 (next)</text></g>
          <g><rect x="700" y="130" width="140" height="66" rx="8" fill="none" stroke="var(--k-sak)" stroke-dasharray="5 4"/>
            <text x="710" y="150" font-size="12" font-weight="700">SA · AN 1</text><text x="710" y="168" font-size="11" class="mono">SAK #2 (next)</text></g>
          <g><rect x="700" y="280" width="140" height="66" rx="8" fill="none" stroke="var(--k-sak)" stroke-dasharray="5 4"/>
            <text x="710" y="300" font-size="12" font-weight="700">SA · AN 1</text><text x="710" y="318" font-size="11" class="mono">SAK #2 (next)</text></g>
        </g>
      </svg>`,
      steps: [
        { caption: 'Every MACsec-enabled port has a <b>SecY</b>, the MACsec engine that sits between the MAC client and the MAC service.',
          do: s => s.show(['secy-a', 'secy-b']) },
        { caption: 'Both ports are configured with the same <span class="pill cak">CAK</span> and its name, the <b>CKN</b>. MKA checks this, and the two SecYs become members of one <b>Secure Connectivity Association (CA)</b>.',
          do: s => s.show('ca') },
        { caption: 'Switch A creates its <b>transmit Secure Channel</b>. The SCI is A\'s MAC address plus a port number.',
          do: s => s.show('txa') },
        { caption: 'Switch B creates a <b>receive SC</b> for A\'s SCI. An SC carries traffic in <b>one direction only</b>.',
          do: s => s.show(['rxb', 'arr-ab']) },
        { caption: 'The other direction gets its own channel: B\'s Tx SC goes to A\'s Rx SC. A point-to-point link therefore has <b>two SCs</b>.',
          do: s => s.show(['txb', 'rxa', 'arr-ba']) },
        { caption: 'MKA installs the first <span class="pill sak">SAK</span> as a <b>Secure Association</b> with <b>AN 0</b> in every SC. The Tx SA counts the <i>next PN</i> to send, and the Rx SA tracks the <i>lowest acceptable PN</i>.',
          do: s => s.show('sa0') },
        { caption: 'Each frame uses the next PN. Each PN value is used only once per SAK, because a repeated IV would break GCM.',
          do: s => { s.text('pn-a', 'next PN 1 234 567'); s.hl('sa0'); } },
        { caption: 'When a rekey comes, the key server sends <b>SAK #2</b>, which is installed as <b>AN 1</b> alongside AN 0. Senders then switch to AN 1 with no gap in traffic. The AN field is 2 bits, so an SC can hold up to 4 SAs (AN 0–3).',
          do: s => { s.unhl('sa0'); s.show('sa1'); s.hl('sa1'); } },
      ]
    });

    const mac = root.querySelector('#sci-mac'), port = root.querySelector('#sci-port'), out = root.querySelector('#sci-out');
    function upd() {
      const m = mac.value.replace(/[^0-9a-f]/gi, '').toLowerCase();
      const p = Math.max(0, Math.min(65535, parseInt(port.value || '0', 10)));
      if (m.length !== 12) { out.innerHTML = '<span class="bad">MAC must be 6 bytes (12 hex digits)</span>'; return; }
      const ph = p.toString(16).padStart(4, '0');
      out.innerHTML = `<span class="k">SCI (64 bits)</span> = <span class="ok">${m.match(/../g).join('')}</span> ‖ <span class="w">${ph}</span>
= 0x${m}${ph}

On the wire (SecTAG, SC bit = 1): ${(m + ph).match(/../g).join(' ')}
In the GCM IV:  SCI(8 bytes) ‖ PN(4 bytes) → ${m}${ph} ‖ 00000001  (first frame)`;
    }
    mac.addEventListener('input', upd); port.addEventListener('input', upd); upd();
  }
});
