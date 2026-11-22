Course.register({
  id: 'as2011-vs-2020',
  title: '802.1AS-2011 vs 802.1AS-2020',
  section: 'Automotive',
  minutes: 30,
  render: () => `
    <h1>802.1AS-2011 vs. 802.1AS-2020: what changed</h1>
    <p>Most ECUs in production today implement <b>802.1AS-2011</b> (often through the AVnu Automotive Profile or AUTOSAR EthTSyn).
    New zonal architectures and the IEEE automotive TSN profile (802.1DG) build on <b>802.1AS-2020</b>. The two interoperate on
    domain 0, but 2020 adds multiple domains, a shared link-delay service, one-step operation and standardised static configuration,
    which are exactly the features cars were working around.</p>

    <h2>At a glance</h2>
    <div class="table-wrap"><table class="cmp">
      <tr><th>Topic</th><th>802.1AS-2011</th><th>802.1AS-2020</th><th>Why it matters in a car</th></tr>
      <tr><td>Base standard</td><td>IEEE 1588-2008 (PTPv2)</td><td>IEEE 1588-2019 (PTPv2.1)</td><td>Header byte 1 changes from <code>0x02</code> to <code>0x12</code></td></tr>
      <tr><td>Domains</td><td>One (domain 0)</td><td><b>Multiple</b> (0–127); each is a separate <b>PTP Instance</b></td><td>Redundant GMs, a working-clock time plus a GNSS/UTC time</td></tr>
      <tr><td>Link delay</td><td>Per-port Pdelay (majorSdoId 1)</td><td>Instance-specific <i>or</i> <b>CMLDS</b> (majorSdoId 2), one measurement per link for all domains</td><td>No N× Pdelay traffic with N domains</td></tr>
      <tr><td>Sync mode</td><td>Two-step only</td><td>Two-step, <b>optional one-step TX</b>; every receiver must accept both</td><td>Lower CPU load, smaller residence time</td></tr>
      <tr><td>Static configuration</td><td>Not standardised (profiles like AVnu added it)</td><td><b>External port configuration</b>: <code>externalPortConfigurationEnabled</code>, <code>desiredState</code> per port</td><td>The automotive "no BMCA" model is now in the standard</td></tr>
      <tr><td>Intervals</td><td>initial*, Signaling</td><td>+ <b>management-settable</b> intervals (<code>useMgtSettableLogSyncInterval</code>, …), Signaling</td><td>Fixed operational rates from configuration</td></tr>
      <tr><td>asCapable</td><td>From Pdelay (per port)</td><td>Per domain: Pdelay/CMLDS plus the <b>gPTP-capable TLV</b> in Signaling; also <code>asCapableAcrossDomains</code></td><td>A domain only runs where the neighbour participates in it</td></tr>
      <tr><td>Fault tolerance</td><td>allowedLostResponses</td><td>+ <b>allowedFaults</b> (default 9)</td><td>Fewer asCapable flaps under EMC disturbances</td></tr>
      <tr><td>Timescale</td><td>PTP (TAI-based)</td><td>PTP or <b>ARB</b> (arbitrary) per domain</td><td>A free-running vehicle time without a TAI claim</td></tr>
      <tr><td>Relay behaviour</td><td>Send at next interval</td><td>+ <b>syncLocked</b> mode: send downstream immediately on receipt</td><td>Smaller residence time, lower error over many hops</td></tr>
      <tr><td>Media</td><td>Full-duplex 802.3, 802.11 TM, EPON, CSN</td><td>Same, plus 802.11 <b>FTM</b> (fine timing measurement)</td><td>Ethernet is what cars use; half-duplex 10BASE-T1S is not covered (see lesson 12)</td></tr>
      <tr><td>Terminology</td><td>Time-aware system, master/slave</td><td>PTP Instance, PTP Relay/End Instance; later amendment (802.1ASdr) introduces timeTransmitter/timeReceiver</td><td>New specs and tools use the new names</td></tr>
    </table></div>

    <h2>Details by topic</h2>
    <div class="card" id="v-tabs">
      <div class="tabs"><button>On the wire</button><button>Multiple domains</button><button>CMLDS</button><button>External port config</button><button>One-step & syncLocked</button><button>Interop & migration</button><button>Amendments</button></div>

      <div class="tabpane">
        <p>Same Ethernet framing (01-80-C2-00-00-0E, 0x88F7). The differences are in a few header bytes and new TLVs. Pick a message and compare:</p>
        <div class="lab"><div class="row">
          <div><label>Message</label><select id="w-msg"><option value="0">Sync</option><option value="8" selected>Follow_Up</option><option value="2">Pdelay_Req</option><option value="12">Signaling</option></select></div>
          <div><label>2020 domainNumber</label><input type="number" id="w-dom" value="1" min="0" max="127"></div>
          <div><label class="chk" style="margin-top:28px"><input type="checkbox" id="w-cmlds"> Pdelay via CMLDS (2020)</label></div>
        </div></div>
        <div class="grid2">
          <div><b>802.1AS-2011</b><div class="hexgrid" id="w-a"></div></div>
          <div><b>802.1AS-2020</b><div class="hexgrid" id="w-b"></div></div>
        </div>
        <div class="out" id="w-out"></div>
        <div class="table-wrap"><table>
          <tr><th>Field / TLV</th><th>2011</th><th>2020</th></tr>
          <tr><td>Byte 0 high nibble</td><td>transportSpecific = 1</td><td>majorSdoId = 1 (gPTP) or <b>2 (CMLDS)</b></td></tr>
          <tr><td>Byte 1 high nibble</td><td>reserved = 0</td><td>minorVersionPTP = <b>1</b></td></tr>
          <tr><td>Byte 4 domainNumber</td><td>0</td><td>0–127</td></tr>
          <tr><td>Byte 5</td><td>reserved</td><td>minorSdoId (0)</td></tr>
          <tr><td>Bytes 16–19</td><td>reserved</td><td>messageTypeSpecific (0)</td></tr>
          <tr><td>Sync</td><td>44 B, Follow_Up follows</td><td>44 B two-step, or <b>76 B one-step</b> (Follow_Up information TLV inside Sync)</td></tr>
          <tr><td>Signaling TLVs</td><td>Message interval request (subtype 2)</td><td>+ <b>gPTP-capable</b> (subtype 4), gPTP-capable message interval request (5); interval request gains <code>oneStepReceiveCapable</code> flag</td></tr>
        </table></div>
      </div>

      <div class="tabpane">
        <p>A 2020 time-aware system can contain one PTP Instance per domain, each with its own GM, port roles, Sync tree and (logically) its own clock.
        A port participates in several domains at once. Typical automotive uses:</p>
        <ul>
          <li><b>Redundancy</b>: two GMs (for example central HPC A and B) in domains 0 and 1, with end stations tracking both and selecting one. The 802.1ASdm <i>hot standby</i> amendment standardises this selection.</li>
          <li><b>Two timescales</b>: a free-running <i>working clock</i> (ARB timescale) for TSN gates and sensors, plus a <i>global time</i> (PTP timescale) traceable to GNSS/UTC for logging and V2X.</li>
          <li><b>Separation of concerns</b>: different safety or security levels per domain.</li>
        </ul>
        <p>Hardware impact: each domain needs its own time. That means either several PHCs, or one free-running PHC with per-domain
        offsets and rate ratios kept in software (Linux <b>PHC vclocks</b>, <code>/sys/class/ptp/ptpN/n_vclocks</code>), so one hardware
        timestamp can be converted into every domain's time base.</p>
      </div>

      <div class="tabpane">
        <div id="anim-cmlds"></div>
        <p>The <b>Common Mean Link Delay Service</b> (from 1588-2019, clause 16.6) runs once per physical link on a <b>Link Port</b>.
        Its Pdelay messages carry <code>majorSdoId = 2</code> and domain 0, and the measured <code>meanLinkDelay</code> and
        <code>neighborRateRatio</code> are provided to every PTP Instance on that port. In linuxptp this is <code>delay_mechanism COMMON_P2P</code> with a
        separate CMLDS server process (see <code>configs/gPTP_CMLDS_*.cfg</code>).</p>
      </div>

      <div class="tabpane">
        <p>With <code>externalPortConfigurationEnabled = TRUE</code> the BMCA is not run. Instead, each port's state comes from the
        management variable <code>desiredState</code> (master, slave, passive, disabled). Announce messages may still be sent and
        carry information, but they no longer elect anything. This is the 2011 automotive "static GM" model, standardised:</p>
        <div class="table-wrap"><table>
          <tr><th>Automotive Profile (2011 based)</th><th>802.1AS-2020 equivalent</th></tr>
          <tr><td>Static GM, no BMCA</td><td>externalPortConfigurationEnabled + desiredState</td></tr>
          <tr><td>initial/oper sync intervals via Signaling</td><td>Signaling, or useMgtSettableLogSyncInterval + mgtSettableLogSyncInterval</td></tr>
          <tr><td>oper Pdelay interval</td><td>useMgtSettableLogPdelayReqInterval + mgtSettableLogPdelayReqInterval</td></tr>
          <tr><td>asCapable forced true</td><td>No direct equivalent; asCapable is still computed (with allowedFaults for robustness)</td></tr>
          <tr><td>Stored neighborPropDelay</td><td>Management can switch off the link-delay computation (<code>useMgtSettableComputeMeanLinkDelay</code> / <code>mgtSettableComputeMeanLinkDelay</code>), so a configured value is used</td></tr>
        </table></div>
      </div>

      <div class="tabpane">
        <p><b>One-step</b> (optional, 2020): the transmitter inserts the timestamp in hardware and appends the Follow_Up information TLV to the Sync itself.
        A port only sends one-step if its neighbour said it can receive it (<code>oneStepReceiveCapable</code> in Signaling) and management allows it
        (<code>useMgtSettableOneStepTxOper</code>). A relay that receives one-step and transmits two-step (or the reverse) is fine; the correction arithmetic is the same.</p>
        <p><b>syncLocked</b>: when a PTP Relay Instance\'s master port runs at the same Sync interval as its slave port, it can transmit each Sync as
        soon as it has processed the incoming one, instead of on its own timer. Residence time drops from up to one Sync interval to the processing
        time, which reduces the error from rate-ratio inaccuracy and makes the downstream Sync phase-locked to the GM\'s.</p>
      </div>

      <div class="tabpane">
        <ul>
          <li><b>Domain 0 is the compatibility domain.</b> A 2020 system talking to a 2011 neighbour runs domain 0 only and uses the instance-specific Pdelay (majorSdoId 1), which a 2011 device understands.</li>
          <li>2011 receivers ignore the reserved nibble that 2020 uses for minorVersionPTP, so the <code>0x12</code> byte is accepted. Very old or strict parsers that compare the whole byte to 0x02 are a known interop pitfall.</li>
          <li>CMLDS is only used if both ends support it; otherwise 2020 falls back to per-instance Pdelay.</li>
          <li>One-step is never sent towards a neighbour that did not advertise oneStepReceiveCapable.</li>
          <li>In linuxptp, the same <code>gPTP.cfg</code> serves both; 2020 features are opt-in (<code>domainNumber</code>, <code>COMMON_P2P</code>, <code>time_stamping onestep</code>, <code>allowedLostResponses 9</code>).</li>
          <li><b>Migration in a vehicle</b>: keep domain 0 as the 2011-compatible working clock, add domain 1+ only between 2020-capable zone controllers and the HPC, and move static roles from vendor-specific options to external port configuration.</li>
        </ul>
      </div>

      <div class="tabpane">
        <div class="table-wrap"><table>
          <tr><th>Document</th><th>Content</th></tr>
          <tr><td>802.1AS-2011</td><td>First edition. Corrigenda: Cor 1-2013, Cor 2-2016.</td></tr>
          <tr><td>802.1AS-2020</td><td>Second edition (multiple domains, CMLDS, one-step, external port configuration). Cor 1-2021.</td></tr>
          <tr><td>802.1ASdr</td><td>Inclusive terminology (timeTransmitter / timeReceiver).</td></tr>
          <tr><td>802.1ASdm</td><td><b>Hot standby</b>: redundant GMs in two domains and selection between them.</td></tr>
          <tr><td>802.1ASdn</td><td>YANG data model for management.</td></tr>
          <tr><td>P802.1ASds</td><td>Support for half-duplex 802.3 MACs, which brings <b>10BASE-T1S multidrop</b> into gPTP.</td></tr>
          <tr><td>802.1DG</td><td>TSN profile for automotive in-vehicle Ethernet: selects 802.1AS-2020 features (external port configuration, multiple domains) for cars.</td></tr>
        </table></div>
        <p class="src">Amendment designations and status change over time; check the IEEE 802.1 TSN task group pages for the current state of each project.</p>
      </div>
    </div>
  `,
  mount: (root) => {
    Course.tabs(root.querySelector('#v-tabs'));

    // CMLDS animation
    const nd = (id, x, t) => `<g id="${id}"><rect class="node" x="${x}" y="70" width="220" height="190" rx="10"/><text x="${x + 110}" y="92" text-anchor="middle" font-size="12.5" font-weight="700">${t}</text></g>`;
    const inst = (id, x, y, t, c) => `<g id="${id}" class="f"><rect x="${x}" y="${y}" width="180" height="34" rx="6" fill="var(--panel-2)" stroke="${c}" stroke-width="1.5"/><text x="${x + 90}" y="${y + 21}" text-anchor="middle" font-size="11" font-weight="700">${t}</text></g>`;
    const pd = (id, y, t, c) => `<g id="${id}" class="f"><path d="M270,${y} L630,${y}" stroke="${c}" stroke-width="2" marker-start="url(#ah10)" marker-end="url(#ah10)"/><text x="450" y="${y - 6}" text-anchor="middle" font-size="10.5" font-weight="700" style="fill:${c}">${t}</text></g>`;
    Course.stepper(root.querySelector('#anim-cmlds'), {
      title: 'Two domains on one link: instance-specific Pdelay vs CMLDS',
      svg: `
      <svg viewBox="0 0 900 290" role="img" aria-label="CMLDS">
        <defs><marker id="ah10" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--text)"/></marker></defs>
        ${nd('A', 50, 'Zone controller')}${nd('B', 630, 'Central HPC')}
        <path class="wire" d="M270,165 L630,165"/>
        ${inst('a0', 70, 108, 'PTP Instance · domain 0', 'var(--c-sync)')}${inst('a1', 70, 150, 'PTP Instance · domain 1', 'var(--c-gm)')}
        ${inst('b0', 650, 108, 'PTP Instance · domain 0', 'var(--c-sync)')}${inst('b1', 650, 150, 'PTP Instance · domain 1', 'var(--c-gm)')}
        ${pd('pd0', 120, 'Pdelay, domain 0 (sdoId 1)', 'var(--c-sync)')}${pd('pd1', 145, 'Pdelay, domain 1 (sdoId 1)', 'var(--c-gm)')}
        ${inst('la', 70, 210, 'CMLDS Link Port', 'var(--c-pd)')}${inst('lb', 650, 210, 'CMLDS Link Port', 'var(--c-pd)')}
        ${pd('pdc', 215, 'one Pdelay (majorSdoId 2, domain 0)', 'var(--c-pd)')}
        <g id="share" class="f"><path d="M160,210 L160,186" stroke="var(--c-pd)" stroke-width="1.5" marker-end="url(#ah10)"/><path d="M200,210 L200,144" stroke="var(--c-pd)" stroke-width="1.5" marker-end="url(#ah10)"/>
          <text x="450" y="270" text-anchor="middle" font-size="11" font-weight="700" style="fill:var(--c-pd)">meanLinkDelay + neighborRateRatio shared with every domain</text></g>
      </svg>`,
      steps: [
        { caption: 'Two 2020 systems that both take part in domain 0 and domain 1 (for example a working clock and a redundant GM).', do: s => s.show(['a0', 'a1', 'b0', 'b1']) },
        { caption: '<b>Instance-specific</b> mechanism: each domain runs its own Pdelay. The cable is measured twice, with twice the traffic and twice the timestamps. Fine for one or two domains, wasteful beyond that.', do: s => s.show(['pd0', 'pd1']) },
        { caption: '<b>CMLDS</b>: a single Link Port per physical port measures the link once, with majorSdoId 2.', do: s => { s.dim(['pd0', 'pd1']); s.show(['la', 'lb', 'pdc']); } },
        { caption: 'The result is shared with every PTP Instance on the port. A 2011 neighbour doesn\'t understand majorSdoId 2, so toward a 2011 device a 2020 port uses the instance-specific mechanism on domain 0.', do: s => s.show('share') },
      ]
    });

    // wire diff
    const q = s => root.querySelector(s);
    const LEN = { 0: 44, 8: 76, 2: 54, 12: 60 };
    function wire() {
      const t = +q('#w-msg').value, cm = q('#w-cmlds').checked && t === 2;
      const base = { messageType: t, messageLength: LEN[t], flags: t === 0 ? 0x0208 : 0x0008, correctionNs: 0, clockIdentity: '001b21fffeaabbcc', sequenceId: 7, logMessageInterval: t === 2 ? 0 : t === 12 ? 127 : -3 };
      const ctl = t === 0 ? 0 : t === 8 ? 2 : 5;   // legacy controlField values, unchanged
      const A = PTPMath.buildHeader(Object.assign({}, base, { majorSdoId: 1, minorVersionPTP: 0, domainNumber: 0, controlField: ctl }));
      const B = PTPMath.buildHeader(Object.assign({}, base, { majorSdoId: cm ? 2 : 1, minorVersionPTP: 1, domainNumber: (t === 2) ? 0 : Math.max(0, Math.min(127, +q('#w-dom').value | 0)), controlField: ctl }));
      const draw = (b, o) => Array.from(b, (x, i) => `<span class="${x !== o[i] ? 'icv' : ''}" title="offset ${i}">${x.toString(16).padStart(2, '0')}</span>`).join('');
      q('#w-a').innerHTML = draw(A, B); q('#w-b').innerHTML = draw(B, A);
      const diff = []; A.forEach((x, i) => { if (x !== B[i]) diff.push(i); });
      const names = { 0: 'majorSdoId/messageType', 1: 'minorVersionPTP/versionPTP', 4: 'domainNumber', 32: 'controlField' };
      q('#w-out').innerHTML = `Differences (highlighted): ` + (diff.length ? diff.map(i => `byte ${i} (${names[i] || '?'}): 0x${A[i].toString(16).padStart(2, '0')} → 0x${B[i].toString(16).padStart(2, '0')}`).join(', ') : 'none') +
        (t === 2 ? `\n<span class="w">Pdelay always uses domain 0; with CMLDS the 2020 frame changes majorSdoId to 2.</span>` : '') +
        `\nThe common header is otherwise identical; body and TLVs differ only where new TLVs are added.`;
    }
    ['#w-msg', '#w-dom', '#w-cmlds'].forEach(i => q(i).addEventListener('input', wire)); wire();
  }
});
