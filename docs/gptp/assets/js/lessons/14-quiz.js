Course.register({
  id: 'quiz',
  title: 'Final quiz',
  section: 'Practice',
  minutes: 15,
  render: () => `
    <h1>Final quiz</h1>
    <p>22 questions covering the whole course, with an emphasis on timestamping, bridges and the automotive profiles. You pass with 80% or more.</p>
    <div id="quiz"></div>
    <button class="btn" id="quiz-retry">↻ Retry quiz</button>
  `,
  mount: (root) => {
    const Q = [
      { q: 'Which destination MAC address and EtherType does gPTP use?', opts: ['01-1B-19-00-00-00 / 0x88F7', '01-80-C2-00-00-0E / 0x88F7', '01-80-C2-00-00-03 / 0x888E', 'FF-FF-FF-FF-FF-FF / 0x0800'], a: 1,
        why: '01-80-C2-00-00-0E is the link-local "nearest bridge" address that bridges never forward; 0x88F7 is PTP.' },
      { q: 'Which gPTP messages are timestamped by hardware?', opts: ['All of them', 'Sync, Pdelay_Req, Pdelay_Resp', 'Follow_Up and Pdelay_Resp_Follow_Up', 'Announce and Signaling'], a: 1,
        why: 'Event messages (messageType 0–3) are timestamped. General messages carry timestamps taken earlier.' },
      { q: 'The message timestamp point is…', opts: ['the last bit of the FCS', 'the first bit of the preamble', 'the first bit after the Start Frame Delimiter, at the reference plane (MDI)', 'when the driver hands the frame to DMA'], a: 2,
        why: 'The SFD is the first repeatable event in a frame; implementations correct their actual capture point to the MDI with ingress/egress latencies.' },
      { q: 'Why does two-step mode need a Follow_Up?', opts: ['Sync is too short to hold a timestamp', 'The exact TX time is only known after the frame started leaving, so it is sent in a second message', 'Follow_Up carries the link delay', 'To make the BMCA work'], a: 1,
        why: 'Without on-the-fly insertion hardware, the egress timestamp exists only after transmission.' },
      { q: 'What does a one-step Pdelay responder do?', opts: ['Sends no Pdelay_Resp', 'Puts t3 − t2 (turnaround) into the Pdelay_Resp correctionField and sends no Resp_Follow_Up', 'Sends Pdelay_Resp twice', 'Measures the delay itself'], a: 1,
        why: 'HWTSTAMP_TX_ONESTEP_P2P: the turnaround is inserted on the fly.' },
      { q: 'meanLinkDelay is computed as…', opts: ['(t4 − t1) / 2', '((t4 − t1) − (t3 − t2)) / 2 · nrr', '(nrr · (t4 − t1) − (t3 − t2)) / 2', '(t2 − t1) + (t4 − t3)'], a: 2,
        why: 't4 − t1 is in initiator time and is converted with neighborRateRatio before subtracting the responder\'s turnaround.' },
      { q: 'Ignoring neighborRateRatio with a 10 ms turnaround and 100 ppm frequency difference gives a link delay error of about…', opts: ['5 ns', '50 ns', '500 ns', '5 µs'], a: 2,
        why: 'turnaround × Δf / 2 = 10 ms × 100e-6 / 2 = 500 ns.' },
      { q: 'A Sync waits 80 µs in a bridge egress queue behind a jumbo frame. Effect on accuracy?', opts: ['80 µs error', '40 µs error', 'None, as long as it is timestamped at ingress and egress with the same clock', 'The Sync is dropped'], a: 2,
        why: 'Residence time is measured, not estimated. Only timestamp quality and rate-ratio errors matter.' },
      { q: 'A time-aware relay adds what to the correctionField?', opts: ['Residence time only', 'Upstream link delay only', 'rateRatio × (residence time + upstream link delay)', 'Nothing; it writes a new origin timestamp'], a: 2,
        why: 'correction_out = correction_in + rateRatio × (egress − upstreamTxTime).' },
      { q: 'How does a boundary clock differ from a gPTP relay?', opts: ['A BC disciplines its own clock with a servo and sends Sync from that clock', 'A BC forwards Sync unchanged', 'A BC does not use Pdelay', 'There is no difference'], a: 0,
        why: 'A BC terminates PTP and re-originates time from its own servoed clock. A relay accumulates corrections with rateRatio and needs no servo.' },
      { q: 'Why is cumulativeScaledRateOffset carried in the Follow_Up?', opts: ['To encrypt the time', 'So each system can convert its local time intervals (residence, link delay) to GM time', 'To elect the GM', 'For leap seconds'], a: 1,
        why: 'Without it, a 2 ms residence at 50 ppm would add 100 ns of error per hop.' },
      { q: 'What happens when a plain 802.1Q switch without gPTP sits between two gPTP devices?', opts: ['It acts as a transparent clock', 'It drops the link-local gPTP frames, so asCapable stays false', 'It improves accuracy', 'Nothing; gPTP is routed'], a: 1,
        why: 'Bridges must not forward 01-80-C2-00-00-0E, so no Pdelay responses arrive.' },
      { q: 'Which BMCA field is compared first?', opts: ['clockIdentity', 'priority1', 'clockClass', 'stepsRemoved'], a: 1,
        why: 'priority1, then clockClass, clockAccuracy, offsetScaledLogVariance, priority2, clockIdentity; stepsRemoved only between paths to the same GM.' },
      { q: 'In the AVnu Automotive Profile, how is the GM chosen?', opts: ['BMCA with priority1 = 246', 'Statically, at design time; no BMCA and no Announce', 'The first ECU to boot', 'Round-robin'], a: 1,
        why: 'Static GM and port roles remove the announce/BMCA delay from startup.' },
      { q: 'Why does the Automotive Profile use a stored neighborPropDelay?', opts: ['Pdelay is forbidden', 'So Sync can be used immediately after link-up without waiting for Pdelay exchanges', 'To save memory', 'Because cables change length'], a: 1,
        why: 'Cable lengths in a car are fixed, so the last measured value is a good starting point.' },
      { q: 'How does an automotive slave slow the Sync rate after it is locked?', opts: ['It stops answering Pdelay', 'Signaling with a Message Interval Request TLV', 'An Announce message', 'It cannot; the rate is fixed'], a: 1,
        why: 'linuxptp: msg_interval_request 1 + operLogSyncInterval; the request is sent when the servo reaches s3 (locked stable).' },
      { q: 'Which ptp4l client option is needed when the server inhibits Announce?', opts: ['free_running 1', 'ignore_source_id 1', 'hwts_filter full', 'clock_type P2P_TC'], a: 1,
        why: 'Without Announce, the client cannot know the server identity, so source-identity checks of Sync/Follow_Up must be disabled.' },
      { q: 'What does header byte 1 look like in 802.1AS-2011 vs 2020?', opts: ['0x02 vs 0x12', '0x12 vs 0x02', '0x20 vs 0x21', 'identical'], a: 0,
        why: '2020 sets minorVersionPTP = 1 in the high nibble (1588-2019); 2011 left it reserved (0).' },
      { q: 'What is CMLDS?', opts: ['A security TLV', 'A 2020 service that measures each link once (majorSdoId 2) and shares the delay with all domains', 'The 2011 Pdelay', 'A CAN time sync protocol'], a: 1,
        why: 'Common Mean Link Delay Service, from 1588-2019 clause 16.6 and used by 802.1AS-2020.' },
      { q: 'Which 802.1AS-2020 feature standardises the automotive "no BMCA" approach?', opts: ['syncLocked', 'External port configuration (externalPortConfigurationEnabled, desiredState)', 'allowedFaults', 'ARB timescale'], a: 1,
        why: 'Port states come from management instead of the BMCA.' },
      { q: 'A 2020 device talks to a 2011 neighbour. Which is correct?', opts: ['It must use CMLDS', 'It runs domain 0 with instance-specific Pdelay (majorSdoId 1)', 'It must send one-step Sync', 'They cannot interoperate'], a: 1,
        why: 'Domain 0 with instance-specific Pdelay is the compatibility mode; one-step and CMLDS are only used when the neighbour supports them.' },
      { q: 'Why is 10BASE-T1S multidrop a problem for 802.1AS-2020?', opts: ['10 Mb/s is too slow for PTP', '802.1AS assumes full-duplex point-to-point links with exactly one neighbour per port', 'T1S has no SFD', 'PLCA forbids multicast'], a: 1,
        why: 'Half-duplex shared media are addressed by the P802.1ASds amendment project.' },
    ];
    const run = () => Course.quiz(root.querySelector('#quiz'), Q, (r, n) => { if (r / n >= 0.8) Course.markDone('quiz'); });
    run();
    root.querySelector('#quiz-retry').addEventListener('click', () => {
      const old = root.querySelector('#quiz');
      const fresh = old.cloneNode(false); old.replaceWith(fresh); run(); fresh.scrollIntoView({ behavior: 'smooth' });
    });
  }
});
