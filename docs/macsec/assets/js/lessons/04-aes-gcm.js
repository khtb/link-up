Course.register({
  id: 'aes-gcm',
  title: 'Encryption: GCM-AES & the PN',
  section: 'Data plane (802.1AE)',
  minutes: 20,
  render: () => `
    <h1>Encryption: GCM-AES and the Packet Number</h1>
    <p>All standard MACsec cipher suites use <b>AES in Galois/Counter Mode</b> (NIST SP 800-38D). One pass gives
    <b>confidentiality</b> (counter-mode encryption) and <b>integrity</b> (the GHASH-based tag, which becomes the ICV).</p>

    <div class="table-wrap"><table>
      <tr><th>Cipher suite</th><th>Key (SAK)</th><th>PN</th><th>IV construction</th><th>Notes</th></tr>
      <tr><td><b>GCM-AES-128</b></td><td>128 bit</td><td>32 bit</td><td>SCI ‖ PN</td><td>The original default and mandatory to implement</td></tr>
      <tr><td><b>GCM-AES-256</b></td><td>256 bit</td><td>32 bit</td><td>SCI ‖ PN</td><td>Added by 802.1AEbn</td></tr>
      <tr><td><b>GCM-AES-XPN-128</b></td><td>128 bit</td><td>64 bit</td><td>(SSCI ‖ PN) ⊕ Salt</td><td>802.1AEbw, for links of 40G and faster</td></tr>
      <tr><td><b>GCM-AES-XPN-256</b></td><td>256 bit</td><td>64 bit</td><td>(SSCI ‖ PN) ⊕ Salt</td><td>The usual choice for 100G/400G links</td></tr>
    </table></div>

    <div id="anim-gcm"></div>

    <div class="callout warn"><b>The rule that matters most: never reuse (SAK, IV)</b>
      If two frames are encrypted with the same SAK and the same IV, their keystreams are identical. XORing the two
      ciphertexts then gives the XOR of the two plaintexts, and an attacker can recover the GHASH key H and forge
      frames. This is why the PN must never repeat or wrap under one SAK, and why MKA rekeys before the PN runs out.</div>

    <h2>Lab 1: encrypt a real frame in your browser</h2>
    <p>This lab runs real <b>GCM-AES</b> through your browser's Web Crypto API, using the same code that is checked
    against the IEEE 802.1AE Annex C test vectors. Protect a frame, click any byte to tamper with it, then validate the
    frame at the receiver.</p>
    <div class="card lab">
      <div class="row">
        <div style="flex:2 1 320px"><label>SAK (32 hex = AES-128, 64 hex = AES-256)</label><input type="text" id="g-sak" value="ad7a2bd03eac835a6f620fdcb506b345"></div>
        <div style="flex:0 0 auto"><button class="btn" id="g-rand">🎲 Random SAK</button></div>
      </div>
      <div class="row">
        <div><label>SCI (16 hex)</label><input type="text" id="g-sci" value="001a2b3c4d5e0001"></div>
        <div><label>PN</label><input type="number" id="g-pn" value="1" min="1" max="4294967295"></div>
        <div><label>AN</label><select id="g-an"><option>0</option><option>1</option><option>2</option><option>3</option></select></div>
        <div><label>Mode</label><select id="g-mode"><option value="enc">Confidentiality + integrity</option><option value="int">Integrity only</option></select></div>
      </div>
      <label>Payload (text, sent after EtherType 0x0800)</label>
      <input type="text" id="g-pt" value="Hello from Switch A! user=bob pass=hunter2">
      <div class="row" style="margin-top:12px">
        <div style="flex:0 0 auto"><button class="btn primary" id="g-go">🔒 Protect frame</button></div>
        <div style="flex:0 0 auto"><button class="btn good" id="g-rx">📥 Validate at receiver</button></div>
        <div style="flex:1 1 200px"><label style="margin:0"><input type="checkbox" id="g-wrong"> Receiver uses a different SAK</label></div>
      </div>
      <div class="hexgrid" id="g-hex"></div>
      <div class="muted" style="font-size:.8rem;margin-top:6px">Legend:
        <span class="pill" style="background:var(--plain)">DA/SA</span>
        <span class="pill cak">SecTAG</span>
        <span class="pill" style="background:var(--cipher)">Secure data</span>
        <span class="pill sak">ICV</span> · click a byte to flip one bit</div>
      <div class="out" id="g-out">Press “Protect frame”.</div>
    </div>

    <h2>Lab 2: replay protection</h2>
    <p>The receiver keeps a <b>next expected PN</b> for each Rx SA. 802.1AE accepts a frame when
    <code>PN ≥ next PN − replayWindow</code> and the ICV checks out, and then updates <code>next PN = max(next PN, PN + 1)</code>.
    A frame below the window is dropped as <i>late</i>.</p>
    <div class="card lab">
      <div class="row">
        <div><label>Replay window (0 = strict ordering)</label><input type="number" id="r-win" value="0" min="0" max="16"></div>
        <div><label>PN to receive</label><input type="number" id="r-pn" value="1" min="1"></div>
        <div style="flex:0 0 auto"><button class="btn primary" id="r-send">Receive PN</button></div>
      </div>
      <div class="row" style="margin-top:8px">
        <div style="flex:0 0 auto"><button class="btn" id="r-next">▶ In-order frame</button></div>
        <div style="flex:0 0 auto"><button class="btn" id="r-reorder">🔀 Reordered (PN−2)</button></div>
        <div style="flex:0 0 auto"><button class="btn" id="r-replay">🔁 Replay an old PN</button></div>
        <div style="flex:0 0 auto"><button class="btn" id="r-reset">⏮ Reset</button></div>
      </div>
      <div class="pnrow" id="r-row"></div>
      <div class="out" id="r-log"></div>
    </div>
    <div class="callout"><b>Subtlety</b>
      802.1AE stores only one "lowest acceptable PN" per SA. It does not keep a bitmap of the PNs it has seen. With
      window W &gt; 0, a duplicate whose PN is still inside the window will be <i>accepted</i>. The window trades some
      replay strictness for tolerance of reordering (QoS queues, link aggregation, carrier networks). Use W = 0
      wherever frames cannot be reordered.</div>
  `,
  mount: (root) => {
    const A = 'marker-end="url(#g-arr)"';
    Course.stepper(root.querySelector('#anim-gcm'), {
      title: 'Inside GCM-AES for one MACsec frame',
      autoplayMs: 3200,
      svg: `
      <svg viewBox="0 0 900 440" role="img" aria-label="GCM-AES pipeline">
        <defs><marker id="g-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="var(--muted)"/></marker></defs>
        <g font-size="12">
          <g id="in-sak"><rect x="20" y="20" width="170" height="44" rx="8" fill="var(--k-sak)"/><text x="105" y="47" text-anchor="middle" style="fill:#fff" font-weight="700">🔑 SAK (from MKA)</text></g>
          <g id="in-sci"><rect x="260" y="20" width="170" height="44" rx="8" fill="var(--k-cak)"/><text x="345" y="40" text-anchor="middle" style="fill:#fff" font-weight="700">SCI</text><text x="345" y="56" text-anchor="middle" style="fill:#fff" font-size="10" class="mono">001a2b3c4d5e0001</text></g>
          <g id="in-pn"><rect x="440" y="20" width="130" height="44" rx="8" fill="var(--k-cak)" opacity=".8"/><text x="505" y="40" text-anchor="middle" style="fill:#fff" font-weight="700">PN</text><text id="pnv" x="505" y="56" text-anchor="middle" style="fill:#fff" font-size="10" class="mono">00000001</text></g>

          <g id="iv" class="f">
            <line x1="345" y1="64" x2="380" y2="90" stroke="var(--muted)" ${A}/><line x1="505" y1="64" x2="460" y2="90" stroke="var(--muted)" ${A}/>
            <rect x="260" y="92" width="310" height="40" rx="8" class="node"/><text x="415" y="117" text-anchor="middle" font-weight="700">IV = SCI ‖ PN  (96 bits)</text>
          </g>

          <g id="ctrs" class="f">
            <path d="M300,132 L115,160" stroke="var(--muted)" fill="none" ${A}/><line x1="390" y1="132" x2="355" y2="160" stroke="var(--muted)" ${A}/><line x1="480" y1="132" x2="575" y2="160" stroke="var(--muted)" ${A}/>
            <rect x="20" y="162" width="190" height="38" rx="6" class="node"/><text x="115" y="186" text-anchor="middle" class="mono" font-size="11">J0 = IV ‖ 00000001</text>
            <rect x="260" y="162" width="190" height="38" rx="6" class="node"/><text x="355" y="186" text-anchor="middle" class="mono" font-size="11">CB1 = IV ‖ 00000002</text>
            <rect x="480" y="162" width="190" height="38" rx="6" class="node"/><text x="575" y="186" text-anchor="middle" class="mono" font-size="11">CB2 = IV ‖ 00000003</text>
            <text x="690" y="186" font-size="16" class="t-muted">…</text>
          </g>

          <g id="aes" class="f">
            <line x1="105" y1="64" x2="105" y2="150" stroke="var(--k-sak)" stroke-dasharray="3 3"/>
            <rect x="60" y="222" width="110" height="36" rx="6" fill="var(--k-sak)"/><text x="115" y="245" text-anchor="middle" style="fill:#fff" font-weight="700">AES_SAK</text>
            <rect x="300" y="222" width="110" height="36" rx="6" fill="var(--k-sak)"/><text x="355" y="245" text-anchor="middle" style="fill:#fff" font-weight="700">AES_SAK</text>
            <rect x="520" y="222" width="110" height="36" rx="6" fill="var(--k-sak)"/><text x="575" y="245" text-anchor="middle" style="fill:#fff" font-weight="700">AES_SAK</text>
            <line x1="115" y1="200" x2="115" y2="220" stroke="var(--muted)" ${A}/><line x1="355" y1="200" x2="355" y2="220" stroke="var(--muted)" ${A}/><line x1="575" y1="200" x2="575" y2="220" stroke="var(--muted)" ${A}/>
            <text x="365" y="276" font-size="10" class="t-muted">keystream KS1</text><text x="585" y="276" font-size="10" class="t-muted">keystream KS2</text>
          </g>

          <g id="xor" class="f">
            <line x1="355" y1="258" x2="355" y2="284" stroke="var(--muted)" ${A}/><line x1="575" y1="258" x2="575" y2="284" stroke="var(--muted)" ${A}/>
            <circle cx="355" cy="300" r="14" class="node"/><text x="355" y="305" text-anchor="middle" font-size="16">⊕</text>
            <circle cx="575" cy="300" r="14" class="node"/><text x="575" y="305" text-anchor="middle" font-size="16">⊕</text>
            <rect x="215" y="288" width="110" height="24" rx="4" fill="var(--plain)"/><text x="270" y="305" text-anchor="middle" style="fill:#fff" font-size="11">P1: 08 00 45 00…</text>
            <rect x="435" y="288" width="110" height="24" rx="4" fill="var(--plain)"/><text x="490" y="305" text-anchor="middle" style="fill:#fff" font-size="11">P2: user data…</text>
          </g>
          <g id="ct" class="f">
            <line x1="355" y1="314" x2="355" y2="334" stroke="var(--muted)" ${A}/><line x1="575" y1="314" x2="575" y2="334" stroke="var(--muted)" ${A}/>
            <rect x="300" y="336" width="110" height="32" rx="6" fill="var(--cipher)"/><text x="355" y="357" text-anchor="middle" style="fill:#fff" font-weight="700">C1</text>
            <rect x="520" y="336" width="110" height="32" rx="6" fill="var(--cipher)"/><text x="575" y="357" text-anchor="middle" style="fill:#fff" font-weight="700">C2</text>
            <text x="300" y="390" font-size="11" class="t-muted">Ciphertext is the same length as the plaintext. No padding.</text>
          </g>

          <g id="gh" class="f">
            <rect x="700" y="92" width="185" height="40" rx="8" fill="var(--k-cak)" opacity=".85"/><text x="792" y="117" text-anchor="middle" style="fill:#fff" font-size="11" font-weight="700">AAD = DA ‖ SA ‖ SecTAG</text>
            <rect x="700" y="162" width="185" height="38" rx="6" fill="var(--k-sak)" opacity=".85"/><text x="792" y="186" text-anchor="middle" style="fill:#fff" font-size="11" font-weight="700">H = AES_SAK(0¹²⁸)</text>
            <rect x="700" y="232" width="185" height="60" rx="8" class="node"/><text x="792" y="256" text-anchor="middle" font-weight="700">GHASH_H</text><text x="792" y="274" text-anchor="middle" font-size="10" class="t-muted">(AAD, C1‖C2…, len(A)‖len(C))</text>
            <line x1="792" y1="132" x2="792" y2="160" stroke="var(--muted)" ${A}/><line x1="792" y1="200" x2="792" y2="230" stroke="var(--muted)" ${A}/>
            <path d="M630,352 L690,352 L690,270 L698,270" stroke="var(--muted)" fill="none" ${A}/>
          </g>

          <g id="icv" class="f">
            <line x1="792" y1="292" x2="792" y2="324" stroke="var(--muted)" ${A}/>
            <circle cx="792" cy="340" r="14" class="node"/><text x="792" y="345" text-anchor="middle" font-size="16">⊕</text>
            <path d="M115,258 L115,418 L670,418 L670,340 L776,340" stroke="var(--k-sak)" fill="none" stroke-dasharray="4 3" ${A}/>
            <text x="130" y="410" font-size="10" class="t-muted">E_SAK(J0)</text>
            <line x1="792" y1="354" x2="792" y2="376" stroke="var(--muted)" ${A}/>
            <rect x="732" y="378" width="120" height="34" rx="6" fill="var(--k-sak)"/><text x="792" y="400" text-anchor="middle" style="fill:#fff" font-weight="700">ICV (16 B)</text>
          </g>

          <g id="reuse" class="f">
            <rect x="200" y="96" width="420" height="300" rx="14" fill="var(--bad)" opacity=".08" stroke="var(--bad)" stroke-width="2"/>
            <text x="410" y="422" text-anchor="middle" font-weight="700" style="fill:var(--bad)">Same SAK + same PN ⇒ same keystream ⇒ C ⊕ C′ = P ⊕ P′ 💥</text>
          </g>
        </g>
      </svg>`,
      steps: [
        { caption: 'There are three inputs: the <span class="pill sak">SAK</span> (from MKA), this transmitter\'s <b>SCI</b>, and the <b>PN</b> for this frame (the SA\'s next PN, which then goes up by one).',
          do: s => s.hl(['in-sak']) },
        { caption: 'The 96-bit <b>IV</b> is simply <b>SCI ‖ PN</b>. It is unique because the SCI is unique to the transmitter and the PN is never repeated under the same SAK.',
          do: s => s.show('iv') },
        { caption: 'GCM builds <b>counter blocks</b> by appending a 32-bit counter to the IV. J0 (counter = 1) is set aside for the tag. CB1, CB2… encrypt the data.',
          do: s => s.show('ctrs') },
        { caption: 'Each counter block is encrypted with <b>AES under the SAK</b>, which yields 16 bytes of <b>keystream</b> per block.',
          do: s => s.show('aes') },
        { caption: 'The keystream is <b>XORed</b> with the user data (the original EtherType and payload) to produce the <b>ciphertext</b>. This is counter mode.',
          do: s => s.show(['xor', 'ct']) },
        { caption: 'For integrity, GCM derives the hash key <b>H = AES(0)</b> and runs <b>GHASH</b> over the AAD (DA, SA, SecTAG, sent in clear) followed by the ciphertext and both lengths.',
          do: s => s.show('gh') },
        { caption: 'The GHASH result is XORed with <b>E(J0)</b> to give the 128-bit tag, which is sent as the <b>ICV</b>. The receiver repeats the same steps and drops the frame if its ICV differs.',
          do: s => s.show('icv') },
        { caption: '⚠️ If the PN ever repeated under the same SAK, the IV, counter blocks and keystream would repeat too. Avoiding that is one of MKA\'s main jobs.',
          do: s => { s.show('reuse'); s.text('pnv', '00000001 (again!)'); s.pulse('in-pn'); } },
      ]
    });

    // ===== Lab 1 =====
    const C = window.MKACrypto;
    const $ = id => root.querySelector('#' + id);
    let lastOut = null, regions = [];
    $('g-rand').addEventListener('click', () => {
      const n = $('g-sak').value.replace(/\s/g, '').length === 64 ? 32 : 16;
      $('g-sak').value = C.hex(C.random(n));
    });
    function buildFrame() {
      const da = C.unhex('00aabbccddee'), sa = C.unhex('001a2b3c4d5e');
      return C.concat(da, sa, C.unhex('0800'), C.utf8($('g-pt').value));
    }
    function renderHex(bytes, tampered) {
      $('g-hex').innerHTML = Array.from(bytes, (b, i) => {
        const r = regions.find(r => i >= r.from && i < r.to);
        return `<span class="${r ? r.cls : ''} ${tampered && tampered.has(i) ? 'tampered' : ''}" data-i="${i}" title="byte ${i}${r ? ' · ' + r.name : ''}">${b.toString(16).padStart(2, '0')}</span>`;
      }).join('');
    }
    const tamper = new Set();
    $('g-go').addEventListener('click', async () => {
      try {
        const sak = C.unhex($('g-sak').value);
        if (sak.length !== 16 && sak.length !== 32) throw new Error('SAK must be 16 or 32 bytes');
        const sci = C.unhex($('g-sci').value);
        if (sci.length !== 8) throw new Error('SCI must be 8 bytes');
        const pn = Math.max(1, Math.min(0xffffffff, parseInt($('g-pn').value, 10) || 1));
        const enc = $('g-mode').value === 'enc';
        const frame = buildFrame();
        const r = await C.protectFrame({ sak, sci, pn, an: +$('g-an').value, frame, encrypt: enc });
        lastOut = r.out; tamper.clear();
        regions = [
          { from: 0, to: 12, cls: 'hdr', name: 'DA/SA (clear, authenticated)' },
          { from: 12, to: 12 + r.tag.length, cls: 'tag', name: 'SecTAG' },
          { from: 12 + r.tag.length, to: r.out.length - 16, cls: enc ? 'enc' : '', name: enc ? 'Secure data (encrypted)' : 'User data (clear, authenticated)' },
          { from: r.out.length - 16, to: r.out.length, cls: 'icv', name: 'ICV' },
        ];
        renderHex(r.out, tamper);
        $('g-out').innerHTML =
`<span class="k">Cipher suite</span>  GCM-AES-${sak.length * 8}${enc ? '' : '  (integrity only → GMAC)'}
<span class="k">IV</span>            ${C.hex(r.iv)}   (SCI ‖ PN)
<span class="k">SecTAG</span>        ${C.hex(r.tag, ' ')}
                 └ TCI/AN = 0x${r.tag[2].toString(16).padStart(2, '0')}, SL = ${r.tag[3]}, PN = ${pn}
<span class="k">AAD length</span>    ${r.aadLen} bytes
<span class="k">Plain frame</span>   ${frame.length} B  →  <span class="k">MACsec frame</span> ${r.out.length} B  (+${r.out.length - frame.length})
<span class="k">ICV</span>           ${C.hex(r.out.subarray(r.out.length - 16))}

<span class="w">Tip: protect again with the same PN and the ciphertext is identical. Change the PN by 1 and every byte changes.</span>`;
      } catch (e) { $('g-out').innerHTML = `<span class="bad">${Course.esc(e.message)}</span>`; }
    });
    $('g-hex').addEventListener('click', e => {
      const sp = e.target.closest('span[data-i]'); if (!sp || !lastOut) return;
      const i = +sp.dataset.i;
      lastOut[i] ^= 0x01;
      tamper.has(i) ? tamper.delete(i) : tamper.add(i);
      renderHex(lastOut, tamper);
    });
    $('g-rx').addEventListener('click', async () => {
      if (!lastOut) { $('g-out').innerHTML = '<span class="w">Protect a frame first.</span>'; return; }
      let sak = C.unhex($('g-sak').value);
      if ($('g-wrong').checked) { sak = sak.slice(); sak[0] ^= 0xff; }
      const v = await C.validateFrame({ sak, sci: C.unhex($('g-sci').value), macsecFrame: lastOut });
      if (v.ok) {
        const text = new TextDecoder().decode(v.frame.subarray(14));
        $('g-out').innerHTML = `<span class="ok">✔ ICV valid: frame accepted (InPktsOK++)</span>
PN ${v.pn}, AN ${v.an}
Recovered EtherType: 0x${C.hex(v.frame.subarray(12, 14))}
Recovered payload:   "${Course.esc(text)}"`;
      } else {
        $('g-out').innerHTML = `<span class="bad">✘ ${Course.esc(v.error)}</span>
${tamper.size ? `You flipped ${tamper.size} bit(s). GCM detects any change to the AAD, secure data or ICV.` : 'The receiver\'s SAK does not match the sender\'s, so the computed ICV differs.'}`;
      }
    });
    $('g-go').click();

    // ===== Lab 2: replay window =====
    let next = 1, log = [], seen = new Map();
    const N = 24;
    function drawRow() {
      const w = Math.max(0, parseInt($('r-win').value, 10) || 0);
      const low = Math.max(1, next - w);
      $('r-row').innerHTML = Array.from({ length: N }, (_, k) => {
        const pn = k + 1;
        const st = seen.get(pn);
        const cls = st === 'drop' ? 'drop' : st === 'ok' ? 'seen' : (pn >= low && pn < next + 1) ? 'win' : '';
        return `<div class="pn ${cls}" title="PN ${pn}">${pn}</div>`;
      }).join('');
      $('r-log').innerHTML = `next PN expected = <span class="k">${next}</span>   lowest acceptable PN = <span class="k">${low}</span>   (window ${w})\n` + log.slice(-7).join('\n');
    }
    function rx(pn) {
      const w = Math.max(0, parseInt($('r-win').value, 10) || 0);
      const low = Math.max(1, next - w);
      if (pn < low) {
        seen.set(pn, 'drop');
        log.push(`<span class="bad">PN ${pn}: DROPPED: below lowest acceptable PN ${low} (InPktsLate++)</span>`);
      } else {
        const dup = seen.get(pn) === 'ok';
        seen.set(pn, 'ok');
        log.push(dup
          ? `<span class="w">PN ${pn}: ACCEPTED even though it is a duplicate: inside the window, and 802.1AE keeps no bitmap</span>`
          : `<span class="ok">PN ${pn}: accepted${pn < next ? ' (late but within window, InPktsDelayed/OK)' : ''}</span>`);
        next = Math.max(next, pn + 1);
      }
      $('r-pn').value = next;
      drawRow();
    }
    $('r-send').addEventListener('click', () => rx(Math.max(1, parseInt($('r-pn').value, 10) || 1)));
    $('r-next').addEventListener('click', () => rx(next));
    $('r-reorder').addEventListener('click', () => { if (next < 4) { rx(next); rx(next); rx(next); } rx(Math.max(1, next - 2)); });
    $('r-replay').addEventListener('click', () => { const old = [...seen.keys()].filter(k => seen.get(k) === 'ok'); rx(old.length ? old[Math.floor(Math.random() * old.length)] : 1); });
    $('r-reset').addEventListener('click', () => { next = 1; log = []; seen = new Map(); $('r-pn').value = 1; drawRow(); });
    $('r-win').addEventListener('input', drawRow);
    drawRow();
  }
});
