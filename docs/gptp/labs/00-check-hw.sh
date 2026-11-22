#!/usr/bin/env bash
# Lab 00: what timestamping hardware does this machine have? (read-only, no root needed)
#
#   ./labs/00-check-hw.sh            all interfaces
#   ./labs/00-check-hw.sh eth0       one interface
#
# For each interface: HW/SW timestamping, PHC index, TX modes and RX filters (ethtool -T).
# For each PHC: name, max frequency adjustment, pins and virtual clocks (/sys/class/ptp).
set -uo pipefail

command -v ethtool >/dev/null || { echo "ethtool not found" >&2; exit 1; }
ifaces=("$@")
[ ${#ifaces[@]} -eq 0 ] && mapfile -t ifaces < <(ls /sys/class/net)

printf '%-16s %-6s %-6s %-9s %-28s %s\n' IFACE HW-TX HW-RX PHC/SRC TX-MODES RX-FILTERS
for i in "${ifaces[@]}"; do
  out=$(ethtool -T "$i" 2>/dev/null) || continue
  hwtx=$(grep -q 'hardware-transmit' <<<"$out" && echo yes || echo no)
  hwrx=$(grep -q 'hardware-receive' <<<"$out" && echo yes || echo no)
  phc=$(sed -n -e 's/^PTP Hardware Clock: *//p' -e 's/^Hardware timestamp provider index: *//p' <<<"$out")
  src=$(sed -n 's/^Hardware timestamp source: *//p' <<<"$out")
  [ -n "$src" ] && phc="$phc/$src"
  tx=$(sed -n '/Transmit Timestamp Modes/,/Receive Filter/p' <<<"$out" | grep -vE 'Modes|none' | tr -d '\t' | awk '{print $1}' | paste -sd, -)
  rx=$(sed -n '/Receive Filter Modes/,$p' <<<"$out" | grep -vE 'Modes|none' | tr -d '\t' | awk '{print $1}' | paste -sd, -)
  printf '%-16s %-6s %-6s %-9s %-28s %s\n' "$i" "$hwtx" "$hwrx" "${phc:-none}" "${tx:--}" "${rx:--}"
done

echo
if ls /sys/class/ptp/ >/dev/null 2>&1 && [ -n "$(ls /sys/class/ptp 2>/dev/null)" ]; then
  printf '%-8s %-24s %-12s %-5s %-5s %-5s %-5s %s\n' PHC NAME MAX_ADJ_ppb PINS PEROUT EXTTS PPS VCLOCKS
  for p in /sys/class/ptp/ptp*; do
    n=$(basename "$p")
    rd() { cat "$p/$1" 2>/dev/null || echo -; }
    printf '%-8s %-24s %-12s %-5s %-5s %-5s %-5s %s\n' "$n" "$(rd clock_name)" "$(rd max_adjustment)" "$(rd n_programmable_pins)" \
      "$(rd n_periodic_outputs)" "$(rd n_external_timestamps)" "$(rd pps_available)" "$(rd n_vclocks)"
  done
else
  echo "No PTP hardware clocks (/sys/class/ptp is empty): only software timestamping (ptp4l -S) is possible."
fi
cat <<'TXT'

What to look for (course lesson 5):
  HW-TX/HW-RX yes + a PHC       -> ptp4l with hardware timestamps (ns accuracy)
  same PHC on several ports     -> they can form one gPTP bridge without boundary_clock_jbod
  TX mode onestep-sync/-p2p     -> one-step operation possible (802.1AS-2020)
  RX filter ptpv2-l2-event/all  -> gPTP event messages get timestamped
  PEROUT/EXTTS > 0              -> PPS output / input for scope measurements and ts2phc
TXT
