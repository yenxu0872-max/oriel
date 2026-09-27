/* oriel.ai website — shared by the home page and the models page. */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const gb = n => n >= 10 ? Math.round(n) + ' GB' : n >= 1 ? n.toFixed(1) + ' GB' : Math.round(n * 1000) + ' MB';
const month = ym => { if (!ym) return ''; const [y, m] = ym.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleString('en-GB', { month: 'short', year: 'numeric' }); };
const WEBLLM = v => `https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@${v}/+esm`;
const RAW = 'https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/';
const JSD = 'https://cdn.jsdelivr.net/gh/mlc-ai/binary-mlc-llm-libs@main/';
const BROWSE = !!$('#groups');
const S = { models: [], makers: {}, engine: {}, gpu: null, ram: 16, q: '', use: 'all', maker: null,
            browserOnly: false, fitsOnly: false, group: 'maker', sort: 'rec', have: {} };

const I = {   // line icons
  x: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  go: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  all: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12Z"/></svg>',
  code: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/></svg>',
  brain: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 6 1V6a2 2 0 0 0-3-2ZM15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-6 1"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>',
  globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/></svg>',
  box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8 12 3 3 8v8l9 5 9-5V8Z"/><path d="m3 8 9 5 9-5M12 13v8"/></svg>',
};
const USES = [
  { id: 'chat', label: 'Chat & writing', icon: I.chat, about: 'Everyday questions, emails, stories and explanations.', test: m => m.good.some(g => g === 'chat' || g === 'writing') },
  { id: 'coding', label: 'Coding', icon: I.code, about: 'Write, explain and fix code.', test: m => m.good.includes('coding') },
  { id: 'reasoning', label: 'Reasoning & maths', icon: I.brain, about: 'Puzzles, maths and careful step-by-step thinking.', test: m => m.good.some(g => g === 'reasoning' || g === 'maths') },
  { id: 'vision', label: 'Sees images', icon: I.eye, about: 'Describe photos, read screenshots and charts.', test: m => m.good.includes('vision') },
  { id: 'languages', label: 'Many languages', icon: I.globe, about: 'Chat and translate beyond English.', test: m => m.good.includes('languages') },
  { id: 'tiny', label: 'Tiny & fast', icon: I.bolt, about: 'Quick to download, and runs almost anywhere.', test: m => m.good.includes('tiny') },
];
const SIZES = [
  { id: 'xs', label: 'Tiny', about: 'Under 1 GB to download — quick, and fits almost anything.', max: 1 },
  { id: 's', label: 'Small', about: '1 to 3 GB — the sweet spot for most laptops.', max: 3 },
  { id: 'm', label: 'Medium', about: '3 to 6 GB — smarter, and needs a newer computer.', max: 6 },
  { id: 'l', label: 'Large', about: '6 to 15 GB — for computers with 16 GB of memory or more.', max: 15 },
  { id: 'xl', label: 'Huge', about: 'Over 15 GB — for powerful computers only.', max: Infinity },
];
const PROMPTS = {
  chat: ['Write a friendly email inviting my class to a study group', 'Explain how vaccines work, in simple words'],
  writing: ['Write a short story about a lighthouse keeper who finds a message in a bottle'],
  coding: ['Write a Python function that checks whether a word is a palindrome', 'Explain what a JavaScript promise is, with a small example'],
  reasoning: ['A bat and a ball cost $1.10 in total. The bat costs $1 more than the ball. How much is the ball?'],
  maths: ['Solve 3x + 7 = 25 and show each step'],
  vision: ['Describe a photo in detail — attach one with the + button', 'Read the text in a screenshot — attach one with the + button'],
  languages: ['Translate “Where is the train station?” into Malay, French and Japanese'],
  tiny: ['Give me three fun facts about space'],
};
const PICK_ORDER = ['Best in the browser', 'Best for older computers', 'Best for coding', 'Best to download'];
/* Each maker's own colours, taken from its logo, for its section's gradient. */
const BRAND = {
  'meta-llama': ['#0a6cff', '#00a2ff'], google: ['#4285f4', '#ea4335'], Qwen: ['#615ced', '#3b82f6'],
  microsoft: ['#f25022', '#00a4ef'], mistralai: ['#fa520f', '#ffaf00'], 'deepseek-ai': ['#4d6bfe', '#6f8bff'],
  openai: ['#10a37f', '#0f766e'], HuggingFaceTB: ['#ffb800', '#ff7a00'], NousResearch: ['#64748b', '#94a3b8'],
};
const NEUTRAL = ['#7c5cff', '#0ea5e9'];
const brand = org => BRAND[org] || NEUTRAL;

