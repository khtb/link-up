Course.register({
  id: 'glossary',
  title: 'Glossary & references',
  section: 'Practice',
  minutes: 5,
  render: () => {
    const g = [
      ['asCapable', 'Per-port (2020: per-domain) flag that the neighbour runs 802.1AS and the link delay is plausible. Sync only flows on asCapable ports.'],
      ['ARB timescale', 'Arbitrary timescale (2020): a time base with no claim of TAI/UTC traceability.'],
      ['BC', 'Boundary clock: terminates PTP, disciplines its own clock, re-originates time on master ports.'],
      ['BMCA', 'Best Master Clock Algorithm: compares Announce priority vectors to choose a GM and set port roles.'],
      ['CanTSyn / FrTSyn', 'AUTOSAR time synchronization over CAN / FlexRay (SYNC + FUP messages).'],
      ['CMLDS', 'Common Mean Link Delay Service (1588-2019 16.6, 802.1AS-2020): one Pdelay per link (majorSdoId 2) shared by all domains.'],
      ['correctionField', '64-bit signed field in units of 2⁻¹⁶ ns. Accumulates residence times and link delays in GM time.'],
      ['cumulativeScaledRateOffset', '(rateRatio − 1) × 2⁴¹ in the Follow_Up information TLV.'],
      ['Domain', 'A set of PTP Instances sharing one GM and one time. 2011: domain 0 only; 2020: 0–127.'],
      ['E2E / P2P', 'End-to-end (Delay_Req across the whole path) vs. peer-to-peer (Pdelay per link) delay measurement. gPTP uses P2P.'],
      ['EthTSyn', 'AUTOSAR Time Synchronization over Ethernet: static gPTP with an AUTOSAR Follow_Up TLV.'],
      ['Event / general message', 'Event messages (Sync, Pdelay_Req, Pdelay_Resp) are timestamped; general ones are not.'],
      ['External port configuration', '802.1AS-2020 mechanism to set port states by management instead of the BMCA.'],
      ['gmTimeBaseIndicator', 'Counter in the Follow_Up TLV incremented by the GM on every time-base discontinuity.'],
      ['GM', 'Grandmaster: the time source of a domain.'],
      ['gPTP', 'generalized Precision Time Protocol, IEEE 802.1AS.'],
      ['Hot standby', '802.1ASdm: two GMs in two domains with seamless selection.'],
      ['ingressLatency / egressLatency', 'Fixed delays between the actual timestamp capture point and the MDI, used to correct timestamps.'],
      ['majorSdoId', 'High nibble of header byte 0 (2011: transportSpecific). 1 = gPTP, 2 = CMLDS.'],
      ['meanLinkDelay', 'One-way propagation delay of a link measured by Pdelay (2011: neighborPropDelay).'],
      ['neighborRateRatio', 'Frequency ratio of the neighbour\'s clock to the local clock, measured from successive Pdelay exchanges.'],
      ['One-step / two-step', 'One-step: timestamp inserted into the event message on the fly. Two-step: sent later in Follow_Up / Pdelay_Resp_Follow_Up.'],
      ['PHC', 'PTP Hardware Clock: the timestamp counter, /dev/ptpN in Linux.'],
      ['PHC vclock', 'Linux virtual PTP clock on top of a free-running PHC, used for multiple domains.'],
      ['PTP Instance', '802.1AS-2020 term: the per-domain gPTP entity inside a time-aware system (Relay Instance or End Instance).'],
      ['rateRatio', 'Cumulative ratio of GM frequency to the local clock frequency.'],
      ['Reference plane', 'The boundary between a node and the medium (MDI) where timestamps are defined.'],
      ['Residence time', 'Time a Sync spends inside a bridge, from ingress to egress timestamp.'],
      ['Signaling', 'gPTP message carrying TLVs such as the Message Interval Request and (2020) gPTP-capable TLV.'],
      ['StbM', 'AUTOSAR Synchronized Time-Base Manager: manages time bases and their status in an ECU.'],
      ['syncLocked', '802.1AS-2020 relay mode: send Sync downstream immediately after receiving it.'],
      ['Syntonization', 'Matching frequency (as opposed to synchronization, which matches phase).'],
      ['TC', 'Transparent clock: forwards PTP event messages and adds the residence time (and for P2P, link delay) to correctionField.'],
      ['Time-aware relay / bridge', 'An 802.1AS bridge that terminates and regenerates Sync and accumulates corrections with rateRatio.'],
      ['TSU', 'Time Stamp Unit: hardware that latches the PHC when a frame\'s SFD passes.'],
    ];
    const ref = (t, u, d) => `<li><a href="${u}" target="_blank" rel="noopener">${t}</a>${d ? ` <span class="muted">${d}</span>` : ''}</li>`;
    return `
    <h1>Glossary and references</h1>
    <div class="table-wrap"><table>
      <tr><th style="width:220px">Term</th><th>Meaning</th></tr>
      ${g.map(([t, d]) => `<tr><td><b>${t}</b></td><td>${d}</td></tr>`).join('')}
    </table></div>

    <h2>Standards</h2>
    <ul>
      <li><b>IEEE 802.1AS-2011</b>: Timing and Synchronization for Time-Sensitive Applications in Bridged LANs (with Cor 1-2013, Cor 2-2016)</li>
      <li><b>IEEE 802.1AS-2020</b>: second edition (multiple domains, CMLDS, one-step, external port configuration), and amendments 802.1ASdm (hot standby), 802.1ASdr (terminology), 802.1ASdn (YANG), P802.1ASds (half-duplex / 10BASE-T1S)</li>
      <li><b>IEEE 1588-2008 / 1588-2019</b>: Precision Time Protocol (PTPv2 / v2.1)</li>
      <li><b>IEEE 802.1DG</b>: TSN profile for automotive in-vehicle Ethernet communications</li>
      <li><b>IEEE 802.1Qbv</b> (time-aware shaper, now in 802.1Q), <b>IEEE 1722</b> (AVTP)</li>
    </ul>

    <h2>Automotive</h2>
    <ul>
      ${ref('AVnu Alliance: Automotive Ethernet AVB Functional and Interoperability Specification (Automotive Profile)', 'https://avnu.org/', '(specifications section)')}
      ${ref('AUTOSAR Classic Platform: Specification of Time Synchronization over Ethernet (EthTSyn), StbM, CanTSyn', 'https://www.autosar.org/standards/classic-platform', '')}
      ${ref('IEEE 802.1 TSN Task Group: project status (802.1AS amendments, 802.1DG)', 'https://1.ieee802.org/tsn/', '')}
      ${ref('OPEN Alliance: TC6 10BASE-T1S MAC-PHY serial interface', 'https://opensig.org/', '')}
    </ul>

    <h2>Linux</h2>
    <ul>
      ${ref('linuxptp project (ptp4l, phc2sys, pmc, ts2phc)', 'https://linuxptp.nwtime.org/', '')}
      <li><code>man ptp4l</code>, <code>man phc2sys</code>, <code>man pmc</code>, <code>man ts2phc</code>; example configs in <code>linuxptp/configs/</code> (<code>gPTP.cfg</code>, <code>automotive-master.cfg</code>, <code>automotive-slave.cfg</code>, <code>gPTP_CMLDS_*.cfg</code>)</li>
      <li>Kernel docs: <code>Documentation/networking/timestamping.rst</code>, <code>Documentation/driver-api/ptp.rst</code>, <code>Documentation/networking/dsa/</code></li>
      <li>Wireshark display filter <code>ptp</code>; tcpdump <code>ether proto 0x88f7</code></li>
    </ul>
    <div class="callout tip"><b>Next steps</b> Run the namespace labs in <code>labs/</code>, capture the exchange in Wireshark and compare it with the
      dissector in lesson 3. Then repeat with two PTP-capable NICs and watch the offsets drop from microseconds to nanoseconds.</div>`;
  }
});
