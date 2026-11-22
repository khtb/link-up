Course.register({
  id: 'intro',
  title: 'Why time sync in a vehicle?',
  section: 'Foundations',
  minutes: 10,
  render: () => `
    <h1>Why a car needs one clock</h1>
    <p>A modern vehicle is a distributed computer. Cameras, radars and lidars sample the world in different ECUs,
    zone controllers forward their data over Ethernet, and a central computer fuses it. That only works if every
    sample carries a timestamp from the <b>same time base</b>. <b>gPTP</b> (generalized Precision Time Protocol,
    <b>IEEE 802.1AS</b>) provides that time base. It is a profile of IEEE 1588 PTP, tightened for Layer-2 networks
    with hardware timestamping on every hop.</p>

    <div id="anim-intro"></div>

    <h2>What the time is used for</h2>
    <div class="table-wrap"><table>
      <tr><th>Use case</th><th>What needs the common time</th><th>Typical accuracy target</th></tr>
      <tr><td><b>Sensor fusion (ADAS / AD)</b></td><td>Camera, radar, lidar and IMU samples are aligned on one timeline before fusion. An error of 1 ms at 36 m/s (130 km/h) is a 3.6 cm position error.</td><td>≤ 1 µs between sensors</td></tr>
      <tr><td><b>TSN scheduling (802.1Qbv)</b></td><td>Time-aware shapers open and close gates on every switch at the same instant. A gate schedule is only as good as the clocks driving it.</td><td>sub-µs</td></tr>
      <tr><td><b>Audio / video (AVB, IEEE 1722)</b></td><td>Presentation time in each stream packet; amplifiers and displays play out at the same instant and recover the media clock.</td><td>≈ 1 µs (lip-sync, multi-speaker phase)</td></tr>
      <tr><td><b>Control loops & actuators</b></td><td>Time-triggered sampling and actuation across ECUs (chassis, powertrain, brake-by-wire).</td><td>µs-class</td></tr>
      <tr><td><b>Logging, diagnostics, event data recorder</b></td><td>Correlating logs from many ECUs after an incident; synchronizing traces on a test bench.</td><td>µs to ms</td></tr>
      <tr><td><b>Security & V2X</b></td><td>Freshness values in SecOC, certificate validity, V2X message timestamps (with a GNSS-traceable source).</td><td>ms (but must be trusted)</td></tr>
    </table></div>

    <h2>Why gPTP and not NTP or plain PTP?</h2>
    <div class="grid3">
      <div class="card"><b>NTP</b><br><span class="muted">Software timestamps, IP/UDP, many queues in between. Gives ms, sometimes 100 µs. Fine for logs, useless for fusion or Qbv.</span></div>
      <div class="card"><b>IEEE 1588 PTP</b><br><span class="muted">Hardware timestamps, ns-capable. But it is a toolbox: UDP or L2, E2E or P2P, one- or two-step, optional transparent clocks. Every profile chooses differently.</span></div>
      <div class="card"><b>gPTP (802.1AS)</b><br><span class="muted">One fixed choice: Layer 2, peer-to-peer delay, every bridge is time-aware, rate ratio carried in Follow_Up. Plug-and-play inside a TSN/AVB network. The automotive profiles then make it static and fast.</span></div>
    </div>

    <div class="callout"><b>The performance promise</b>
      802.1AS states (informative Annex B) that any two time-aware systems separated by <b>six or fewer hops</b> are synchronized
      to within <b>1 µs</b> peak-to-peak during steady state, assuming clocks within ±100 ppm and timestamp granularity of 40 ns
      or better. Real automotive implementations with PHY or switch timestamping typically achieve tens of nanoseconds per hop.</div>

    <h2>What you will learn</h2>
    <ol class="objectives">
      <li>The gPTP building blocks and every message on the wire, byte by byte.</li>
      <li><b>Timestamping</b>: exactly <i>when</i> a timestamp is taken, <i>how</i> (software, MAC, PHY, one-step, two-step), and which <b>hardware capabilities</b> you need.</li>
      <li>Peer delay, rate ratio and the <b>correctionField</b> arithmetic.</li>
      <li>A detailed anatomy of <b>timestamping inside a switch</b>, and how <b>boundary clocks, transparent clocks and gPTP relays</b> differ.</li>
      <li>The <b>automotive focus</b>: the AVnu Automotive Profile, the protocol differences between <b>802.1AS-2011 and 802.1AS-2020</b>, AUTOSAR time sync, IEEE 802.1DG and 10BASE-T1S.</li>
      <li>Hands-on Linux with <code>ptp4l</code>, <code>phc2sys</code>, <code>pmc</code> and <code>ethtool</code>.</li>
    </ol>
  `,
  mount: (root) => {
    const node = (id, x, y, w, label, sub, cls = '') => `
      <g id="${id}" class="${cls}">
        <rect class="node" x="${x - w / 2}" y="${y - 22}" width="${w}" height="44" rx="8"/>
        <text x="${x}" y="${y - 3}" text-anchor="middle" font-size="13" font-weight="700">${label}</text>
        <text x="${x}" y="${y + 13}" text-anchor="middle" font-size="10" class="t-muted">${sub}</text>
      </g>`;
    const clock = (id, x, y, t) => `<g id="${id}" class="f"><rect x="${x - 70}" y="${y}" width="140" height="20" rx="10" fill="var(--panel-2)" stroke="var(--border-2)"/><text id="${id}-t" x="${x}" y="${y + 14}" text-anchor="middle" font-size="11" class="mono">${t}</text></g>`;
    const pkt = (id, x, y, c) => `<g id="${id}" class="mv f"><rect x="${x - 18}" y="${y - 9}" width="36" height="18" rx="4" fill="${c}"/><text x="${x}" y="${y + 4}" text-anchor="middle" font-size="9" style="fill:#fff" font-weight="700">Sync</text></g>`;
    Course.stepper(root.querySelector('#anim-intro'), {
      title: 'Time flows from one grandmaster through a zonal network',
      svg: `
      <svg viewBox="0 0 900 350" role="img" aria-label="Zonal vehicle network with gPTP">
        <path class="wire" d="M450,62 L220,148"/><path class="wire" d="M450,62 L680,148"/>
        <path class="wire" d="M220,170 L100,258"/><path class="wire" d="M220,170 L330,258"/>
        <path class="wire" d="M680,170 L570,258"/><path class="wire" d="M680,170 L800,258"/>
        ${node('gm', 450, 40, 190, 'Central compute (HPC)', 'grandmaster · GNSS or free-running')}
        ${node('zl', 220, 160, 150, 'Zone switch L', 'time-aware bridge')}
        ${node('zr', 680, 160, 150, 'Zone switch R', 'time-aware bridge')}
        ${node('cam', 100, 270, 120, 'Front camera', 'end station')}
        ${node('rad', 330, 270, 120, 'Corner radar', 'end station')}
        ${node('lid', 570, 270, 120, 'Lidar', 'end station')}
        ${node('amp', 800, 270, 120, 'Amplifier', 'AVB listener')}
        ${clock('c-gm', 632, 30, '12:00:00.000 000 000')}
        ${clock('c-zl', 85, 150, '?')}${clock('c-zr', 815, 150, '?')}
        ${clock('c-cam', 100, 300, '?')}${clock('c-rad', 330, 300, '?')}${clock('c-lid', 570, 300, '?')}${clock('c-amp', 800, 300, '?')}
        ${pkt('p1', 450, 70, 'var(--c-sync)')}${pkt('p2', 450, 70, 'var(--c-sync)')}
        ${pkt('p3', 220, 180, 'var(--c-sync)')}${pkt('p4', 220, 180, 'var(--c-sync)')}
        ${pkt('p5', 680, 180, 'var(--c-sync)')}${pkt('p6', 680, 180, 'var(--c-sync)')}
        <g id="ts-note" class="f"><text x="450" y="118" text-anchor="middle" font-size="11" style="fill:var(--c-ts)" font-weight="700">each hop: HW timestamp in · residence time · HW timestamp out</text></g>
        <g id="warn" class="f"><text x="450" y="344" text-anchor="middle" font-size="12" font-weight="700" style="fill:var(--accent-2)">all clocks within ≈ 100 ns of the grandmaster</text></g>
      </svg>`,
      steps: [
        { caption: 'A zonal architecture: a central computer, zone switches and sensors/actuators. Each ECU has its own crystal, so left alone every clock drifts at up to ±100 ppm, i.e. up to 100 µs per second.',
          do: s => { s.show(['c-zl', 'c-zr', 'c-cam', 'c-rad', 'c-lid', 'c-amp']); } },
        { caption: 'One device is the <b>grandmaster (GM)</b>. In a car it is chosen at design time, usually the central computer. It may follow GNSS or simply run free; what matters is that everyone follows it.',
          do: s => { s.hl('gm'); s.show('c-gm'); } },
        { caption: 'The GM sends <b>Sync</b> messages (8 per second by default) on each of its <b>master ports</b>. gPTP frames are link-local: they travel exactly one hop.',
          do: s => { s.show(['p1', 'p2']); s.move('p1', -200, 72); s.move('p2', 200, 72); } },
        { caption: 'Each zone switch is a <b>time-aware bridge</b>. It timestamps the Sync in hardware at its slave port, adds the time the message spent inside it and the delay of the cable it came over, then sends a new Sync on every master port.',
          do: s => { s.show(['ts-note', 'p3', 'p4', 'p5', 'p6']); s.dim(['p1', 'p2']); s.move('p3', -110, 68); s.move('p4', 100, 68); s.move('p5', -100, 68); s.move('p6', 110, 68); s.text('c-zl-t', 'locked'); s.text('c-zr-t', 'locked'); } },
        { caption: 'End stations do the same calculation, then steer their local clock to the GM. Every sample, log line and TSN gate now refers to one shared time.',
          do: s => { ['c-zl-t', 'c-zr-t', 'c-cam-t', 'c-rad-t', 'c-lid-t', 'c-amp-t'].forEach(id => s.text(id, '12:00:00.000 000 0xx')); s.show('warn'); s.dim(['p3', 'p4', 'p5', 'p6']); } },
      ]
    });
  }
});
