Course.register({
  id: 'quiz',
  title: 'Final quiz',
  section: 'Practice',
  minutes: 15,
  render: () => `
    <h1>Final quiz</h1>
    <p>20 questions covering the whole course, including automotive and 10BASE-T1S. You pass with 80% or more. Each answer comes with an explanation.</p>
    <div id="quiz"></div>
    <button class="btn" id="quiz-retry">↻ Retry quiz</button>
  `,
  mount: (root) => {
    const Q = [
      { q: 'Which key actually encrypts MACsec data frames?', opts: ['CAK', 'ICK', 'KEK', 'SAK'], a: 3,
        why: 'The SAK (Secure Association Key) is the GCM-AES key in the SecY. The CAK only derives the ICK and KEK.' },
      { q: 'What is the EtherType of a MACsec frame (SecTAG)?', opts: ['0x888E', '0x88E5', '0x8100', '0x88CC'], a: 1,
        why: '0x88E5 = MACsec. 0x888E is EAPoL (used by MKA), 0x8100 is 802.1Q and 0x88CC is LLDP.' },
      { q: 'How is the 96-bit GCM IV built for GCM-AES-128 (non-XPN)?', opts: ['Random per frame', 'SCI ‖ PN', 'SAK ‖ PN', 'MI ‖ MN'], a: 1,
        why: 'IV = 64-bit SCI followed by the 32-bit PN. The SCI makes IVs unique across transmitters and the PN makes them unique across frames.' },
      { q: 'Two switches have key-server priorities 10 and 20. Which becomes key server?', opts: ['Priority 20 (higher)', 'Priority 10 (lower)', 'The one with the lower MAC, whatever the priority', 'Both, one per direction'], a: 1,
        why: 'The lowest numerical priority wins. The SCI is only used to break a tie.' },
      { q: 'Both ends are set to key-server priority 255. What happens?', opts: ['The lower SCI wins', 'Both become key server', 'No key server, so no SAK is distributed and the link never secures', 'MKA falls back to a static SAK'], a: 2,
        why: '255 means "not capable of being key server". With nobody eligible, no SAK is distributed.' },
      { q: 'The CKNs match but the CAKs are different. What do you observe?', opts: ['Session comes up with integrity only', 'MKPDUs fail ICV verification, so the peer never becomes live', 'Data frames fail the ICV but MKA is fine', 'Nothing. The CAK is only used for rekeys'], a: 1,
        why: 'A different CAK gives a different ICK, so every MKPDU fails its AES-CMAC ICV and is discarded.' },
      { q: 'How is the SAK protected while it is distributed?', opts: ['Sent in clear inside the signed MKPDU', 'AES Key Wrap with the KEK', 'GCM-AES with the CAK', 'RSA with the peer\'s certificate'], a: 1,
        why: 'The key server wraps the SAK with AES Key Wrap (RFC 3394) under the KEK, and the MKPDU is also signed with the ICK.' },
      { q: 'Why is a new SAK installed for Rx before Tx?', opts: ['To save memory', 'So that no frame is sent with a key a peer cannot decrypt (hitless rekey)', 'Because the AN field only allows one key', 'It is not; Tx is installed first'], a: 1,
        why: 'Transmitters switch only after every live peer reports Rx on the new key, so no frames are lost.' },
      { q: 'What is the maximum MACsec overhead per frame?', opts: ['8 bytes', '16 bytes', '32 bytes', '64 bytes'], a: 2,
        why: 'A SecTAG with SCI is 16 bytes and the ICV is 16 bytes, 32 in total (24 without the SCI).' },
      { q: 'Default MKA hello and life times are…', opts: ['1 s / 3 s', '2 s / 6 s', '5 s / 15 s', '30 s / 90 s'], a: 1,
        why: 'MKA Hello Time = 2 s, MKA Life Time = 6 s (802.1X-2010).' },
      { q: 'Why are XPN cipher suites recommended for 100G links?', opts: ['They use stronger AES', 'A 32-bit PN runs out in well under a minute at 100G line rate', 'They remove the ICV', 'They allow more than 4 ANs'], a: 1,
        why: '2³² frames at about 148 Mpps (64-byte frames) is around 29 s. XPN\'s 64-bit PN effectively never runs out.' },
      { q: 'With a replay window of 4, the next expected PN is 100. Which received PN is dropped as late?', opts: ['PN 97', 'PN 96', 'PN 95', 'PN 101'], a: 2,
        why: 'Lowest acceptable PN = 100 − 4 = 96. PN 95 is below that, so it is dropped (InPktsLate).' },
      { q: 'What does MACsec NOT protect against?', opts: ['A fiber tap reading traffic', 'Frame injection on the link', 'A compromised switch reading traffic it forwards', 'Replay of captured frames'], a: 2,
        why: 'MACsec works hop by hop: frames are in clear text inside every device. Use IPsec/TLS for end-to-end protection.' },
      { q: 'Which part of an MKPDU proves that a peer has received <i>your</i> recent messages?', opts: ['Your MI and latest MN appear in its Live/Potential Peer List', 'Its Key Server flag', 'The Algorithm Agility field', 'The EAPOL version'], a: 0,
        why: 'Peers echo back (MI, MN). Seeing your own fresh MN proves the path works both ways and the message is not a replay.' },
      { q: 'What does version 1.0 of the OPEN Alliance Automotive MACsec Specification cover?', opts: ['Only data-center links', 'Switched automotive Ethernet, including 10BASE-T1S point-to-point. Shared-medium T1S is left to a future revision.', '10BASE-T1S multidrop only', 'End-to-end MACsec across switches'], a: 1,
        why: 'v1.0 (May 2025) targets switched automotive Ethernet and explicitly leaves 10BASE-T1S shared-medium mode to a later revision.' },
      { q: 'Why does the automotive profile require support for a SecTAG without the SCI?', opts: ['The SCI is insecure', 'It saves 8 bytes per frame on point-to-point links, where the receiver already knows the sender', 'XPN forbids the SCI', 'Because ECUs have no MAC address'], a: 1,
        why: 'AutoMACsec-01004: omitting the SCI reduces overhead from 32 to 24 bytes. On a point-to-point link the single Rx SC tells the receiver who sent the frame.' },
      { q: 'A typical automotive target for securing a link with MKA is…', opts: ['about 8 s, the default', 'under 30 ms from link-up', 'under 1 µs', 'whenever the first rekey happens'], a: 1,
        why: 'Cars must be ready to drive in about 1.5–2 s and restart often. Default MKA can take up to ~8 s. Tuned MKA with fixed roles reaches under 10 ms on two stations.' },
      { q: 'On a 10BASE-T1S bus using PLCA, which node sends the BEACON?', opts: ['The node with the highest PLCA ID', 'The MKA key server, always', 'The coordinator, PLCA node ID 0', 'Every node in turn'], a: 2,
        why: 'Node ID 0 is the PLCA coordinator. Its BEACON starts each cycle, and the transmit opportunities then go round in ID order.' },
      { q: 'Four ECUs share one CA and one group SAK on a T1S bus. What does a valid ICV prove?', opts: ['That the frame came from the SCI in its SecTAG', 'That the frame was sent by some member that holds the group SAK', 'That the head node approved the frame', 'Nothing, because group SAKs disable the ICV'], a: 1,
        why: 'Every member holds the same SAK and could forge another member\'s SCI. Per-sender authenticity needs pairwise CAs (configuration 2).' },
      { q: 'Why is startup on a shared-medium bus slower with standard MKA?', opts: ['PLCA blocks EAPoL', 'MKA distributes a new SAK on every member join, and staggered joins chain several rekeys', 'MKA only supports 2 members', 'T1S cannot carry MKPDUs'], a: 1,
        why: '802.1X-2020 9.8 calls for a new SAK when a member joins. With stations booting at slightly different times, each join adds another rekey round.' },
    ];
    const run = () => Course.quiz(root.querySelector('#quiz'), Q, (r, n) => { if (r / n >= 0.8) Course.markDone('quiz'); });
    run();
    root.querySelector('#quiz-retry').addEventListener('click', () => {
      const old = root.querySelector('#quiz');
      const fresh = old.cloneNode(false); old.replaceWith(fresh); run(); fresh.scrollIntoView({ behavior: 'smooth' });
    });
  }
});
