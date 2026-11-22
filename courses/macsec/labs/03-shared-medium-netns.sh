#!/usr/bin/env bash
# Lab 03: a simulated 10BASE-T1S multidrop bus with multipoint MACsec.
#
#   sudo ./labs/03-shared-medium-netns.sh up       static group SAK (configuration 1 from lesson 9)
#   sudo ./labs/03-shared-medium-netns.sh up-mka   EXPERIMENTAL: MKA on all nodes (head = key server)
#   sudo ./labs/03-shared-medium-netns.sh show
#   sudo ./labs/03-shared-medium-netns.sh down
#
#                 [mka-bus]  br0  (the "twisted pair": every node sees every frame)
#        ┌──────────┬──────────┼──────────┐
#     [mka-h]    [mka-n1]   [mka-n2]   [mka-n3]
#     head .1     end .11    end .12    end .13       (10.98.0.0/24 on macsec0)
#
# A bridge only approximates a shared medium: there is no PLCA, but flooding and multicast make
# every node receive the traffic, which is what matters for MACsec. Each node gets 1 Tx SC and
# N-1 Rx SCs; all Tx SAs use the same group SAK, so the SCI (MAC||port) keeps the IVs unique.
set -euo pipefail

NODES=(h n1 n2 n3)
declare -A MAC=([h]=02:00:00:00:01:01 [n1]=02:00:00:00:01:11 [n2]=02:00:00:00:01:12 [n3]=02:00:00:00:01:13)
declare -A IP=([h]=10.98.0.1 [n1]=10.98.0.11 [n2]=10.98.0.12 [n3]=10.98.0.13)
GROUP_SAK=${GROUP_SAK:-3b1f6a0c9d2e84f7a1c05e6b9d3f7a21}
CKN=${CKN:-5431535f6d756c746964726f705f6c6162}
CAK=${CAK:-9a8b7c6d5e4f30211203f4e5d6c7b8a9}
RUN=/run/mka-lab-bus

need_root() { [ "$(id -u)" -eq 0 ] || { echo "Run as root (sudo)." >&2; exit 1; }; }
ns() { echo "mka-$1"; }

build_bus() {
  ip netns list | grep -qw mka-bus && { echo "Lab already up. Run '$0 down' first."; exit 1; }
  ip netns add mka-bus
  ip -n mka-bus link add br0 type bridge
  # forward 01:80:C2:00:00:03 (PAE group address) so MKPDUs cross the "bus": bit 3
  ip netns exec mka-bus sh -c 'echo 8 > /sys/class/net/br0/bridge/group_fwd_mask'
  ip -n mka-bus link set br0 up
  for n in "${NODES[@]}"; do
    ip netns add "$(ns "$n")"
    ip link add "t1s-$n" netns "$(ns "$n")" type veth peer name "tap-$n" netns mka-bus
    ip -n "$(ns "$n")" link set lo up
    ip -n "$(ns "$n")" link set "t1s-$n" address "${MAC[$n]}" up
    ip -n mka-bus link set "tap-$n" master br0 up
  done
}

up_static() {
  need_root; build_bus
  for n in "${NODES[@]}"; do
    local N; N=$(ns "$n")
    ip -n "$N" link add link "t1s-$n" macsec0 type macsec port 1 encrypt on cipher gcm-aes-128
    ip netns exec "$N" ip macsec add macsec0 tx sa 0 pn 1 on key 01 "$GROUP_SAK"
    for p in "${NODES[@]}"; do
      [ "$p" = "$n" ] && continue
      ip netns exec "$N" ip macsec add macsec0 rx port 1 address "${MAC[$p]}"
      ip netns exec "$N" ip macsec add macsec0 rx port 1 address "${MAC[$p]}" sa 0 pn 1 on key 01 "$GROUP_SAK"
    done
    ip -n "$N" addr add "${IP[$n]}/24" dev macsec0
    ip -n "$N" link set macsec0 up
  done
  echo "== head -> every end node, and end node -> end node =="
  for t in n1 n2 n3; do ip netns exec mka-h ping -c 1 -W 1 "${IP[$t]}" >/dev/null && echo "  h  -> $t ok" || echo "  h  -> $t FAIL"; done
  ip netns exec mka-n1 ping -c 1 -W 1 "${IP[n2]}" >/dev/null && echo "  n1 -> n2 ok" || echo "  n1 -> n2 FAIL"
  echo
  echo "Each node: 1 Tx SC + $(( ${#NODES[@]} - 1 )) Rx SCs, one shared SAK (key id 01)."
  echo "Note: n1 could forge frames carrying n2's SCI, because a group SAK authenticates the group, not the sender."
  echo "Run '$0 show' for per-node SC/SA state and counters."
}

