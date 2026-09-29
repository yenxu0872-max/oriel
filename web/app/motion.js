/* Oriel's page: scrolling tells the story. Every [data-scene] knows how far
   through it you are (0 to 1) — eased, so things glide after the scroll
   rather than jerk with it — and moves to match: the daylight dims, your
   messages pass through their servers, the facts stack up, the leaks roll
   by, a light grows back, and the laptop shows what Oriel does. [data-reveal]
   blocks rise in as they come up the screen. With "reduce motion" on, the
   page stays still and only the header follows. */
(() => {
  const root = document.documentElement;
  const moving = root.classList.contains('js');
  const nav = document.querySelector('.nav');
  const bar = nav.querySelector('.prog');
  const themeColor = document.querySelector('meta[name=theme-color]');
  const zones = [...document.querySelectorAll('main > section, footer')];
  const scenes = [...document.querySelectorAll('[data-scene]')];
  // a revealed block's own slide would feed back into where it is, so measure it where it rests:
  // its box minus the slide, or — for the floating messages at the end — the section they float in
  const reveals = [...document.querySelectorAll('[data-reveal]')].map(el => {
    const probe = el.matches('.orbit .ob') ? el.closest('section') : null;
    return { el, probe, delay: parseFloat(el.dataset.reveal) || 0, v: 0 };
  });
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const ease = t => 1 - Math.pow(1 - t, 3);
  const f = (n, d = 3) => n.toFixed(d);
  // how far through a pinned scene you are: 0 when it reaches the top, 1 when it lets go
  const through = el => {
    const r = el.getBoundingClientRect(), run = r.height - innerHeight;
    return run > 0 ? clamp(-r.top / run) : r.top <= 0 ? 1 : 0;
  };

  const scene = {
    // the question in daylight; the lights go down and what people typed drifts away
    hero: {
      init(s) {
        this.fl = $$('.fl', s).map(el => ({ el, d: parseFloat(el.style.getPropertyValue('--d')) || 1 }));
        this.q = $('.q', s); this.ans = $$('.ans p', s); this.cue = $('.cue', s);
      },
      measure() {
        for (const f of this.fl) { f.x = f.el.offsetLeft + f.el.offsetWidth / 2; f.y = f.el.offsetTop + f.el.offsetHeight / 2; }
      },
      draw(s, p) {
        const W = innerWidth, H = innerHeight;
        const dim = smooth(.12, .5, p);
        s.style.setProperty('--dim', f(dim));
        s.dataset.tone = dim > .55 ? 'night' : 'day';
        const pull = smooth(.28, .74, p), gone = smooth(.5, .74, p);
        for (const t of this.fl) {
          const dx = (W / 2 - t.x) * pull * .8;
          const dy = -p * .4 * H * t.d - pull * pull * (t.y + .35 * H);
          t.el.style.transform = `translate3d(${f(dx, 1)}px,${f(dy, 1)}px,0) scale(${f(t.d * (1 - .55 * pull))})`;
          t.el.style.opacity = f(1 - gone);
        }
        const out = smooth(.5, .68, p);
        this.q.style.transform = `translate3d(0,${f(-out * 70, 1)}px,0) scale(${f(1 - out * .06, 4)})`;
        this.q.style.opacity = f(1 - out);
        this.ans.forEach((a, i) => {
          const v = smooth(.66 + i * .1, .78 + i * .1, p);
          a.style.opacity = f(v);
          a.style.transform = `translate3d(0,${f((1 - v) * 30, 1)}px,0)`;
          a.style.filter = v > .99 ? '' : `blur(${f((1 - v) * 10, 1)}px)`;
        });
        this.cue.style.opacity = f(.6 * (1 - smooth(.01, .06, p)));
      },
    },

    // 01: two rows of messages slide through "their servers" and come out stamped
    belt: {
      init(s) {
        this.lane = $('.lane', s); this.gate = $('.gate', s);
        this.tracks = $$('.track', s).map((el, k) => ({ el, k, items: $$('.m', el).map(el => ({ el })) }));
        this.n = $('.tally .n', s); this.words = $('.tally .w1', s); this.count = -1;
      },
      measure() {
        this.W = this.lane.clientWidth; this.gx = this.W / 2; this.gh = this.gate.offsetWidth / 2;
        for (const t of this.tracks) {
          t.w = t.el.scrollWidth;
          for (const m of t.items) m.c = m.el.offsetLeft + m.el.offsetWidth / 2;
        }
      },
      draw(s, p) {
        let saved = 0;
        for (const t of this.tracks) {
          const start = this.W * (t.k ? .9 : .6), end = this.gx - t.w - 40;
          const x = start + (end - start) * p;
          t.el.style.transform = `translate3d(${f(x, 1)}px,0,0)`;
          for (const m of t.items) {
            const cx = x + m.c, done = cx < this.gx, scan = Math.abs(cx - this.gx) < this.gh;
            if (m.done !== done) m.el.classList.toggle('done', m.done = done);
            if (m.scan !== scan) m.el.classList.toggle('scan', m.scan = scan);
            if (done) saved++;
          }
        }
        if (saved !== this.count) {
          if (saved > this.count && this.count >= 0)
            this.n.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.3)', color: 'oklch(0.68 0.2 32)' }, { transform: 'scale(1)' }], { duration: 420, easing: 'ease-out' });
          this.count = saved;
          this.n.textContent = saved;
          this.words.textContent = `${saved === 1 ? 'message' : 'messages'} saved on their servers.`;
        }
      },
    },

    // 02: each fact slides up over the last; the ones underneath shrink back into a stack
    stack: {
      init(s) { this.cards = $$('.card', s); this.num = $('.count b', s); this.at = -1; },
      draw(s, p) {
        const n = this.cards.length, u = clamp(p * 1.1) * (n - 1);
        this.cards.forEach((c, i) => {
          const enter = i === 0 ? 1 : ease(clamp(u - (i - 1)));
          const back = clamp(u - i, 0, 3);
          c.style.transform = `translate3d(0,${f((1 - enter) * 110 - back * 3.4, 2)}vh,0) scale(${f(1 - back * .05, 4)})`;
          c.style.setProperty('--shade', f(Math.min(back, 2) * .3));
          const on = enter > .5 && back < .5;
          if (c._on !== on) c.classList.toggle('on', c._on = on);
        });
        const at = Math.min(n - 1, Math.round(u));
        if (at !== this.at) this.num.textContent = (this.at = at) + 1;
      },
    },

    // 03: the incidents roll sideways; the date on the line below keeps up
    leaks: {
      init(s) {
        this.row = $('.row', s); this.axis = $('.years .axis', s); this.done = $('.years .done', s); this.dot = $('.years .dot', s);
        this.cards = $$('.lk', s).map(el => ({ el, box: $('.lk-in', el), when: parseFloat(el.dataset.when), big: $('.big[data-to]', el) }));
        // big numbers count up as their card slides in; the real figure stays for screen readers
        for (const c of this.cards) if (c.big) {
          const final = c.big.textContent;
          Object.assign(c, { to: +c.big.dataset.to, pre: c.big.dataset.pre || '', post: c.big.dataset.post || '', v: -1 });
          c.big.innerHTML = `<span class="sr">${final}</span><span aria-hidden="true">${final}</span>`;
          c.num = c.big.lastChild;
        }
      },
      measure(s) {
        const pad = parseFloat(getComputedStyle(this.row).paddingLeft) || 24;
        const last = this.cards[this.cards.length - 1].el;
        this.over = Math.max(0, last.offsetLeft + last.offsetWidth + pad - innerWidth);
        s.style.height = `${Math.round(innerHeight * 1.5 + this.over)}px`;
        for (const c of this.cards) { c.w = c.el.offsetWidth; c.mid = c.el.offsetLeft + c.w / 2; }
        this.aw = this.axis.offsetWidth;
      },
      draw(s, p) {
        const q = smooth(.08, .92, p), x = -q * this.over, W = innerWidth;
        this.row.style.transform = `translate3d(${f(x, 1)}px,0,0)`;
        for (const c of this.cards) {
          const d = (c.mid + x - W / 2) / W, a = Math.min(1, Math.abs(d) * 1.25);
          c.box.style.transform = `translate3d(0,${f(a * 26, 1)}px,0) scale(${f(1 - a * .06, 4)}) rotate(${f(d * 2.5, 2)}deg)`;
          c.box.style.opacity = f(1 - a * .45);
          if (c.big) {
            const v = Math.round(c.to * ease(clamp((W * .96 - (c.mid + x - c.w / 2)) / (W * .42))));
            if (v !== c.v) { c.v = v; c.num.textContent = c.pre + v.toLocaleString('en-US') + c.post; }
          }
        }
        const k = q * (this.cards.length - 1), i = Math.min(this.cards.length - 2, Math.floor(k));
        const when = this.cards[i].when + (this.cards[i + 1].when - this.cards[i].when) * (k - i);
        const at = when <= 2026 ? (when - 2023) * .25 : .75 + (when - 2026) / .75 * .25;
        this.done.style.transform = `scaleX(${f(at, 4)})`;
        this.dot.style.transform = `translate3d(${f(at * this.aw, 1)}px,0,0)`;
      },
    },

    // 03: the profile fills in, the ads arrive, then the switch that won't move
    prof: {
      init(s) {
        this.gets = $$('.get', s); this.pips = $$('.pips i', s);
        this.facts = $$('.dz-facts li', s); this.ads = $$('.dz-ads .ad', s); this.at = -1;
      },
      draw(s, p) {
        const n = this.gets.length, u = clamp(p / .95) * n;
        const at = Math.min(n - 1, Math.floor(u)), local = clamp(u - at);
        if (at !== this.at) {
          this.at = at; s.dataset.at = at;
          this.gets.forEach((g, i) => { g.classList.toggle('on', i === at); g.classList.toggle('past', i < at); });
        }
        this.pips.forEach((pip, i) => pip.style.setProperty('--f', i < at ? 1 : i === at ? f(local) : 0));
        const facts = at > 0 ? this.facts.length : Math.ceil(clamp(local * 1.3) * this.facts.length);
        const ads = at > 1 ? this.ads.length : at < 1 ? 0 : Math.ceil(clamp(local * 1.6 - .1) * this.ads.length);
        this.facts.forEach((li, i) => { li.classList.toggle('on', i < facts); li.classList.toggle('hit', at === 1 && i < ads); });
        this.ads.forEach((ad, i) => ad.classList.toggle('on', i < ads));
      },
    },

    // a small light, then a zoom right through it into daylight
    turn: {
      init(s) { this.core = $('.core', s); this.rings = $$('.rings i', s); this.pre = $('.pre', s); this.say = $('.say', s); },
      measure() {
        const r = this.core.offsetWidth / 2;
        this.max = Math.hypot(innerWidth, innerHeight) / 2 / (r * .42) * 1.08;
      },
      draw(s, p) {
        const inn = smooth(.03, .16, p), z = smooth(.32, .7, p);
        this.pre.style.opacity = f(inn * (1 - smooth(.3, .42, p)));
        this.pre.style.transform = `translate3d(0,${f((1 - inn) * 24, 1)}px,0)`;
        this.core.style.transform = `scale(${f(Math.pow(this.max, z))})`;
        this.rings.forEach((r, k) => {
          r.style.transform = `rotate(${f(p * (k % 2 ? -240 : 280) + k * 40, 1)}deg) scale(${f(1 + z * (2.5 + k * 2.2))})`;
          r.style.opacity = f(1 - smooth(.36, .58, p));
        });
        s.classList.toggle('bright', z > .97);
        s.dataset.tone = z > .55 ? 'day' : 'night';
        const say = smooth(.7, .86, p);
        this.say.style.opacity = f(say);
        this.say.style.transform = `translate3d(0,${f((1 - say) * 40, 1)}px,0) scale(${f(.96 + say * .04, 4)})`;
      },
    },

    // the laptop: one step per feature; the chat grows, the Wi-Fi goes off, a picture paints itself
    lap: {
      init(s) {
        this.gets = $$('.get', s); this.badges = $$('.badge', s); this.pips = $$('.pips i', s);
        this.items = $$('.thread [data-k]', s).map(el => ({ el, k: +el.dataset.k }));
        this.thread = $('.thread', s); this.view = $('.view', s); this.net = $('.net', s);
        this.img = $('.pic img', s); this.stp = $('.stp', s); this.at = -1; this.paint = -1;
      },
      measure() { this.vh = this.view.clientHeight; this.fit(); },
      // keep the newest message just above the input bar, like a real chat
      fit() {
        const shown = this.items.filter(m => m.k <= this.at), last = shown[shown.length - 1];
        if (!last) return;
        const bottom = last.el.offsetTop + last.el.offsetHeight + 16;
        this.thread.style.transform = `translate3d(0,${this.vh - bottom}px,0)`;
      },
      draw(s, p) {
        const n = this.gets.length, u = clamp(p / .95) * n;
        const at = Math.min(n - 1, Math.floor(u)), local = clamp(u - at);
        if (at !== this.at) {
          this.at = at; s.dataset.at = at;
          this.gets.forEach((g, i) => { g.classList.toggle('on', i === at); g.classList.toggle('past', i < at); });
          this.badges.forEach((b, i) => b.classList.toggle('on', i === at));
          this.items.forEach(m => m.el.classList.toggle('shown', m.k <= at));
          s.classList.toggle('offline', at >= 1);
          this.fit();
          // the meter blinks at every step — and still says 0 bytes
          this.net.animate([{ background: 'oklch(0.9 0.08 150)' }, { background: '#f5f5f7' }], { duration: 700, easing: 'ease-out' });
        }
        this.pips.forEach((pip, i) => pip.style.setProperty('--f', i < at ? 1 : i === at ? f(local) : 0));
        const paint = at < 4 ? 0 : at > 4 ? 1 : clamp(local * 1.4);
        if (paint !== this.paint) {
          this.paint = paint;
          this.stp.textContent = Math.max(1, Math.ceil(paint * 9));
          this.img.style.filter = paint >= 1 ? '' : `blur(${f((1 - paint) * 16, 1)}px) saturate(${f(.35 + paint * .65, 2)})`;
          this.img.style.opacity = f(.2 + paint * .8);
          s.classList.toggle('painted', paint >= 1);
        }
      },
    },

    // the words light up one at a time
    lines: {
      init(s) { this.words = $$('.lit span', s); },
      draw(s, p) {
        const lit = Math.round(clamp((p - .08) / .72) * this.words.length);
        this.words.forEach((w, i) => w.classList.toggle('on', i < lit));
      },
    },
  };

  // odometers: each digit is a strip of 0–9 twice over that rolls to its number
  function odometers() {
    for (const el of $$('.odo')) {
      const to = el.dataset.to;
      el.innerHTML = `<span class="sr">${to}</span>`;
      el._cols = [...to].map(ch => {
        const col = document.createElement('span');
        col.className = 'col'; col.setAttribute('aria-hidden', 'true');
        col.innerHTML = Array.from({ length: 20 }, (_, j) => `<span>${j % 10}</span>`).join('');
        el.appendChild(col);
        return { col, end: 10 + +ch };
      });
      const r = reveals.find(r => r.el.contains(el));
      if (r) (r.odos ||= []).push(el);
    }
  }
  function roll(odos, v) {
    for (const el of odos) el._cols.forEach((c, i) => {
      const t = ease(clamp(v * 1.5 - .35 - i * .12));
      c.col.style.transform = `translate3d(0,${f(-c.end * t, 4)}em,0)`;
    });
  }

  // ------------------------------------------------------------ chapter rail
  // one dot per [data-chapter]; hover shows the names, a click jumps to the start of that chapter
  const chapters = $$('[data-chapter]'), rail = $('.rail');
  let railAt = -1, railTone = '';
  if (rail) {
    rail.innerHTML = chapters.map((c, i) => `<button type="button" data-i="${i}"><span>${c.dataset.chapter}</span><i aria-hidden="true"></i></button>`).join('');
    rail.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (b) scrollTo({ top: chapters[+b.dataset.i].getBoundingClientRect().top + scrollY + 2, behavior: moving ? 'smooth' : 'auto' });
    });
  }
  const railButtons = rail ? [...rail.children] : [];
  const drifts = $$('[data-drift]');   // rows that slide sideways as they pass up the screen

  // ------------------------------------------------------------ "will it run on my computer?"
  // everything is read from this browser; nothing is sent anywhere
  const checkBtn = $('#check-run');
  checkBtn?.addEventListener('click', async () => {
    const rows = Object.fromEntries($$('.ck-r li').map(li => [li.dataset.k, li]));
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const set = (k, state, text) => {
      const li = rows[k];
      li.className = (k === 'pick' ? 'pick ' : '') + state;
      li.querySelector('b').textContent = text;
      if (state !== 'busy') { li.classList.remove('fresh'); void li.offsetWidth; li.classList.add('fresh'); }
    };
    checkBtn.disabled = true; checkBtn.textContent = 'Checking…';
    for (const k in rows) set(k, 'busy', 'Checking…');
    await wait(300);
    let adapter = null;
    try { adapter = navigator.gpu ? await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' }) : null; } catch {}
    const vendor = { apple: 'Apple', nvidia: 'NVIDIA', amd: 'AMD', intel: 'Intel', qualcomm: 'Qualcomm', arm: 'Arm' }[(adapter?.info?.vendor || '').toLowerCase()];
    if (adapter) set('gpu', 'ok', vendor ? `Ready · ${vendor} graphics` : 'Ready');
    else set('gpu', 'bad', navigator.gpu ? 'No usable graphics chip found' : 'This browser can’t run it yet');
    await wait(280);
    const mem = navigator.deviceMemory;   // Chrome and Edge only, and never above 8
    if (!mem) set('mem', 'warn', 'Your browser doesn’t say');
    else set('mem', mem >= 8 ? 'ok' : mem >= 4 ? 'warn' : 'bad', mem >= 8 ? '8 GB or more' : `About ${mem} GB`);
    await wait(280);
    let room = null;
    try { const e = await navigator.storage.estimate(); room = (e.quota - e.usage) / 1e9; } catch {}
    if (room == null) set('disk', 'warn', 'Your browser doesn’t say');
    else set('disk', room > 3 ? 'ok' : room > 1 ? 'warn' : 'bad', room > 50 ? 'Plenty' : `About ${room.toFixed(room < 10 ? 1 : 0)} GB`);
    await wait(280);
    if (!adapter) set('pick', 'bad', 'Try Chrome, Edge or Safari 26');
    else if (!mem || mem >= 8) set('pick', 'ok', 'Qwen3 4B · 2.3 GB download');
    else if (mem >= 4) set('pick', 'ok', 'Llama 3.2 1B · 0.7 GB download');
    else set('pick', 'warn', 'SmolLM2 360M · 0.2 GB download');
    checkBtn.disabled = false; checkBtn.textContent = 'Check again';
  });

  // ------------------------------------------------------------ the loop
  const FOLLOW = .14;           // how quickly a scene catches up with the scroll, per 60 Hz frame
  const live = scenes.filter(s => scene[s.dataset.scene]).map(s => {
    const h = Object.create(scene[s.dataset.scene]);
    return { s, h, p: 0, drawn: -1 };
  });
  let queued = false, last = 0, tone = '', first = true;

  function measure() {
    if (!moving) return;
    for (const l of live) l.h.measure?.(l.s);
    for (const l of live) l.drawn = -1;
  }

  function frame(now) {
    queued = false;
    const dt = last ? Math.min(64, now - last) : 16.7; last = now;
    const k = first ? 1 : 1 - Math.pow(1 - FOLLOW, dt / 16.7);
    first = false;
    // read everything first…
    const targets = moving ? live.map(l => through(l.s)) : [];
    const tops = moving ? reveals.map(r => r.probe ? r.probe.getBoundingClientRect().top : r.el.getBoundingClientRect().top - (1 - r.v) * 44) : [];
    const under = zones.find(z => { const r = z.getBoundingClientRect(); return r.top <= 28 && r.bottom > 28; });
    const mid = zones.find(z => { const r = z.getBoundingClientRect(); return r.top <= innerHeight / 2 && r.bottom > innerHeight / 2; });
    const driftBoxes = moving ? drifts.map(el => el.getBoundingClientRect()) : [];
    let chapter = -1;
    chapters.forEach((c, i) => { if (c.getBoundingClientRect().top <= innerHeight * .4) chapter = i; });
    const max = root.scrollHeight - innerHeight;
    // …then write
    let busy = false;
    if (moving) live.forEach((l, i) => {
      const t = targets[i], d = t - l.p;
      l.p = Math.abs(d) < 4e-4 ? t : l.p + d * k;
      if (l.p !== t) busy = true;
      if (l.p !== l.drawn) { l.h.draw(l.s, l.p); l.drawn = l.p; }
    });
    const H = innerHeight;
    if (moving) reveals.forEach((r, i) => {
      const v = Math.round(clamp((H * .96 - tops[i]) / (H * .34) - r.delay) * 1000) / 1000;
      if (v === r.v && r.set) return;
      r.v = v; r.set = true;
      r.el.style.setProperty('--v', v);
      if (r.odos) roll(r.odos, v);
    });
    if (moving) drifts.forEach((el, i) => el.style.setProperty('--pos', f(clamp((H - driftBoxes[i].top) / (H + driftBoxes[i].height)))));
    bar.style.transform = `scaleX(${f(max > 0 ? clamp(scrollY / max) : 0, 4)})`;
    if (chapter !== railAt) {
      railButtons.forEach((b, i) => { b.classList.toggle('on', i === chapter); b.toggleAttribute('aria-current', i === chapter); });
      railAt = chapter;
    }
    const t = under?.dataset.tone || 'day';
    if (t !== tone) { tone = t; nav.dataset.tone = t; themeColor.content = t === 'night' ? '#050507' : '#ffffff'; }
    // the rail sits mid-screen, so it follows the scene there rather than the one under the header
    const rt = mid?.dataset.tone || 'day';
    if (rail && rt !== railTone) { railTone = rt; rail.dataset.tone = rt; }
    if (busy) ask();
  }
  const ask = () => { if (!queued) { queued = true; requestAnimationFrame(frame); } };

  if (!moving) $('.turn')?.setAttribute('data-tone', 'day');   // the still page shows it already in daylight
  if (moving) {
    for (const l of live) l.h.init(l.s);
    odometers();
    root.classList.add('motion');
  }
  measure();
  addEventListener('scroll', ask, { passive: true });
  let resizing;
  addEventListener('resize', () => { clearTimeout(resizing); resizing = setTimeout(() => { measure(); first = true; ask(); }, 120); ask(); });
  document.fonts?.ready.then(() => { measure(); ask(); });
  addEventListener('load', () => { measure(); ask(); });
  ask();
})();