/* ---------------------------------------------------------------- floating logos */
/* The AI makers' logos floating around the whole page, like the book covers on
   Deepstash: big and sharp up front, smaller and softer further back, always
   behind the text. The ones beside the title rise away a little faster than the
   page as you scroll; the ones peeking in from the sides go all the way down and
   drift slower than the page, so they seem to float behind it. Each one also
   bobs on its own (site.css). ChatGPT and Claude are here for recognition only —
   they run in the cloud and aren't in the catalog (the footer says so). */
const EXTRA = { chatgpt: { logo: 'logos/openai.webp', dark: true }, claude: { logo: 'logos/claude.svg' } };
/* beside the title: [logo, side, gap from the text in px, how far down the hero (0–1), size, tilt, depth,
   on a phone: [how far across (0–1), px down the hero, size] — or nothing to leave it out] */
const HERO_HOME = [
  ['chatgpt', -1, 34, .2, 104, -8, 'near', [.13, 30, 54]],
  ['google', -1, 150, .5, 70, 10, 'far', [.33, 82, 38]],
  ['microsoft', -1, 44, .8, 112, 7, 'mid'],
  ['claude', 1, 34, .17, 108, 9, 'near', [.87, 26, 56]],
  ['NousResearch', 1, 150, .47, 70, -9, 'mid', [.67, 86, 36]],
  ['HuggingFaceTB', 1, 48, .79, 110, -6, 'mid', [.5, 18, 46]],
];
const HERO_BROWSE = [
  ['chatgpt', -1, 50, .28, 92, -8, 'near', [.14, 22, 48]],
  ['google', -1, 170, .64, 60, 9, 'far', [.36, 66, 34]],
  ['claude', 1, 50, .24, 96, 9, 'near', [.86, 18, 50]],
  ['microsoft', 1, 172, .62, 58, -8, 'far', [.64, 70, 32]],
];
/* down the sides, taking turns left and right, in this order */
const EDGE_LOGOS = ['meta-llama', 'mistralai', 'Qwen', 'deepseek-ai', 'openai', 'google', 'claude', 'HuggingFaceTB', 'NousResearch', 'microsoft', 'chatgpt'];
const EDGE_DEPTHS = [['near', 'near'], ['far', 'mid'], ['mid', 'far']];   // [left, right] for each pair
const EDGE_SIZE = { near: 172, mid: 126, far: 92 };
const BEHIND = { near: .12, mid: .26, far: .42 };   // how much slower than the page the side logos drift
const LIFT = { near: .24, mid: .12, far: -.1 };     // how much faster than the page the title's logos rise
const FL = { hero: [], els: new Map(), tiles: [], y: 0, vh: 0, raf: 0, t: 0,
             still: matchMedia('(prefers-reduced-motion: reduce)').matches };

