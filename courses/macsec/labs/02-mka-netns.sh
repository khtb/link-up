#!/usr/bin/env bash
# Lab 02: point-to-point MACsec keyed by MKA (wpa_supplicant, pre-shared CAK/CKN).
#
#   sudo ./labs/02-mka-netns.sh up      start two MKA participants and ping across MACsec
#   sudo ./labs/02-mka-netns.sh show    SA state (watch the AN/PN), last log lines
#   sudo ./labs/02-mka-netns.sh down    stop supplicants, remove namespaces
#
#   [mka-a] veth-a (key server, prio 0) ──── veth-b (peer, prio 255) [mka-b]
#
# Needs wpa_supplicant built with MACsec support (CONFIG_MACSEC, CONFIG_DRIVER_MACSEC_LINUX);
# the Debian/Ubuntu/Fedora packages have it.
# Variables: CAK_B=<hex> gives node B a different CAK (to break the session on purpose),
#            INTEG_ONLY=1 selects integrity only.
set -euo pipefail

NS_A=mka-a; NS_B=mka-b
MAC_A=02:00:00:00:00:0a; MAC_B=02:00:00:00:00:0b
RUN=/run/mka-lab
CKN=${CKN:-96437a93ccf10d9dfe347846cce52c7d}
CAK=${CAK:-135bd758b0ee5c11c55ff6ab19fdb199}
CAK_B=${CAK_B:-$CAK}
INTEG_ONLY=${INTEG_ONLY:-0}

need_root() { [ "$(id -u)" -eq 0 ] || { echo "Run as root (sudo)." >&2; exit 1; }; }

write_conf() { # $1=name $2=priority $3=cak
  cat > "$RUN/$1.conf" <<EOF
ctrl_interface=$RUN/ctrl-$1
eapol_version=3
ap_scan=0
network={
    key_mgmt=NONE
    eapol_flags=0
    macsec_policy=1
    macsec_integ_only=$INTEG_ONLY
    macsec_port=1
    mka_priority=$2
    mka_ckn=$CKN
    mka_cak=$3
}
EOF
}

start_supp() { # $1=ns $2=ifname $3=name
  ip netns exec "$1" wpa_supplicant -i "$2" -D macsec_linux -c "$RUN/$3.conf" -dd > "$RUN/$3.log" 2>&1 &
  echo $! > "$RUN/$3.pid"
}

wait_macsec() { # $1=ns -> prints macsec ifname
  local i name
  for i in $(seq 1 40); do
    name=$(ip netns exec "$1" ip -br link show type macsec 2>/dev/null | awk '{print $1}' | cut -d@ -f1 | head -n1)
    [ -n "$name" ] && { echo "$name"; return 0; }
    sleep 0.25
  done
  return 1
}

up() {
  need_root
  command -v wpa_supplicant >/dev/null || { echo "wpa_supplicant not found (install the wpasupplicant package)." >&2; exit 1; }
  ip netns list | grep -qw "$NS_A" && { echo "Lab already up. Run '$0 down' first."; exit 1; }
  mkdir -p "$RUN"; chmod 700 "$RUN"
  ip netns add "$NS_A"; ip netns add "$NS_B"
  ip link add veth-a netns "$NS_A" type veth peer name veth-b netns "$NS_B"
  ip netns exec "$NS_A" ip link set veth-a address "$MAC_A" up
  ip netns exec "$NS_B" ip link set veth-b address "$MAC_B" up

  write_conf a 0 "$CAK"       # key server
  write_conf b 255 "$CAK_B"   # never key server
  start_supp "$NS_A" veth-a a
  start_supp "$NS_B" veth-b b
  echo "MKA starting… (logs: $RUN/a.log, $RUN/b.log)"

  local ma mb
  ma=$(wait_macsec "$NS_A") || { echo "!! no macsec interface in $NS_A. See $RUN/a.log"; exit 1; }
  mb=$(wait_macsec "$NS_B") || { echo "!! no macsec interface in $NS_B. See $RUN/b.log"; exit 1; }
  ip netns exec "$NS_A" ip addr add 10.99.0.1/30 dev "$ma"; ip netns exec "$NS_A" ip link set "$ma" up
  ip netns exec "$NS_B" ip addr add 10.99.0.2/30 dev "$mb"; ip netns exec "$NS_B" ip link set "$mb" up

  echo "Waiting for MKA to install SAKs (live peers, key server election, SAK distribution)…"
  local i
  for i in $(seq 1 30); do
    if ip netns exec "$NS_A" ping -c 1 -W 1 10.99.0.2 >/dev/null 2>&1; then
      echo "== secured after ~${i}s: ping A -> B over MKA-keyed MACsec =="
      ip netns exec "$NS_A" ping -c 3 -W 1 10.99.0.2
      show; return 0
    fi
    sleep 1
  done
  echo "!! not secured after 30 s. Check the logs (CKN/CAK mismatch? priorities?)."
  show
}

show() {
  need_root
  for n in a b; do
    echo "----- [mka-$n] -----"
    ip netns exec "mka-$n" ip -s macsec show 2>/dev/null || true
    [ -f "$RUN/$n.log" ] && { echo "  last log lines:"; grep -iE "kay|mka|sak|key server|cp state|secured" "$RUN/$n.log" | tail -n 6 | sed 's/^/    /'; }
  done
  cat <<EOF

Capture MKPDUs:   sudo ip netns exec $NS_B tcpdump -e -nn -i veth-b ether proto 0x888e
Break it:         sudo $0 down && sudo CAK_B=00112233445566778899aabbccddeeff $0 up
EOF
}

down() {
  need_root
  for n in a b; do
    [ -f "$RUN/$n.pid" ] && kill "$(cat "$RUN/$n.pid")" 2>/dev/null || true
  done
  sleep 0.5
  ip netns del "$NS_A" 2>/dev/null || true
  ip netns del "$NS_B" 2>/dev/null || true
  rm -f "$RUN"/a.* "$RUN"/b.*
  rm -rf "$RUN"/ctrl-a "$RUN"/ctrl-b
  rmdir "$RUN" 2>/dev/null || true
  echo "Lab removed."
}

case "${1:-}" in
  up) up ;; show) show ;; down) down ;;
  *) echo "usage: $0 up|show|down   (env: CAK=.. CKN=.. CAK_B=.. INTEG_ONLY=1)"; exit 1 ;;
esac
