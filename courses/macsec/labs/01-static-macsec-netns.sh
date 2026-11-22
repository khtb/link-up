#!/usr/bin/env bash
# Lab 01: point-to-point MACsec with static SAKs, between two network namespaces.
#
#   sudo ./labs/01-static-macsec-netns.sh up       build the lab and ping across MACsec
#   sudo ./labs/01-static-macsec-netns.sh show     SecY / SC / SA state and counters
#   sudo ./labs/01-static-macsec-netns.sh down     remove the lab namespaces
#
#   [mka-a] veth-a ──── "cable" ──── veth-b [mka-b]
#             └ macsec0 10.99.0.1     macsec0 10.99.0.2 ┘
#
# Nothing outside the two namespaces is touched.
set -euo pipefail

NS_A=mka-a; NS_B=mka-b
MAC_A=02:00:00:00:00:0a; MAC_B=02:00:00:00:00:0b
CIPHER=${CIPHER:-gcm-aes-128}
ENCRYPT=${ENCRYPT:-on}                     # ENCRYPT=off -> integrity only
SAK_A=${SAK_A:-ad7a2bd03eac835a6f620fdcb506b345}   # A transmits with this
SAK_B=${SAK_B:-0f0e0d0c0b0a09080706050403020100}   # B transmits with this

need_root() { [ "$(id -u)" -eq 0 ] || { echo "Run as root (sudo)." >&2; exit 1; }; }
inA() { ip netns exec "$NS_A" "$@"; }
inB() { ip netns exec "$NS_B" "$@"; }

up() {
  need_root
  ip netns list | grep -qw "$NS_A" && { echo "Lab already up. Run '$0 down' first."; exit 1; }
  ip netns add "$NS_A"; ip netns add "$NS_B"
  ip link add veth-a netns "$NS_A" type veth peer name veth-b netns "$NS_B"
  inA ip link set lo up; inB ip link set lo up
  inA ip link set veth-a address "$MAC_A" up
  inB ip link set veth-b address "$MAC_B" up

  # SecY on each side (macsec0 inherits the parent's MAC -> SCI = MAC || port 1)
  inA ip link add link veth-a macsec0 type macsec port 1 encrypt "$ENCRYPT" cipher "$CIPHER"
  inB ip link add link veth-b macsec0 type macsec port 1 encrypt "$ENCRYPT" cipher "$CIPHER"

  # A: Tx SA AN0 with SAK_A, Rx SC for B's SCI with SAK_B
  inA ip macsec add macsec0 tx sa 0 pn 1 on key 01 "$SAK_A"
  inA ip macsec add macsec0 rx port 1 address "$MAC_B"
  inA ip macsec add macsec0 rx port 1 address "$MAC_B" sa 0 pn 1 on key 02 "$SAK_B"
  # B: the mirror image
  inB ip macsec add macsec0 tx sa 0 pn 1 on key 02 "$SAK_B"
  inB ip macsec add macsec0 rx port 1 address "$MAC_A"
  inB ip macsec add macsec0 rx port 1 address "$MAC_A" sa 0 pn 1 on key 01 "$SAK_A"

  inA ip addr add 10.99.0.1/30 dev macsec0; inA ip link set macsec0 up
  inB ip addr add 10.99.0.2/30 dev macsec0; inB ip link set macsec0 up

  echo "== ping A -> B over MACsec =="
  inA ping -c 3 -W 1 10.99.0.2 || echo "!! ping failed. Check '$0 show'."
  show
  cat <<EOF

Next steps:
  sudo ip netns exec $NS_B tcpdump -e -nn -i veth-b     # only ethertype 0x88e5 frames, PN increasing
  sudo ip netns exec $NS_A ping 10.99.0.2               # (in another terminal)
  Break it: sudo ip netns exec $NS_B ip macsec set macsec0 rx port 1 address $MAC_A sa 0 off
            then watch InPktsNoSA / InPktsNotUsingSA in '$0 show'
EOF
}

show() {
  need_root
  for ns in "$NS_A" "$NS_B"; do
    echo "----- [$ns] -----"
    ip netns exec "$ns" ip -s macsec show || true
  done
}

down() {
  need_root
  ip netns del "$NS_A" 2>/dev/null || true
  ip netns del "$NS_B" 2>/dev/null || true
  echo "Lab removed."
}

case "${1:-}" in
  up) up ;; show) show ;; down) down ;;
  *) echo "usage: $0 up|show|down   (env: CIPHER=gcm-aes-256 ENCRYPT=off SAK_A=.. SAK_B=..)"; exit 1 ;;
esac