function floaters(hero) {
  if (!$('#floaters')) return;
  FL.hero = hero;
  FL.y = scrollY;
  relayout();
  addEventListener('scroll', () => { if (!FL.raf) FL.raf = requestAnimationFrame(glide); }, { passive: true });
  addEventListener('resize', relayout);
  new ResizeObserver(relayout).observe(document.body);   // the Browse page grows and shrinks as you filter
}
function relayout() { requestAnimationFrame(() => { layoutFloaters(); paintFloaters(); }); }
function glide(now) {   // ease towards the scroll position, so the logos float rather than jump
  const to = scrollY, dt = FL.t ? Math.min(64, now - FL.t) : 16.7;
  FL.t = now;
  FL.y = FL.still || Math.abs(to - FL.y) < .5 ? to : FL.y + (to - FL.y) * (1 - Math.pow(.86, dt / 16.7));
  paintFloaters();
  if (FL.y === to) { FL.raf = 0; FL.t = 0; } else FL.raf = requestAnimationFrame(glide);
}
function layoutFloaters() {
  const layer = $('#floaters'), hero = $('.hero'), inner = $('.hero-inner');
  const vw = document.documentElement.clientWidth, vh = innerHeight, phone = vw <= 860;
  const hr = hero.getBoundingClientRect(), ir = inner.getBoundingClientRect(), top = hr.top + scrollY;
  const wrap = $('main > .wrap, main > :not(.hero) .wrap');
  const gutter = wrap ? wrap.getBoundingClientRect().left + parseFloat(getComputedStyle(wrap).paddingLeft) : 16;
  const k = phone ? .5 : Math.min(1, Math.max(.72, vw / 1440));
  const tiles = [];
  FL.hero.forEach(([logo, side, gap, down, size, tilt, depth, ph], i) => {
    if (phone && !ph) return;
    const s = phone ? ph[2] : size * k;
    tiles.push({ id: 'h' + i, logo, depth, size: s, tilt, hero: true, lift: FL.still ? 0 : LIFT[depth],
      x: phone ? ph[0] * vw - s / 2 : side < 0 ? ir.left - gap * k - s : ir.right + gap * k,
      D: top + (phone ? ph[1] + s / 2 : down * hr.height) });
  });
  const docH = document.documentElement.scrollHeight;
  for (let j = 0; 140 + j * 560 < docH - 60; j++) for (const side of [-1, 1]) {
    const i = j * 2 + (side > 0), depth = EDGE_DEPTHS[j % 3][side > 0 ? 1 : 0];
    const s = EDGE_SIZE[depth] * k * (1 + ((i * 7) % 5 - 2) * .05);
    // how much of it peeks in: never far over the content
    const show = Math.min(s * (depth === 'far' ? .7 : .6), Math.max(gutter + (phone ? 8 : 24), s * .3));
    tiles.push({ id: 'e' + i, logo: EDGE_LOGOS[i % EDGE_LOGOS.length], depth, size: s,
      tilt: side * (j % 2 ? -1 : 1) * (6 + (i * 5) % 7), p: FL.still ? 0 : BEHIND[depth],
      x: side < 0 ? show - s : vw - show, D: 140 + j * 560 + (side > 0 ? 120 : 0) });
  }
  const keep = new Set();
  tiles.forEach((t, n) => {
    const src = EXTRA[t.logo]?.logo || S.makers[t.logo]?.logo;
    if (!src) return;
    let el = FL.els.get(t.id);
    if (!el) {
      el = document.createElement('span');
      el.innerHTML = '<span><img alt=""></span>';
      el.style.setProperty('--d', (9 + (n * 1.7) % 5).toFixed(1) + 's');
      el.style.setProperty('--delay', -(n * 1.3).toFixed(1) + 's');
      layer.append(el); FL.els.set(t.id, el);
    }
    el.className = `fl ${t.depth}${EXTRA[t.logo]?.dark ? ' dark' : ''}`;
    el.style.setProperty('--s', t.size.toFixed(1) + 'px');
    const img = el.firstChild.firstChild;
    if (img.getAttribute('src') !== src) img.src = src;
    Object.assign(t, { el, on: null });
    keep.add(t.id);
  });
  for (const [id, el] of FL.els) if (!keep.has(id)) { el.remove(); FL.els.delete(id); }
  FL.tiles = tiles.filter(t => t.el);
  FL.vh = vh;
}
function paintFloaters() {
  const s = FL.y, vh = FL.vh;
  for (const t of FL.tiles) {
    const mid = t.hero ? t.D - s * (1 + t.lift) : t.D - s + t.p * (s + vh / 2 - t.D);
    const y = mid - t.size / 2, on = y < vh + 40 && y > -t.size - 60;
    if (on !== t.on) { t.el.style.visibility = on ? 'visible' : 'hidden'; t.on = on; }
    if (on) t.el.style.transform = `translate3d(${t.x.toFixed(1)}px,${y.toFixed(1)}px,0) rotate(${t.tilt}deg)`;
  }
}

/* ---------------------------------------------------------------- device */
function guessRam() {
  try { const r = +localStorage.getItem('oriel-ram'); if (r) return r; } catch (e) {}
  if (/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)) return 4;
  const dm = navigator.deviceMemory;          // Chrome only, and never above 8
  return dm && dm < 8 ? 8 : 16;
}
async function checkGpu() {
  if (!navigator.gpu) return { ok: false, why: "This browser can't run models itself — use recent Chrome, Edge or Safari 26+, or download a model instead." };
  try {
    const a = await navigator.gpu.requestAdapter();
    if (!a) return { ok: false, why: 'No graphics chip is available to this browser — try Chrome or Edge.' };
    return { ok: true, f16: a.features.has('shader-f16') };
  } catch (e) { return { ok: false, why: 'WebGPU is switched off in this browser.' }; }
}
/* Which models are downloaded in this browser: WebLLM keeps each in Cache
   Storage ("webllm/model"); compare the stored pieces with its file list. */
