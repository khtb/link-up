Course.register({
  id: 'auto-ecosystem',
  title: 'Automotive time-sync protocols: AUTOSAR, 802.1DG, T1S',
  section: 'Automotive',
  minutes: 25,
  render: () => `
    <h1>The automotive time-sync landscape</h1>
    <p>In a real vehicle, gPTP is one link in a chain: the time base is managed by AUTOSAR on microcontrollers, passed on to CAN
    and FlexRay by time gateways, consumed by Linux on the HPC, and sometimes handed to sensors that speak plain IEEE 1588.
    This lesson maps the protocols and profiles you will meet and how they relate to the 2011 and 2020 editions of 802.1AS.</p>

    <h2>Protocol and profile map</h2>
    <div class="table-wrap"><table>
      <tr><th>Protocol / profile</th><th>Based on</th><th>Medium</th><th>Key characteristics</th></tr>
      <tr><td><b>AVnu Automotive Profile</b></td><td>802.1AS-2011</td><td>100BASE-T1, 1000BASE-T1</td><td>Static GM and port roles, no Announce, asCapable true, stored link delay, initial/oper intervals via Signaling (lesson 10).</td></tr>
      <tr><td><b>AUTOSAR EthTSyn</b> (Time Synchronization over Ethernet)</td><td>802.1AS-2011 messages</td><td>Ethernet</td><td>Static Time Master / Time Slave per port, no BMCA. Adds the <b>AUTOSAR Follow_Up TLV</b> with sub-TLVs (CRC-protected time, status, user data, offset time bases). Domain number = AUTOSAR time domain.</td></tr>
      <tr><td><b>AUTOSAR CanTSyn / FrTSyn</b></td><td>AUTOSAR-specific</td><td>CAN (FD), FlexRay</td><td>Two-message SYNC + FUP: SYNC carries the seconds, FUP the nanoseconds and the measured transmit latency. Optional CRC. Fed by a time gateway.</td></tr>
      <tr><td><b>AUTOSAR StbM</b> (Synchronized Time-Base Manager)</td><td>—</td><td>internal</td><td>Owns every time base in the ECU, applies rate and offset correction, detects timeouts and time leaps, gives applications status bits.</td></tr>
      <tr><td><b>IEEE 802.1DG</b> (TSN profile for automotive in-vehicle Ethernet)</td><td>802.1AS-2020</td><td>Ethernet</td><td>Selects 2020 features for cars: external port configuration instead of BMCA, multiple domains for redundancy and separate timescales, fixed intervals.</td></tr>
      <tr><td><b>gPTP on 10BASE-T1S</b></td><td>802.1AS-2020 + P802.1ASds</td><td>10 Mb/s single-pair, multidrop with PLCA</td><td>Half-duplex shared medium: one transmitter, many receivers, no per-link Pdelay pairs. Being standardised (see below).</td></tr>
      <tr><td><b>IEEE 1588 default / sensor profiles</b></td><td>1588-2008/2019</td><td>UDP/IPv4 or L2, E2E</td><td>Many lidars, radars and cameras. A gateway or switch running a 1588 BC/TC bridges them to the gPTP domain.</td></tr>
      <tr><td><b>IEEE 1722 AVTP</b></td><td>802.1AS time</td><td>Ethernet</td><td>Not a sync protocol: stream packets carry an <b>avtp_timestamp</b> (presentation time) in gPTP time; listeners recover media clocks (CRF).</td></tr>
    </table></div>

    <h2>A global time across the whole vehicle</h2>
    <div id="anim-gw"></div>

    <h2>AUTOSAR Follow_Up TLV</h2>
    <p>EthTSyn appends a second organisation-extension TLV after the 802.1AS Follow_Up information TLV. It contains sub-TLVs
    so that safety-relevant receivers can check what they get:</p>
    <div class="table-wrap"><table>
      <tr><th>Part</th><th>Content</th></tr>
      <tr><td>TLV header</td><td>tlvType 0x0003 (organisation extension), organizationId <code>1A-75-FB</code> (AUTOSAR), organizationSubType <code>60-56-76</code></td></tr>
      <tr><td><b>Time Secured</b> sub-TLV</td><td>CRC over selected Follow_Up fields (correctionField, preciseOriginTimestamp, domain, sequenceId) using a DataID list; lets an ASIL receiver detect corrupted time</td></tr>
      <tr><td><b>Status</b> sub-TLV (secured / not secured)</td><td>The StbM status of the time master, e.g. SYNC_TO_GATEWAY</td></tr>
      <tr><td><b>UserData</b> sub-TLV</td><td>Up to 3 bytes of application data distributed with the time</td></tr>
      <tr><td><b>OFS</b> sub-TLV</td><td>An <b>offset time base</b> (for example UTC or local time) transported as an offset to the synchronized time base</td></tr>
    </table></div>
    <p class="src">Summarised from the AUTOSAR Classic Platform <i>Specification of Time Synchronization over Ethernet</i> (SWS EthTSyn). Exact sub-TLV type codes, CRC
    configuration and the newer authenticated-time options depend on the AUTOSAR release; check the release your ECUs implement.</p>

    <h2>Lab: StbM time-base status</h2>
    <p>Applications don't read raw gPTP; they read the StbM status of a time base. Trigger events and watch the status byte.</p>
    <div class="card lab">
      <div class="row">
        <div style="flex:1 1 300px">
          <label class="chk"><input type="checkbox" id="st-first" checked> At least one valid time sync received since startup</label>
          <label class="chk"><input type="checkbox" id="st-to"> No Sync/Follow_Up within the timeout (master lost)</label>
          <label class="chk"><input type="checkbox" id="st-gw"> Time gateway lost sync to its upstream master</label>
          <label>Time jump applied by the last update [ms]: <b id="st-jv">0</b></label><input type="range" id="st-jump" min="-50" max="50" value="0">
          <label>Time leap threshold [ms]</label><input type="number" id="st-thr" value="10" min="0" step="any">
        </div>
      </div>
      <div class="out" id="st-out"></div>
    </div>

    <h2>10BASE-T1S: gPTP on a shared medium</h2>
    <div class="grid2">
      <div class="card"><b>Why it is different</b><br><span class="muted">802.1AS (2011 and 2020) assumes <b>full-duplex point-to-point</b> links: each port has exactly one neighbour and Pdelay measures that one link. On a T1S multidrop bus, 2–8+ nodes share one pair, transmit in turn under PLCA, and every frame reaches every node.</span></div>
      <div class="card"><b>How it is being solved</b><br><span class="muted">The amendment project <b>P802.1ASds</b> adds support for half-duplex 802.3 MACs. The natural model: one node (usually the head node, a zone controller) is the master for the segment and multicasts Sync. Bus delays are tiny (≈ 5 ns/m, a 25 m bus ≈ 125 ns) and can be configured or measured per node.</span></div>
      <div class="card"><b>Timestamping</b><br><span class="muted">Many T1S nodes are MCUs with an OPEN Alliance <b>TC6 MAC-PHY</b> on SPI. The timestamp is taken in the MAC-PHY and returned over SPI (TX timestamp capture registers or footers), so latency to software is high but accuracy can stay good.</span></div>
      <div class="card"><b>Interaction with MACsec</b><br><span class="muted">If gPTP frames are MACsec-protected, the timestamp must be taken on the protected frame at the wire, or the MACsec latency must be constant. On a shared medium, MACsec keying itself is still being standardised (see the MACsec course, lesson 9).</span></div>
    </div>

    <h2>Securing time</h2>
    <ul>
      <li><b>Hop-by-hop MACsec</b> protects gPTP frames against injection and modification on each link, provided timestamping is compatible (see above). Bridges still see clear text internally.</li>
      <li><b>AUTOSAR CRC</b> in the Follow_Up TLV detects corruption (safety), not attacks.</li>
      <li><b>IEEE 1588-2019 Annex P authentication TLV</b> adds an ICV to PTP messages. linuxptp supports it (<code>configs/authentication.cfg</code>, <code>spp</code> / <code>active_key_id</code>).</li>
      <li><b>Plausibility</b>: time-leap thresholds (StbM), rate-correction limits, comparing two domains (2020 multi-domain / hot standby). A delay attack on a single link cannot be detected cryptographically, only by plausibility checks.</li>
    </ul>
  `,
  mount: (root) => {
    const nd = (id, x, y, w, t, sub, c) => `<g id="${id}"><rect class="node" x="${x}" y="${y}" width="${w}" height="50" rx="8" ${c ? `style="stroke:${c}"` : ''}/><text x="${x + w / 2}" y="${y + 21}" text-anchor="middle" font-size="12" font-weight="700">${t}</text><text x="${x + w / 2}" y="${y + 37}" text-anchor="middle" font-size="9.5" class="t-muted">${sub}</text></g>`;
    const lbl = (id, x, y, t, c) => `<g id="${id}" class="f"><text x="${x}" y="${y}" text-anchor="middle" font-size="10.5" font-weight="700" style="fill:${c}">${t}</text></g>`;
    Course.stepper(root.querySelector('#anim-gw'), {
      title: 'One global time: GNSS → gPTP → time gateway → CAN / T1S / Linux',
      svg: `
      <svg viewBox="0 0 900 330" role="img" aria-label="Vehicle time distribution">
        ${nd('gnss', 20, 20, 130, 'GNSS receiver', 'PPS + NMEA', 'var(--c-gm)')}
        ${nd('hpc', 220, 20, 200, 'Central HPC (Linux)', 'ptp4l GM · phc2sys · ts2phc', 'var(--c-gm)')}
        ${nd('zc', 330, 140, 220, 'Zone controller (AUTOSAR)', 'EthTSyn slave + StbM + time gateway', 'var(--accent)')}
        ${nd('eth', 620, 20, 170, 'Ethernet ECU', 'EthTSyn time slave')}
        ${nd('can', 80, 260, 180, 'CAN-FD ECUs', 'CanTSyn time slaves')}
        ${nd('t1s', 340, 260, 200, '10BASE-T1S sensors', 'MAC-PHY · gPTP on the bus')}
        ${nd('lid', 640, 260, 200, 'Lidar (IEEE 1588)', 'UDP · E2E')}
        <path class="wire" d="M150,45 L220,45"/><path class="wire" d="M420,45 L620,45"/><path class="wire" d="M320,70 L400,140"/>
        <path class="wire" d="M380,190 L170,260"/><path class="wire" d="M440,190 L440,260"/><path class="wire" d="M500,190 L740,260"/>
        ${lbl('l-pps', 185, 36, 'PPS', 'var(--c-gm)')}
        ${lbl('l-g1', 520, 36, 'gPTP domain 0', 'var(--c-sync)')}
        ${lbl('l-g2', 470, 112, 'gPTP + AUTOSAR TLV', 'var(--c-sync)')}
        ${lbl('l-can', 190, 215, 'CanTSyn SYNC/FUP', 'var(--warn)')}
        ${lbl('l-t1s', 500, 232, 'gPTP (T1S)', 'var(--c-sync)')}
        ${lbl('l-1588', 700, 222, '1588 BC on a port', 'var(--c-ann)')}
        ${lbl('l-sys', 200, 92, 'phc2sys → CLOCK_REALTIME', 'var(--accent-2)')}
      </svg>`,
      steps: [
        { caption: 'A possible vehicle: a central HPC running Linux, a zone controller running AUTOSAR, Ethernet ECUs, a CAN-FD domain, a 10BASE-T1S sensor bus and a lidar that only speaks 1588.', do: s => {} },
        { caption: 'The HPC disciplines its PHC to <b>GNSS</b> (<code>ts2phc</code> with the receiver\'s PPS) and is the gPTP <b>grandmaster</b>. Without GNSS it simply free-runs; the in-vehicle time stays consistent either way.', do: s => { s.show('l-pps'); s.hl(['gnss', 'hpc']); } },
        { caption: 'gPTP domain 0 carries the time over Ethernet. AUTOSAR ECUs run <b>EthTSyn</b> as static time slaves and read the AUTOSAR Follow_Up TLV.', do: s => { s.unhl(['gnss', 'hpc']); s.show(['l-g1', 'l-g2']); } },
        { caption: 'The zone controller is a <b>time gateway</b>: StbM keeps the synchronized time base and re-distributes it, here with <b>CanTSyn</b> SYNC/FUP on CAN-FD. Downstream ECUs see <code>SYNC_TO_GATEWAY</code> if the gateway loses its upstream sync.', do: s => { s.hl('zc'); s.show('l-can'); } },
        { caption: 'On the <b>10BASE-T1S</b> bus the zone controller is the segment master and multicasts gPTP Sync to all nodes.', do: s => s.show('l-t1s') },
        { caption: 'The lidar speaks IEEE 1588 over UDP with E2E delay measurement. The zone controller (or switch) acts as a 1588 <b>boundary clock</b> on that port, using the same PHC.', do: s => s.show('l-1588') },
        { caption: 'On the HPC, applications use <code>CLOCK_REALTIME</code> or the PHC directly; <code>phc2sys</code> keeps the system clock aligned to the PHC (lesson 13).', do: s => { s.unhl('zc'); s.show('l-sys'); } },
      ]
    });

    const q = s => root.querySelector(s);
    function st() {
      const j = +q('#st-jump').value, thr = +q('#st-thr').value || 0;
      q('#st-jv').textContent = j;
      const bits = [
        ['TIMEOUT', 0x01, q('#st-to').checked, 'no valid time message within the configured timeout; time continues on local oscillator'],
        ['SYNC_TO_GATEWAY', 0x04, q('#st-gw').checked, 'time is provided by a gateway that is itself not synchronized upstream'],
        ['GLOBAL_TIME_BASE', 0x08, q('#st-first').checked, 'has been synchronized at least once since startup'],
        ['TIMELEAP_FUTURE', 0x10, j > thr, `last update jumped forward by more than ${thr} ms`],
        ['TIMELEAP_PAST', 0x20, j < -thr, `last update jumped backward by more than ${thr} ms`],
      ];
      const v = bits.reduce((a, b) => a | (b[2] ? b[1] : 0), 0);
      q('#st-out').innerHTML = `<span class="k">timeBaseStatus</span> = 0x${v.toString(16).padStart(2, '0').toUpperCase()}\n` +
        bits.map(b => `${b[2] ? '<span class="w">■</span>' : '□'} ${b[0].padEnd(17)} 0x${b[1].toString(16).padStart(2, '0')}  ${b[2] ? b[3] : ''}`).join('\n') +
        `\n\n` + (!(v & 0x08) ? '<span class="bad">Never synchronized: applications must not use this time.</span>' :
          (v & 0x31) ? '<span class="w">Synchronized time base with warnings: safety functions decide whether the time is still usable.</span>' :
          '<span class="ok">Healthy, synchronized time base.</span>') +
        `\n<span class="muted">Bit positions as in AUTOSAR CP StbM_TimeBaseStatusType; verify against your release.</span>`;
    }
    ['#st-first', '#st-to', '#st-gw', '#st-jump', '#st-thr'].forEach(i => q(i).addEventListener('input', st)); st();
  }
});
