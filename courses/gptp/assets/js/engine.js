/*
 * Course engine: lesson registry, hash router, progress tracking,
 * and the step-through SVG animation component ("stepper").
 *
 * A lesson is registered with:
 *   Course.register({
 *     id: 'intro', title: 'Why time sync', section: 'Foundations', minutes: 10,
 *     render: () => '<h1>...</h1>',        // returns HTML string
 *     mount:  (root) => { ... }            // optional: wire up animations/labs
 *   });
 */
(function () {
  'use strict';

  const STORE_KEY = 'gptp-course-v1';
  const lessons = [];

  // ---------- storage (best-effort; course works without it) ----------
  function load() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (e) { return {}; }
  }
  function save(state) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }
  const state = Object.assign({ done: {}, theme: null }, load());

  // ---------- helpers ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ---------- Stepper: step-by-step SVG animation ----------
  /**
   * Course.stepper(hostEl, {
   *   title: 'Animation title',
   *   svg: '<svg ...>...</svg>',
   *   steps: [ { caption: 'HTML', do: (s) => { s.show('id'); s.move('pkt', 200, 0); } }, ... ],
   *   autoplayMs: 2600
   * })
   *
   * Elements with class "f" start hidden; s.show() fades them in.
   * Elements with class "mv" animate when s.move() sets a translate.
   * Steps are cumulative: step N = steps 0..N applied in order.
   */
  function stepper(host, cfg) {
    host.classList.add('stage');
    host.innerHTML = `
      ${cfg.title ? `<div class="stage-title">▶ ${cfg.title}</div>` : ''}
      <div class="stage-svg">${cfg.svg}</div>
      <div class="stage-caption"></div>
      <div class="stage-controls">
        <button class="btn" data-a="reset" title="Restart">⏮</button>
        <button class="btn" data-a="prev" title="Previous step">◀ Prev</button>
        <button class="btn primary" data-a="next" title="Next step">Next ▶</button>
        <button class="btn" data-a="play" title="Auto-play">⏵ Play</button>
        <div class="dots"></div>
        <span class="step-count"></span>
      </div>`;
    const svg = $('svg', host);
    const cap = $('.stage-caption', host);
    const dots = $('.dots', host);
    const count = $('.step-count', host);
    const btnPlay = $('[data-a=play]', host);
    const steps = cfg.steps;
    let idx = 0, timer = null;

    // remember original text so reset can restore it
    $$('text[id], tspan[id]', svg).forEach(t => { t.dataset.orig = t.textContent; });

    const el = id => {
      const e = svg.querySelector('#' + CSS.escape(id));
      if (!e) console.warn('stepper: missing #' + id);
      return e;
    };
    const touched = new Set();
    const each = (ids, fn) => (Array.isArray(ids) ? ids : [ids]).forEach(id => { const e = el(id); if (e) fn(e); });
    const api = {
      svg, el,
      show: ids => each(ids, e => e.classList.add('on')),
      hide: ids => each(ids, e => e.classList.remove('on')),
      hl: ids => each(ids, e => e.classList.add('hl')),
      unhl: ids => each(ids, e => e.classList.remove('hl')),
      dim: ids => each(ids, e => e.classList.add('dim')),
      undim: ids => each(ids, e => e.classList.remove('dim')),
      pulse: ids => each(ids, e => e.classList.add('pulse')),
      move: (id, x, y) => each(id, e => { touched.add(e); e.style.transform = `translate(${x}px, ${y}px)`; }),
      text: (id, t) => each(id, e => { e.textContent = t; }),
      fill: (id, c) => each(id, e => { touched.add(e); e.style.fill = c; }),
      stroke: (id, c) => each(id, e => { touched.add(e); e.style.stroke = c; }),
    };

    function resetSvg() {
      $$('.on, .hl, .dim, .pulse', svg).forEach(e => e.classList.remove('on', 'hl', 'dim', 'pulse'));
      touched.forEach(e => { e.style.transform = ''; e.style.fill = ''; e.style.stroke = ''; });
      touched.clear();
      $$('[data-orig]', svg).forEach(t => { t.textContent = t.dataset.orig; });
    }

    function paint(i, animateLast) {
      host.classList.add('no-anim');
      resetSvg();
      for (let k = 0; k < i; k++) steps[k].do && steps[k].do(api);
      void svg.getBoundingClientRect(); // force reflow so the last step animates
      if (animateLast) host.classList.remove('no-anim');
      steps[i].do && steps[i].do(api);
      if (!animateLast) requestAnimationFrame(() => host.classList.remove('no-anim'));
      idx = i;
      cap.innerHTML = steps[i].caption || '';
      count.textContent = `Step ${i + 1} / ${steps.length}`;
      $$('span', dots).forEach((d, k) => d.classList.toggle('on', k === i));
      $('[data-a=prev]', host).disabled = i === 0;
      $('[data-a=next]', host).disabled = i === steps.length - 1;
    }

    function stop() { clearInterval(timer); timer = null; btnPlay.textContent = '⏵ Play'; }
    function play() {
      if (idx === steps.length - 1) paint(0, true);
      btnPlay.textContent = '⏸ Pause';
      timer = setInterval(() => {
        if (idx >= steps.length - 1) return stop();
        paint(idx + 1, true);
      }, cfg.autoplayMs || 2800);
    }

    dots.innerHTML = steps.map(() => '<span></span>').join('');
    $$('span', dots).forEach((d, k) => d.addEventListener('click', () => { stop(); paint(k, false); }));
    host.addEventListener('click', e => {
      const a = e.target.closest('[data-a]');
      if (!a) return;
      const act = a.dataset.a;
      if (act === 'play') return timer ? stop() : play();
      stop();
      if (act === 'next' && idx < steps.length - 1) paint(idx + 1, true);
      if (act === 'prev' && idx > 0) paint(idx - 1, false);
      if (act === 'reset') paint(0, false);
    });
    paint(0, false);
    return { goto: i => paint(i, true), stop };
  }

  // ---------- Quiz helper ----------
  /** questions: [{ q, opts: [..], a: index, why }] */
  function quiz(host, questions, onScore) {
    let answered = 0, right = 0;
    host.innerHTML = questions.map((qq, i) => `
      <div class="q" data-i="${i}">
        <div><b>Q${i + 1}.</b> ${qq.q}</div>
        <div class="opts">${qq.opts.map((o, j) => `<button class="opt" data-j="${j}">${o}</button>`).join('')}</div>
        <div class="why">${qq.why || ''}</div>
      </div>`).join('') + `<div class="card score-card"><span class="score">Score: 0 / ${questions.length}</span></div>`;
    host.addEventListener('click', e => {
      const b = e.target.closest('button.opt');
      if (!b) return;
      const box = b.closest('.q');
      if (box.classList.contains('answered')) return;
      const qq = questions[+box.dataset.i];
      const j = +b.dataset.j;
      box.classList.add('answered');
      $$('button.opt', box)[qq.a].classList.add('right');
      if (j !== qq.a) b.classList.add('wrong'); else right++;
      answered++;
      $('.score', host).textContent = `Score: ${right} / ${questions.length}` + (answered === questions.length ? (right / questions.length >= .8 ? '  🎉 Passed!' : '  — review and retry') : '');
      if (answered === questions.length && onScore) onScore(right, questions.length);
    });
  }

  // ---------- Tabs helper ----------
  function tabs(host) {
    const btns = $$('.tabs button', host), panes = $$('.tabpane', host);
    btns.forEach((b, i) => b.addEventListener('click', () => {
      btns.forEach((x, k) => x.classList.toggle('on', k === i));
      panes.forEach((x, k) => x.classList.toggle('on', k === i));
    }));
    if (btns[0]) btns[0].click();
  }

  // ---------- Router / shell ----------
  function register(lesson) { lessons.push(lesson); }

  function renderSidebar(activeId) {
    const nav = $('#sidebar');
    let html = '', lastSection = null;
    lessons.forEach((l, i) => {
      if (l.section && l.section !== lastSection) {
        html += `<div class="section-label">${esc(l.section)}</div>`;
        lastSection = l.section;
      }
      const cls = [l.id === activeId ? 'active' : '', state.done[l.id] ? 'done' : ''].join(' ');
      html += `<a href="#/${l.id}" class="${cls}"><span class="num">${state.done[l.id] ? '✓' : i + 1}</span><span>${esc(l.title)}</span></a>`;
    });
    nav.innerHTML = html;
    const pct = Math.round(100 * Object.keys(state.done).filter(k => lessons.some(l => l.id === k)).length / lessons.length);
    $('#progressBar').style.width = pct + '%';
    $('#progressText').textContent = pct + '%';
  }

  function markDone(id) { state.done[id] = true; save(state); renderSidebar(id); }

  function show(id) {
    const i = Math.max(0, lessons.findIndex(l => l.id === id));
    const l = lessons[i];
    const main = $('#content');
    const prev = lessons[i - 1], next = lessons[i + 1];
    main.innerHTML = `
      <div class="lesson-meta">Lesson ${i + 1} of ${lessons.length}${l.minutes ? ` · ~${l.minutes} min` : ''}${l.section ? ` · ${esc(l.section)}` : ''}</div>
      ${l.render()}
      <div class="lesson-nav">
        ${prev ? `<a class="btn" href="#/${prev.id}">◀ ${esc(prev.title)}</a>` : '<span></span>'}
        <button class="btn good" id="doneBtn">${state.done[l.id] ? '✓ Completed' : 'Mark lesson complete'}</button>
        ${next ? `<a class="btn primary" href="#/${next.id}">${esc(next.title)} ▶</a>` : '<span></span>'}
      </div>`;
    $('#doneBtn').addEventListener('click', () => { markDone(l.id); $('#doneBtn').textContent = '✓ Completed'; });
    try { l.mount && l.mount(main); } catch (e) { console.error(e); }
    renderSidebar(l.id);
    $('#sidebar').classList.remove('open');
    window.scrollTo(0, 0);
    main.focus({ preventScroll: true });
    document.title = `${l.title} · gPTP Automotive Course`;
  }

  function route() {
    const id = (location.hash.match(/^#\/(.+)$/) || [])[1];
    show(id || lessons[0].id);
  }

  // theme: 'light' | 'dark' | null (= follow the operating system)
  function applyTheme() {
    if (state.theme) document.documentElement.setAttribute('data-theme', state.theme);
    else document.documentElement.removeAttribute('data-theme');
    $$('[data-theme-set]').forEach(b => b.setAttribute('aria-pressed', String((b.dataset.themeSet === 'auto' ? null : b.dataset.themeSet) === state.theme)));
  }

  function start() {
    applyTheme();
    $$('[data-theme-set]').forEach(b => b.addEventListener('click', () => {
      state.theme = b.dataset.themeSet === 'auto' ? null : b.dataset.themeSet;
      save(state); applyTheme();
    }));
    $('#menuBtn').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
    window.addEventListener('hashchange', route);
    route();
  }

  window.Course = { register, start, stepper, quiz, tabs, markDone, esc, $, $$, lessons };
})();
