# Link Up

**Link Up** is one static website that bundles all the interactive courses (gPTP, MACsec & MKA, …) behind a landing page.
It needs no framework, no npm and no server-side code: just HTML/CSS/JS files, so it runs locally or on any static host such as GitHub Pages.

```
link-up/                      ← this folder is the git repo
├── courses/                  course sources (edit these)
│   ├── gptp/                 gPTP / IEEE 802.1AS (lessons, labs, tests)
│   └── macsec/               MACsec & MKA (lessons, labs, tests)
├── courses.json              which courses to publish (slug, source, title, icon, accent colours, tags)
├── build.py                  copies each course into docs/<slug>/ and generates the landing page
├── serve.py / start.sh       local web server (build + serve)
├── hub/index.template.html   landing page template
├── hub/hub.css               landing page style
└── docs/                     ← the generated website (what you publish; don't edit by hand)
```

## Run locally

```bash
./start.sh                 # build, then serve http://localhost:8080
./start.sh 9000            # another port
HOST=0.0.0.0 ./start.sh    # reachable from other PCs on your LAN: http://<this-pc-ip>:8080
NO_BUILD=1 ./start.sh      # serve docs/ as it is
```

From another PC you can also use an SSH tunnel and browse to `http://localhost:8080`:
`ssh -N -L 8080:localhost:8080 user@this-pc`.
(The MACsec crypto labs use Web Crypto, which browsers only allow on `https://` or `localhost`.)

## Add a course

1. Create the course in `courses/<slug>/` like the others: `index.html`, `assets/`, lessons registered with `Course.register`.
2. Add an entry to `courses.json`:
   ```json
   { "slug": "tsn-qbv", "source": "courses/tsn-qbv", "title": "TSN scheduling (802.1Qbv)",
     "subtitle": "…", "icon": "📅", "storageKey": "tsn-course-v1", "tags": ["TSN"] }
   ```
   `source` is relative to this folder. `storageKey` must match the course's `STORE_KEY` in `engine.js`,
   so the landing page can show progress.
3. Run `python3 build.py` (or `./start.sh`).

`build.py` leaves out `.git`, `node_modules`, `tests`, captures and logs, and adds a ⌂ "All courses" button to each course's top bar
(only in `docs/`; the sources in `courses/` are not modified). Each course also still runs on its own: `courses/gptp/start.sh`.

## Publish on GitHub Pages

Yes, GitHub works well for this. GitHub Pages serves static files over HTTPS for free, at
`https://<user>.github.io/<repo>/`.

```bash
cd link-up
python3 build.py                         # make sure docs/ is up to date
git init -b main
git add .
git commit -m "Link Up: gPTP and MACsec courses"
gh repo create link-up --public --source . --push   # or create the repo on github.com and `git remote add` + `git push`
```

Then on GitHub: **Settings → Pages → Build and deployment → Source: "Deploy from a branch" → Branch: `main`, folder: `/docs` → Save.**
After a minute the site is live. To update it later: edit a course, run `python3 build.py`, commit and push.

Notes:
- **Public repo = public content.** Everything in `docs/` (including the `labs/` scripts) becomes visible and indexable.
  The courses paraphrase IEEE/AUTOSAR/AVnu/OPEN Alliance documents; don't add copies of the specifications themselves or any company-internal material.
- **Private sharing:** GitHub Pages from a *private* repo requires a paid plan (and Enterprise for access-controlled Pages).
  Free alternatives: keep the repo private and share it with collaborators (they clone and run `./start.sh`), or share a zip of `docs/`.
- Progress and theme are stored in each visitor's browser (localStorage), so nothing is collected on the server.
- Other static hosts work the same way: upload `docs/` to Netlify, Cloudflare Pages or GitLab Pages.
