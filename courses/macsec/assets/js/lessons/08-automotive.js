Course.register({
  id: 'automotive',
  title: 'Automotive MACsec (OPEN Alliance)',
  section: 'Automotive',
  minutes: 25,
  render: () => `
    <h1>Automotive MACsec: the OPEN Alliance profile</h1>
    <p>IEEE 802.1AE and 802.1X were written for enterprise and carrier networks. A car has different constraints:
    small embedded controllers, 10–15-year lifetimes, −40 °C to +125 °C, fully automated key provisioning in production,
    no authentication server, and very fast startup. The <b>OPEN Alliance</b> Technical Committee <b>TC17</b> (automotive Ethernet
    security, chaired by BMW with Ford as vice chair) therefore defines an <b>automotive profile</b> of the IEEE standards.</p>

    <div class="grid2">
      <div class="card"><b>Automotive MACsec Specification</b> <span class="tag ok">v1.0 · Final · Public</span><br>
        <span class="muted">Published 16 May 2025. A profile of IEEE 802.1AE-2018 for <i>switched</i> automotive Ethernet, including
        10BASE-T1S in point-to-point half- or full-duplex mode. Editor from TI, with contributors from NXP, Marvell, Broadcom, Infineon, ST, ADI,
        Realtek, KDPOF, Bosch, BMW, Volvo and Technica.</span></div>
      <div class="card"><b>Automotive MKA Specification</b> <span class="tag">TC17</span><br>
        <span class="muted">A companion profile of 802.1X MKA. It changes the MKA control state machines so the protocol reacts in
        real time, because default MKA offers many options not suited to cars and its timeouts are too long.</span></div>
    </div>

    <h2>Goals of the profile</h2>
    <ul>
      <li><b>One common MACsec solution for all OEMs</b>, so suppliers build one implementation.</li>
      <li><b>Remove features</b> a car doesn't need, so it fits an embedded footprint and costs less silicon.</li>
      <li><b>Add features</b> automotive needs, such as uncontrolled-port bypass rules.</li>
      <li><b>Stay interoperable</b> with standard IEEE MACsec when both sides are configured to the common features, so standard test tools still work.</li>
    </ul>

    <h2>The requirements at a glance</h2>
    <div class="table-wrap"><table>
      <tr><th>Requirement</th><th>What it says (paraphrased)</th><th>Why it matters</th></tr>
      <tr><td class="req">AutoMACsec-01001</td><td>Support <b>point-to-point</b> MACsec as in 802.1AE-2018. End-to-end or proprietary variants are out of scope.</td><td>Each link is its own CA with two members, as in lessons 2–7.</td></tr>
      <tr><td class="req">AutoMACsec-01002</td><td>At least <b>one Tx SC and one Rx SC per Ethernet port</b>.</td><td>The minimum for point-to-point. It keeps PHY and switch hardware small.</td></tr>
      <tr><td class="req">AutoMACsec-01003</td><td>Must work <b>without IEEE 802.3br frame preemption</b>.</td><td>Less hardware complexity and cost.</td></tr>
      <tr><td class="req">AutoMACsec-01004</td><td>Support a SecTAG <b>without the SCI</b>.</td><td>Saves 8 bytes per frame, so each frame carries 24 B of overhead instead of 32 (see lesson 3).</td></tr>
      <tr><td class="req">AutoMACsec-01005</td><td>Support <b>integrity only</b>, and <b>confidentiality + integrity with offset 0</b>. Offsets 30/50 are not needed.</td><td>Many in-vehicle flows need authenticity more than secrecy.</td></tr>
      <tr><td class="req">AutoMACsec-01006 / 06A / 06B</td><td><b>Uncontrolled-port bypass rules</b> on Tx and Rx, matching at least MAC DA, EtherType and VLAN ID, with <b>at least 8 rules</b>.</td><td>Decides which frames skip MACsec. Try the lab below.</td></tr>
      <tr><td class="req">AutoMACsec-01007</td><td>Verify frames as 802.1AE specifies. If the hardware can't drop a failed frame, it must forward it with a <b>corrupted FCS</b>.</td><td>Lets a PHY-integrated MACsec, which can't drop frames, still make the MAC discard them.</td></tr>
      <tr><td class="req">AutoMACsec-01008</td><td>A minimum set of <b>64-bit counters</b>: OutPktsUntagged/TooLong/Protected/Encrypted, InPktsUntagged/NoTag/BadTag/NoSA/NoSAError/Overrun, InPktsOK/Unchecked/Late/Invalid/NotValid, InOctetsValidated/Decrypted.</td><td>The same names Linux shows in <code>ip -s macsec show</code> (lesson 10).</td></tr>
    </table></div>
    <p class="src">Source: OPEN Alliance, <i>Automotive MACsec Specification v1.0</i>, 16 May 2025 (sections 2–3). The requirements are paraphrased here; read the specification itself for the normative text.</p>

    <div class="callout warn"><b>Scope: no shared medium yet</b>
      Version 1.0 covers <i>switched</i> automotive Ethernet only, and explicitly excludes
      <b>10BASE-T1S in shared-medium (multidrop) mode</b>. Multidrop needs different optimizations and performance targets,
      and the TC17 10BASE-T1S subgroup plans to address it in a future revision. Lesson 9 explains why it is hard.</div>

    <h2>Lab: uncontrolled-port bypass rules</h2>
    <p>Every frame the SecY sends goes either through the <b>controlled port</b>, where it is protected, or through the
    <b>uncontrolled port</b>, where it goes out in clear. MKA's own EAPoL frames must bypass MACsec, or the keys could never be
    agreed. Each extra bypass rule is a security decision. Switch the rules on and off and watch where each frame goes.</p>
    <div class="card lab">
      <div class="row">
        <div style="flex:1 1 320px">
          <b>Bypass rules (max 8)</b>
          <div id="by-rules"></div>
        </div>
        <div style="flex:1 1 320px">
          <b>Frames leaving the ECU</b>
          <div id="by-frames"></div>
        </div>
      </div>
    </div>

    <h2>Startup time is the defining requirement</h2>
    <p>A car is expected to be ready to drive about <b>1.5–2 s</b> after it is unlocked. In that window, ECUs wake and boot,
    switches start, T1 PHYs link up (<b>20–120 ms</b>), and every link must be secured. Startup also happens <i>often</i>:
    after sleep or wake-up to save energy, and when a cranking engine pulls the voltage down and resets several ECUs at once.</p>

    <div class="card">
      <div class="row lab" style="margin-bottom:10px">
        <div style="flex:0 0 auto"><button class="btn" id="tl-default">Default 802.1X MKA</button></div>
        <div style="flex:0 0 auto"><button class="btn primary" id="tl-auto">Automotive-tuned MKA</button></div>
      </div>
      <div id="tl"></div>
      <p class="src" style="margin-top:8px">The scale runs to 2.5 s. The ECU boot and stack times are illustrative. The PHY link-up range, the &lt;30 ms target, the &lt;10 ms tuned result and the ~8 s default worst case come from L. Völker, IEEE 802.1 contribution, 2025-03-12.</p>
    </div>

    <div id="anim-fast"></div>

    <h2>How automotive deployments use MKA</h2>
    <div class="grid2">
      <div class="card"><b>🏭 Pre-shared CAK, installed in production</b><br><span class="muted">There is no EAP or RADIUS in a vehicle. A CAK/CKN per link is written by the end-of-line tooling, along with certificates, into secure storage (an HSM or secure element) in a fully automated process.</span></div>
      <div class="card"><b>👑 Fixed key server</b><br><span class="muted">The switch or zone controller side is set to key-server priority 0 and the ECU to 255. The roles are decided at design time, so startup never waits for a real election.</span></div>
      <div class="card"><b>🛡️ Integrity first</b><br><span class="muted">Early deployments use MACsec mainly for access control: integrity protection, delay checks, and dropping unprotected frames. Confidentiality and multiple security domains come later.</span></div>
      <div class="card"><b>⚙️ Hardware placement</b><br><span class="muted">MACsec usually runs in the PHY, the switch port or the SoC's MAC. PHY-integrated MACsec is why AutoMACsec-01007 allows "forward with corrupted FCS" instead of dropping.</span></div>
      <div class="card"><b>💾 Mind the flash</b><br><span class="muted">Automotive flash wears out, so an implementation can't save PN or KN state on every change. That makes a fresh SAK at each startup the natural design.</span></div>
      <div class="card"><b>🧩 AUTOSAR</b><br><span class="muted">AUTOSAR specifies MKA as a basic-software module for Classic Platform ECUs (<i>SWS MACsecKeyAgreement</i>, from R22-11) and documents MACsec for the Adaptive Platform.</span></div>
    </div>
    <p class="src">Sources: OPEN Alliance TC17 committee page; M. Demchenko (Rambus), "10Base-T1S Ethernet and the Use of MACsec for Link Security", SemiEngineering, July 2025; L. Völker, IEEE 802.1 contribution, March 2025; AUTOSAR R22-11 SWS MACsecKeyAgreement.</p>
  `,
  mount: (root) => {
    // ---------- bypass rule lab ----------
    const rules = [
      { id: 'eapol', on: true, label: 'EtherType 0x888E (EAPoL / MKA)', m: f => f.et === '0x888E', must: true },
      { id: 'gptp', on: false, label: 'EtherType 0x88F7 (gPTP time sync)', m: f => f.et === '0x88F7' },
      { id: 'diag', on: false, label: 'VLAN 20 (diagnostics / DoIP)', m: f => f.vlan === 20 },
      { id: 'lldp', on: false, label: 'DA 01:80:C2:00:00:0E (LLDP / link-local)', m: f => f.da === '01:80:C2:00:00:0E' && f.et === '0x88CC' },
    ];
    const frames = [
      { n: 'MKPDU', et: '0x888E', da: '01:80:C2:00:00:03' },
      { n: 'gPTP Sync', et: '0x88F7', da: '01:80:C2:00:00:0E' },
      { n: 'LLDP', et: '0x88CC', da: '01:80:C2:00:00:0E' },
      { n: 'SOME/IP (VLAN 10)', et: '0x0800', vlan: 10, da: 'unicast' },
      { n: 'DoIP diagnostics (VLAN 20)', et: '0x0800', vlan: 20, da: 'unicast' },
      { n: 'Camera stream (AVTP, VLAN 30)', et: '0x22F0', vlan: 30, da: 'multicast' },
    ];
    const rHost = root.querySelector('#by-rules'), fHost = root.querySelector('#by-frames');
    function drawBypass() {
      rHost.innerHTML = rules.map(r => `<label style="display:flex;gap:8px;align-items:center;color:var(--text);font-size:.88rem;margin:8px 0">
        <input type="checkbox" data-r="${r.id}" ${r.on ? 'checked' : ''}> ${r.label}</label>`).join('')
        + `<div class="src">${rules.filter(r => r.on).length} of 8 rules used</div>`;
      fHost.innerHTML = frames.map(f => {
        const hit = rules.find(r => r.on && r.m(f));
        const tag = hit ? '<span class="tag warn">uncontrolled · clear</span>' : '<span class="tag ok">controlled · MACsec</span>';
        let note = '';
        if (f.et === '0x888E' && !hit) note = '<div class="src" style="color:var(--bad)">MKA can\'t run: its own frames would need a SAK that doesn\'t exist yet. The link never secures.</div>';
        else if (hit && f.et !== '0x888E') note = '<div class="src">Sent without protection. Anyone on the link can read and spoof it.</div>';
        return `<div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;padding:6px 0;border-bottom:1px solid var(--border);font-size:.88rem">
          <span>${f.n} <span class="muted mono" style="font-size:.75rem">${f.et}${f.vlan ? ' · VID ' + f.vlan : ''}</span></span>${tag}${note ? '<div style="flex-basis:100%">' + note + '</div>' : ''}</div>`;
      }).join('');
    }
    rHost.addEventListener('change', e => { const r = rules.find(x => x.id === e.target.dataset.r); if (r) { r.on = e.target.checked; drawBypass(); } });
    drawBypass();

    // ---------- startup timeline ----------
    const SCALE = 2500; // ms
    const tl = root.querySelector('#tl');
    function bars(mode) {
      const mka = mode === 'auto' ? { s: 470, d: 10, label: 'MKA ≈ 10 ms ✔' } : { s: 470, d: 8000, label: 'MKA up to ~8 s ✘' };
      const rows = [
        { n: 'Unlock → wake-up', s: 0, d: 60, c: 'var(--muted)' },
        { n: 'ECU boot', s: 60, d: 250, c: 'var(--plain-2)' },
        { n: 'Switch start', s: 100, d: 250, c: 'var(--plain-3)' },
        { n: 'PHY link-up', s: 350, d: 120, c: 'var(--accent)', label: '20–120 ms' },
        { n: 'MACsec / MKA', s: mka.s, d: mka.d, c: mode === 'auto' ? 'var(--accent-2)' : 'var(--bad)', label: mka.label },
        { n: 'Stacks & apps', s: mode === 'auto' ? 480 : 8470, d: 600, c: 'var(--k-cak)' },
        { n: 'Ready to drive', s: 1500, d: 500, c: 'var(--warn)', label: 'target 1.5–2 s' },
      ];
      tl.innerHTML = rows.map(r => {
        const left = Math.min(100, r.s / SCALE * 100), w = Math.max(.8, Math.min(100 - left, r.d / SCALE * 100));
        return `<div class="tl-row"><span>${r.n}</span><div class="tl-track">${left < 100 ? `<div class="tl-bar" style="left:${left}%;width:${w}%;background:${r.c}">${r.label || ''}</div>` : '<span class="src" style="padding-left:6px">off the chart (after 8 s)</span>'}</div></div>`;
      }).join('');
      root.querySelector('#tl-default').classList.toggle('primary', mode !== 'auto');
      root.querySelector('#tl-auto').classList.toggle('primary', mode === 'auto');
    }
    root.querySelector('#tl-default').addEventListener('click', () => bars('default'));
    root.querySelector('#tl-auto').addEventListener('click', () => bars('auto'));
    bars('auto');

    // ---------- 4-MKPDU fast start ----------
    const A = 'marker-end="url(#a-arr)"';
    const m = (id, y, dir, t1, t2, col) => {
      const x1 = dir === 'r' ? 200 : 700, x2 = dir === 'r' ? 700 : 200;
      return `<g id="${id}" class="f"><line x1="${x1}" y1="${y}" x2="${x2}" y2="${y + 20}" stroke="${col}" stroke-width="2.2" ${A}/>
        <rect x="270" y="${y - 13}" width="360" height="32" rx="6" fill="var(--panel)" stroke="${col}"/>
        <text x="450" y="${y + 1}" text-anchor="middle" font-size="11.5" font-weight="700">${t1}</text>
        <text x="450" y="${y + 14}" text-anchor="middle" font-size="10" class="mono t-muted">${t2}</text></g>`;
    };
    Course.stepper(root.querySelector('#anim-fast'), {
      title: 'Automotive fast start: secured with four MKPDUs',
      svg: `
      <svg viewBox="0 0 900 340" role="img" aria-label="Fast MKA start sequence">
        <defs><marker id="a-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="var(--muted)"/></marker></defs>
        <g font-size="12">
          <rect x="100" y="10" width="200" height="50" rx="10" class="node"/><text x="200" y="32" text-anchor="middle" font-weight="700">👑 Zone switch port</text><text x="200" y="49" text-anchor="middle" font-size="10" class="mono t-muted">key server · priority 0</text>
          <rect x="600" y="10" width="200" height="50" rx="10" class="node"/><text x="700" y="32" text-anchor="middle" font-weight="700">ECU (camera)</text><text x="700" y="49" text-anchor="middle" font-size="10" class="mono t-muted">peer · priority 255</text>
          <line x1="200" y1="60" x2="200" y2="330" stroke="var(--border)" stroke-width="2" stroke-dasharray="5 5"/>
          <line x1="700" y1="60" x2="700" y2="330" stroke="var(--border)" stroke-width="2" stroke-dasharray="5 5"/>
          <g id="lu" class="f"><rect x="330" y="70" width="240" height="22" rx="11" fill="var(--accent)" opacity=".15" stroke="var(--accent)"/><text x="450" y="85" text-anchor="middle" font-size="11" font-weight="700">t = 0 · PHY link up</text></g>
          ${m('k1', 115, 'r', 'KS #1: Basic · Potential Peers { }', 'sent at once, no hello wait', 'var(--accent)')}
          ${m('p1', 165, 'l', 'Peer #1: Basic · Potential Peers {KS}', 'ICV checked → CAK proven', 'var(--accent)')}
          ${m('k2', 215, 'r', 'KS #2: Live Peers {Peer} + Distributed SAK + SAK Use', 'AES-KW(KEK, SAK) · key server installs the SAK for Rx', 'var(--k-sak)')}
          ${m('p2', 265, 'l', 'Peer #2: Live Peers {KS} + SAK Use (Rx=1, Tx=1)', 'stopwatch stops at the last SAK Use with Rx=1, Tx=1', 'var(--accent-2)')}
          <g id="done" class="f"><rect x="250" y="302" width="400" height="28" rx="8" fill="var(--accent-2)"/><text x="450" y="321" text-anchor="middle" style="fill:#fff" font-weight="700">🔒 Secured in &lt; 10 ms</text></g>
        </g>
      </svg>`,
      steps: [
        { caption: 'The roles are fixed at design time. The zone switch port has key-server priority 0 and the ECU has 255, so the election result is known before the link is even up.',
          do: s => {} },
        { caption: 'The PHY reports link up. Automotive MKA starts at this moment and sends its first MKPDU immediately instead of waiting for the 2 s hello timer.',
          do: s => s.show('lu') },
        { caption: 'The key server announces itself. It has no peers yet.',
          do: s => s.show('k1') },
        { caption: 'The ECU checks the ICV (so the key server knows the CAK) and replies, listing the key server as a potential peer.',
          do: s => s.show('p1') },
        { caption: 'The key server now sees itself in the ECU\'s list, so the ECU is live. In the same MKPDU the key server sends the live peer list, the wrapped SAK (Distributed SAK) and its SAK Use. Four separate round trips collapse into one message.',
          do: s => s.show('k2') },
        { caption: 'The ECU installs the SAK and answers with SAK Use. Both sides then enable transmit. Measured from link-up to this last SAK Use, a tuned pair finishes in under 10 ms while staying compatible with standard MKA.',
          do: s => s.show(['p2', 'done']) },
      ]
    });
  }
});