async function scanDownloads() {
  const have = {};
  if (!('caches' in window)) return have;
  try {
    const cache = await caches.open('webllm/model');
    const byRepo = {};
    for (const k of await cache.keys()) {
      const m = k.url.match(/huggingface\.co\/mlc-ai\/([^/]+)\/resolve\/main\/(.+)$/);
      if (m) (byRepo[m[1]] ||= []).push(m[2]);
    }
    for (const [repo, files] of Object.entries(byRepo)) {
      const index = files.find(f => /(tensor|ndarray)-cache\.json$/.test(f));
      if (!index) continue;
      const res = await cache.match(`https://huggingface.co/mlc-ai/${repo}/resolve/main/${index}`);
      const need = new Set((await res.json()).records.map(r => r.dataPath));
      const got = files.filter(f => need.has(f)).length;
      if (!got) continue;                  // only the file list is left: nothing downloaded
      have[repo] = got >= need.size ? 'complete' : 'partial';
    }
  } catch (e) {}
  return have;
}
function renderDevice() {
  const st = $('#gpuStatus'); if (!st) return;
  const gpu = S.gpu;
  st.className = 'ds-status ' + (gpu.ok ? 'ok' : 'no');
  st.innerHTML = gpu.ok
    ? `<span class="dot"></span><div><b>This browser can run models</b><small>Models marked “Runs in your browser” work right here${gpu.f16 ? '' : ', except a few'}.</small></div>`
    : `<span class="dot"></span><div><b>This browser can't run models itself</b><small>${esc(gpu.why)}</small></div>`;
  document.querySelectorAll('#ramSeg button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.ram === S.ram)));
}

/* ---------------------------------------------------------------- facts */
const maker = m => S.makers[m.org] || { name: m.maker, family: '', logo: '' };
const size = m => m.browser ? m.browser.download_gb : m.ollama.download_gb;
const runsHere = m => !!m.browser && !!S.gpu?.ok && !(m.browser.f16 && !S.gpu.f16);
// Browser runs share memory with everything else open; Ollama uses it more
// efficiently. Both thresholds err towards "won't fit".
function fitOf(m, ram = S.ram) {
  if (m.browser && S.gpu?.ok && !(m.browser.f16 && !S.gpu.f16)) {
    const n = m.browser.needs_gb;
    return { level: n <= ram * 0.6 ? 'yes' : n <= ram * 0.8 ? 'tight' : 'no', needs: n };
  }
  const n = (m.ollama || m.browser).needs_gb;
  return { level: n <= ram * 0.75 ? 'yes' : n <= ram ? 'tight' : 'no', needs: n };
}
const FIT = { yes: 'Fits your computer', tight: 'Tight fit', no: 'Needs more memory' };
function primaryUse(m) {
  if (m.good.includes('tiny')) return 'tiny';
  if (m.good.includes('vision')) return 'vision';
  if (m.good[0] === 'coding') return 'coding';
  if (['reasoning', 'maths'].includes(m.good[0])) return 'reasoning';
  return 'chat';
}
const sizeBand = m => SIZES.find(b => size(m) < b.max);
function tagsOf(m) {
  const t = [];
  if (m.browser && S.have[m.browser.id] === 'complete') t.push('<span class="pill have">Downloaded</span>');
  else if (m.browser) t.push('<span class="pill browser">Runs in your browser</span>');
  else t.push('<span class="pill">Download</span>');
  if (m.good.includes('vision')) t.push('<span class="pill">Sees images</span>');
  if (m.good.includes('coding')) t.push('<span class="pill">Coding</span>');
  if (m.good.includes('reasoning')) t.push('<span class="pill">Thinks step by step</span>');
  if (m.good.includes('languages')) t.push('<span class="pill">Many languages</span>');
  if (m.licence.business === false) t.push('<span class="pill personal">Personal use only</span>');
  return t.join('');
}

/* ---------------------------------------------------------------- models page */
function visible() {
  const q = S.q.trim().toLowerCase();
  const use = USES.find(u => u.id === S.use);
  return S.models.filter(m => {
    if (use && !use.test(m)) return false;
    if (S.browserOnly && !m.browser) return false;
    if (S.maker && m.org !== S.maker) return false;
    if (S.fitsOnly && fitOf(m).level === 'no') return false;
    if (!q) return true;
    const mk = maker(m);
    return [m.name, mk.name, mk.family, m.blurb, m.params, ...m.good, ...USES.filter(u => u.test(m)).map(u => u.label), m.ollama?.tag || '']
      .join(' ').toLowerCase().includes(q);
  });
}
function sorted(list) {
  const by = {
    rec: (a, b) => (!!b.browser - !!a.browser) || (!!b.pick - !!a.pick) || size(a) - size(b),
    small: (a, b) => size(a) - size(b),
    large: (a, b) => size(b) - size(a),
    new: (a, b) => (b.released || '').localeCompare(a.released || ''),
  }[S.sort];
  return [...list].sort(by);
}
function groupsOf(list) {
  if (S.group === 'use') return USES.map(u => ({ title: esc(u.label), about: u.about, icon: u.icon, colors: NEUTRAL, items: list.filter(m => primaryUse(m) === u.id) }));
  if (S.group === 'size') return SIZES.map(b => ({ title: esc(b.label), about: b.about, icon: I.box, colors: NEUTRAL, items: list.filter(m => sizeBand(m) === b) }));
  return Object.entries(S.makers).map(([org, mk]) => ({ title: `${esc(mk.name)} <span>· ${esc(mk.family)}</span>`, about: mk.about, logo: mk.logo, colors: brand(org), items: list.filter(m => m.org === org) }));
}
const filtersActive = () => !!(S.q.trim() || S.use !== 'all' || S.maker || S.browserOnly || S.fitsOnly);
function row(m) {
  const f = fitOf(m), mk = maker(m);
  const here = m.browser && S.have[m.browser.id] === 'complete';
  const where = here ? '<span class="where have">On this device</span>' : m.browser ? '<span class="where">Runs in your browser</span>' : '<span class="where dl">Download</span>';
  return `<article class="row" data-open="${m.id}" tabindex="0" aria-label="${esc(m.name)}">
    <img src="${mk.logo}" alt="${esc(mk.name)}" width="44" height="44" loading="lazy">
    <div class="row-main">
      <div class="row-name">${esc(m.name)}<span class="params">${esc(m.params.split(' · ')[0])}</span></div>
      <div class="row-desc">${esc(m.blurb)}</div>
      <div class="row-meta">${where}<span class="sep"></span><span>${gb(size(m))}</span><span class="sep"></span><span class="fit ${f.level}"><i></i>${FIT[f.level]}</span></div>
    </div>
    ${runsHere(m) ? `<button class="btn btn-sm btn-soft" data-run="${m.id}">Run</button>` : `<button class="btn btn-sm" data-open="${m.id}">Get</button>`}
  </article>`;
}
function renderModels() {
  const list = sorted(visible());
  const groups = groupsOf(list).filter(g => g.items.length);
  $('#groups').innerHTML = groups.length ? groups.map(g => `
    <section class="maker-sec" aria-label="${esc(g.title.replace(/<[^>]+>/g, ''))}">
      <div class="banner" style="--c1:${g.colors[0]};--c2:${g.colors[1]}">
        ${g.logo ? `<img class="logo" src="${g.logo}" alt="" width="52" height="52">` : `<span class="ico">${g.icon}</span>`}
        <div><h2>${g.title}</h2><p>${esc(g.about)}</p></div>
        ${g.logo ? `<img class="wm" src="${g.logo}" alt="" aria-hidden="true">` : ''}
      </div>
      <div class="rows">${g.items.map(row).join('')}</div>
    </section>`).join('')
    : `<div class="empty">No models match all of that. ${S.fitsOnly ? 'Try switching off “Fits my computer”, or pick a bigger memory size.' : 'Try another search or fewer filters.'}<br><br><button class="btn btn-sm" id="emptyClear">Clear filters</button></div>`;
  $('#picksWrap').hidden = filtersActive();
  const picks = S.models.filter(m => m.pick).sort((a, b) => PICK_ORDER.indexOf(a.pick) - PICK_ORDER.indexOf(b.pick));
  $('#picks').innerHTML = picks.map(m => `<button class="pick" data-open="${m.id}" style="--c1:${brand(m.org)[0]}">
    <img class="logo" src="${maker(m).logo}" alt="" width="36" height="36"><span class="why">${esc(m.pick)}</span>
    <span class="nm">${esc(m.name)}</span><span class="sz">${esc(maker(m).name)} · ${gb(size(m))} · ${m.browser ? 'runs in your browser' : 'download'}</span>
    <img class="wm" src="${maker(m).logo}" alt="" aria-hidden="true"></button>`).join('');
  $('#useTabs').innerHTML = [{ id: 'all', label: 'All models', icon: I.all }, ...USES].map(u =>
    `<button class="utab" role="tab" data-use="${u.id}" aria-selected="${S.use === u.id}">${u.icon}${esc(u.label)}</button>`).join('')
    + (S.maker ? `<button class="utab" data-maker-clear aria-selected="true">Made by ${esc(S.makers[S.maker]?.name || S.maker)} ✕</button>` : '');
  $('#browserOnly').checked = S.browserOnly; $('#fitsOnly').checked = S.fitsOnly;
  $('#group').value = S.group; $('#sort').value = S.sort;
  $('#clearAll').hidden = !filtersActive();
  $('#qClear').hidden = !S.q;
  const url = new URLSearchParams();
  if (S.q.trim()) url.set('q', S.q.trim());
  if (S.maker) url.set('maker', S.maker);
  if (S.use !== 'all') url.set('use', S.use);
  history.replaceState(null, '', location.pathname + (url.toString() ? '?' + url : '') + location.hash);
}

/* ---------------------------------------------------------------- sheet */
function promptsFor(m) {
  const out = [];
  for (const g of m.good) for (const p of PROMPTS[g] || []) if (!out.includes(p)) out.push(p);
  return out.slice(0, 3);
}
function sheet(m) {
  const f = fitOf(m), mk = maker(m), b = m.browser, o = m.ollama, hereOk = runsHere(m);
  const yes = v => v ? 'Yes' : 'No';
  const specs = [
    ['Size', esc(m.params), 'parameters'],
    ['Released', esc(month(m.released) || '—'), 'on Hugging Face'],
    b ? ['In your browser', gb(b.download_gb), 'one-time download'] : ['In your browser', 'No', 'download it instead'],
    o ? ['With Ollama', gb(o.download_gb), 'on your computer'] : ['With Ollama', '—', 'not in Ollama'],
    ['Memory needed', `~${gb(f.needs)}`, `<span class="fit ${f.level}"><i></i>${FIT[f.level]}</span>`],
    ['Sees images', yes(m.good.includes('vision')), m.good.includes('vision') ? 'photos, screenshots' : 'text only'],
    ['Thinks first', yes(m.good.includes('reasoning')), m.good.includes('reasoning') ? 'step by step' : 'answers directly'],
    ['Licence', esc(m.licence.label), m.licence.business ? 'business OK' : m.licence.business === false ? 'personal use only' : 'see terms'],
  ].map(([k, v, s]) => `<div class="spec"><small>${k}</small><b>${v}</b><span>${s}</span></div>`).join('');
  const t = m.tested;
  const tested = t ? `<div class="tested-line">✓ Tested in Oriel on a ${esc(t.on)}${t.tokens_per_s ? ` — about ${Math.round(t.tokens_per_s * 0.75)} words a second` : ' — works'}</div>` : '';
  const prompts = b && hereOk ? `<div><p class="sec-title">Try asking</p><div class="prompts">${promptsFor(m).map(p =>
    `<button class="prompt" data-try="${esc(p)}" data-model="${m.id}"><span>${esc(p)}</span>${I.go}</button>`).join('')}</div></div>` : '';
  const here = b ? `
    <div class="way primary">
      <h3>Run it here, in Oriel</h3>
      <p>Chat with ${esc(m.name)} right in this browser. ${S.have[b.id] === 'complete' ? "It's already downloaded, so it starts in seconds." : `It downloads ${gb(b.download_gb)} once, then starts in seconds.`} <b>Nothing you type leaves your device.</b></p>
      ${hereOk ? `<button class="btn btn-brand" data-run="${m.id}">Run in Oriel</button>`
               : `<button class="btn" disabled>Run in Oriel</button><div class="warnbox">${esc(S.gpu && !S.gpu.ok ? S.gpu.why : 'This model needs a graphics feature (16-bit shaders) your browser doesn’t offer. Try Chrome or Edge, or download it below.')}</div>`}
      ${hereOk && f.level === 'no' ? `<div class="warnbox">It needs about ${gb(f.needs)} of memory — more than your computer has. It may fail to start or be very slow.</div>` : ''}
    </div>` : '';
  const hf = `https://huggingface.co/${m.hf.repo}`;
  const tabs = [
    o && { id: 'ollama', label: 'Ollama', body: `
      <ol class="howto">
        <li>Get the free Ollama app from <a href="https://ollama.com/download" target="_blank" rel="noopener">ollama.com/download</a> and open it.</li>
        <li>Open Terminal (Mac) or Command Prompt (Windows), paste this and press Return:
          <div class="cmd"><code>ollama run ${esc(o.tag)}</code><button data-copy="ollama run ${esc(o.tag)}">Copy</button></div></li>
        <li>It downloads ${gb(o.download_gb)} once, then you can chat right there. Next time the same command starts it instantly.</li>
      </ol>` },
    { id: 'lmstudio', label: 'LM Studio', body: `
      <ol class="howto">
        <li>Get the free LM Studio app from <a href="https://lmstudio.ai" target="_blank" rel="noopener">lmstudio.ai</a>.</li>
        <li>Open <b>Discover</b> (the magnifying glass) and search for <b>${esc(m.name)}</b>.</li>
        <li>Press <b>Download</b>, then start a chat with it.</li>
      </ol>` },
    { id: 'files', label: 'Original files', body: `
      <p class="note" style="margin:0 0 14px">The model's own page from ${esc(mk.name)}: the full files, the maker's notes and the licence.</p>
      <a class="btn" href="${hf}" target="_blank" rel="noopener">Open on Hugging Face ↗</a>
      ${m.hf.gated ? '<p class="note">Hugging Face asks you to sign in and accept the licence before downloading these files. The Ollama and Oriel downloads don’t need this.</p>' : ''}` },
  ].filter(Boolean);
  return `
    <div class="sheet-head"><img src="${mk.logo}" alt="${esc(mk.name)} logo" width="48" height="48">
      <div><h2 id="sheetTitle">${esc(m.name)}</h2><div class="by">by ${esc(mk.name)} · ${esc(mk.family)} family${m.pick ? ' · <b>' + esc(m.pick) + '</b>' : ''}</div></div>
      <button class="x-btn" data-close aria-label="Close">${I.x}</button></div>
    <div class="sheet-body">
      <p class="about">${esc(m.blurb)}</p>
      <div class="tags">${tagsOf(m)}</div>
      <div class="specs">${specs}</div>
      ${tested}
      ${prompts}
      ${here}
      <div class="way">
        <h3>Run it anywhere</h3>
        <p>Download ${esc(m.name)} to your computer and use it in any app that runs AI models.</p>
        <div class="tabs" role="tablist">${tabs.map((x, i) => `<button role="tab" aria-selected="${i === 0}" data-tab="${x.id}">${x.label}</button>`).join('')}</div>
        ${tabs.map((x, i) => `<div role="tabpanel" data-panel="${x.id}" ${i ? 'hidden' : ''}>${x.body}</div>`).join('')}
      </div>
      <p class="lic"><b>Licence:</b> ${esc(m.licence.label)} — ${esc(m.licence.meaning)} <a href="${hf}" target="_blank" rel="noopener">Read it</a></p>
    </div>`;
}
function openSheet(id) {
  const m = S.models.find(x => x.id === id); if (!m) return;
  if (!BROWSE) { location.href = 'models.html#model=' + id; return; }
  $('#sheetInner').innerHTML = sheet(m);
  const d = $('#sheet'); if (!d.open) d.showModal();
  $('#sheetInner').scrollTop = 0;
  history.replaceState(null, '', location.pathname + location.search + '#model=' + id);
}

/* ---------------------------------------------------------------- downloads */
async function refreshStored() {
  S.have = await scanDownloads();
  const mine = S.models.filter(m => m.browser && S.have[m.browser.id] === 'complete');
  const el = $('#stored'); if (!el) return;
  el.hidden = !mine.length;
  if (mine.length) $('#storedText').textContent = `${mine.length} model${mine.length > 1 ? 's' : ''} downloaded here · ${gb(mine.reduce((a, m) => a + m.browser.download_gb, 0))}`;
}
function manageView() {
  const mine = S.models.filter(m => m.browser && S.have[m.browser.id]);
  return `
    <div class="sheet-head"><div><h2 id="manageTitle">Models in this browser</h2><div class="by">Delete any you don't need to free up space.</div></div>
      <button class="x-btn" data-close aria-label="Close">${I.x}</button></div>
    <div class="sheet-body"><div class="mylist">${mine.length ? mine.map(m => `
      <div class="myrow"><img src="${maker(m).logo}" alt="" width="32" height="32"><span class="grow"><b>${esc(m.name)}</b><br><span style="color:var(--muted)">${gb(m.browser.download_gb)}${S.have[m.browser.id] === 'partial' ? ' · unfinished download' : ''}</span></span>
      <button class="btn btn-sm" data-run="${m.id}">Open</button><button class="btn btn-sm btn-soft" data-delete="${m.id}">Delete</button></div>`).join('')
      : '<p class="note">Nothing downloaded in this browser.</p>'}</div></div>`;
}
async function deleteModel(id) {
  const m = S.models.find(x => x.id === id);
  toast(`Deleting ${m.name}…`);
  try {
    const lib = await import(WEBLLM(S.engine.webllm));
    // the chat page fetches engine code from jsDelivr (see chat's fastAppConfig), so delete that copy
    const cfg = lib.prebuiltAppConfig;
    await lib.deleteModelAllInfoInCache(m.browser.id, { ...cfg, model_list: cfg.model_list.map(x => ({ ...x, model_lib: x.model_lib.replace(RAW, JSD) })) });
    // WebLLM's delete leaves the model's file list behind; remove every trace
    for (const name of ['webllm/model', 'webllm/config', 'webllm/wasm']) {
      const ch = await caches.open(name);
      for (const k of await ch.keys()) {
        if (k.url.includes('/' + m.browser.id + '/') || (name === 'webllm/wasm' && k.url.includes(m.browser.id.replace(/-MLC$/, '')))) await ch.delete(k);
      }
    }
  } catch (e) { toast("Couldn't delete it — try clearing this site's data in your browser settings"); return; }
  await refreshStored(); if (BROWSE) renderModels();
  $('#manageInner').innerHTML = manageView();
  toast(`Deleted ${m.name}`);
}

/* ---------------------------------------------------------------- home page */
function renderHome() {
  const makers = $('#makers');
  if (makers) makers.innerHTML = Object.entries(S.makers).map(([org, mk]) =>
    `<a class="maker-chip" href="models.html?maker=${encodeURIComponent(org)}"><img src="${mk.logo}" alt="" width="30" height="30">${esc(mk.name)}</a>`).join('');
}

/* ---------------------------------------------------------------- events */
let toastT;
function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2600); }
function run(id, prompt) { location.href = 'chat.html?model=' + encodeURIComponent(id) + (prompt ? '&prompt=' + encodeURIComponent(prompt) : ''); }

