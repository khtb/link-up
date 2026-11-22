#!/usr/bin/env python3
"""Build the Link Up: copy every course listed in courses.json into docs/<slug>/,
add a "back to all courses" link to each course, and generate docs/index.html.

  python3 build.py            # output in ./docs (ready for GitHub Pages "main /docs")
  python3 build.py -o site    # another output folder

Course "source" paths in courses.json are relative to this file (or absolute).
"""
import argparse, html, json, re, shutil, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
# Never published: dev-only folders, captures, editor state.
EXCLUDE = {'.git', 'node_modules', 'tests', '.preview', '.claude', '.vscode', '.idea', '__pycache__'}
EXCLUDE_SUFFIX = ('.pcap', '.pcapng', '.log')

BACKLINK = ('<a class="icon-btn" href="../" title="All courses" aria-label="All courses" '
            'style="display:inline-grid;place-items:center;text-decoration:none">⌂</a>')


def ignore(src_dir, names):
    out = set()
    for n in names:
        p = (Path(src_dir) / n).resolve()
        if n in EXCLUDE or n.endswith(EXCLUDE_SUFFIX):
            out.add(n)
        if p == HERE:            # the hub may live inside a course folder: don't copy it into itself
            out.add(n)
    return out


def build(out: Path):
    cfg = json.loads((HERE / 'courses.json').read_text(encoding='utf-8'))
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    cards = []
    for c in cfg['courses']:
        src = (HERE / c['source']).resolve()
        if not (src / 'index.html').is_file():
            sys.exit(f"course '{c['slug']}': no index.html in {src}")
        dst = out / c['slug']
        shutil.copytree(src, dst, ignore=ignore)
        idx = dst / 'index.html'
        page = idx.read_text(encoding='utf-8')
        lessons = len(re.findall(r'<script src="assets/js/lessons/', page))
        code = ''.join(f.read_text(encoding='utf-8', errors='ignore') for f in sorted((src / 'assets/js/lessons').glob('*.js')))
        anims = code.count('Course.stepper(')
        labs = code.count('class="card lab')
        quiz = len(re.findall(r'\{ q:', code))
        if 'title="All courses"' not in page:
            page = page.replace('<div class="brand">', BACKLINK + '\n    <div class="brand">', 1)
        idx.write_text(page, encoding='utf-8')
        cards.append(dict(c, lessons=lessons, anims=anims, labs=labs, quiz=quiz))
        print(f"  {c['slug']:<10} {lessons:>2} lessons {anims:>2} animations {labs:>2} labs  <- {src}")

    shutil.copy(HERE / 'hub' / 'hub.css', out / 'hub.css')
    tpl = (HERE / 'hub' / 'index.template.html').read_text(encoding='utf-8')
    site = cfg['site']
    esc = html.escape
    art = {
        'sync': ('<svg viewBox="0 0 400 140" aria-hidden="true">'
                 + ''.join(f'<line x1="20" y1="{y}" x2="380" y2="{y}" class="a-line"/>' for y in (30, 60, 90, 120))
                 + ''.join(f'<circle cx="60" cy="{y}" r="6" class="a-dot d{i}"/>' for i, y in enumerate((30, 60, 90, 120)))
                 + '<line x1="300" y1="14" x2="300" y2="136" class="a-gm"/><text x="306" y="22" class="a-lbl">GM</text></svg>'),
        'crypto': ('<svg viewBox="0 0 400 140" aria-hidden="true"><g class="a-hex">'
                   + ''.join(f'<text x="{24 + (i % 12) * 30}" y="{40 + (i // 12) * 32}" class="hx">00</text>' for i in range(36))
                   + '</g><g class="a-lock"><rect x="176" y="62" width="48" height="40" rx="8"/><path d="M186,62 v-10 a14,14 0 0 1 28,0 v10" /></g></svg>'),
    }
    card_html = '\n'.join(f'''
      <a class="course" href="{esc(c['slug'])}/" data-key="{esc(c['storageKey'])}" data-lessons="{c['lessons']}"
         style="--ca:{esc(c.get('accent', '#6366f1'))};--cb:{esc(c.get('accent2', '#22d3ee'))}">
        <div class="art art-{esc(c.get('art', 'sync'))}">{art.get(c.get('art', 'sync'), '')}<span class="c-icon">{esc(c['icon'])}</span></div>
        <div class="c-body">
          <div class="c-kicker">{esc(c.get('kicker', ''))}</div>
          <h3 class="c-title">{esc(c['title'])}</h3>
          <p class="c-sub">{esc(c['subtitle'])}</p>
          <div class="c-tags">{''.join(f'<span class="tag">{esc(t)}</span>' for t in c.get('tags', []))}</div>
          <div class="c-stats"><span><b>{c['lessons']}</b> lessons</span><span><b>{c['anims']}</b> animations</span><span><b>{c['labs']}</b> labs</span><span><b>{c['quiz']}</b> quiz Qs</span></div>
          <div class="c-foot"><div class="c-prog"><div class="bar"><span></span></div><span class="pct">Not started</span></div><span class="go">Start course <i>→</i></span></div>
        </div>
      </a>''' for c in cards)
    tot = lambda k: sum(c[k] for c in cards)
    first = cards[0]
    page = tpl
    for k, v in {'TITLE': esc(site['title']), 'TAGLINE': esc(site.get('tagline', '')), 'SUBTITLE': esc(site['subtitle']),
                 'AUTHOR': esc(site.get('author', '')), 'COUNT': str(len(cards)), 'CARDS': card_html,
                 'LESSONS': str(tot('lessons')), 'ANIMS': str(tot('anims')), 'LABS': str(tot('labs')), 'QUIZ': str(tot('quiz')),
                 'FIRST_SLUG': esc(first['slug']), 'FIRST_TITLE': esc(first['title'])}.items():
        page = page.replace('{{' + k + '}}', v)
    (out / 'index.html').write_text(page, encoding='utf-8')
    (out / '.nojekyll').write_text('')   # GitHub Pages: serve files as-is
    print(f"built {len(cards)} course(s) into {out}")


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('-o', '--out', default='docs')
    a = ap.parse_args()
    o = Path(a.out)
    build(o if o.is_absolute() else HERE / o)
