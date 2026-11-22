Course.register({
  id: 'glossary',
  title: 'Glossary & references',
  section: 'Practice',
  minutes: 5,
  render: () => {
    const g = [
      ['10BASE-T1S', 'IEEE 802.3cg 10 Mbit/s single-pair Ethernet. It supports point-to-point and half-duplex multidrop (shared medium).'],
      ['AAD', 'Additional Authenticated Data: authenticated but not encrypted. In MACsec this is DA ‖ SA ‖ SecTAG.'],
      ['AN', 'Association Number (2 bits) in the SecTAG. Selects the SA/SAK within an SC.'],
      ['AUTOSAR MKA', 'The AUTOSAR basic-software specification for MKA in ECUs (SWS MACsecKeyAgreement).'],
      ['Bypass rule', 'A rule (match on DA, EtherType or VLAN) that sends a frame through the uncontrolled port in clear. The automotive profile requires at least 8.'],
      ['CA', 'Secure Connectivity Association: the members that share a CAK.'],
      ['CAK', 'Connectivity Association Key: the long-term root key (pre-shared, or derived from EAP).'],
      ['CKN', 'CAK Name: the public identifier of the CAK, carried in every MKPDU.'],
      ['Coordinator', 'The PLCA node with ID 0. It sends the BEACON that starts each transmit cycle.'],
      ['EAPoL', 'EAP over LAN (EtherType 0x888E). MKA uses EAPOL packet type 5.'],
      ['Head node', 'The node on a T1S bus that connects it to the rest of the vehicle network, usually a zone controller or switch.'],
      ['ICK', 'ICV Key: derived from the CAK. Computes the AES-CMAC ICV of MKPDUs.'],
      ['ICV', 'Integrity Check Value: a 16-byte tag (the GCM tag on frames, the CMAC on MKPDUs).'],
      ['KEK', 'Key Encrypting Key: derived from the CAK. Wraps the SAK with AES Key Wrap.'],
      ['Key server', 'The elected MKA participant that generates and distributes SAKs. In cars this role is usually fixed (priority 0).'],
      ['KI / KN', 'Key Identifier = key server MI ‖ Key Number. It names a SAK.'],
      ['MAC-PHY', 'A chip combining MAC and PHY, connected to an MCU over SPI (OPEN Alliance TC6 interface).'],
      ['MI / MN', 'Member Identifier (96-bit random) / Message Number (32-bit counter) of an MKA participant.'],
      ['MKA', 'MACsec Key Agreement protocol, IEEE 802.1X-2010/2020 clause 9.'],
      ['MKPDU', 'MKA protocol data unit: an EAPOL-MKA frame.'],
      ['OPEN Alliance TC17', 'The OPEN Alliance technical committee for automotive Ethernet security. It publishes the Automotive MACsec and MKA specifications.'],
      ['PLCA', 'Physical Layer Collision Avoidance (802.3cg Clause 148): round-robin transmit opportunities on a T1S bus.'],
      ['PN', 'Packet Number: a per-SA frame counter, part of the IV, used for replay protection.'],
      ['SA', 'Secure Association: one SAK\'s use within an SC.'],
      ['SAK', 'Secure Association Key: the GCM-AES data key.'],
      ['SC', 'Secure Channel: a one-way channel from one transmitter, identified by its SCI.'],
      ['SCI', 'Secure Channel Identifier: 48-bit MAC ‖ 16-bit port ID.'],
      ['SecTAG', 'Security TAG inserted after the source MAC: EtherType 88E5, TCI/AN, SL, PN, [SCI].'],
      ['SecY', 'MAC Security Entity: the MACsec engine on a port. On Linux, a macsec netdev.'],
      ['SSCI / Salt', 'XPN-only values: a 32-bit Short SCI and a 96-bit salt used to build the IV.'],
      ['TCI', 'Tag Control Information bits: V, ES, SC, SCB, E, C.'],
      ['TO', 'Transmit Opportunity: a node\'s turn in a PLCA cycle.'],
      ['XPN', 'Extended Packet Numbering: a 64-bit PN (802.1AEbw).'],
      ['Zonal architecture', 'A vehicle E/E design in which zone controllers gather local ECUs and sensors and connect to central compute over an Ethernet backbone.'],
    ];
    const ref = (t, u, d) => `<li><a href="${u}" target="_blank" rel="noopener">${t}</a>${d ? ` <span class="muted">${d}</span>` : ''}</li>`;
    return `
    <h1>Glossary and references</h1>
    <div class="table-wrap"><table>
      <tr><th style="width:190px">Term</th><th>Meaning</th></tr>
      ${g.map(([t, d]) => `<tr><td><b>${t}</b></td><td>${d}</td></tr>`).join('')}
    </table></div>

    <h2>Standards</h2>
    <ul>
      <li><b>IEEE 802.1AE-2018</b>: MAC Security (MACsec), including the AEbn (GCM-AES-256) and AEbw (XPN) amendments</li>
      <li><b>IEEE 802.1X-2020</b>: Port-Based Network Access Control. Clause 9 covers MKA and clause 6 the key hierarchy and KDF.</li>
      <li><b>IEEE 802.3cg-2019</b>: 10BASE-T1S / T1L, with Clause 148 (PLCA). <b>P802.3da</b> extends multidrop.</li>
      <li><b>NIST SP 800-38D</b> (GCM/GMAC) · <b>RFC 4493</b> (AES-CMAC) · <b>RFC 3394</b> (AES Key Wrap)</li>
    </ul>

    <h2>Automotive and 10BASE-T1S</h2>
    <ul>
      ${ref('OPEN Alliance: Automotive MACsec Specification v1.0 (16 May 2025)', 'https://opensig.org/wp-content/uploads/2025/05/Automotive-MACsec-Specification-v1.0.pdf', '(public)')}
      ${ref('OPEN Alliance TC17: Automotive Ethernet security committee', 'https://opensig.org/?p=1035', '(roadmap, Automotive MKA specification)')}
      ${ref('L. Völker: Automotive Requirements for (Shared Medium) MKA, IEEE 802.1, 2025-03', 'https://www.ieee802.org/1/files/public/docs2025/x-voelker-mka-requirements-automotive-0325-v01.pdf')}
      ${ref('J. McIntosh: MACsec with Shared Media, IEEE 802.1, 2023-07', 'https://grouper.ieee.org/groups/802/1/files/public/docs2023/ae-mcintosh-macsec-w-shared-media-2307-v03.pdf')}
      ${ref('IEEE 802.1 contribution: MKA explicit SSCI (2025-07)', 'https://grouper.ieee.org/groups/802/1/files/public/docs2025/x-molina-mka-explicit-ssci-0725-v01.pdf')}
      ${ref('IEEE 802.1 contribution: MKA optimizations (2025-03)', 'https://grouper.ieee.org/groups/802/1/files/public/docs2025/x-seaman-mka-optimizations-0325-v05.pdf')}
      ${ref('SemiEngineering: 10Base-T1S Ethernet and the Use of MACsec for Link Security (2025)', 'https://semiengineering.com/10base-t1s-ethernet-and-the-use-of-macsec-for-link-security')}
      ${ref('Microchip: How MACsec protects the vehicles of the future (2026)', 'https://www.microchip.com/en-us/about/media-center/blog/2026/how-macsec-protects-the-vehicles-of-the-future')}
      ${ref('ePrint 2026/1661: MKA Meets Multidrop', 'https://eprint.iacr.org/2026/1661')}
      ${ref('AUTOSAR: SWS MACsecKeyAgreement (R22-11)', 'https://www.autosar.org/fileadmin/standards/R22-11/CP/AUTOSAR_SWS_MACsecKeyAgreement.pdf')}
    </ul>

    <h2>Linux</h2>
    <ul>
      <li><code>man ip-macsec</code>, <code>man ip-link</code> (type macsec), <code>man systemd.netdev</code> ([MACsec] sections)</li>
      <li>wpa_supplicant: the <code>macsec_linux</code> driver and the <code>mka_*</code> / <code>macsec_*</code> options in <code>wpa_supplicant.conf</code></li>
      <li>ethtool PLCA: <code>--get-plca-cfg</code>, <code>--set-plca-cfg</code>, <code>--get-plca-status</code></li>
      <li>Wireshark display filters: <code>eapol.type == 5</code> (MKA), <code>macsec</code></li>
    </ul>
    <div class="callout tip"><b>Next steps</b> Run the three lab scripts in <code>labs/</code>, capture both protocols in Wireshark,
      and compare what you see with the frame dissector in lesson 3 and the MKA sequence in lesson 6.</div>`;
  }
});
