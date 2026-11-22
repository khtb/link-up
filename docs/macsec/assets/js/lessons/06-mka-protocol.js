Course.register({
  id: 'mka-protocol',
  title: 'MKA: peers, election & SAK distribution',
  section: 'Control plane (MKA)',
  minutes: 25,
  render: () => `
    <h1>MKA: peers, key-server election and SAK distribution</h1>
    <p><b>MACsec Key Agreement</b> (IEEE 802.1X-2010/2020, clause 9) runs on each CA. Every member periodically sends
    <b>MKPDUs</b> (MKA protocol data units) to tell the others it is alive, to learn who else is there, to elect a
    <b>key server</b>, and to hand out and confirm SAKs.</p>

    <h2>An MKPDU on the wire</h2>
    <div class="frame-bar" id="mk-bar"></div>
    <div class="card fld-detail" id="mk-detail"><span class="muted">Click a part of the MKPDU.</span></div>

    <h2>The conversation, step by step</h2>
    <div id="anim-mka"></div>

    <h2>Identities inside MKA</h2>
    <div class="table-wrap"><table>
      <tr><th>Field</th><th>Size</th><th>Purpose</th></tr>
      <tr><td><b>MI</b>: Member Identifier</td><td>96 bit</td><td>A random value chosen when a participant starts. A new MI means a new incarnation, for example after a reboot.</td></tr>
      <tr><td><b>MN</b>: Message Number</td><td>32 bit</td><td>Goes up by one with every MKPDU. Peers echo back the latest MN they have seen, which proves the peer list is fresh (replay protection for MKA).</td></tr>
      <tr><td><b>Key Server Priority</b></td><td>8 bit</td><td>The <b>lowest value wins</b> the election. 255 means "never be key server".</td></tr>
      <tr><td><b>KI</b>: Key Identifier</td><td>128 bit</td><td>The key server's MI plus a 32-bit <b>KN</b> (Key Number). It names one specific SAK.</td></tr>
      <tr><td><b>LPN</b>: Lowest acceptable PN</td><td>32 bit</td><td>Reported in SAK Use, so the key server can see PN exhaustion coming.</td></tr>
    </table></div>

    <h2>Lab: key-server election</h2>
    <p>Rule (802.1X 9.5.1): among the <b>live</b> participants that can act as key server, the one with the
    <b>lowest Key Server Priority</b> wins. On a tie, the one with the <b>lowest SCI</b> wins, comparing the SCI as
    a 64-bit number (MAC address, then port). Edit the values below.</p>
    <div class="card">
      <div class="peer-list" id="el-list"></div>
      <button class="btn" id="el-add">＋ Add participant</button>
      <div class="out" id="el-out"></div>
    </div>

    <h2>Timers</h2>
    <div class="grid3">
      <div class="card"><b>MKA Hello Time: 2 s</b><br><span class="muted">How often each participant sends an MKPDU. Some vendors let you tune it, or use a faster "bounded hello" (0.5 s).</span></div>
      <div class="card"><b>MKA Life Time: 6 s</b><br><span class="muted">A peer that has sent no fresh MKPDU for this long is removed. When the last peer goes, the session drops and the SAKs are deleted.</span></div>
      <div class="card"><b>SAK Retire Time: 3 s</b><br><span class="muted">How long the old SAK stays installed for receiving after a new one takes over for transmit.</span></div>
    </div>

    <div class="callout tip"><b>Rx before Tx</b>
      A new SAK is always installed for <b>receive first</b>. The key server starts transmitting with it only after
      every live peer has said, in SAK Use, that it can receive with it. Peers then switch their Tx too. That order
      is what makes rekeying hitless: no frame is ever sent with a key the other side can't decrypt.</div>

    <div class="callout warn"><b>Automotive: these timers are far too slow</b>
      With default timers, MKA guarantees a secured link only within about 8 s. A typical automotive target is under
      30 ms from link-up. Automotive stacks get there by fixing the roles in advance (key server priority 0 on one end,
      255 on the other, so no real election happens) and by sending MKPDUs back to back during startup instead of
      waiting for the hello timer. With both ends tuned, startup takes under 10 ms on a two-station link. Lesson 8 covers this.
      <div class="src">Source: L. Völker, <i>Automotive Requirements for MKA</i>, IEEE 802.1 contribution, 2025-03-12.</div></div>
  `,
  mount: (root) => {
    // ----- MKPDU bar -----
    const parts = [
      { n: 'DA', b: '6', c: 'var(--plain)', w: 7, d: '<code>01:80:C2:00:00:03</code> (Nearest non-TPMR Bridge group address, the PAE default). Bridges do not forward this address. That is fine on a point-to-point link, but a Linux bridge in a lab needs <code>group_fwd_mask</code> set before it will pass MKPDUs (lesson 10).' },
      { n: 'SA', b: '6', c: 'var(--plain)', w: 7, d: 'The port\'s MAC address.' },
      { n: 'EtherType', b: '2', c: 'var(--plain-2)', w: 6, d: '<code>0x888E</code>, the EAPoL EtherType. MKPDUs pass through the <b>uncontrolled port</b>, so they flow before MACsec is up.' },
      { n: 'Ver/Type/Len', b: '4', c: 'var(--plain-2)', w: 7, d: 'EAPOL protocol version (3 for 802.1X-2010 and later), packet type <b>5 = EAPOL-MKA</b>, body length.' },
      { n: 'Basic Param Set', b: '28+', c: 'var(--k-cak)', w: 14, d: 'Always first. MKA version, Key Server Priority, Key Server flag, MACsec Desired, MACsec Capability, the actor\'s <b>SCI</b>, <b>MI</b> and <b>MN</b>, Algorithm Agility (<code>0x0080C201</code> = AES-CMAC-128 for the ICV) and the <b>CKN</b>.' },
      { n: 'Live Peer List', b: 'var', c: 'var(--plain-3)', w: 9, d: 'Parameter set type 1: the (MI, MN) of every peer whose recent MKPDU listed <i>this</i> participant. Being in each other\'s live list proves that both directions work and that both sides are fresh.' },
      { n: 'Potential Peers', b: 'var', c: 'var(--plain-3)', w: 9, d: 'Type 2: peers this participant has heard from that have not yet confirmed it.' },
      { n: 'SAK Use', b: '40', c: 'var(--accent-2)', w: 8, d: 'Type 3: which SAKs (KI, AN) this participant has installed for Rx and Tx: Latest Key and Old Key, with Tx/Rx flags, Lowest Acceptable PN and a Delay Protect flag.' },
      { n: 'Distributed SAK', b: '28/44', c: 'var(--k-sak)', w: 9, d: 'Type 4, sent <b>only by the key server</b>: the AN, the confidentiality offset, the KN and the <b>AES-wrapped SAK</b> (plus the cipher suite when it isn\'t the default).' },
      { n: 'ICV', b: '16', c: 'var(--k-ick)', w: 7, d: 'AES-CMAC computed with the <b>ICK</b> over the whole MKPDU, from DA to the end of the last parameter set. A wrong CAK means a wrong ICK, and the MKPDU is discarded without a word.' },
    ];
    const bar = root.querySelector('#mk-bar'), det = root.querySelector('#mk-detail');
    bar.innerHTML = parts.map((f, i) => `<div class="fld" data-i="${i}" style="flex:${f.w};background:${f.c}">${f.n}<small>${f.b} B</small></div>`).join('');
    bar.addEventListener('click', e => {
      const el = e.target.closest('.fld'); if (!el) return;
      bar.querySelectorAll('.fld').forEach(x => x.classList.remove('sel')); el.classList.add('sel');
      const f = parts[+el.dataset.i];
      det.innerHTML = `<b>${f.n}</b> <span class="muted">(${f.b} bytes)</span><p style="margin:.4em 0 0">${f.d}</p>`;
    });

    // ----- sequence animation -----
    const A = 'marker-end="url(#m-arr)"';
    const msg = (id, y, dir, label, sub, color) => {
      const x1 = dir === 'r' ? 200 : 700, x2 = dir === 'r' ? 700 : 200;
      const lx = 450;
      return `<g id="${id}" class="f">
        <line x1="${x1}" y1="${y}" x2="${x2}" y2="${y + 22}" stroke="${color || 'var(--accent)'}" stroke-width="2.2" ${A}/>
        <rect x="${lx - 175}" y="${y - 14}" width="350" height="${sub ? 34 : 20}" rx="6" fill="var(--panel)" stroke="${color || 'var(--accent)'}"/>
        <text x="${lx}" y="${y}" text-anchor="middle" font-size="11.5" font-weight="700">${label}</text>
        ${sub ? `<text x="${lx}" y="${y + 14}" text-anchor="middle" font-size="10" class="mono t-muted">${sub}</text>` : ''}
      </g>`;
    };
    Course.stepper(root.querySelector('#anim-mka'), {
      title: 'An MKA session between two switches (PSK mode)',
      autoplayMs: 3400,
      svg: `
      <svg viewBox="0 0 900 560" role="img" aria-label="MKA sequence diagram">
        <defs><marker id="m-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="var(--muted)"/></marker></defs>
        <g font-size="12">
          <rect x="110" y="10" width="180" height="50" rx="10" class="node"/>
          <text x="200" y="32" text-anchor="middle" font-weight="700">Switch A</text>
          <text x="200" y="49" text-anchor="middle" font-size="10" class="mono t-muted">prio 16 · MI a1b2…</text>
          <rect x="610" y="10" width="180" height="50" rx="10" class="node"/>
          <text x="700" y="32" text-anchor="middle" font-weight="700">Switch B</text>
          <text x="700" y="49" text-anchor="middle" font-size="10" class="mono t-muted">prio 32 · MI c3d4…</text>
          <line x1="200" y1="60" x2="200" y2="550" stroke="var(--border)" stroke-width="2" stroke-dasharray="5 5"/>
          <line x1="700" y1="60" x2="700" y2="550" stroke="var(--border)" stroke-width="2" stroke-dasharray="5 5"/>

          <g id="crown" class="f"><text x="120" y="38" font-size="22">👑</text><text x="80" y="80" font-size="11" font-weight="700" style="fill:var(--accent-2)">Key Server</text></g>

          ${msg('m1', 90, 'r', 'MKPDU: Basic(MI=A, MN=1, CKN, prio 16)', 'no peers yet · ICV = CMAC(ICK, …)')}
          ${msg('m2', 145, 'l', 'MKPDU: Basic(MI=B, MN=1) + Potential Peers {A:1}', 'B checked A\'s ICV, so A knows the CAK')}
          ${msg('m3', 200, 'r', 'MKPDU: Basic(MN=2) + Live Peers {B:1}', 'A sees itself in B\'s list → B is live')}
          ${msg('m4', 255, 'l', 'MKPDU: Basic(MN=2) + Live Peers {A:2}', 'mutual liveness ✔')}
          <g id="elect" class="f">
            <rect x="250" y="292" width="400" height="26" rx="13" fill="var(--accent-2)" opacity=".18" stroke="var(--accent-2)"/>
            <text x="450" y="310" text-anchor="middle" font-weight="700">Election: priority 16 &lt; 32 → A is key server</text>
          </g>
          ${msg('m5', 345, 'r', 'MKPDU: Distributed SAK (AN 0, KN 1, wrapped SAK)', 'AES-KW(KEK, SAK) · Key Server flag = 1', 'var(--k-sak)')}
          <g id="rxb" class="f"><rect x="712" y="352" width="160" height="24" rx="6" fill="var(--k-sak)" opacity=".2" stroke="var(--k-sak)"/><text x="792" y="368" text-anchor="middle" font-size="11">install SAK for Rx</text></g>
          ${msg('m6', 400, 'l', 'MKPDU: SAK Use (Latest KI=A|1, AN 0, Rx ✔)', 'B can now decrypt AN 0', 'var(--accent-2)')}
          <g id="txa" class="f"><rect x="28" y="408" width="160" height="24" rx="6" fill="var(--k-sak)" opacity=".2" stroke="var(--k-sak)"/><text x="108" y="424" text-anchor="middle" font-size="11">enable Tx on AN 0</text></g>
          ${msg('m7', 455, 'r', 'MKPDU: SAK Use (Latest KI=A|1, Tx ✔ Rx ✔)', 'all live peers have Rx → key server transmits', 'var(--accent-2)')}
          <g id="txb" class="f"><rect x="712" y="462" width="160" height="24" rx="6" fill="var(--k-sak)" opacity=".2" stroke="var(--k-sak)"/><text x="792" y="478" text-anchor="middle" font-size="11">enable Tx on AN 0</text></g>
          <g id="secured" class="f">
            <rect x="200" y="500" width="500" height="34" rx="8" fill="var(--accent-2)"/>
            <text x="450" y="522" text-anchor="middle" style="fill:#fff" font-weight="700" font-size="13">🔒 Secured: data frames ⇄ GCM-AES · MKPDU every 2 s</text>
          </g>
        </g>
      </svg>`,
      steps: [
        { caption: 'Both ports are configured with the same CAK/CKN. Each starts an <b>MKA participant</b> with a random <b>MI</b>, and until MACsec is up it blocks all data on the controlled port ("must-secure").',
          do: s => {} },
        { caption: 'A sends its first MKPDU to <code>01:80:C2:00:00:03</code>. It carries A\'s MI, MN=1, CKN and priority, and is signed with the ICK.',
          do: s => s.show('m1') },
        { caption: 'B looks up the CKN, finds the matching CAK, and <b>checks the ICV</b>. The check passes, so A must know the CAK. B adds A to its <b>Potential Peer List</b> and replies.',
          do: s => s.show('m2') },
        { caption: 'A finds its own MI and current MN in B\'s list. That proves B is receiving A\'s messages and the reply is fresh, so A moves B to its <b>Live Peer List</b>.',
          do: s => s.show('m3') },
        { caption: 'B now sees itself in A\'s live list, so both sides are <b>live peers</b> of each other. Two-way communication and knowledge of the CAK are both confirmed.',
          do: s => s.show('m4') },
        { caption: 'Every member runs the same deterministic <b>key-server election</b> on the live membership. A has the lower priority value (16), so A becomes the key server. No messages are exchanged to decide this.',
          do: s => s.show(['elect', 'crown']) },
        { caption: 'A generates a <span class="pill sak">SAK</span> (KN 1, AN 0), wraps it with the <span class="pill kek">KEK</span>, and sends it in a <b>Distributed SAK</b> parameter set.',
          do: s => s.show('m5') },
        { caption: 'B unwraps the SAK and installs it for <b>receive</b> only. Its SAK Use set reports "Latest Key = A|1, Rx = yes".',
          do: s => s.show(['rxb', 'm6']) },
        { caption: 'All live peers can now receive with KN 1, so the key server <b>enables transmit</b> on AN 0 and says so (Tx ✔).',
          do: s => s.show(['txa', 'm7']) },
        { caption: 'B sees that the key server is transmitting with the new SAK, and enables its own <b>Tx</b> as well.',
          do: s => s.show('txb') },
        { caption: 'The port is <b>secured</b> and the controlled port opens. MKPDUs keep flowing every <b>2 s</b> as keep-alives, and if a peer is silent for <b>6 s</b> it is declared dead.',
          do: s => { s.show('secured'); s.pulse('secured'); } },
      ]
    });

    // ----- election lab -----
    const list = root.querySelector('#el-list'), out = root.querySelector('#el-out');
    let peers = [
      { name: 'Switch A', prio: 16, sci: '001a2b3c4d5e0001' },
      { name: 'Switch B', prio: 32, sci: '00aabbccddee0001' },
      { name: 'Router C', prio: 16, sci: '0011223344550002' },
    ];
    function elect() {
      const cands = peers.map((p, i) => ({ ...p, i, sciN: BigInt('0x' + (p.sci.replace(/[^0-9a-f]/gi, '') || '0')) }))
        .filter(p => p.prio < 255);
      cands.sort((a, b) => a.prio - b.prio || (a.sciN < b.sciN ? -1 : a.sciN > b.sciN ? 1 : 0));
      return cands;
    }
    function draw() {
      const ranked = elect();
      const ks = ranked[0];
      list.innerHTML = peers.map((p, i) => `
        <div class="peer ${ks && ks.i === i ? 'ks' : ''}" data-i="${i}">
          <input data-k="name" value="${Course.esc(p.name)}" aria-label="name">
          <input data-k="prio" type="number" min="0" max="255" value="${p.prio}" aria-label="priority">
          <input data-k="sci" value="${Course.esc(p.sci)}" aria-label="SCI">
          <span>${ks && ks.i === i ? '<span class="badge">👑 KEY SERVER</span>' : `<button class="btn" data-del="${i}" title="remove">✕</button>`}</span>
        </div>`).join('') + `<div class="muted" style="font-size:.8rem">name · key-server priority (0–255, lower wins, 255 = never) · SCI (hex)</div>`;
      if (!ks) { out.innerHTML = '<span class="bad">No eligible key server (every priority is 255). Nobody distributes a SAK, so the session never secures.</span>'; return; }
      out.innerHTML = 'Ranking (priority, then SCI):\n' + ranked.map((p, k) =>
        `${k === 0 ? '<span class="ok">1.' : (k + 1) + '.'} ${Course.esc(p.name).padEnd(12)} prio ${String(p.prio).padStart(3)}  SCI ${p.sci}${k === 0 ? '  ← key server</span>' : ''}`).join('\n')
        + (ranked.length > 1 && ranked[0].prio === ranked[1].prio ? '\n<span class="w">Tie on priority → decided by the lowest SCI.</span>' : '');
    }
    list.addEventListener('change', e => {
      const row = e.target.closest('.peer'); if (!row || !e.target.dataset.k) return;
      const p = peers[+row.dataset.i], k = e.target.dataset.k;
      p[k] = k === 'prio' ? Math.max(0, Math.min(255, parseInt(e.target.value, 10) || 0)) : e.target.value;
      draw();
    });
    list.addEventListener('click', e => {
      const d = e.target.closest('[data-del]'); if (!d) return;
      peers.splice(+d.dataset.del, 1); draw();
    });
    root.querySelector('#el-add').addEventListener('click', () => {
      const n = peers.length + 1;
      peers.push({ name: 'Device ' + n, prio: 128, sci: Array.from(crypto.getRandomValues(new Uint8Array(6)), b => b.toString(16).padStart(2, '0')).join('') + '0001' });
      draw();
    });
    draw();
  }
});
