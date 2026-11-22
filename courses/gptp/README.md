# gPTP (IEEE 802.1AS): an animated course (timestamping, bridges, automotive)

A self-contained browser course on **gPTP / IEEE 802.1AS**. It covers in detail **when and how frames are timestamped**,
the **hardware** that does it (PHC, TSU, one-step/two-step), **timestamping inside a switch**, **boundary clocks,
transparent clocks and gPTP relays**, and the **automotive** profiles: the AVnu Automotive Profile, the differences
between **802.1AS-2011 and 802.1AS-2020**, AUTOSAR time sync, IEEE 802.1DG and 10BASE-T1S. Hands-on work uses **Linux** (linuxptp,
ethtool, network namespaces).

It uses the same engine, style and light/dark/auto theme as the MACsec & MKA course (`../macsec`): step-by-step SVG
animations and interactive labs that compute real gPTP values in the browser. No build step, no dependencies.

## Run it

```bash
./start.sh            # serves http://localhost:8080 and opens your browser
./start.sh 9000       # another port
NO_BROWSER=1 ./start.sh
```

You can also open `index.html` directly from disk.

## Course outline

| # | Lesson | Animations / labs |
|---|--------|-------------------|
| 1 | Why time sync in a vehicle? | Zonal network sync flow · use cases and accuracy targets |
| 2 | gPTP building blocks | Sync/Follow_Up timing diagram · slave-offset lab · log-interval converter |
| 3 | Anatomy of gPTP messages | Clickable Ethernet + 34-byte header + Follow_Up TLV dissectors · header builder · correctionField and rate-offset converters |
| 4 | Timestamping: when and how | Timestamp point along the TX path (SW / MAC / PHY / MDI) · two-step TX timestamp round trip in Linux · one-step · per-hop error-budget lab |
| 5 | Hardware capabilities: PHC and TSU | PHC/TSU block diagram · fractional increment / addend lab · capability checklist · clickable `ethtool -T` |
| 6 | Peer delay & rate ratio | Pdelay timing diagram · link-delay, rate-ratio and asCapable labs |
| 7 | Timestamping inside a switch | 11-step anatomy of a Sync through a bridge · relay correction lab · multi-hop rateRatio lab · DSA timestamp delivery |
| 8 | Boundary clocks, transparent clocks & gPTP relays | BC / E2E TC / P2P TC / relay compared · error-accumulation simulation |
| 9 | BMCA, Announce & port roles | BMCA simulator with presets |
| 10 | The Automotive Profile (AVnu) | Requirements → linuxptp options · startup timeline comparison · Signaling animation · config generator |
| 11 | 802.1AS-2011 vs 802.1AS-2020 | Feature table · byte-level wire diff · multiple domains · CMLDS animation · external port configuration · interop · amendments |
| 12 | Automotive time-sync protocols | AUTOSAR EthTSyn/StbM/CanTSyn, 802.1DG, 10BASE-T1S, 1588 sensors · vehicle time-distribution animation · StbM status lab · securing time |
| 13 | Linux lab & troubleshooting | linuxptp recipes (end station, automotive, bridge, phc2sys, CMLDS, pmc) · ptp4l log explainer · troubleshooting map |
| 14 | Final quiz | 22 questions with explanations |
| 15 | Glossary & references | Standards, automotive and Linux references |

Progress, theme and completed lessons are saved in the browser's localStorage.

## Linux labs

| Script | What it does |
|--------|--------------|
| `labs/00-check-hw.sh [iface]` | Read-only: timestamping capabilities, PHC/source, TX modes, RX filters and PHC pins for each interface |
| `sudo labs/01-gptp-pair-netns.sh up\|show\|down` | Automotive Profile GM ↔ end station in two namespaces (veth, software timestamps) |
| `sudo labs/02-gptp-bridge-netns.sh up\|show\|down` | GM — bridge (one ptp4l, two ports) — end station with standard gPTP/BMCA |

The namespace labs need `ptp4l` (linuxptp) and only touch the namespaces they create. Because namespaces share one system
clock and veth only has software timestamps, slaves run with `free_running 1`: every message is exchanged for real and offsets
and path delays are measured, but the shared clock is not adjusted. For ns results, use two hosts with PTP-capable NICs.

## Project layout

```
index.html                  shell + script includes (lesson order)
start.sh                    local web server launcher
assets/css/style.css        theme tokens (light/dark), layout, components (+ gPTP palette)
assets/js/engine.js         router, progress, theme switch, stepper animation engine, quiz & tabs helpers
assets/js/ptpmath.js        gPTP arithmetic: correctionField, rate offset, Pdelay, relay correction, BMCA, header codec
assets/js/lessons/*.js      one file per lesson
labs/*.sh                   Linux labs
tests/ptpmath.test.cjs      checks for ptpmath.js
```

Adding a lesson works as in the MACsec course: `Course.register({ id, title, section, minutes, render, mount })`, then add a
`<script>` tag in `index.html`. Use the CSS tokens (`var(--c-sync)`, `var(--c-fu)`, `var(--c-pd)`, `var(--c-ts)`, `var(--c-gm)`, …)
so both themes work.

## Tests

```bash
node tests/ptpmath.test.cjs
```

## Disclaimer

Requirements from IEEE 802.1AS, the AVnu Automotive Profile and AUTOSAR are paraphrased for teaching; the specifications are
the normative text. Amendment projects (802.1ASdm/dr/dn/ds, 802.1DG) evolve; check the IEEE 802.1 pages for their current status.
Device examples are illustrative.
