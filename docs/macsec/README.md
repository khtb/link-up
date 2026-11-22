# MACsec & MKA: an animated course (automotive & Linux)

A self-contained browser course on **MACsec (IEEE 802.1AE)**, **MKA (IEEE 802.1X)**, GCM-AES **encryption**
and the **key hierarchy** (CAK → ICK/KEK → SAK). It focuses on **automotive Ethernet**: the OPEN Alliance TC17
profile and **10BASE-T1S shared medium**. Hands-on work is on **Linux** (iproute2, wpa_supplicant, network namespaces).

The course uses step-by-step SVG animations and interactive labs that run real cryptography in the browser.
It has a light/dark/auto theme switch, needs no build step and has no dependencies. Fonts come from Google Fonts
when you are online; otherwise system fonts are used.

## Run it

```bash
./start.sh            # serves http://localhost:8080 and opens your browser
./start.sh 9000       # another port
NO_BROWSER=1 ./start.sh
```

From another PC, use an SSH tunnel and browse to `http://localhost:8080` there:

```bash
ssh -N -L 8080:localhost:8080 user@course-host
```

Use `localhost` in the browser. The crypto labs use Web Crypto, which needs a secure context
(`localhost` or `file://`), so `http://<ip>:8080` won't work.

## Course outline

| # | Lesson | Animations / labs |
|---|--------|-------------------|
| 1 | Why MACsec? | Hop-by-hop protection on an in-vehicle path vs. a harness tap · automotive use cases |
| 2 | Building blocks: SecY, CA, SC, SA | Assembling a CA · SCI builder |
| 3 | Anatomy of a MACsec frame | Frame transformation · clickable dissector · TCI bit builder · MTU calculator |
| 4 | Encryption: GCM-AES & the PN | GCM pipeline · **live frame encryption + tamper lab** · replay-window lab |
| 5 | Key hierarchy: CAK → ICK/KEK → SAK | Key tree · **live KDF / AES Key Wrap / CMAC lab** |
| 6 | MKA: peers, election & SAK distribution | MKPDU dissector · full MKA sequence · key-server election simulator |
| 7 | Rekeying, PN exhaustion & XPN | AN rotation · PN-exhaustion calculator (10BASE-T1S … 25GBASE-T1) |
| 8 | Automotive MACsec (OPEN Alliance) | TC17 profile requirements · bypass-rule lab · startup timeline · 4-MKPDU fast start |
| 9 | 10BASE-T1S: MACsec on a shared medium | PLCA cycle · SC/key configuration calculator · rekey-on-join timeline · open problems |
| 10 | Linux lab & troubleshooting | iproute2, wpa_supplicant, NetworkManager, systemd-networkd, HW offload · troubleshooting map |
| 11 | Final quiz | 20 questions with explanations |
| 12 | Glossary & references | Standards, OPEN Alliance and IEEE 802.1 documents |

Progress, theme and completed lessons are saved in the browser's localStorage.

## Linux labs (network namespaces, run as root)

| Script | What it builds |
|--------|----------------|
| `labs/01-static-macsec-netns.sh up\|show\|down` | Two namespaces + veth, static SAKs (pure iproute2) |
| `labs/02-mka-netns.sh up\|show\|down` | Same, keyed by wpa_supplicant MKA with a PSK (A = key server, prio 0) |
| `labs/03-shared-medium-netns.sh up\|up-mka\|show\|down` | Simulated 10BASE-T1S bus: head + 3 end nodes on a bridge, multipoint CA |

The labs only touch the namespaces they create. Lab 02 and `up-mka` need wpa_supplicant with MACsec support.

## Project layout

```
index.html                  shell + script includes (lesson order)
start.sh                    local web server launcher
assets/css/style.css        theme tokens (light/dark), layout, components
assets/js/engine.js         router, progress, theme switch, stepper animation engine, quiz & tabs helpers
assets/js/crypto.js         AES-CMAC, 802.1X KDF, AES-KW, MACsec GCM-AES (Web Crypto)
assets/js/lessons/*.js      one file per lesson
labs/*.sh                   Linux namespace labs
tests/crypto.test.cjs       crypto checked against RFC 4493, RFC 3394 and an IEEE 802.1AE Annex C vector
```

## Adding a lesson

Create `assets/js/lessons/NN-name.js`:

```js
Course.register({
  id: 'my-lesson', title: 'My lesson', section: 'Extras', minutes: 10,
  render: () => `<h1>My lesson</h1><div id="anim"></div>`,
  mount: (root) => Course.stepper(root.querySelector('#anim'), {
    title: 'Demo',
    svg: `<svg viewBox="0 0 400 100"><g id="box" class="f"><rect x="10" y="10" width="80" height="40"/></g></svg>`,
    steps: [
      { caption: 'Nothing yet', do: s => {} },
      { caption: 'Box fades in', do: s => s.show('box') },
    ],
  }),
});
```

Then add a `<script>` tag for it in `index.html`. Stepper helpers: `show/hide`, `hl/unhl`, `dim/undim`, `pulse`,
`move(id, dx, dy)` (on `.mv` elements), `text(id, str)`, `fill`, `stroke`. Steps are cumulative.
Use the CSS tokens (`var(--accent)`, `var(--k-sak)`, …) for colours so both themes work.

## Tests

```bash
node tests/crypto.test.cjs
```

## Disclaimer

The crypto code is for education only. It is verified against published test vectors but is not meant to protect
real traffic. Requirements from the OPEN Alliance specification are paraphrased; the specification itself is the normative text.