document.addEventListener('click', e => {
  const t = e.target.closest('[data-run],[data-open],[data-close],[data-copy],[data-tab],[data-delete],[data-use],[data-ram],[data-try],[data-maker-clear],#emptyClear,#clearAll,#qClear,#manageBtn,.nav-menu');
  if (!t) return;
  if (t.dataset.try) return run(t.dataset.model, t.dataset.try);
  if (t.dataset.run) { e.stopPropagation(); return run(t.dataset.run); }
  if (t.dataset.delete) return deleteModel(t.dataset.delete);
  if (t.dataset.copy) { navigator.clipboard?.writeText(t.dataset.copy); t.textContent = 'Copied'; setTimeout(() => (t.textContent = 'Copy'), 1400); return; }
  if (t.hasAttribute('data-close')) { t.closest('dialog').close(); return; }
  if (t.dataset.tab) {
    const box = t.closest('.way');
    box.querySelectorAll('[role=tab]').forEach(b => b.setAttribute('aria-selected', String(b === t)));
    box.querySelectorAll('[role=tabpanel]').forEach(p => (p.hidden = p.dataset.panel !== t.dataset.tab));
    return;
  }
  if (t.classList.contains('nav-menu')) { const d = $('.nav-drop'); d.classList.toggle('open'); t.setAttribute('aria-expanded', String(d.classList.contains('open'))); return; }
  if (t.id === 'manageBtn') { $('#manageInner').innerHTML = manageView(); $('#manage').showModal(); return; }
  if (t.dataset.ram) { S.ram = +t.dataset.ram; try { localStorage.setItem('oriel-ram', S.ram); } catch (e) {} renderDevice(); return BROWSE && renderModels(); }
  if (t.dataset.use) { S.use = t.dataset.use; return renderModels(); }
  if (t.hasAttribute('data-maker-clear')) { S.maker = null; return renderModels(); }
  if (t.id === 'qClear') { S.q = ''; $('#q').value = ''; $('#q').focus(); return renderModels(); }
  if (t.id === 'emptyClear' || t.id === 'clearAll') {
    Object.assign(S, { q: '', use: 'all', maker: null, browserOnly: false, fitsOnly: false }); $('#q').value = '';
    return renderModels();
  }
  if (t.dataset.open) return openSheet(t.dataset.open);
});
document.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.classList?.contains('row')) { e.preventDefault(); openSheet(e.target.dataset.open); }
});
for (const id of ['sheet', 'manage']) {
  const d = $('#' + id); if (!d) continue;
  d.addEventListener('click', e => { if (e.target === d) d.close(); });   // click outside the card
  d.addEventListener('close', () => { if (id === 'sheet') history.replaceState(null, '', location.pathname + location.search); });
}
if (BROWSE) {
  $('#q').addEventListener('input', e => { S.q = e.target.value; renderModels(); });
  $('#searchForm').addEventListener('submit', e => { e.preventDefault(); $('.tabs-bar')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  $('#browserOnly').addEventListener('change', e => { S.browserOnly = e.target.checked; renderModels(); });
  $('#fitsOnly').addEventListener('change', e => { S.fitsOnly = e.target.checked; renderModels(); });
  $('#group').addEventListener('change', e => { S.group = e.target.value; try { localStorage.setItem('oriel-group', S.group); } catch (x) {} renderModels(); });
  $('#sort').addEventListener('change', e => { S.sort = e.target.value; renderModels(); });
}

(async () => {
  S.ram = guessRam();
  const p = new URLSearchParams(location.search);
  S.q = p.get('q') || '';
  S.maker = p.get('maker');
  const use = p.get('use');
  if (use && USES.some(u => u.id === use)) S.use = use;
  try { const g = localStorage.getItem('oriel-group'); if (['maker', 'use', 'size'].includes(g)) S.group = g; } catch (e) {}
  if (BROWSE) $('#q').value = S.q;
  const [data, gpu] = await Promise.all([fetch('models.json', { cache: 'no-cache' }).then(r => r.json()), checkGpu()]);
  Object.assign(S, { models: data.models, makers: data.makers, engine: data.engine, gpu });
  if (S.maker && !S.makers[S.maker]) S.maker = null;
  if (!BROWSE) { renderHome(); floaters(HERO_HOME); return; }
  floaters(HERO_BROWSE);
  renderDevice();
  renderModels();
  await refreshStored();
  renderModels();
  const hash = location.hash.match(/model=([\w.-]+)/);
  if (hash) openSheet(hash[1]);
})();
