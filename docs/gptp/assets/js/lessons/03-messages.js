Course.register({
  id: 'messages',
  title: 'Anatomy of gPTP messages',
  section: 'Foundations',
  minutes: 20,
  render: () => `
    <h1>Anatomy of gPTP messages</h1>
    <p>gPTP over Ethernet (the 802.3 "media-dependent" layer) is always plain Layer 2: no IP, no UDP and no VLAN tag.
    Every frame goes to the reserved link-local address <code>01-80-C2-00-00-0E</code>, which 802.1Q bridges never forward,
    with EtherType <code>0x88F7</code>.</p>

    <h2>The Ethernet frame</h2>
    <div class="frame-bar" id="bar-eth"></div>
    <div class="card fld-detail" id="det-eth"><span class="muted">Click a field.</span></div>

    <h2>The 34-byte common header</h2>
    <p>Identical for every message type. Click a field; the byte offsets are shown under each name.</p>
    <div class="frame-bar" id="bar-hdr"></div>
    <div class="card fld-detail" id="det-hdr"><span class="muted">Click a field.</span></div>

    <h2>Message catalogue</h2>
    <div class="card" id="msg-tabs">
      <div class="tabs"><button>Sync</button><button>Follow_Up</button><button>Pdelay_*</button><button>Announce</button><button>Signaling</button></div>
      <div class="tabpane">
        <p><span class="pill sync">messageType 0x0</span> <b>event</b> · 44 bytes (two-step) · controlled by <code>logSyncInterval</code></p>
        <div class="frame-bar" id="bar-sync"></div>
        <p class="muted">In two-step mode the 10 bytes after the header are reserved (originTimestamp is not used) and <code>twoStepFlag</code> = 1.
        802.1AS-2020 adds optional <b>one-step</b> Sync: the hardware writes the originTimestamp into the frame as it leaves,
        and the Follow_Up information TLV is appended to the Sync itself (76 bytes), so no Follow_Up is sent.</p>
      </div>
      <div class="tabpane">
        <p><span class="pill fu">messageType 0x8</span> <b>general</b> · 76 bytes · one per Sync, same sequenceId</p>
        <div class="frame-bar" id="bar-fu"></div>
        <div class="card fld-detail" id="det-fu"><span class="muted">Click a field of the Follow_Up information TLV.</span></div>
      </div>
      <div class="tabpane">
        <p><span class="pill pd">0x2 / 0x3 / 0xA</span> All three are 54 bytes. Req and Resp are <b>event</b> messages, Resp_Follow_Up is general.</p>
        <div class="table-wrap"><table>
          <tr><th>Message</th><th>Body after the header (20 bytes)</th></tr>
          <tr><td><b>Pdelay_Req</b> (0x2)</td><td>10 reserved + 10 reserved (padding so Req and Resp have equal length → symmetric PHY latency)</td></tr>
          <tr><td><b>Pdelay_Resp</b> (0x3)</td><td><code>requestReceiptTimestamp</code> = t2 (10) + <code>requestingPortIdentity</code> (10)</td></tr>
          <tr><td><b>Pdelay_Resp_Follow_Up</b> (0xA)</td><td><code>responseOriginTimestamp</code> = t3 (10) + <code>requestingPortIdentity</code> (10)</td></tr>
        </table></div>
        <p class="muted">Pdelay messages always use domainNumber 0 in 2011. In 2020 they belong either to a domain's own
        instance-specific mechanism or to the <b>CMLDS</b> (Common Mean Link Delay Service), which uses <code>majorSdoId = 0x2</code>
        so that one measurement per link serves every domain (lesson 11).</p>
      </div>
      <div class="tabpane">
        <p><span class="pill ann">messageType 0xB</span> <b>general</b> · 64 bytes + path trace TLV (4 + 8·N)</p>
        <div class="frame-bar" id="bar-ann"></div>
        <p class="muted">The <b>path trace TLV</b> (tlvType 0x0008) lists the clockIdentity of every system the Announce passed
        through. A system that finds its own identity in the list discards the message, which breaks loops.
        The automotive profile does not send Announce at all.</p>
      </div>
      <div class="tabpane">
        <p><span class="pill ann">messageType 0xC</span> <b>general</b> · 60 bytes with one Message Interval Request TLV</p>
        <div class="frame-bar" id="bar-sig"></div>
        <p class="muted">Body: targetPortIdentity (10, all 0xFF = any port), then TLVs. The interval request TLV
        (organizationId <code>00-80-C2</code>, subtype 2) asks the link partner to change linkDelayInterval, timeSyncInterval and announceInterval.
        Flags: <code>computeNeighborRateRatio</code>, <code>computeNeighborPropDelay</code>, and in 2020 <code>oneStepReceiveCapable</code>.
        2020 also defines the <b>gPTP-capable TLV</b> (subtype 4) and gPTP-capable message interval request TLV (subtype 5),
        used to decide asCapable per domain.</p>
      </div>
    </div>

    <h2>Lab: build and decode a header</h2>
    <div class="card lab">
      <div class="row">
        <div><label>messageType</label><select id="h-type">
          <option value="0">0x0 Sync</option><option value="8" selected>0x8 Follow_Up</option><option value="2">0x2 Pdelay_Req</option>
          <option value="3">0x3 Pdelay_Resp</option><option value="10">0xA Pdelay_Resp_Follow_Up</option><option value="11">0xB Announce</option><option value="12">0xC Signaling</option></select></div>
        <div><label>majorSdoId (transportSpecific)</label><select id="h-sdo"><option value="1" selected>0x1 gPTP</option><option value="2">0x2 CMLDS (2020)</option><option value="0">0x0 plain 1588</option></select></div>
        <div><label>domainNumber</label><input type="number" id="h-dom" value="0" min="0" max="127"></div>
      </div>
      <div class="row">
        <div><label>Port MAC (→ clockIdentity)</label><input type="text" id="h-mac" value="00:1b:21:aa:bb:cc"></div>
        <div><label>sequenceId</label><input type="number" id="h-seq" value="4242" min="0" max="65535"></div>
        <div><label>correctionField [ns]</label><input type="number" id="h-corr" value="1234.5678" step="0.0001"></div>
        <div><label>logMessageInterval</label><input type="number" id="h-log" value="-3" min="-128" max="127"></div>
      </div>
      <div class="hexgrid" id="h-hex"></div>
      <div class="out" id="h-out"></div>
    </div>

    <h2>Lab: scaled fields</h2>
    <div class="grid2">
      <div class="card lab"><b>correctionField</b> (Integer64, ns × 2<sup>16</sup>)
        <label>nanoseconds</label><input type="number" id="cf-ns" value="0.5" step="any">
        <label>or 8-byte hex</label><input type="text" id="cf-hex" value="">
        <div class="out" id="cf-out"></div></div>
      <div class="card lab"><b>cumulativeScaledRateOffset</b> (Integer32, (rateRatio − 1) × 2<sup>41</sup>)
        <label>frequency offset of GM relative to local clock [ppm]</label><input type="number" id="ro-ppm" value="12.5" step="any">
        <div class="out" id="ro-out"></div></div>
    </div>
  `,
  mount: (root) => {
    const bar = (hostSel, detSel, fields) => {
      const host = root.querySelector(hostSel), det = detSel && root.querySelector(detSel);
      host.innerHTML = fields.map((f, i) => `<div class="fld" data-i="${i}" style="flex:${f.w};background:${f.c}" title="${f.n}">${f.n}<small>${f.b}</small></div>`).join('');
      if (!det) return;
      host.addEventListener('click', e => {
        const el = e.target.closest('.fld'); if (!el) return;
        host.querySelectorAll('.fld').forEach(x => x.classList.remove('sel')); el.classList.add('sel');
        const f = fields[+el.dataset.i];
        det.innerHTML = `<b>${f.n}</b> <span class="muted">(${f.b})</span><p style="margin:.4em 0 0">${f.d}</p>`;
      });
    };
    const H = 'var(--plain)', H2 = 'var(--plain-2)', B = 'var(--c-fu)', T = 'var(--c-gm)', P = 'var(--c-pd)', F = 'var(--fcs)', A = 'var(--c-ann)';

    bar('#bar-eth', '#det-eth', [
      { n: 'DA', b: '6 B', c: H, w: 7, d: '<code>01-80-C2-00-00-0E</code>: the "Nearest Bridge" group address. 802.1Q bridges must not forward it, which is why every gPTP hop has to be time-aware. 1588 over L2 can also use 01-1B-19-00-00-00 (forwardable), but gPTP never does.' },
      { n: 'SA', b: '6 B', c: H, w: 7, d: 'MAC address of the transmitting <b>port</b>. The clockIdentity is usually derived from a system MAC (EUI-48 → EUI-64 by inserting FF-FE).' },
      { n: 'EtherType', b: '2 B', c: T, w: 5, d: '<code>0x88F7</code> = PTP. No 802.1Q tag: gPTP frames are sent untagged (priority is handled internally, typically highest queue).' },
      { n: 'PTP header', b: '34 B', c: H2, w: 14, d: 'The common header, decoded field by field below.' },
      { n: 'Body', b: '10–30 B', c: B, w: 10, d: 'Message-specific fields: timestamps, port identities, Announce data.' },
      { n: 'TLVs', b: '0–n B', c: P, w: 9, d: 'Type-Length-Value extensions: Follow_Up information TLV, path trace TLV, message interval request TLV, AUTOSAR sub-TLVs…' },
      { n: 'Pad', b: '0–n B', c: 'var(--cipher)', w: 3, d: 'Padding up to the 46-byte minimum payload (only Sync, 44 bytes, needs 2 bytes).' },
      { n: 'FCS', b: '4 B', c: F, w: 4, d: 'Ethernet CRC-32. A one-step transmitter writes the timestamp into the frame on the fly and must recompute the FCS.' },
    ]);

    bar('#bar-hdr', '#det-hdr', [
      { n: 'SdoId|Type', b: '0 · 1 B', c: T, w: 6, d: 'High nibble: <b>majorSdoId</b> (2011 name: transportSpecific) = <b>0x1</b> for gPTP, 0x2 for CMLDS. A plain 1588 node sends 0 and is ignored. Low nibble: <b>messageType</b> (0 Sync, 2 Pdelay_Req, 3 Pdelay_Resp, 8 Follow_Up, A Pdelay_Resp_Follow_Up, B Announce, C Signaling). Types 0–3 are event messages (timestamped); 8–D are general.' },
      { n: 'Ver', b: '1 · 1 B', c: H2, w: 4, d: 'Low nibble <b>versionPTP = 2</b>. High nibble <b>minorVersionPTP</b>: 0 in 802.1AS-2011 (based on 1588-2008), 1 in 802.1AS-2020 (based on 1588-2019). So you see <code>0x02</code> vs <code>0x12</code> on the wire.' },
      { n: 'Length', b: '2 · 2 B', c: H2, w: 5, d: 'messageLength: header + body + TLVs, without Ethernet header, padding or FCS. 44 Sync, 76 Follow_Up, 54 Pdelay_*, 64+ Announce.' },
      { n: 'Dom', b: '4 · 1 B', c: H2, w: 4, d: '<b>domainNumber</b>. 2011: always 0. 2020: 0–127 (domain 0 is mandatory and default). Pdelay over CMLDS uses 0.' },
      { n: 'minSdo', b: '5 · 1 B', c: H2, w: 4, d: '<b>minorSdoId</b> (2020; reserved in 2011). 0 for gPTP.' },
      { n: 'Flags', b: '6 · 2 B', c: H, w: 5, d: 'Octet 0: <b>twoStepFlag</b> (0x02) must be 1 in two-step Sync and Pdelay_Resp. Octet 1: leap61 (0x01), leap59 (0x02), currentUtcOffsetValid (0x04), <b>ptpTimescale</b> (0x08, always 1 in gPTP), timeTraceable (0x10), frequencyTraceable (0x20).' },
      { n: 'correctionField', b: '8 · 8 B', c: 'var(--c-ts)', w: 12, d: 'Signed 64-bit, units of 2<sup>−16</sup> ns. In Sync it is the correction known at Sync time; in Follow_Up it carries the accumulated <b>residence times and upstream link delays</b> since the GM, scaled to GM time. In Pdelay_Resp of a one-step responder it holds the turnaround time.' },
      { n: 'TypeSpecific', b: '16 · 4 B', c: H2, w: 6, d: '<b>messageTypeSpecific</b> (1588-2019; "reserved" in 2011). 0 in gPTP.' },
      { n: 'sourcePortIdentity', b: '20 · 10 B', c: H, w: 12, d: '8-byte <b>clockIdentity</b> + 2-byte <b>portNumber</b> (1…n). Identifies the transmitting port. Note: in a bridge, Sync on each master port carries that port\'s identity, not the GM\'s.' },
      { n: 'seqId', b: '30 · 2 B', c: H2, w: 5, d: '<b>sequenceId</b>: per message type and port. Follow_Up repeats its Sync\'s value; Pdelay_Resp and Resp_Follow_Up repeat the Req\'s.' },
      { n: 'Ctl', b: '32 · 1 B', c: H2, w: 3, d: '<b>controlField</b>: a 1588 v1 leftover. 2011: Sync 0, Follow_Up 2, others 5. Deprecated in 1588-2019; receivers ignore it.' },
      { n: 'logInt', b: '33 · 1 B', c: H2, w: 4, d: '<b>logMessageInterval</b>, signed: log₂ of the current interval for this message type. Sync −3 = 125 ms. For Pdelay_Resp and Resp_Follow_Up it is 0x7F.' },
    ]);

    bar('#bar-sync', null, [
      { n: 'Header', b: '34 B', c: H2, w: 34 }, { n: 'reserved (originTimestamp)', b: '10 B', c: 'var(--cipher)', w: 10 },
    ]);
    bar('#bar-fu', '#det-fu', [
      { n: 'Header', b: '34 B', c: H2, w: 22, d: 'Same sequenceId as the Sync. correctionField = accumulated correction (see lesson 7).' },
      { n: 'preciseOriginTimestamp', b: '10 B', c: 'var(--c-ts)', w: 12, d: 'GM time when the Sync left the GM (48-bit seconds + 32-bit ns). Bridges copy it unchanged; they add their contribution to correctionField instead.' },
      { n: 'tlvType', b: '2 B', c: P, w: 4, d: '0x0003 = ORGANIZATION_EXTENSION.' },
      { n: 'len', b: '2 B', c: P, w: 3, d: 'lengthField = 28.' },
      { n: 'orgId', b: '3 B', c: P, w: 4, d: '00-80-C2 (IEEE 802.1).' },
      { n: 'sub', b: '3 B', c: P, w: 3, d: 'organizationSubType = 1: Follow_Up information TLV.' },
      { n: 'cumScaledRateOffset', b: '4 B', c: 'var(--c-gm)', w: 9, d: '<b>(rateRatio − 1) × 2<sup>41</sup></b>, Integer32. rateRatio = GM frequency / frequency of the sender\'s LocalClock. Each bridge multiplies in its own neighborRateRatio. Lets the next system convert local time intervals to GM time intervals.' },
      { n: 'gmTimeBaseInd', b: '2 B', c: 'var(--c-gm)', w: 5, d: '<b>gmTimeBaseIndicator</b>: the GM increments it whenever its time base changes (phase jump, frequency change, new source). Slaves use it to detect discontinuities.' },
      { n: 'lastGmPhaseChange', b: '12 B', c: 'var(--c-gm)', w: 9, d: 'ScaledNs (96-bit): size of the last GM phase change.' },
      { n: 'scaledLastGmFreqChange', b: '4 B', c: 'var(--c-gm)', w: 7, d: 'Integer32: the last GM frequency change, (fractional) × 2<sup>41</sup>.' },
    ]);
    bar('#bar-ann', null, [
      { n: 'Header', b: '34', c: H2, w: 34 }, { n: 'reserved', b: '10', c: 'var(--cipher)', w: 10 }, { n: 'UtcOff', b: '2', c: A, w: 3 }, { n: 'r', b: '1', c: 'var(--cipher)', w: 2 },
      { n: 'prio1', b: '1', c: T, w: 3 }, { n: 'clockQuality', b: '4', c: T, w: 5 }, { n: 'prio2', b: '1', c: T, w: 3 }, { n: 'gmIdentity', b: '8', c: T, w: 8 },
      { n: 'steps', b: '2', c: A, w: 3 }, { n: 'src', b: '1', c: A, w: 2 }, { n: 'path trace TLV', b: '4+8N', c: P, w: 12 },
    ]);
    bar('#bar-sig', null, [
      { n: 'Header', b: '34', c: H2, w: 34 }, { n: 'targetPortIdentity', b: '10', c: H, w: 10 }, { n: 'TLV hdr+org', b: '10', c: P, w: 10 },
      { n: 'link', b: '1', c: A, w: 2 }, { n: 'sync', b: '1', c: A, w: 2 }, { n: 'ann', b: '1', c: A, w: 2 }, { n: 'flags', b: '1', c: A, w: 2 }, { n: 'rsv', b: '2', c: 'var(--cipher)', w: 2 },
    ]);
    Course.tabs(root.querySelector('#msg-tabs'));

    // header builder
    const q = s => root.querySelector(s);
    const LEN = { 0: 44, 8: 76, 2: 54, 3: 54, 10: 54, 11: 76, 12: 60 };
    function build() {
      let ci, err = '';
      try { ci = PTPMath.macToClockIdentity(q('#h-mac').value); } catch (e) { ci = '0000000000000000'; err = '<span class="bad">MAC must be 6 bytes</span>\n'; }
      const t = +q('#h-type').value;
      const flags = (t === 0 || t === 3) ? 0x0208 : 0x0008;
      const h = { majorSdoId: +q('#h-sdo').value, messageType: t, minorVersionPTP: 1, versionPTP: 2, messageLength: LEN[t],
        domainNumber: Math.min(255, Math.max(0, +q('#h-dom').value | 0)), flags,
        correctionNs: parseFloat(q('#h-corr').value) || 0, clockIdentity: ci, portNumber: 1,
        sequenceId: (+q('#h-seq').value) & 0xffff, controlField: 0,
        logMessageInterval: (t === 3 || t === 10) ? 127 : Math.max(-128, Math.min(127, +q('#h-log').value | 0)) };
      const b = PTPMath.buildHeader(h);
      const cls = i => i < 2 ? 'tag' : i >= 8 && i < 16 ? 'icv' : i >= 20 && i < 30 ? 'hdr' : '';
      q('#h-hex').innerHTML = Array.from(b, (x, i) => `<span class="${cls(i)}" title="offset ${i}">${x.toString(16).padStart(2, '0')}</span>`).join('');
      const p = PTPMath.parseHeader(b);
      q('#h-out').innerHTML = err + `<span class="k">byte 0</span>  0x${b[0].toString(16).padStart(2, '0')} → majorSdoId ${p.majorSdoId}, messageType ${p.messageType} (${p.messageName}) ${p.messageType < 4 ? '<span class="w">event: hardware timestamps it</span>' : '<span class="ok">general: not timestamped</span>'}
<span class="k">byte 1</span>  0x${b[1].toString(16).padStart(2, '0')} → PTP v${p.versionPTP}.${p.minorVersionPTP} (802.1AS-2020 style; 2011 sends 0x02)
<span class="k">length</span>  ${p.messageLength} B   <span class="k">domain</span> ${p.domainNumber}   <span class="k">flags</span> 0x${p.flags.toString(16).padStart(4, '0')}${p.flags & 0x200 ? ' (twoStep, ptpTimescale)' : ' (ptpTimescale)'}
<span class="k">correctionField</span> ${hexs(b, 8, 16)} → ${p.correctionNs} ns
<span class="k">sourcePortIdentity</span> ${p.clockIdentity.match(/../g).join(':')} port ${p.portNumber}
<span class="k">sequenceId</span> ${p.sequenceId}   <span class="k">logMessageInterval</span> ${p.logMessageInterval}${p.logMessageInterval === 127 ? ' (0x7F: not applicable)' : ''}`;
    }
    const hexs = (b, a, z) => Array.from(b.subarray(a, z), x => x.toString(16).padStart(2, '0')).join(' ');
    ['#h-type', '#h-sdo', '#h-dom', '#h-mac', '#h-seq', '#h-corr', '#h-log'].forEach(s => q(s).addEventListener('input', build));
    build();

    // correctionField converter
    function cfFromNs() {
      const ns = parseFloat(q('#cf-ns').value) || 0;
      const b = PTPMath.encodeCorrection(ns);
      q('#cf-hex').value = PTPMath.hex(b);
      showCf(b);
    }
    function cfFromHex() {
      try { const b = PTPMath.unhex(q('#cf-hex').value); if (b.length !== 8) throw 0; q('#cf-ns').value = PTPMath.decodeCorrection(b); showCf(b); }
      catch (e) { q('#cf-out').innerHTML = '<span class="bad">enter exactly 8 bytes of hex</span>'; }
    }
    function showCf(b) {
      const ns = PTPMath.decodeCorrection(b);
      q('#cf-out').innerHTML = `${PTPMath.hex(b).match(/../g).join(' ')}\n= ${ns} ns  (resolution 2^-16 ns ≈ 15.3 fs)\nmax ≈ ±1.4e14 ns ≈ ±39 hours`;
    }
    q('#cf-ns').addEventListener('input', cfFromNs); q('#cf-hex').addEventListener('change', cfFromHex); cfFromNs();

    function ro() {
      const ppm = parseFloat(q('#ro-ppm').value) || 0;
      try {
        const v = PTPMath.encodeRateOffset(PTPMath.ppmToRatio(ppm));
        const u = (v >>> 0).toString(16).padStart(8, '0');
        q('#ro-out').innerHTML = `rateRatio = ${PTPMath.ppmToRatio(ppm).toFixed(12)}
cumulativeScaledRateOffset = ${v} = 0x${u}
decoded back: ${PTPMath.ratioToPpm(PTPMath.decodeRateOffset(v)).toFixed(6)} ppm  (step 2^-41 ≈ 4.5e-7 ppm)
Over a 125 ms Sync interval this ratio is worth ${(ppm * 125e-3 * 1e3).toFixed(1)} ns.`;
      } catch (e) { q('#ro-out').innerHTML = `<span class="bad">${e.message}</span>`; }
    }
    q('#ro-ppm').addEventListener('input', ro); ro();
  }
});
