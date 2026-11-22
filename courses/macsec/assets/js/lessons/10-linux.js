Course.register({
  id: 'linux',
  title: 'Linux lab & troubleshooting',
  section: 'Practice',
  minutes: 30,
  render: () => `
    <h1>MACsec on Linux: lab and troubleshooting</h1>
    <p>Linux has a complete MACsec data plane in the kernel: the <code>macsec</code> driver, with optional hardware offload
    to the PHY or MAC. For the control plane it uses <b>wpa_supplicant</b>, which implements MKA through its <code>macsec_linux</code>
    driver. The same tools run on automotive Linux HPCs, infotainment units, HIL benches and an ordinary laptop, so every
    lab in this lesson runs on one PC using <b>network namespaces</b>.</p>

    <div class="grid3">
      <div class="card"><b>Data plane</b><br><span class="muted"><code>ip link … type macsec</code> creates a SecY. <code>ip macsec</code> manages its TX SC, RX SCs and SAs.</span></div>
      <div class="card"><b>Control plane</b><br><span class="muted"><code>wpa_supplicant -D macsec_linux</code> runs MKA with a PSK (CAK/CKN), or with 802.1X EAP.</span></div>
      <div class="card"><b>Integration</b><br><span class="muted">NetworkManager (<code>nmcli</code>) and systemd-networkd can configure both.</span></div>
    </div>

    <h2>Mapping the concepts to Linux objects</h2>
    <div class="table-wrap"><table>
      <tr><th>Course concept</th><th>Linux</th></tr>
      <tr><td>SecY on a port</td><td>A <code>macsec0</code> netdev stacked on <code>eth0</code>. <code>macsec0</code> is the controlled port and <code>eth0</code> carries the uncontrolled port.</td></tr>
      <tr><td>SCI = MAC ‖ port</td><td><code>macsec0</code>'s MAC + <code>port N</code> (or an explicit <code>sci &lt;hex&gt;</code>)</td></tr>
      <tr><td>Tx SC / Tx SA (AN, PN, SAK)</td><td><code>ip macsec add macsec0 tx sa &lt;AN&gt; pn &lt;PN&gt; on key &lt;KI&gt; &lt;SAK&gt;</code></td></tr>
      <tr><td>Rx SC per peer SCI</td><td><code>ip macsec add macsec0 rx port &lt;P&gt; address &lt;peer MAC&gt;</code> (one per peer, so multipoint is just more of these)</td></tr>
      <tr><td>Encrypt vs integrity only</td><td><code>encrypt on|off</code></td></tr>
      <tr><td>Include SCI / ES / SCB</td><td><code>send_sci on|off</code>, <code>end_station on|off</code>, <code>scb on|off</code></td></tr>
      <tr><td>Replay window</td><td><code>replay on window &lt;N&gt;</code></td></tr>
      <tr><td>Cipher suite</td><td><code>cipher gcm-aes-128 | gcm-aes-256 | gcm-aes-xpn-128 | gcm-aes-xpn-256</code></td></tr>
      <tr><td>Hardware offload</td><td><code>offload off | phy | mac</code> (if the driver supports it)</td></tr>
      <tr><td>802.1AE counters</td><td><code>ip -s macsec show</code> (InPktsOK, InPktsLate, InPktsNotValid, OutPktsProtected …)</td></tr>
    </table></div>

    <h2>Configuration</h2>
    <div class="card" id="cfg-tabs">
      <div class="tabs"><button>Static SAK (iproute2)</button><button>MKA (wpa_supplicant)</button><button>NetworkManager</button><button>systemd-networkd</button><button>HW offload</button></div>

      <div class="tabpane">
<p class="muted">No MKA at all: you program the SAKs yourself. This is ideal for seeing the SecY, SC and SA objects directly, but nothing rekeys, so use it only in a lab.</p>
<pre><code><span class="c"># Node A (MAC 00:1a:2b:3c:4d:5e), peer B (MAC 00:aa:bb:cc:dd:ee)</span>
ip link add link eth0 macsec0 type macsec port 1 encrypt on cipher gcm-aes-128

<span class="c"># Tx SA: AN 0, first PN 1, key identifier 01, SAK</span>
ip macsec add macsec0 tx sa 0 pn 1 on key 01 ad7a2bd03eac835a6f620fdcb506b345

<span class="c"># Rx SC for the peer's SCI (peer MAC + port 1), then its Rx SA</span>
ip macsec add macsec0 rx port 1 address 00:aa:bb:cc:dd:ee
ip macsec add macsec0 rx port 1 address 00:aa:bb:cc:dd:ee sa 0 pn 1 on key 02 0f0e0d0c0b0a09080706050403020100

ip addr add 10.99.0.1/30 dev macsec0
ip link set macsec0 up

<span class="c"># Node B mirrors this: its Tx key = A's Rx key, its Rx key = A's Tx key.</span>
ip macsec show</code></pre>
      </div>

      <div class="tabpane">
<p class="muted">MKA with a pre-shared CAK, which is the automotive model: no RADIUS, and the CAK is installed in advance. Give one side a lower priority so the key server role is fixed.</p>
<pre><code><span class="c"># /etc/wpa_supplicant/macsec-eth0.conf</span>
ctrl_interface=/run/wpa_supplicant
eapol_version=3
ap_scan=0

network={
    key_mgmt=NONE
    eapol_flags=0
    macsec_policy=1            <span class="c"># 1 = MACsec required (must-secure)</span>
    macsec_integ_only=0        <span class="c"># 1 = integrity only (AutoMACsec-01005)</span>
    macsec_replay_protect=1
    macsec_replay_window=0
    macsec_port=1
    mka_priority=0             <span class="c"># 0 on the key-server side, 255 on the ECU side</span>
    mka_ckn=96437a93ccf10d9dfe347846cce52c7d
    mka_cak=135bd758b0ee5c11c55ff6ab19fdb199
}

<span class="c"># Start MKA. wpa_supplicant creates the macsec netdev on top of eth0.</span>
sudo wpa_supplicant -i eth0 -D macsec_linux -c /etc/wpa_supplicant/macsec-eth0.conf -dd

<span class="c"># Then give the new macsec interface an address</span>
ip -br link show type macsec
sudo ip addr add 10.99.0.1/30 dev macsec0 &amp;&amp; sudo ip link set macsec0 up</code></pre>
<p class="src">Newer wpa_supplicant releases add more <code>macsec_*</code> options (cipher-suite index, offload). Check <code>wpa_supplicant.conf(5)</code> or the example file for your version.</p>
      </div>

      <div class="tabpane">
<pre><code>nmcli connection add type macsec con-name msec0 ifname macsec0 \\
      macsec.parent eth0 macsec.mode psk \\
      macsec.mka-cak 135bd758b0ee5c11c55ff6ab19fdb199 \\
      macsec.mka-ckn 96437a93ccf10d9dfe347846cce52c7d \\
      macsec.encrypt yes macsec.validation strict \\
      ipv4.method manual ipv4.addresses 10.99.0.1/30

nmcli connection up msec0
<span class="c"># NetworkManager runs wpa_supplicant (MKA) for you.</span></code></pre>
      </div>

      <div class="tabpane">
<p class="muted">systemd-networkd sets up static-key MACsec, which suits a fixed embedded image.</p>
<pre><code><span class="c"># /etc/systemd/network/25-macsec.netdev</span>
[NetDev]
Name=macsec0
Kind=macsec

[MACsec]
Port=1
Encrypt=yes

[MACsecReceiveChannel]
Port=1
MACAddress=00:aa:bb:cc:dd:ee

[MACsecTransmitAssociation]
PacketNumber=1
KeyId=01
Key=ad7a2bd03eac835a6f620fdcb506b345
Activate=yes
UseForEncoding=yes

[MACsecReceiveAssociation]
Port=1
MACAddress=00:aa:bb:cc:dd:ee
PacketNumber=1
KeyId=02
Key=0f0e0d0c0b0a09080706050403020100
Activate=yes

<span class="c"># /etc/systemd/network/25-eth0.network</span>
[Match]
Name=eth0
[Network]
MACsec=macsec0

<span class="c"># /etc/systemd/network/26-macsec0.network</span>
[Match]
Name=macsec0
[Network]
Address=10.99.0.1/30</code></pre>
<p class="src">For real images use <code>KeyFile=</code> rather than an inline <code>Key=</code>, so the SAK isn't stored in a world-readable unit file.</p>
      </div>

      <div class="tabpane">
<p class="muted">In automotive hardware the crypto usually runs in the PHY or the MAC. Linux exposes this as MACsec offload, and the kernel API stays the same.</p>
<pre><code><span class="c"># Does the NIC/PHY driver support MACsec offload?</span>
ethtool -k eth0 | grep macsec

<span class="c"># Create the SecY with offload to the PHY (or 'mac')</span>
ip link add link eth0 macsec0 type macsec port 1 encrypt on offload phy

<span class="c"># Or switch an existing SecY</span>
ip macsec offload macsec0 phy
ip -d link show macsec0          <span class="c"># shows "offload: phy"</span>

<span class="c"># wpa_supplicant can request offload too (option name depends on version)</span></code></pre>
<p class="src">Offload support depends on the driver: several PHY, NIC and DPAA drivers implement it, including some automotive T1 PHYs. Counters may then come from hardware, and software tools like tcpdump on the parent see ciphertext only.</p>
      </div>
    </div>

    <h2>Hands-on lab scripts</h2>
    <p>The repo's <code>labs/</code> folder has scripts that build everything inside network namespaces, so nothing on your
    real interfaces changes. Run them as root and tear the lab down with <code>down</code>.</p>
    <div class="table-wrap"><table>
      <tr><th>Script</th><th>What it builds</th><th>Try</th></tr>
      <tr><td><code>labs/01-static-macsec-netns.sh up</code></td><td>Two namespaces joined by a veth "cable", with static SAKs on each side.</td><td>Ping, then capture on the parent interface: you see only 0x88E5 frames with an incrementing PN. Change one key and watch InPktsNotValid.</td></tr>
      <tr><td><code>labs/02-mka-netns.sh up</code></td><td>The same two nodes, keyed by <b>wpa_supplicant MKA</b> with a PSK. Node A is the key server (priority 0).</td><td>Capture EAPoL (0x888E) to watch the MKPDU exchange from lesson 6. Use the wrong CAK and see the session never come up.</td></tr>
      <tr><td><code>labs/03-shared-medium-netns.sh up</code></td><td>A simulated 10BASE-T1S bus: a head node and 3 end nodes on a bridge, as a multipoint CA with one shared SAK (configuration 1 from lesson 9).</td><td>Check that each node has 1 Tx SC and N−1 Rx SCs, then ping between end nodes.</td></tr>
    </table></div>
<pre><code><span class="c"># Watch the frames on the wire (from the root namespace or the lab namespace)</span>
sudo ip netns exec mka-a tcpdump -e -nn -i veth-a                 <span class="c"># everything</span>
sudo ip netns exec mka-a tcpdump -e -nn -i veth-a ether proto 0x888e   <span class="c"># MKPDUs only</span>
sudo ip netns exec mka-a tcpdump -w /tmp/mka.pcap -i veth-a        <span class="c"># open in Wireshark: filter "eapol.type == 5" or "macsec"</span></code></pre>

    <h2>Reading <code>ip macsec show</code></h2>
<pre><code>12: macsec0: protect on validate strict sc off sa off encrypt on send_sci on end_station off scb off replay off
    cipher suite: GCM-AES-128, using ICV length 16
    TXSC: 001a2b3c4d5e0001 on SA 0
        0: PN 1042, state on, key 01000000000000000000000000000000
    RXSC: 00aabbccddee0001, state on
        0: PN 1037, state on, key 02000000000000000000000000000000</code></pre>
    <p>The <b>TXSC</b> is your SCI, and "on SA 0" is the AN currently used for transmit. Each <b>RXSC</b> line is one peer, and its
    PN is the next PN expected from that peer. With MKA you will see the AN move from 0 to 1 to 2 to 3 and wrap around as the key
    server rekeys. <code>ip -s macsec show</code> adds the 802.1AE counters required by AutoMACsec-01008.</p>

    <h2>Troubleshooting map</h2>
    <div class="table-wrap"><table>
      <tr><th>Symptom</th><th>Likely cause</th><th>Check / fix on Linux</th></tr>
      <tr><td>No macsec interface appears (MKA)</td><td>wpa_supplicant built without MACsec, or wrong driver</td><td>Run with <code>-D macsec_linux -dd</code>. Look for "KaY" lines in the log.</td></tr>
      <tr><td>No MKA peer at all</td><td><b>CKN mismatch</b>: MKPDUs arrive but name no known CA</td><td>Compare <code>mka_ckn</code> on both sides (case, length). Capture 0x888E to confirm MKPDUs arrive.</td></tr>
      <tr><td>Peer never becomes live</td><td><b>CAK mismatch</b>, so a wrong ICK and every ICV fails</td><td>The <code>-dd</code> log shows ICV verification failures. Reprovision the CAK.</td></tr>
      <tr><td>No MKPDUs through a bridge</td><td>Linux bridges don't forward 01:80:C2:00:00:03 by default</td><td><code>echo 8 &gt; /sys/class/net/br0/bridge/group_fwd_mask</code> (bit 3 = …:03). Lab 03 does this.</td></tr>
      <tr><td>Live, but never secured</td><td>Both sides <code>mka_priority=255</code>, or the cipher/integrity settings don't match</td><td>Set priority 0 on the key-server side and match <code>macsec_integ_only</code>.</td></tr>
      <tr><td>Ping works, large transfers stall</td><td><b>MTU</b>: the extra 16–32 bytes don't fit</td><td>The macsec0 MTU is the parent's minus the overhead. Raise the parent MTU, or test with <code>ping -M do -s 1472</code>.</td></tr>
      <tr><td>InPktsNotValid / InPktsBadTag rising</td><td>The keys don't match (static), or a rekey went wrong</td><td>In a static setup, check that A's Tx key equals B's Rx key for the same AN.</td></tr>
      <tr><td>InPktsNoSA rising</td><td>A frame arrived for an AN with no installed Rx SA</td><td>Install the Rx SA before the peer starts sending on that AN (Rx before Tx).</td></tr>
      <tr><td>InPktsLate rising</td><td>Frames reordered with <code>replay on window 0</code></td><td>Allow a small window, or find out why frames are reordered (queues).</td></tr>
      <tr><td>Slow secure startup on an ECU</td><td>Default MKA hello and life timers</td><td>Fix the roles with priority 0/255. Real automotive stacks need the optimized MKA timing from lesson 8.</td></tr>
    </table></div>

    <div class="callout tip"><b>Exercise</b>
      Run lab 02. Then edit the CAK on node B only (<code>/run/mka-lab/b.conf</code>) and restart its supplicant.
      Predict which counters and log lines change before you look, and compare the result with the troubleshooting map.</div>
  `,
  mount: (root) => { Course.tabs(root.querySelector('#cfg-tabs')); }
});
