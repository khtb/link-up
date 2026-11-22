Course.register({
  id: 'frame-format',
  title: 'Anatomy of a MACsec frame',
  section: 'Data plane (802.1AE)',
  minutes: 15,
  render: () => `
    <h1>Anatomy of a MACsec frame</h1>
    <p>MACsec does not tunnel a frame. It keeps the original destination and source MAC addresses, inserts a
    <b>Security TAG</b> after them, encrypts everything that follows (starting with the original EtherType), and
    appends a 16-byte <b>Integrity Check Value</b>.</p>

    <div id="anim-frame"></div>

    <h2>Click a field to inspect it</h2>
    <div class="frame-bar" id="fbar"></div>
    <div class="card fld-detail" id="fdetail"><span class="muted">Select a field above.</span></div>

    <h2>The TCI/AN byte: build it bit by bit</h2>
    <p>The third byte of the SecTAG holds six flag bits followed by the 2-bit Association Number. Click the bits to change them.</p>
    <div class="card">
      <div class="bits" id="tci-bits"></div>
      <div class="out" id="tci-out"></div>
    </div>

    <h2>Overhead and MTU</h2>
    <div class="card lab">
      <div class="row">
        <div><label>Original frame size (DA…payload, no FCS) bytes</label><input type="number" id="ov-size" value="1514" min="60" max="9216"></div>
        <div><label>SCI included in SecTAG?</label><select id="ov-sci"><option value="1">Yes (16-byte SecTAG)</option><option value="0">No (8-byte SecTAG)</option></select></div>
      </div>
      <div class="out" id="ov-out"></div>
    </div>
    <div class="callout warn"><b>MTU gotcha</b>
      MACsec adds 24–32 bytes to each frame. Every link and every transparent transport in the path has to carry
      the larger frame. When it can't, small pings succeed and large transfers stall. Raise the interface or
      provider MTU (by at least 32 bytes) before you turn MACsec on.</div>

    <h2>Variants you will meet</h2>
    <ul>
      <li><b>Integrity only</b> (E=0, C=0): the user data stays in clear text and only the ICV is added (GMAC). Useful when you need to see the traffic but still want tamper detection.</li>
      <li><b>Confidentiality offset 30 / 50</b>: the first 30 or 50 bytes of user data stay in clear text, for example so a transit device can still read IP/TCP headers for load balancing. The data is still authenticated.</li>
      <li><b>No SCI (ES/SCB or point-to-point)</b>: the receiver can work out the SCI from the source MAC, which saves 8 bytes. Many platforms call this <i>include-sci disable</i>.</li>
      <li><b>VLAN tags in the clear</b> ("ClearTag" / WAN MACsec): some vendors put 802.1Q tags <i>before</i> the SecTAG so a carrier can still switch on them. The tags are outside MACsec's protection.</li>
    </ul>
  `,
  mount: (root) => {
    // ----- transformation animation -----
    Course.stepper(root.querySelector('#anim-frame'), {
      title: 'An Ethernet frame becomes a MACsec frame',
      svg: `
      <svg viewBox="0 0 900 250" role="img" aria-label="MACsec frame transformation">
        <g font-size="12">
          <g><rect x="10" y="60" width="90" height="56" rx="4" fill="var(--plain)"/><text x="55" y="85" text-anchor="middle" style="fill:#fff" font-weight="700">DA</text><text x="55" y="102" text-anchor="middle" style="fill:#fff" font-size="10">6 B</text></g>
          <g><rect x="100" y="60" width="90" height="56" rx="4" fill="var(--plain)" opacity=".85"/><text x="145" y="85" text-anchor="middle" style="fill:#fff" font-weight="700">SA</text><text x="145" y="102" text-anchor="middle" style="fill:#fff" font-size="10">6 B</text></g>

          <g id="tag" class="f">
            <rect x="190" y="60" width="140" height="56" rx="4" fill="var(--k-cak)"/>
            <text x="260" y="80" text-anchor="middle" style="fill:#fff" font-weight="700">SecTAG</text>
            <text x="260" y="96" text-anchor="middle" style="fill:#fff" font-size="10">88E5 · TCI/AN · SL · PN</text>
            <text x="260" y="109" text-anchor="middle" style="fill:#fff" font-size="10">+ SCI (8 or 16 B)</text>
          </g>

          <g id="user" class="mv">
            <g id="plain-user">
              <rect x="190" y="60" width="70" height="56" rx="4" fill="var(--plain-2)"/><text x="225" y="85" text-anchor="middle" style="fill:#fff" font-weight="700">Type</text><text x="225" y="102" text-anchor="middle" style="fill:#fff" font-size="10">0800</text>
              <rect x="260" y="60" width="320" height="56" rx="4" fill="var(--plain-3)"/><text x="420" y="85" text-anchor="middle" style="fill:#fff" font-weight="700">Payload (IP packet…)</text><text x="420" y="102" text-anchor="middle" style="fill:#fff" font-size="10">46 – 1500 B</text>
            </g>
            <g id="enc-user" class="f">
              <rect x="190" y="60" width="390" height="56" rx="4" fill="var(--cipher)"/>
              <text x="385" y="85" text-anchor="middle" style="fill:#fff" font-weight="700">Secure Data (ciphertext)</text>
              <text x="385" y="102" text-anchor="middle" style="fill:#fff" font-size="10" class="mono">9f 3a 71 c0 e2 d8 0b 5c 44 a1 …</text>
            </g>
          </g>

          <g id="icv" class="f">
            <rect x="720" y="60" width="100" height="56" rx="4" fill="var(--k-sak)"/><text x="770" y="85" text-anchor="middle" style="fill:#fff" font-weight="700">ICV</text><text x="770" y="102" text-anchor="middle" style="fill:#fff" font-size="10">16 B</text>
          </g>

          <g id="fcs" class="mv">
            <rect x="580" y="60" width="60" height="56" rx="4" fill="var(--fcs)"/><text x="610" y="85" text-anchor="middle" style="fill:#fff" font-weight="700">FCS</text><text x="610" y="102" text-anchor="middle" style="fill:#fff" font-size="10">4 B</text>
          </g>
          <g id="fcs-new" class="f"><text x="850" y="140" text-anchor="middle" font-size="11" class="t-muted">recomputed</text></g>

          <!-- brackets -->
          <g id="br-auth" class="f">
            <path d="M10,135 L10,145 L720,145 L720,135" fill="none" stroke="var(--accent-2)" stroke-width="2"/>
            <text x="365" y="164" text-anchor="middle" font-size="12" style="fill:var(--accent-2)" font-weight="700">authenticated by the ICV (DA … Secure Data)</text>
          </g>
          <g id="br-enc" class="f">
            <path d="M330,40 L330,30 L720,30 L720,40" fill="none" stroke="var(--cipher)" stroke-width="2"/>
            <text x="525" y="22" text-anchor="middle" font-size="12" font-weight="700" class="t-muted">encrypted (confidentiality offset 0)</text>
          </g>
          <g id="br-aad" class="f">
            <path d="M10,185 L10,195 L330,195 L330,185" fill="none" stroke="var(--k-cak)" stroke-width="2"/>
            <text x="170" y="214" text-anchor="middle" font-size="12" style="fill:var(--k-cak)" font-weight="700">AAD: authenticated, sent in clear</text>
          </g>
          <g id="overhead" class="f">
            <text x="560" y="214" font-size="13" font-weight="700">Overhead: SecTAG 16 + ICV 16 = 32 bytes</text>
            <text x="560" y="232" font-size="11" class="t-muted">(24 bytes when the SCI is omitted)</text>
          </g>
        </g>
      </svg>`,
      steps: [
        { caption: 'An ordinary Ethernet II frame: destination MAC, source MAC, EtherType (here <code>0x0800</code> = IPv4), payload, FCS.',
          do: s => {} },
        { caption: 'The SecY inserts a <b>SecTAG</b> right after the source MAC. Its EtherType is <code>0x88E5</code>, so any device that sees the frame knows it is MACsec.',
          do: s => { s.move('user', 140, 0); s.move('fcs', 140, 0); s.show('tag'); } },
        { caption: 'The original EtherType and payload, together called the <b>user data</b>, are encrypted with GCM-AES under the SAK. The original EtherType is now hidden as well.',
          do: s => { s.show('enc-user'); s.show('br-enc'); } },
        { caption: 'GCM produces a 16-byte <b>ICV</b> (authentication tag), which is appended. Changing even one bit anywhere from DA to the last byte of secure data makes the ICV check fail.',
          do: s => { s.show('icv'); s.move('fcs', 240, 0); s.show('fcs-new'); } },
        { caption: 'The <b>AAD</b> (DA, SA, SecTAG) is authenticated but not encrypted, because switches need the MAC addresses and the receiver needs the SecTAG to find the right key.',
          do: s => { s.show(['br-auth', 'br-aad']); } },
        { caption: 'Total overhead is <b>32 bytes</b> with an explicit SCI, or 24 without one. The FCS is computed again over the new frame.',
          do: s => s.show('overhead') },
      ]
    });

    // ----- dissector -----
    const fields = [
      { n: 'DA', b: '6', c: 'var(--plain)', w: 7, d: 'Destination MAC, sent in clear and included in the ICV. Switches forward on it as usual.' },
      { n: 'SA', b: '6', c: 'var(--plain)', w: 7, d: 'Source MAC, sent in clear and authenticated. When the SCI is omitted, the receiver derives it from this address.' },
      { n: 'EtherType', b: '2', c: 'var(--k-cak)', w: 6, d: '<code>0x88E5</code> marks this as a MACsec frame. It is the first field of the SecTAG.' },
      { n: 'TCI/AN', b: '1', c: 'var(--k-cak)', w: 5, d: 'Tag Control Information: V (version, always 0), ES (end station), SC (SCI present), SCB (single-copy broadcast, for EPON), E (encrypted), C (changed text), then the 2-bit <b>AN</b>. Use the bit builder below.' },
      { n: 'SL', b: '1', c: 'var(--k-cak)', w: 4, d: 'Short Length: the number of secure-data bytes if fewer than 48, otherwise 0. It lets the receiver tell padding from data in short frames. The top 2 bits are reserved.' },
      { n: 'PN', b: '4', c: 'var(--k-cak)', w: 6, d: '<b>Packet Number</b>, 32 bits, sent in clear. It increases with every frame, and the receiver uses it for replay protection and to build the IV. With XPN cipher suites only the low 32 bits are sent; both ends track the upper 32.' },
      { n: 'SCI', b: '8', c: 'var(--k-cak)', w: 9, d: '<b>Secure Channel Identifier</b> (optional, present when TCI.SC=1): MAC + port ID. It tells the receiver which Rx SC, and therefore which key, applies.' },
      { n: 'Secure Data', b: 'n', c: 'var(--cipher)', w: 32, d: 'The original EtherType + payload, encrypted with GCM-AES-128/256 (or left in clear when only integrity is used). It is the same length as the plaintext, because GCM is a stream mode and needs no padding.' },
      { n: 'ICV', b: '16', c: 'var(--k-sak)', w: 10, d: 'Integrity Check Value: the 128-bit GCM tag over the AAD and the secure data. If it fails, the frame is dropped and InPktsNotValid / InPktsBadTag is incremented.' },
      { n: 'FCS', b: '4', c: 'var(--fcs)', w: 5, d: 'Ordinary Ethernet CRC-32, computed again by the MAC. It is not a security mechanism.' },
    ];
    const bar = root.querySelector('#fbar'), det = root.querySelector('#fdetail');
    bar.innerHTML = fields.map((f, i) => `<div class="fld" data-i="${i}" style="flex:${f.w};background:${f.c}">${f.n}<small>${f.b} B</small></div>`).join('');
    bar.addEventListener('click', e => {
      const el = e.target.closest('.fld'); if (!el) return;
      bar.querySelectorAll('.fld').forEach(x => x.classList.remove('sel')); el.classList.add('sel');
      const f = fields[+el.dataset.i];
      det.innerHTML = `<b>${f.n}</b> <span class="muted">(${f.b} bytes)</span><p style="margin:.4em 0 0">${f.d}</p>`;
    });

    // ----- TCI builder -----
    const bits = [
      { n: 'V', d: 'Version (must be 0)', fixed: true },
      { n: 'ES', d: 'End Station' }, { n: 'SC', d: 'SCI present' }, { n: 'SCB', d: 'Single Copy Bcast' },
      { n: 'E', d: 'Encrypted' }, { n: 'C', d: 'Changed text' }, { n: 'AN1', d: 'Assoc. Num' }, { n: 'AN0', d: 'Assoc. Num' },
    ];
    const val = [0, 0, 1, 0, 1, 1, 0, 0];
    const host = root.querySelector('#tci-bits'), out = root.querySelector('#tci-out');
    function draw() {
      host.innerHTML = bits.map((b, i) => `<div class="bit ${val[i] ? 'on' : ''}" data-i="${i}"><div class="b">${val[i]}</div><small>${b.n}</small><small class="muted">${b.d}</small></div>`).join('');
      const byte = val.reduce((a, v) => (a << 1) | v, 0);
      const an = (val[6] << 1) | val[7];
      const notes = [];
      if (val[4] !== val[5]) notes.push('<span class="bad">E and C must be equal for the GCM cipher suites: E=1,C=1 = encrypted; E=0,C=0 = integrity only.</span>');
      else notes.push(val[4] ? '<span class="ok">Confidentiality + integrity (encrypted)</span>' : '<span class="w">Integrity only: the payload is readable on the wire</span>');
      notes.push(val[2] ? 'SecTAG includes the 8-byte SCI → 16-byte SecTAG' : 'No SCI → 8-byte SecTAG. The SCI is inferred from the source MAC (ES) or the single Rx SC');
      if (val[2] && (val[1] || val[3])) notes.push('<span class="bad">If SC=1 then ES and SCB must be 0.</span>');
      out.innerHTML = `<span class="k">TCI/AN byte</span> = 0b${val.join('')} = <span class="ok">0x${byte.toString(16).padStart(2, '0').toUpperCase()}</span>   → AN = ${an}\n` + notes.join('\n')
        + `\n\nCommon values: 0x2C (SCI, encrypted, AN0) · 0x2D (AN1) · 0x0C (no SCI, encrypted, AN0) · 0x20 (SCI, integrity only)`;
    }
    host.addEventListener('click', e => {
      const b = e.target.closest('.bit'); if (!b) return;
      const i = +b.dataset.i; if (bits[i].fixed) return;
      val[i] ^= 1; draw();
    });
    draw();

    // ----- overhead calc -----
    const sz = root.querySelector('#ov-size'), sc = root.querySelector('#ov-sci'), ov = root.querySelector('#ov-out');
    function calc() {
      const n = Math.max(14, parseInt(sz.value || '0', 10));
      const tag = sc.value === '1' ? 16 : 8;
      const total = n + tag + 16;
      ov.innerHTML = `Original frame:        ${n} B  (+4 FCS = ${n + 4})
SecTAG:              + ${tag} B
ICV:                 + 16 B
<span class="k">MACsec frame:          ${total} B  (+4 FCS = ${total + 4})</span>
Overhead:              ${tag + 16} B  (${((tag + 16) / n * 100).toFixed(2)} %)
` + (n >= 1514 ? `<span class="w">A 1500-byte IP MTU now needs a ${total}-byte L2 frame (+FCS ${total + 4}). Check the transport MTU.</span>` : '');
    }
    sz.addEventListener('input', calc); sc.addEventListener('change', calc); calc();
  }
});
