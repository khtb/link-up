Course.register({
  id: 'linux',
  title: 'Linux lab & troubleshooting',
  section: 'Practice',
  minutes: 30,
  render: () => `
    <h1>gPTP on Linux: lab and troubleshooting</h1>
    <p>Linux has the complete toolchain: the kernel PTP subsystem (PHCs as <code>/dev/ptpN</code>, <code>SO_TIMESTAMPING</code>),
    and <b>linuxptp</b> in user space. The same tools run on automotive HPCs, on HIL benches and on a laptop, and the labs in
    <code>labs/</code> run on one PC with network namespaces and software timestamping.</p>

    <div class="table-wrap"><table>
      <tr><th>Tool</th><th>Role</th></tr>
      <tr><td><code>ptp4l</code></td><td>The PTP/gPTP stack: GM, bridge (multiple <code>-i</code>), end station, TC. Disciplines the PHC.</td></tr>
      <tr><td><code>phc2sys</code></td><td>Copies time between clocks: PHC → CLOCK_REALTIME, or between PHCs on one system.</td></tr>
      <tr><td><code>pmc</code></td><td>Management client: query ptp4l over its UNIX socket (port states, offsets, GM identity).</td></tr>
      <tr><td><code>ts2phc</code></td><td>Disciplines a PHC from a PPS input (GNSS receiver, or another PHC's periodic output).</td></tr>
      <tr><td><code>phc_ctl</code>, <code>testptp</code></td><td>Read, set, step and adjust a PHC by hand; configure pins (PPS, perout, extts).</td></tr>
      <tr><td><code>ethtool -T</code></td><td>Timestamping capabilities and PHC index of an interface (lesson 5).</td></tr>
      <tr><td><code>tcpdump</code> / Wireshark</td><td><code>tcpdump -i eth0 -e ether proto 0x88f7</code>; Wireshark display filter <code>ptp</code>.</td></tr>
    </table></div>

    <h2>Configuration recipes</h2>
    <div class="card" id="lx-tabs">
      <div class="tabs"><button>gPTP end station</button><button>Automotive</button><button>Bridge</button><button>System clock</button><button>Multi-domain / CMLDS</button><button>Inspect with pmc</button></div>
      <div class="tabpane">
<pre><code><span class="c"># 802.1AS profile shipped with linuxptp (BMCA on, Announce on)</span>
ethtool -T eth0                          <span class="c"># hardware-transmit/receive + a PHC index?</span>
ptp4l -f /usr/share/doc/linuxptp/configs/gPTP.cfg -i eth0 -m
<span class="c"># key options in gPTP.cfg: transportSpecific 0x1, ptp_dst_mac 01:80:C2:00:00:0E,</span>
<span class="c"># network_transport L2, delay_mechanism P2P, follow_up_info 1, neighborPropDelayThresh 800</span>
<span class="c"># no hardware timestamping? test with software timestamps:</span>
ptp4l -f gPTP.cfg -i eth0 -S -m</code></pre></div>
      <div class="tabpane">
<pre><code><span class="c"># static GM / client (lesson 10; or use the generator there)</span>
ptp4l -f configs/automotive-master.cfg -i eth0 -m      <span class="c"># on the GM</span>
ptp4l -f configs/automotive-slave.cfg  -i eth0 -m      <span class="c"># on each end station</span>
<span class="c"># watch the client switch to the operational intervals once locked (state s3):</span>
<span class="c">#   ptp4l: master offset  -4 s3 freq +1201 path delay 52</span>
<span class="c">#   ptp4l: port 1 (eth0): ... sending message interval request</span></code></pre></div>
      <div class="tabpane">
<pre><code><span class="c"># A Linux time-aware bridge: all ports must share ONE PHC (ethtool -T shows the same index)</span>
ptp4l -f gPTP.cfg -i swp1 -i swp2 -i swp3 -m
<span class="c"># ports with different PHCs (e.g. two NICs): JBOD mode + phc2sys to keep the PHCs aligned</span>
ptp4l -f gPTP.cfg --boundary_clock_jbod=1 -i eth0 -i eth1 -m
phc2sys -a -r -m
<span class="c"># 1588 transparent clock instead of a gPTP relay:</span>
ptp4l -f configs/P2P-TC.cfg -i swp1 -i swp2 -m</code></pre></div>
      <div class="tabpane">
<pre><code><span class="c"># applications usually read CLOCK_REALTIME: follow the PHC that ptp4l disciplines</span>
phc2sys -s eth0 -c CLOCK_REALTIME -w -m        <span class="c"># -w: wait for ptp4l, take the UTC offset from it</span>
<span class="c"># automotive (no Announce → no UTC offset from the GM): give it explicitly</span>
phc2sys -s eth0 -c CLOCK_REALTIME -O -37 -m    <span class="c"># TAI → UTC (37 s since 2017)</span>
<span class="c"># GNSS-locked GM: discipline the PHC from the receiver's PPS on an extts pin</span>
ts2phc -c eth0 -s nmea -m</code></pre></div>
      <div class="tabpane">
<pre><code><span class="c"># 802.1AS-2020: one CMLDS server measures each link, one ptp4l per domain uses it</span>
ptp4l -f configs/gPTP_CMLDS_server.cfg  -i eth0 -m     <span class="c"># transportSpecific 2, free_running</span>
ptp4l -f configs/gPTP_CMLDS_domain0.cfg -i eth0 -m     <span class="c"># delay_mechanism COMMON_P2P</span>
ptp4l -f configs/gPTP_CMLDS_domain1.cfg -i eth0 -m     <span class="c"># domainNumber 1</span>
<span class="c"># give each domain its own (virtual) clock on top of one hardware PHC:</span>
echo 2 &gt; /sys/class/ptp/ptp0/n_vclocks                  <span class="c"># creates /dev/ptp1, /dev/ptp2</span>
<span class="c"># then set phc_index in each domain's config to its vclock</span></code></pre></div>
      <div class="tabpane">
<pre><code><span class="c"># -t 1 = transportSpecific 1 (gPTP), -b 0 = only the local ptp4l</span>
pmc -u -b 0 -t 1 'GET TIME_STATUS_NP'          <span class="c"># master_offset, gmPresent, gmIdentity, cumulativeScaledRateOffset</span>
pmc -u -b 0 -t 1 'GET PORT_DATA_SET'           <span class="c"># portState, peerMeanPathDelay, logSyncInterval</span>
pmc -u -b 0 -t 1 'GET PORT_PROPERTIES_NP'      <span class="c"># timestamping mode, interface</span>
pmc -u -b 0 -t 1 'GET CURRENT_DATA_SET'        <span class="c"># stepsRemoved, offsetFromMaster, meanPathDelay</span>
pmc -u -b 0 -t 1 'GET PARENT_DATA_SET'         <span class="c"># GM priority/class/identity</span></code></pre></div>
    </div>

    <h2>Reading the ptp4l log</h2>
    <div class="card"><pre id="log" style="cursor:pointer"></pre><div id="log-d" class="muted">Click a line.</div></div>

    <h2>Network-namespace labs (run as root)</h2>
    <div class="table-wrap"><table>
      <tr><th>Script</th><th>What it builds</th></tr>
      <tr><td><code>labs/00-check-hw.sh</code></td><td>Lists every interface with its timestamping capabilities and PHC; no changes made.</td></tr>
      <tr><td><code>labs/01-gptp-pair-netns.sh up|show|down</code></td><td>GM ↔ end station on a veth pair, automotive configs, software timestamps.</td></tr>
      <tr><td><code>labs/02-gptp-bridge-netns.sh up|show|down</code></td><td>GM — bridge (ptp4l on two ports) — end station, standard gPTP with BMCA, to watch port roles and stepsRemoved.</td></tr>
    </table></div>
    <div class="callout warn"><b>What the namespace labs can and cannot show</b>
      All namespaces share one kernel and one CLOCK_REALTIME, and veth only supports software timestamps. The slaves therefore run with
      <code>free_running 1</code>: they compute offsets and path delays and exchange every message for real, but don't adjust the
      shared clock. Offsets show software-timestamp jitter (µs). For ns-level results use two machines with PTP-capable NICs (lesson 5).</div>

    <h2>Troubleshooting map</h2>
    <div class="table-wrap"><table>
      <tr><th>Symptom (log / pmc)</th><th>Likely cause</th><th>Fix</th></tr>
      <tr><td><code>timed out while polling for tx timestamp</code></td><td>Driver delivers TX timestamps slowly (MDIO/SPI switch, busy CPU) or not at all</td><td>Raise <code>tx_timestamp_timeout</code> (e.g. 50–100 ms); check driver support; avoid sharing the timestamp register with other PTP traffic</td></tr>
      <tr><td><code>interface 'eth0' does not support requested timestamping mode</code></td><td>No hardware timestamping, or the requested RX filter isn't supported</td><td><code>ethtool -T</code>; try <code>hwts_filter full</code> or <code>-S</code></td></tr>
      <tr><td>Port stays <b>LISTENING</b> (standard gPTP)</td><td>No Announce received: GM not GM-capable (priority1 255), Announce inhibited, wrong transportSpecific</td><td>Check the GM config, <code>pmc ... PORT_DATA_SET</code>, tcpdump for messageType 0xB</td></tr>
      <tr><td><code>peer delay ... above threshold</code> / asCapable false</td><td>Delay > <code>neighborPropDelayThresh</code>, unsupported neighbour, software timestamps</td><td>Fix timestamping; raise the threshold for long links; check for a non-gPTP switch in between</td></tr>
      <tr><td><code>received ... multiple responses</code></td><td>Link-local frames forwarded by an unaware device (hub, Linux bridge with <code>group_fwd_mask</code>)</td><td>Remove the device or make it gPTP-aware</td></tr>
      <tr><td>Client never syncs with the automotive config</td><td>Server sends no Announce and client checks the source identity</td><td><code>ignore_source_id 1</code> on the client; both sides <code>BMCA noop</code></td></tr>
      <tr><td>Offset has a constant bias of tens or hundreds of ns</td><td>Uncompensated PHY latency or link asymmetry</td><td>Calibrate <code>ingressLatency</code>/<code>egressLatency</code>/<code>delayAsymmetry</code> with a PPS and a scope</td></tr>
      <tr><td>Offset oscillates or keeps stepping</td><td>Two processes adjust the same clock (ptp4l + phc2sys + chrony/NTP), or wrong PHC in phc2sys</td><td>One owner per clock: disable NTP on that clock, check <code>-s</code>/<code>-c</code></td></tr>
      <tr><td>System time 37 s off</td><td>TAI vs UTC: gPTP time is TAI</td><td><code>phc2sys -w</code> (standard) or <code>-O -37</code> (automotive without Announce)</td></tr>
      <tr><td>Works on domain 0 only (2020)</td><td>RX filter doesn't match the new domain or majorSdoId 2 (CMLDS)</td><td><code>hwts_filter full</code>, or a NIC that stamps all PTP frames</td></tr>
    </table></div>
  `,
  mount: (root) => {
    Course.tabs(root.querySelector('#lx-tabs'));
    const L = [
      ['ptp4l[10.1]: selected /dev/ptp0 as PTP clock', 'ptp4l found the PHC of the interface (from <code>ethtool -T</code>).'],
      ['ptp4l[10.2]: port 1 (eth0): INITIALIZING to LISTENING on INIT_COMPLETE', 'Standard gPTP: the port waits for Announce. With BMCA noop the port goes directly to MASTER or SLAVE.'],
      ['ptp4l[11.9]: port 1 (eth0): new foreign master 001b21.fffe.000001-1', 'An Announce arrived from a possible GM.'],
      ['ptp4l[14.0]: selected best master clock 001b21.fffe.000001', 'BMCA finished (after announceReceiptTimeout).'],
      ['ptp4l[14.0]: port 1 (eth0): LISTENING to UNCALIBRATED on RS_SLAVE', 'Slave role chosen; now waiting for Sync to calibrate.'],
      ['ptp4l[14.4]: port 1 (eth0): UNCALIBRATED to SLAVE on MASTER_CLOCK_SELECTED', 'The servo has locked (s2) at least once.'],
      ['ptp4l[15.1]: master offset   -2306 s0 freq  +11563 path delay    52', '<b>s0</b> = unlocked: the servo is collecting samples. <code>master offset</code> = offsetFromMaster (ns), <code>freq</code> = current adjustment (ppb), <code>path delay</code> = meanLinkDelay (ns).'],
      ['ptp4l[15.2]: master offset 4813122 s1 freq  +12001 path delay    52', '<b>s1</b> = the clock was stepped (first_step_threshold or step_threshold exceeded).'],
      ['ptp4l[15.4]: master offset     -18 s2 freq  +11990 path delay    52', '<b>s2</b> = locked: the PI servo is tracking. Offsets of a few ns to tens of ns are typical with hardware timestamps.'],
      ['ptp4l[17.0]: master offset       3 s3 freq  +11994 path delay    51', '<b>s3</b> = locked stable: the last <code>servo_num_offset_values</code> offsets were all below <code>servo_offset_threshold</code>. With msg_interval_request, the client now asks for the operational intervals.'],
      ['ptp4l[17.0]: port 1 (eth0): delay timeout', 'A Pdelay exchange did not complete in time (a lost response). After allowedLostResponses of these, asCapable drops.'],
      ['ptp4l[18.2]: timed out while polling for tx timestamp', 'The TX timestamp of an event message never arrived. The port goes to FAULTY and restarts. See the troubleshooting map.'],
    ];
    const pre = root.querySelector('#log'), d = root.querySelector('#log-d');
    pre.innerHTML = L.map((l, i) => `<span data-i="${i}" style="display:block">${Course.esc(l[0])}</span>`).join('');
    pre.addEventListener('click', e => {
      const sp = e.target.closest('span[data-i]'); if (!sp) return;
      pre.querySelectorAll('span').forEach(x => x.style.background = ''); sp.style.background = 'rgba(129,140,248,.25)';
      d.innerHTML = L[+sp.dataset.i][1];
    });
  }
});