up_mka() {
  need_root
  command -v wpa_supplicant >/dev/null || { echo "wpa_supplicant not found." >&2; exit 1; }
  build_bus
  mkdir -p "$RUN"; chmod 700 "$RUN"
  for n in "${NODES[@]}"; do
    local prio=255; [ "$n" = h ] && prio=0
    cat > "$RUN/$n.conf" <<EOF
ctrl_interface=$RUN/ctrl-$n
eapol_version=3
ap_scan=0
network={
    key_mgmt=NONE
    eapol_flags=0
    macsec_policy=1
    macsec_port=1
    mka_priority=$prio
    mka_ckn=$CKN
    mka_cak=$CAK
}
EOF
    ip netns exec "$(ns "$n")" wpa_supplicant -i "t1s-$n" -D macsec_linux -c "$RUN/$n.conf" -dd > "$RUN/$n.log" 2>&1 &
    echo $! > "$RUN/$n.pid"
  done
  echo "MKA starting on ${#NODES[@]} nodes (logs in $RUN/*.log). Waiting for macsec interfaces…"
  for n in "${NODES[@]}"; do
    local N name=""; N=$(ns "$n")
    for _ in $(seq 1 40); do
      name=$(ip -n "$N" -br link show type macsec 2>/dev/null | awk '{print $1}' | cut -d@ -f1 | head -n1)
      [ -n "$name" ] && break; sleep 0.25
    done
    [ -z "$name" ] && { echo "!! no macsec interface on $n. See $RUN/$n.log"; continue; }
    ip -n "$N" addr add "${IP[$n]}/24" dev "$name"; ip -n "$N" link set "$name" up
  done
  echo "Give MKA ~10 s (every join triggers a new SAK: lesson 9), then try:"
  echo "  sudo ip netns exec mka-h ping ${IP[n2]}      and      sudo $0 show"
}

show() {
  need_root
  for n in "${NODES[@]}"; do
    echo "----- [$(ns "$n")] ${IP[$n]} -----"
    ip netns exec "$(ns "$n")" ip -s macsec show 2>/dev/null || true
  done
  echo "Capture on the bus:  sudo ip netns exec mka-bus tcpdump -e -nn -i br0"
}

down() {
  need_root
  for n in "${NODES[@]}"; do
    [ -f "$RUN/$n.pid" ] && kill "$(cat "$RUN/$n.pid")" 2>/dev/null || true
  done
  sleep 0.5
  for n in "${NODES[@]}"; do ip netns del "$(ns "$n")" 2>/dev/null || true; done
  ip netns del mka-bus 2>/dev/null || true
  if [ -d "$RUN" ]; then
    for n in "${NODES[@]}"; do rm -f "$RUN/$n.conf" "$RUN/$n.log" "$RUN/$n.pid"; rm -rf "$RUN/ctrl-$n"; done
    rmdir "$RUN" 2>/dev/null || true
  fi
  echo "Lab removed."
}

case "${1:-}" in
  up) up_static ;; up-mka) up_mka ;; show) show ;; down) down ;;
  *) echo "usage: $0 up|up-mka|show|down"; exit 1 ;;
esac
