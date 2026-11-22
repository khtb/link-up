Course.register({
  id: 'intro',
  title: 'Why MACsec?',
  section: 'Foundations',
  minutes: 10,
  render: () => `
    <h1>Why MACsec?</h1>
    <p><b>MACsec</b> (IEEE 802.1AE) protects Ethernet frames <i>on the wire</i>, one link at a time. It encrypts and
    authenticates every frame between two directly connected devices, at line rate, in hardware. Its partner protocol,
    <b>MKA</b> (MACsec Key Agreement, defined in IEEE 802.1X), finds the peers, agrees on keys and changes them over time.</p>

    <div class="card">
      <b>By the end of this course you will be able to:</b>
      <ul class="objectives">
        <li>Name the MACsec building blocks (SecY, CA, SC, SA, SCI, AN, PN) and explain how they fit together</li>
        <li>Take a MACsec frame apart byte by byte: SecTAG, secure data and ICV</li>
        <li>Explain how GCM-AES encrypts a frame and why the PN must never repeat</li>
        <li>Follow the key hierarchy: CAK/CKN → ICK and KEK → SAK</li>
        <li>Trace an MKA session from the first hello through key-server election, SAK distribution and rekey</li>
        <li>Explain the OPEN Alliance automotive MACsec profile and why startup time drives automotive MKA</li>
        <li>Describe 10BASE-T1S multidrop with PLCA, and what makes MACsec on a shared medium hard</li>
        <li>Build, run and troubleshoot MACsec and MKA on Linux with iproute2 and wpa_supplicant</li>
      </ul>
    </div>

    <h2>The problem: Ethernet trusts the wire</h2>
    <p>Plain Ethernet has no confidentiality and no integrity. In a car, the wiring harness runs through doors, bumpers,
    mirrors and the trunk, and anyone with a few minutes and a connector can reach it. Someone who clips onto an
    automotive Ethernet link, or swaps a sensor for a rogue device, can <b>read</b>, <b>inject</b>, <b>change</b> or
    <b>replay</b> frames, and the ECUs won't know.</p>

    <div id="anim-hop"></div>

    <h2>Where MACsec sits</h2>
    <div class="table-wrap"><table>
      <tr><th></th><th>MACsec (802.1AE)</th><th>IPsec</th><th>TLS</th></tr>
      <tr><td>Layer</td><td>L2: Ethernet frame</td><td>L3: IP packet</td><td>L4/7: a TCP/QUIC session</td></tr>
      <tr><td>Scope</td><td>Hop by hop (one link / one L2 segment)</td><td>End to end, or gateway to gateway</td><td>Application end to end</td></tr>
      <tr><td>What it protects</td><td>Everything above the MAC header: ARP, LLDP, IPv4/6, MPLS…</td><td>IP traffic only</td><td>One application's stream</td></tr>
      <tr><td>Performance</td><td>Line rate in the PHY/MAC ASIC (up to 400G+)</td><td>Usually needs crypto acceleration</td><td>CPU or NIC offload</td></tr>
      <tr><td>Key management</td><td>MKA (802.1X-2010/2020)</td><td>IKEv2</td><td>TLS handshake</td></tr>
    </table></div>

    <div class="callout tip"><b>Two standards, two jobs</b>
      <b>802.1AE</b> is the <i>data plane</i>: how one frame is protected with a key (the SAK).<br>
      <b>802.1X / MKA</b> is the <i>control plane</i>: who the peers are, which key to use, and when to change it.
      Most of this course is about how the two work together.</div>

    <h2>Automotive use cases</h2>
    <p>Cars are turning into Ethernet networks. Zonal architectures replace hundreds of point-to-point wires with a few
    zone controllers linked by an Ethernet backbone. Many OEMs are adopting MACsec to protect those links, often with the
    MACsec engine built into the PHY or switch so it adds almost no CPU load or latency.</p>
    <div class="grid3">
      <div class="card"><b>🧭 Zonal backbone</b><br><span class="muted">Zone controller ⇄ central compute over 1000BASE-T1 or multi-gig (2.5/5/10GBASE-T1). It carries most of the car's traffic.</span></div>
      <div class="card"><b>📷 ADAS sensors</b><br><span class="muted">Cameras, radar and lidar feeding the ADAS computer. Integrity matters most here: a spoofed object list is a safety problem.</span></div>
      <div class="card"><b>🔌 ECU ⇄ switch links</b><br><span class="muted">100BASE-T1 links from body, chassis and powertrain ECUs to the zonal switch.</span></div>
      <div class="card"><b>💡 10BASE-T1S edge</b><br><span class="muted">Low-cost multidrop buses for lights, seats, actuators and small sensors, connected to a head node. MACsec on a shared medium is still being defined (lesson 9).</span></div>
      <div class="card"><b>📡 Telematics / gateway</b><br><span class="muted">The links behind the cellular modem and the central gateway, where an attack from outside the car would arrive first.</span></div>
      <div class="card"><b>🧪 Test benches &amp; Linux ECUs</b><br><span class="muted">Linux-based HPCs, infotainment and HIL benches use the kernel's <code>macsec</code> driver and wpa_supplicant (lesson 10).</span></div>
    </div>

    <div class="callout"><b>Why automotive is different</b>
      Startup time is critical. A car must be ready to drive about 1.5–2 s after it is unlocked, and ECUs restart often:
      after sleep, after wake-up, and after the voltage dip of engine cranking. Keys are installed in fully automated
      production lines, and there is no RADIUS server in a car. Lesson 8 covers how the OPEN Alliance automotive
      MACsec profile deals with this.
      <div class="src">Source: L. Völker, <i>Automotive Requirements for MKA</i>, IEEE 802.1 contribution, March 2025.</div></div>

    <div class="callout warn"><b>What MACsec does <i>not</i> do</b>
      Each device decrypts frames on the way in and re-encrypts them on the way out, so traffic is in clear text
      <i>inside</i> every switch. MACsec protects links. It does not protect a device that has been compromised, and it
      is not an end-to-end tunnel like IPsec or TLS.</div>
  `,
  mount: (root) => {
    const W = 'var(--wire)';
    Course.stepper(root.querySelector('#anim-hop'), {
      title: 'From a plain in-vehicle link to hop-by-hop MACsec',
      svg: `
      <svg viewBox="0 0 900 300" role="img" aria-label="Hop by hop MACsec animation">
        <defs>
          <marker id="i-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="var(--bad)"/></marker>
        </defs>
        <!-- wires -->
        <line class="wire" x1="100" y1="150" x2="290" y2="150"/>
        <line class="wire" x1="370" y1="150" x2="550" y2="150"/>
        <line class="wire" x1="630" y1="150" x2="800" y2="150"/>
        <!-- secured wires -->
        <g id="sec-wires" class="f">
          <line x1="100" y1="150" x2="290" y2="150" stroke="var(--accent-2)" stroke-width="6" stroke-dasharray="10 6"/>
          <line x1="370" y1="150" x2="550" y2="150" stroke="var(--accent-2)" stroke-width="6" stroke-dasharray="10 6"/>
          <line x1="630" y1="150" x2="800" y2="150" stroke="var(--accent-2)" stroke-width="6" stroke-dasharray="10 6"/>
          <text x="195" y="185" text-anchor="middle" font-size="13" fill="var(--k-sak)" style="fill:var(--k-sak)">🔒 SAK-1</text>
          <text x="460" y="185" text-anchor="middle" font-size="13" style="fill:var(--k-sak)">🔒 SAK-2</text>
          <text x="715" y="185" text-anchor="middle" font-size="13" style="fill:var(--k-sak)">🔒 SAK-3</text>
        </g>
        <!-- nodes -->
        <g><rect class="node" x="20" y="115" width="80" height="70" rx="10"/><text x="60" y="146" text-anchor="middle" font-size="22">📷</text><text x="60" y="172" text-anchor="middle" font-size="12">ADAS camera</text></g>
        <g><rect class="node" x="290" y="115" width="80" height="70" rx="10"/><text x="330" y="146" text-anchor="middle" font-size="22">🔀</text><text x="330" y="172" text-anchor="middle" font-size="12">Zone switch</text></g>
        <g><rect class="node" x="550" y="115" width="80" height="70" rx="10"/><text x="590" y="146" text-anchor="middle" font-size="22">🔀</text><text x="590" y="172" text-anchor="middle" font-size="12">Central switch</text></g>
        <g><rect class="node" x="800" y="115" width="80" height="70" rx="10"/><text x="840" y="146" text-anchor="middle" font-size="22">🧠</text><text x="840" y="172" text-anchor="middle" font-size="12">ADAS HPC</text></g>

        <!-- inside-device clear text badges -->
        <g id="clear-in" class="f">
          <rect x="285" y="70" width="90" height="30" rx="6" fill="var(--plain)"/><text x="330" y="90" text-anchor="middle" font-size="11" style="fill:#fff">decrypt→re-encrypt</text>
          <rect x="545" y="70" width="90" height="30" rx="6" fill="var(--plain)"/><text x="590" y="90" text-anchor="middle" font-size="11" style="fill:#fff">decrypt→re-encrypt</text>
        </g>

        <!-- attacker -->
        <g id="atk" class="f">
          <line x1="460" y1="150" x2="460" y2="225" stroke="var(--bad)" stroke-width="2" stroke-dasharray="4 4"/>
          <circle cx="460" cy="150" r="6" fill="var(--bad)"/>
          <rect x="400" y="225" width="120" height="44" rx="10" fill="none" stroke="var(--bad)" stroke-width="2"/>
          <text x="460" y="245" text-anchor="middle" font-size="18">🕵️</text>
          <text x="460" y="262" text-anchor="middle" font-size="11" style="fill:var(--bad)">harness tap</text>
        </g>
        <g id="sniff-plain" class="f">
          <rect x="540" y="228" width="240" height="40" rx="8" fill="var(--bad)" opacity=".12"/>
          <text x="550" y="246" font-size="12" class="mono" style="fill:var(--bad)">reads: object list, speed, VIN</text>
          <text x="550" y="262" font-size="12" class="mono" style="fill:var(--bad)">SOME/IP, gPTP, VLAN tags visible</text>
        </g>
        <g id="inject" class="f">
          <path d="M400,240 C330,240 330,165 360,155" fill="none" stroke="var(--bad)" stroke-width="2" marker-end="url(#i-arr)"/>
          <text x="250" y="250" font-size="12" style="fill:var(--bad)">injects / modifies /</text>
          <text x="250" y="266" font-size="12" style="fill:var(--bad)">replays frames</text>
        </g>
        <g id="sniff-enc" class="f">
          <rect x="540" y="228" width="240" height="40" rx="8" fill="var(--accent-2)" opacity=".12"/>
          <text x="550" y="246" font-size="12" class="mono" style="fill:var(--accent-2)">reads: 9f3a 71c0 e2d8 0b5c …</text>
          <text x="550" y="262" font-size="12" class="mono" style="fill:var(--accent-2)">injected frames fail the ICV → dropped</text>
        </g>

        <!-- packet -->
        <g id="pkt" class="mv">
          <g id="pkt-plain" class="f on"><rect x="40" y="128" width="44" height="24" rx="4" fill="var(--plain)"/><text x="62" y="144" text-anchor="middle" font-size="10" style="fill:#fff">DATA</text></g>
          <g id="pkt-enc" class="f"><rect x="40" y="128" width="44" height="24" rx="4" fill="var(--cipher)"/><text x="62" y="144" text-anchor="middle" font-size="12" style="fill:#fff">🔒</text></g>
        </g>
      </svg>`,
      steps: [
        { caption: 'An ADAS camera sends video and object data through two switches to the ADAS computer, over ordinary automotive Ethernet (e.g. 1000BASE-T1). Frames travel in <b>clear text</b>.',
          do: s => s.show('pkt-plain') },
        { caption: 'An attacker clips onto the harness between the zone switch and the central switch. Every frame that passes is readable: SOME/IP messages, gPTP time sync, VLAN tags.',
          do: s => { s.show(['atk', 'pkt-plain']); s.move('pkt', 400, 0); s.show('sniff-plain'); } },
        { caption: 'The attacker can also <b>inject</b>, <b>modify</b> or <b>replay</b> frames, for example a fake "pedestrian ahead" object or an old frame. With no integrity check, the receiver accepts them.',
          do: s => s.show('inject') },
        { caption: 'Now we enable <b>MACsec on every link</b>. MKA runs separately on each link and gives each one its own key (SAK). The keys are never the same across links.',
          do: s => { s.hide(['sniff-plain', 'inject']); s.move('pkt', 0, 0); s.show('sec-wires'); } },
        { caption: 'The camera (or its PHY) protects the frame with <b>SAK-1</b>. On the wire the tap sees only ciphertext, and any frame it injects fails the 16-byte <b>ICV</b> check and is dropped.',
          do: s => { s.hide('pkt-plain'); s.show('pkt-enc'); s.move('pkt', 400, 0); s.show('sniff-enc'); } },
        { caption: '<b>Hop by hop:</b> each switch decrypts the frame as it comes in (to switch, apply ACLs and QoS), then encrypts it again with the next link\'s SAK on the way out.',
          do: s => { s.show('clear-in'); s.move('pkt', 760, 0); } },
        { caption: '<b>Summary:</b> MACsec gives each link confidentiality, integrity, data-origin authentication and replay protection, for every protocol above Ethernet, at line rate.',
          do: s => { s.hl('sec-wires'); } },
      ]
    });
  }
});
