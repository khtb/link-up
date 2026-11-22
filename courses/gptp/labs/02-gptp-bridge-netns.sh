#!/usr/bin/env bash
# Lab 02: GM — time-aware bridge — end station, standard gPTP (BMCA on), three namespaces.
#
#   sudo ./labs/02-gptp-bridge-netns.sh up      build the chain and start ptp4l everywhere
#   sudo ./labs/02-gptp-bridge-netns.sh show    port states, stepsRemoved, GM identity, path delays
#   sudo ./labs/02-gptp-bridge-netns.sh down    stop ptp4l and remove the namespaces
#
#   [gptp2-gm] v-gm ── v-b1 [gptp2-br] v-b2 ── v-es [gptp2-es]
#    priority1 246          ptp4l -i v-b1 -i v-b2        priority1 255
#
# The bridge runs ONE ptp4l on two ports: one becomes SLAVE (towards the GM), one MASTER.
# Software timestamps + free_running on the bridge and end station (shared system clock).
# The two veths in the bridge namespace are separate "PHCs" in software mode, so ptp4l is
# started with boundary_clock_jbod 1. Watch BMCA: Announce, LISTENING -> SLAVE/MASTER, stepsRemoved.
set -euo pipefail

NS=(gptp2-gm gptp2-br gptp2-es)
RUN=/run/gptp-lab02
PTP4L=${PTP4L:-ptp4l}; PMC=${PMC:-pmc}
need_root() { [ "$(id -u)" -eq 0 ] || { echo "Run as root (sudo)." >&2; exit 1; }; }
nsx() { local n=$1; shift; ip netns exec "$n" "$@"; }

cfg() {  # $1 = priority1, $2 = extra lines
cat <<CFG
[global]
gmCapable               1
priority1               $1
priority2               248
logAnnounceInterval     0
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
$2
CFG
}

up() {
  need_root
  command -v "$PTP4L" >/dev/null || { echo "ptp4l not found (install linuxptp or set PTP4L=)" >&2; exit 1; }
  ip netns list | grep -qw "${NS[0]}" && { echo "Lab already up. Run '$0 down' first."; exit 1; }
  mkdir -p "$RUN"
  for n in "${NS[@]}"; do ip netns add "$n"; nsx "$n" ip link set lo up; done
  ip link add v-gm netns "${NS[0]}" type veth peer name v-b1 netns "${NS[1]}"
  ip link add v-b2 netns "${NS[1]}" type veth peer name v-es netns "${NS[2]}"
  nsx "${NS[0]}" ip link set v-gm address 02:00:00:00:02:01 up
  nsx "${NS[1]}" ip link set v-b1 address 02:00:00:00:02:11 up
  nsx "${NS[1]}" ip link set v-b2 address 02:00:00:00:02:12 up
  nsx "${NS[2]}" ip link set v-es address 02:00:00:00:02:21 up

  cfg 246 "uds_address             $RUN/gm.sock" > "$RUN/gm.cfg"
  cfg 248 "free_running            1
boundary_clock_jbod     1
uds_address             $RUN/br.sock" > "$RUN/br.cfg"
  cfg 255 "free_running            1
uds_address             $RUN/es.sock" > "$RUN/es.cfg"

  nsx "${NS[0]}" "$PTP4L" -f "$RUN/gm.cfg" -i v-gm -m > "$RUN/gm.log" 2>&1 & echo $! > "$RUN/gm.pid"
  nsx "${NS[1]}" "$PTP4L" -f "$RUN/br.cfg" -i v-b1 -i v-b2 -m > "$RUN/br.log" 2>&1 & echo $! > "$RUN/br.pid"
  nsx "${NS[2]}" "$PTP4L" -f "$RUN/es.cfg" -i v-es -m > "$RUN/es.log" 2>&1 & echo $! > "$RUN/es.pid"
  echo "Waiting ~8 s for Pdelay, Announce and the BMCA…"; sleep 8
  echo "== bridge: port state changes =="; grep -E 'to (SLAVE|MASTER|PASSIVE|UNCALIBRATED|LISTENING)' "$RUN/br.log" | sed 's/^/   /'
  echo "== end station =="; grep -E 'to (SLAVE|UNCALIBRATED)|master offset' "$RUN/es.log" | tail -n 4 | sed 's/^/   /'
  echo; echo "Running. '$0 show' for details, '$0 down' to stop. Logs: $RUN/{gm,br,es}.log"
}

show() {
  need_root
  [ -f "$RUN/br.pid" ] || { echo "Lab is not up."; exit 1; }
  for r in gm:0 br:1 es:2; do
    name=${r%%:*}; idx=${r##*:}
    echo "== $name =="
    nsx "${NS[$idx]}" "$PMC" -u -b 0 -t 1 -s "$RUN/$name.sock" 'GET PORT_DATA_SET' 'GET CURRENT_DATA_SET' 'GET PARENT_DATA_SET' 2>/dev/null \
      | grep -E 'portIdentity|portState|peerMeanPathDelay|stepsRemoved|grandmasterIdentity|grandmasterPriority1' | sed 's/^/   /' || true
  done
  echo; echo "Try: stop the GM (kill \$(cat $RUN/gm.pid)) and watch the bridge become GM after announceReceiptTimeout."
}

down() {
  need_root
  for p in gm br es; do [ -f "$RUN/$p.pid" ] && kill "$(cat "$RUN/$p.pid")" 2>/dev/null || true; done
  for n in "${NS[@]}"; do ip netns del "$n" 2>/dev/null || true; done
  rm -rf "$RUN"
  echo "Lab removed."
}

case "${1:-}" in up) up ;; show) show ;; down) down ;; *) echo "usage: $0 up|show|down"; exit 1 ;; esac
