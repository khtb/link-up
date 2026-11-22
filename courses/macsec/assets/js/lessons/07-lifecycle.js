Course.register({
  id: 'lifecycle',
  title: 'Rekeying, PN exhaustion & XPN',
  section: 'Control plane (MKA)',
  minutes: 15,
  render: () => `
    <h1>Rekeying, PN exhaustion and XPN</h1>
    <p>A SAK has to be replaced before its PN space runs out, and also whenever the membership of the CA changes.
    MKA rotates through the four Association Numbers so that the replacement never interrupts traffic.</p>

    <div id="anim-rekey"></div>

    <h2>What triggers a new SAK?</h2>
    <div class="table-wrap"><table>
      <tr><th>Trigger</th><th>Why</th></tr>
      <tr><td><b>PN exhaustion</b></td><td>When any member's PN passes a threshold (typically <code>0xC0000000</code>, 75% of 2³²), reported through SAK Use, the key server sends a new SAK.</td></tr>
      <tr><td><b>Membership change</b></td><td>A peer joins or leaves the live list. A departed member must not keep a valid key, and a new member needs one.</td></tr>
      <tr><td><b>Key server change</b></td><td>The old key server is gone, a new one is elected, and it distributes its own SAK.</td></tr>
      <tr><td><b>Periodic rekey timer</b></td><td>Optional policy (an "SAK rekey interval") that limits how long one key is used. In vehicles it is often tied to drive cycles instead, with a fresh SAK at every startup.</td></tr>
      <tr><td><b>CAK rollover</b></td><td>The key chain moves to a new CKN/CAK. A new MKA participant forms, a new SAK follows, and the old CA is removed.</td></tr>
    </table></div>

    <h2>Why XPN exists: how long does a 32-bit PN last?</h2>
    <div class="card lab">
      <div class="row">
        <div><label>Link speed (Gbit/s)</label><select id="x-speed"><option value="0.01">0.01 (10BASE-T1S)</option><option value="0.1">0.1 (100BASE-T1)</option><option value="1" selected>1 (1000BASE-T1)</option><option value="2.5">2.5 (2.5GBASE-T1)</option><option value="10">10 (10GBASE-T1)</option><option value="25">25 (25GBASE-T1)</option><option value="100">100 (data-center)</option></select></div>
        <div><label>Frame size on the wire (bytes, incl. MACsec overhead)</label><input type="number" id="x-size" value="96" min="64" max="9216"></div>
      </div>
      <div class="out" id="x-out"></div>
    </div>
    <p><b>XPN</b> (802.1AEbw) extends the PN to 64 bits. Only the low 32 bits go in the SecTAG; the receiver works out
    the upper half from its own state. Because a 64-bit PN plus a 64-bit SCI would no longer fit in GCM's 96-bit IV,
    XPN replaces the SCI with a 32-bit <b>SSCI</b> (Short SCI, assigned by MKA) and XORs in a 96-bit <b>salt</b>
    derived from the key server's MI and KN:</p>
    <pre><code>IV (XPN) = ( SSCI(32) ‖ PN(64) )  XOR  Salt(96)</code></pre>

    <h2>Security policies you will configure</h2>
    <div class="grid2">
      <div class="card"><b>must-secure</b> vs <b>should-secure</b><br><span class="muted">must-secure drops every data frame until MKA has secured the link (fail closed). should-secure lets clear-text traffic through if MKA fails (fail open), which is useful while migrating.</span></div>
      <div class="card"><b>Confidentiality offset 0 / 30 / 50</b><br><span class="muted">How many bytes of user data are left unencrypted, for example so transit equipment can hash on IP/TCP headers. Both ends must agree, and the key server announces it in Distributed SAK.</span></div>
      <div class="card"><b>Replay protection window</b><br><span class="muted">0 enforces strict ordering. Use a small window, e.g. 64, when the path can reorder frames (e.g. when the PN is assigned before per-priority egress queues, so high-priority frames overtake others).</span></div>
      <div class="card"><b>Include SCI</b><br><span class="muted">Adds 8 bytes, but some peers and multipoint CAs require it. A mismatch here is a common reason two vendors fail to interoperate.</span></div>
      <div class="card"><b>Delay protection</b><br><span class="muted">(802.1X-2020) Peers report the lowest acceptable PN often enough that frames held back by an attacker for more than about 2 s are rejected.</span></div>
      <div class="card"><b>Cipher suite</b><br><span class="muted">The key server picks one from the capabilities its peers announce. Use XPN for 40G and faster links.</span></div>
    </div>
  `,
  mount: (root) => {
    const slot = (i, x) => `
      <g id="slot${i}">
        <rect id="box${i}" x="${x}" y="40" width="190" height="104" rx="12" class="node"/>
        <text x="${x + 95}" y="64" text-anchor="middle" font-weight="700" font-size="15">AN ${i}</text>
        <text id="kn${i}" x="${x + 95}" y="88" text-anchor="middle" font-size="12" class="mono">empty</text>
        <text id="st${i}" x="${x + 95}" y="112" text-anchor="middle" font-size="12" class="t-muted">—</text>
        <text id="pn${i}" x="${x + 95}" y="132" text-anchor="middle" font-size="10" class="mono t-muted"></text>
      </g>`;
    Course.stepper(root.querySelector('#anim-rekey'), {
      title: 'A hitless rekey: rotating through AN 0 → 1 → 2 → 3 → 0',
      autoplayMs: 3000,
      svg: `
      <svg viewBox="0 0 900 300" role="img" aria-label="SAK rotation across association numbers">
        <g font-size="12">
          ${slot(0, 30)}${slot(1, 250)}${slot(2, 470)}${slot(3, 690)}
          <g id="act0" class="f"><rect x="26" y="36" width="198" height="112" rx="14" fill="none" stroke="var(--accent-2)" stroke-width="3"/></g>
          <g id="act1" class="f"><rect x="246" y="36" width="198" height="112" rx="14" fill="none" stroke="var(--accent-2)" stroke-width="3"/></g>
          <g id="act2" class="f"><rect x="466" y="36" width="198" height="112" rx="14" fill="none" stroke="var(--accent-2)" stroke-width="3"/></g>
          <g id="act3" class="f"><rect x="686" y="36" width="198" height="112" rx="14" fill="none" stroke="var(--accent-2)" stroke-width="3"/></g>

          <text x="30" y="186" font-weight="700">PN of the active Tx SA</text>
          <rect x="30" y="196" width="840" height="22" rx="11" fill="var(--panel-2)" stroke="var(--border)"/>
          <rect id="p25" class="f" x="30" y="196" width="210" height="22" rx="11" fill="var(--accent)"/>
          <rect id="p60" class="f" x="30" y="196" width="504" height="22" rx="11" fill="var(--accent)"/>
          <rect id="p75" class="f" x="30" y="196" width="630" height="22" rx="11" fill="var(--warn)"/>
          <line x1="660" y1="190" x2="660" y2="226" stroke="var(--bad)" stroke-width="2" stroke-dasharray="3 3"/>
          <text x="660" y="244" text-anchor="middle" font-size="11" style="fill:var(--bad)">rekey threshold 0xC0000000</text>
          <text x="870" y="244" text-anchor="end" font-size="11" class="t-muted">2³² − 1 (must never reach)</text>
          <text x="30" y="244" font-size="11" class="t-muted">1</text>

          <g id="ks" class="f"><rect x="180" y="258" width="540" height="32" rx="8" fill="var(--k-sak)" opacity=".15" stroke="var(--k-sak)"/>
            <text id="kstext" x="450" y="279" text-anchor="middle" font-weight="700">👑 Key server: Distributed SAK KN 2 → AN 1</text></g>
        </g>
      </svg>`,
      steps: [
        { caption: '<b>AN 0</b> holds SAK KN 1 and is used for both transmit and receive. Its PN starts at 1.',
          do: s => { s.text('kn0', 'SAK KN 1'); s.text('st0', 'Tx + Rx'); s.show(['act0', 'p25']); s.text('pn0', 'PN 0x10000000'); } },
        { caption: 'Traffic flows and the PN climbs. Every member reports its Lowest Acceptable PN in <b>SAK Use</b>, so the key server can watch the PN rise.',
          do: s => { s.show('p60'); s.text('pn0', 'PN 0x99999999'); } },
        { caption: 'The PN crosses the <b>rekey threshold</b> (75%). The key server has to act now, long before the PN can wrap.',
          do: s => { s.show('p75'); s.text('pn0', 'PN 0xC0000001'); s.pulse('p75'); } },
        { caption: 'The key server generates <b>SAK KN 2</b>, assigns it the <b>next AN (1)</b>, and distributes it. Every member installs it for <b>receive only</b>, while AN 0 stays active for Tx.',
          do: s => { s.show('ks'); s.text('kn1', 'SAK KN 2'); s.text('st1', 'Rx only'); } },
        { caption: 'Once every live peer reports Rx on KN 2, transmitters <b>switch Tx to AN 1</b>. Receivers decrypt with both ANs, so frames already in flight on AN 0 are not lost.',
          do: s => { s.hide(['act0', 'p25', 'p60', 'p75']); s.show(['act1', 'p25']); s.text('st1', 'Tx + Rx'); s.text('st0', 'Rx only (old)'); s.text('pn1', 'PN 0x00000001'); s.text('pn0', ''); } },
        { caption: 'After the <b>SAK Retire Time</b> (3 s) the old SA on AN 0 is deleted. The rekey is finished and no frame was dropped.',
          do: s => { s.text('kn0', 'empty'); s.text('st0', 'retired'); s.hide('ks'); s.dim('slot0'); } },
        { caption: 'Later rekeys use <b>AN 2</b>, then <b>AN 3</b>, then wrap back to <b>AN 0</b>. Two bits are enough because at most two SAs (old and new) are live at any moment.',
          do: s => { s.undim('slot0'); s.hide(['act1']); s.show('act0');
            s.text('kn1', 'retired'); s.text('st1', '—'); s.text('pn1', '');
            s.text('kn2', 'KN 3 (retired)'); s.text('kn3', 'KN 4 (retired)');
            s.text('kn0', 'SAK KN 5'); s.text('st0', 'Tx + Rx'); s.text('pn0', 'PN 0x00000001');
            s.show('ks'); s.text('kstext', 'KN 5 wrapped around to AN 0 = (KN − 1) mod 4'); } },
      ]
    });

    const sp = root.querySelector('#x-speed'), sz = root.querySelector('#x-size'), out = root.querySelector('#x-out');
    function fmt(sec) {
      if (sec < 120) return sec.toFixed(1) + ' seconds';
      if (sec < 7200) return (sec / 60).toFixed(1) + ' minutes';
      if (sec < 172800) return (sec / 3600).toFixed(1) + ' hours';
      if (sec < 3.15e7 * 2) return (sec / 86400).toFixed(1) + ' days';
      return (sec / 3.156e7).toExponential(2).replace('e+', ' × 10^') + ' years';
    }
    function calc() {
      const gbps = parseFloat(sp.value), bytes = Math.max(64, parseInt(sz.value, 10) || 64);
      const fps = gbps * 1e9 / ((bytes + 20) * 8); // + preamble/SFD 8 + IFG 12
      const t32 = 2 ** 32 / fps, t75 = 0.75 * t32, t64 = 2 ** 64 / fps;
      out.innerHTML =
`<span class="k">Frame rate at line rate</span>   ${(fps / 1e6).toFixed(2)} Mpps   (${bytes} B + 20 B preamble/IFG)

<span class="k">32-bit PN</span> exhausted in       ${fmt(t32)}
           rekey at 75% every   ${fmt(t75)}   ${t75 < 60 ? '<span class="bad">← far too often: use XPN</span>' : t75 < 3600 ? '<span class="w">← frequent rekeys; XPN recommended</span>' : '<span class="ok">fine</span>'}
<span class="k">64-bit PN (XPN)</span> exhausted in ${fmt(t64)}`;
    }
    sp.addEventListener('change', calc); sz.addEventListener('input', calc); calc();
  }
});
