#!/usr/bin/env bash
# Lab 01: Automotive Profile GM <-> end station between two network namespaces.
#
#   sudo ./labs/01-gptp-pair-netns.sh up      build the lab and start ptp4l on both sides
#   sudo ./labs/01-gptp-pair-netns.sh show    logs, pmc queries and a short packet capture
#   sudo ./labs/01-gptp-pair-netns.sh down    stop ptp4l and remove the namespaces
#
#   [gptp-gm] veth-gm ──── "cable" ──── veth-es [gptp-es]
#     ptp4l: BMCA noop, serverOnly,         ptp4l: BMCA noop, clientOnly,
#     inhibit_announce, asCapable true      ignore_source_id, free_running
#
# veth supports software timestamps only, and all namespaces share one system clock, so the end
# station runs free_running: it measures offset and path delay but does not adjust the shared clock.
# Expect µs-level jitter. Nothing outside the two namespaces is touched.
set -euo pipefail

NS_GM=gptp-gm; NS_ES=gptp-es
RUN=/run/gptp-lab01
PTP4L=${PTP4L:-ptp4l}; PMC=${PMC:-pmc}

need_root() { [ "$(id -u)" -eq 0 ] || { echo "Run as root (sudo)." >&2; exit 1; }; }
inGM() { ip netns exec "$NS_GM" "$@"; }
inES() { ip netns exec "$NS_ES" "$@"; }

common_cfg() {
cat <<CFG
[global]
gmCapable               1
priority1               248
priority2               248
logSyncInterval         -3
syncReceiptTimeout      3
neighborPropDelayThresh 800
min_neighbor_prop_delay -20000000
assume_two_step         1
path_trace_enabled      1
follow_up_info          1
transportSpecific       0x1
ptp_dst_mac             01:80:C2:00:00:0E
network_transport       L2
delay_mechanism         P2P
time_stamping           software
BMCA                    noop
inhibit_announce        1
asCapable               true
CFG
}

up() {
  need_root
  command -v "$PTP4L" >/dev/null || { echo "ptp4l not found (install linuxptp or set PTP4L=)" >&2; exit 1; }
  ip netns list | grep -qw "$NS_GM" && { echo "Lab already up. Run '$0 down' first."; exit 1; }
  mkdir -p "$RUN"
  ip netns add "$NS_GM"; ip netns add "$NS_ES"
  ip link add veth-gm netns "$NS_GM" type veth peer name veth-es netns "$NS_ES"
  inGM ip link set lo up; inES ip link set lo up
  inGM ip link set veth-gm address 02:00:00:00:01:01 up
  inES ip link set veth-es address 02:00:00:00:01:02 up

  { common_cfg; cat <<CFG
serverOnly              1
inhibit_delay_req       1
uds_address             $RUN/gm.sock
CFG
  } > "$RUN/gm.cfg"
  { common_cfg; cat <<CFG
clientOnly              1
ignore_source_id        1
free_running            1
step_threshold          1
operLogSyncInterval     0
operLogPdelayReqInterval 2
msg_interval_request    1
servo_offset_threshold  30
servo_num_offset_values 10
uds_address             $RUN/es.sock
CFG
  } > "$RUN/es.cfg"

  echo "== ethtool -T veth-es (software timestamping only) =="
  inES ethtool -T veth-es | sed 's/^/   /'
  inGM "$PTP4L" -f "$RUN/gm.cfg" -i veth-gm -m > "$RUN/gm.log" 2>&1 & echo $! > "$RUN/gm.pid"
  inES "$PTP4L" -f "$RUN/es.cfg" -i veth-es -m > "$RUN/es.log" 2>&1 & echo $! > "$RUN/es.pid"
  sleep 4
  echo "== GM log ==";           tail -n 5 "$RUN/gm.log" | sed 's/^/   /'
  echo "== end-station log =="; tail -n 8 "$RUN/es.log" | sed 's/^/   /'
  echo
  echo "Running. '$0 show' for details, '$0 down' to stop. Logs: $RUN/{gm,es}.log"
}

show() {
  need_root
  [ -f "$RUN/es.pid" ] || { echo "Lab is not up."; exit 1; }
  echo "== end station: last offsets (ns) and path delay =="; grep 'master offset' "$RUN/es.log" | tail -n 6 | sed 's/^/   /'
  echo "== pmc on the end station =="
  inES "$PMC" -u -b 0 -t 1 -s "$RUN/es.sock" 'GET PORT_DATA_SET' 'GET TIME_STATUS_NP' 2>/dev/null | grep -E 'portState|peerMeanPathDelay|logSyncInterval|master_offset|gmPresent' | sed 's/^/   /' || true
  if command -v tcpdump >/dev/null; then
    echo "== 3 s of gPTP frames on veth-es (Sync, Follow_Up, Pdelay_*) =="
    inES timeout 3 tcpdump -nn -e -i veth-es ether proto 0x88f7 2>/dev/null | head -n 12 | sed 's/^/   /' || true
  fi
}

down() {
  need_root
  for p in gm es; do [ -f "$RUN/$p.pid" ] && kill "$(cat "$RUN/$p.pid")" 2>/dev/null || true; done
  ip netns del "$NS_GM" 2>/dev/null || true
  ip netns del "$NS_ES" 2>/dev/null || true
  rm -rf "$RUN"
  echo "Lab removed."
}

case "${1:-}" in up) up ;; show) show ;; down) down ;; *) echo "usage: $0 up|show|down"; exit 1 ;; esac
