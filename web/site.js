/* Oriel Models — the model finder: the home page and the Browse page. */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const gb = n => n >= 100 ? Math.round(n) + ' GB' : n >= 10 ? Math.round(n) + ' GB' : n >= 1 ? n.toFixed(1) + ' GB' : Math.max(1, Math.round(n * 1000)) + ' MB';
const month = ym => { if (!ym) return ''; const [y, m] = ym.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleString('en-GB', { month: 'short', year: 'numeric' }); };
const short = n => n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + 'K' : String(Math.round(n));
const APP = 'app/';               // the Oriel app: chat, code and images in your browser
const BROWSE = !!$('#groups');
const PAGE = 40;
const S = { models: [], makers: {}, gpu: null, ram: 16, q: '', kind: 'all', maker: null, oriel: false, fits: false,
            official: false, from: 'any', when: 'any', sort: 'pop', limit: PAGE };

const I = {   // line icons
  x: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  go: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  ext: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
  down: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
  all: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12Z"/></svg>',
  code: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/></svg>',
  brain: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 6 1V6a2 2 0 0 0-3-2ZM15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-6 1"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>',
  image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/></svg>',
  wand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m4 20 11-11M14 4v2M20 10h-2M18.5 5.5 17 7M9 4.5 10 6M19.5 14 18 13"/></svg>',
  film: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m10 9 5 3-5 3V9Z"/></svg>',
  mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
  voice: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4V5ZM16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12"/></svg>',
  note: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"/><path d="M14 3v5h5M12 11v6M9 14l3 3 3-3"/></svg>',
  term: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="m7 9 3 3-3 3M13 15h4"/></svg>',
  box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8 12 3 3 8v8l9 5 9-5V8Z"/><path d="m3 8 9 5 9-5M12 13v8"/></svg>',
  hub: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8.5 14.5s1.2 1.5 3.5 1.5 3.5-1.5 3.5-1.5M9 10h.01M15 10h.01"/></svg>',
  orb: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#17171a"/><circle cx="11.2" cy="12.8" r="5.6" fill="url(#og)"/><circle cx="16.6" cy="7.4" r="2.5" fill="#fff" stroke="#17171a" stroke-width="1.2"/><defs><linearGradient id="og" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b36ef6"/><stop offset="1" stop-color="#3fb0f0"/></linearGradient></defs></svg>',
};

/* What a model is for, in words — the tabs, and the one label each row shows. */
const KINDS = [
  { id: 'all', label: 'All models', icon: I.all },
  { id: 'chat', label: 'Chat', icon: I.chat, one: 'Chat', words: 'chat writing assistant chatbot talk' },
  { id: 'code', label: 'Coding', icon: I.code, one: 'Coding', words: 'coding code programming developer' },
  { id: 'reason', label: 'Reasoning', icon: I.brain, one: 'Thinks step by step', words: 'reasoning thinking maths math logic' },
  { id: 'vision', label: 'Sees images', icon: I.eye, one: 'Sees images', words: 'vision sees images understanding ocr photo screenshot multimodal' },
  { id: 'image', label: 'Makes images', icon: I.image, one: 'Makes images', words: 'image images picture pictures art generator generate draw diffusion' },
  { id: 'image-edit', label: 'Edits images', icon: I.wand, one: 'Edits images', words: 'edit editing image picture photo inpaint' },
  { id: 'video', label: 'Video', icon: I.film, one: 'Makes video', words: 'video videos movie animation clip' },
  { id: 'speech', label: 'Speech', icon: I.mic, one: 'Speech to text', words: 'speech transcription transcribe whisper dictation stt' },
  { id: 'voice', label: 'Voices', icon: I.voice, one: 'Voice (text to speech)', words: 'voice voices speech tts speak read aloud' },
  { id: 'audio', label: 'Music', icon: I.note, one: 'Music & sound', words: 'music sound audio song' },
  { id: 'embed', label: 'Search', icon: I.search, one: 'For search (embeddings)', words: 'embedding embeddings search rag retrieval vector' },
];
const KIND = Object.fromEntries(KINDS.map(k => [k.id, k]));
KIND.omni = { one: 'Text, images & sound', words: 'omni multimodal audio' };
KIND.hearing = { one: 'Listens to audio', words: 'audio listen hearing' };
const FIT = { yes: 'Fits your computer', tight: 'Tight fit', no: 'Needs more memory' };
const PICK_ORDER = ['Best in the browser', 'Best for older computers', 'Best for coding', 'Best to download'];
/* Each maker's own colours, taken from its logo, for its banner's gradient. */
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
  if (!navigator.gpu) return { ok: false, why: "This browser can't run Oriel's models — use recent Chrome, Edge or Safari 26+. Every model can still be downloaded." };
  try {
    const a = await navigator.gpu.requestAdapter();
    if (!a) return { ok: false, why: 'No graphics chip is available to this browser — try Chrome or Edge.' };
    return { ok: true, f16: a.features.has('shader-f16') };
  } catch (e) { return { ok: false, why: 'WebGPU is switched off in this browser.' }; }
}
function renderDevice() {
  const st = $('#gpuStatus'); if (!st) return;
  const gpu = S.gpu;
  st.className = 'ds-status ' + (gpu.ok ? 'ok' : 'no');
  st.innerHTML = gpu.ok
    ? `<span class="dot"></span><div><b>This browser can run Oriel</b><small>Models marked “Open in Oriel” work right here, with nothing to install.</small></div>`
    : `<span class="dot"></span><div><b>This browser can't run Oriel</b><small>${esc(gpu.why)}</small></div>`;
  document.querySelectorAll('#ramSeg button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.ram === S.ram)));
}

/* ---------------------------------------------------------------- facts */
const maker = m => S.makers[m.org] || { name: m.maker || m.org };
const local = m => !!((m.gguf && (TEXT(m) || PICTURES(m))) || (m.ollama && !m.ollama.cloud) || m.lms);
// what you'd download: Oriel's copy, else the file, else Ollama's, else LM Studio's
const size = m => m.oriel?.gb || ((TEXT(m) || PICTURES(m)) && m.gguf?.gb) || (!m.ollama?.cloud && m.ollama?.gb) || m.lms?.gb || null;
function needs(m) {
  if (m.oriel) return m.oriel.needs;
  const g = m.gguf?.gb || (!m.ollama?.cloud && m.ollama?.gb) || m.lms?.gb;
  if (g) return g * 1.15 + 0.6;
  // image, video and voice models usually run at 16-bit: two bytes a parameter
  if (m.b && !m.kinds.includes('chat')) return m.b * 2.1 + 1;
  return m.b ? m.b * 0.62 * 1.15 + 0.6 : null;
}
function fitOf(m, ram = S.ram) {
  const n = needs(m);
  if (!n) return null;
  return { level: n <= ram * 0.7 ? 'yes' : n <= ram * 0.95 ? 'tight' : 'no', needs: n };
}
const kindOne = m => (KIND[m.kinds.find(k => k !== 'chat' && KIND[k]?.one) || m.kinds[0]] || KIND.chat).one;
function paramsText(m) {
  if (!m.b) return '';
  const t = m.b >= 1 ? (m.b >= 100 ? Math.round(m.b) : +m.b.toFixed(m.b < 10 ? 1 : 0)) + 'B' : Math.round(m.b * 1000) + 'M';
  return m.act ? `${t} · ${m.act}B active` : t;
}
const ageDays = m => m.date ? (Date.now() - new Date(m.date)) / 864e5 : 1e9;
const dateText = m => m.date ? `${m.dateKind === 'updated' ? 'Updated' : 'Released'} ${month(m.date)}` : '';
const ollamaUrl = o => `https://ollama.com/${o.name.startsWith('x/') ? o.name : 'library/' + o.name}`;
const hfUrl = m => m.hf ? `https://huggingface.co/${m.hf}` : m.ollama ? ollamaUrl(m.ollama) : m.lms ? `https://lmstudio.ai/models/${m.lms.slug}` : '#';
const fileUrl = g => `https://huggingface.co/${g.repo}/resolve/main/${encodeURIComponent(g.file)}?download=true`;
function avatar(org, px) {
  const mk = S.makers[org], name = mk?.name || org;
  if (mk?.logo) return `<img class="av" src="${mk.logo}" alt="" width="${px}" height="${px}" loading="lazy">`;
  let h = 0; for (const c of org) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `<span class="av lav" style="--h:${h};width:${px}px;height:${px}px;font-size:${Math.round(px * 0.36)}px" aria-hidden="true">${esc(name.replace(/[^A-Za-z0-9]/g, '').slice(0, 2) || '?')}</span>`;
}
function badges(m) {
  const b = [];
  if (ageDays(m) < 31 && m.dateKind !== 'updated') b.push('<span class="bdg new">New</span>');
  if (m.community) b.push('<span class="bdg">Community</span>');
  if (m.base) b.push('<span class="bdg">Base</span>');
  return b.join('');
}

/* ---------------------------------------------------------------- the Browse page */
function textOf(m) {
  return m._s ||= [m.name, maker(m).name, m.org, m.hf, m.ollama?.name, m.lms?.id, m.about, paramsText(m),
    ...m.kinds.map(k => (KIND[k]?.label || '') + ' ' + (KIND[k]?.words || ''))].join(' ').toLowerCase();
}
function visible() {
  const words = S.q.toLowerCase().split(/\s+/).filter(Boolean);
  const age = { month: 31, '3m': 92, year: 366 }[S.when];
  return S.models.filter(m => {
    if (S.kind !== 'all' && !m.kinds.includes(S.kind)) return false;
    if (S.maker && m.org !== S.maker) return false;
    if (S.oriel && !m.oriel) return false;
    if (S.official && m.community) return false;
    if (S.fits && fitOf(m)?.level !== 'yes' && fitOf(m)?.level !== 'tight') return false;
    if (S.from === 'file' && !m.gguf?.file) return false;
    if (S.from === 'ollama' && !(m.ollama && !m.ollama.cloud)) return false;
    if (S.from === 'lms' && !m.lms && !m.gguf) return false;
    if (age && ageDays(m) > age) return false;
    if (words.length) { const t = textOf(m); return words.every(w => t.includes(w)); }
    return true;
  });
}
function sorted(list) {
  const s = m => size(m) ?? (m.b ? m.b * 0.6 : Infinity);
  const by = {
    pop: (a, b) => b.score - a.score,
    new: (a, b) => (b.date || '').localeCompare(a.date || '') || b.score - a.score,
    liked: (a, b) => (b.likes || 0) - (a.likes || 0) || b.score - a.score,
    small: (a, b) => s(a) - s(b),
    large: (a, b) => (s(b) === Infinity ? -1 : s(b)) - (s(a) === Infinity ? -1 : s(a)),
  }[S.sort];
  return [...list].sort(by);
}
const filtersActive = () => !!(S.q.trim() || S.kind !== 'all' || S.maker || S.oriel || S.fits || S.official || S.from !== 'any' || S.when !== 'any');
function actions(m) {
  const get = local(m)
    ? `<button class="btn btn-sm btn-brand" data-get="${m.id}">${I.down}Download</button>`
    : `<a class="btn btn-sm" href="${hfUrl(m)}" target="_blank" rel="noopener">Get it ${I.ext}</a>`;
  const open = m.oriel ? `<a class="btn btn-sm btn-soft" href="${APP}chat.html?model=${m.oriel.id}">Open in Oriel</a>` : '';
  return get + open;
}
function row(m) {
  const f = fitOf(m), z = size(m);
  const pop = m.likes ? `♥ ${short(m.likes)}` : m.ollama?.pulls ? `${short(m.ollama.pulls)} pulls` : '';
  return `<article class="row" data-open="${m.id}" tabindex="0" aria-label="${esc(m.name)}">
    ${avatar(m.org, 44)}
    <div class="row-main">
      <div class="row-name"><span class="nm">${esc(m.name)}</span>${m.b ? `<span class="params">${paramsText(m)}</span>` : ''}${badges(m)}</div>
      <div class="row-desc">${esc(m.about)}</div>
      <div class="row-meta"><span class="kind">${kindOne(m)}</span><span class="sep"></span><span>${esc(maker(m).name)}</span>${
        z ? `<span class="sep"></span><span>${gb(z)}</span>` : ''}${f ? `<span class="sep"></span><span class="fit ${f.level}"><i></i>${FIT[f.level]}</span>` : ''}${
        pop ? `<span class="sep hide-sm"></span><span class="hide-sm">${pop}</span>` : ''}</div>
    </div>
    <div class="act">${actions(m)}</div>
  </article>`;
}
/* With nothing searched, the page opens like a shop: a few shelves, each
   leading to everything of its kind. */
const SHELVES = [
  { title: 'Most popular', test: () => true, set: {} },
  { title: 'New this month', test: m => ageDays(m) <= 31 && m.dateKind !== 'updated', sort: 'liked', set: { when: 'month', sort: 'liked' } },
  { title: 'Makes images', test: m => m.kinds.includes('image'), set: { kind: 'image' } },
  { title: 'Best for coding', test: m => m.kinds.includes('code'), set: { kind: 'code' } },
  { title: 'Open in Oriel — nothing to install', test: m => !!m.oriel, set: { oriel: true } },
  { title: 'Voices and speech', test: m => m.kinds.includes('voice') || m.kinds.includes('speech'), set: { kind: 'voice' } },
];
function renderModels() {
  const shelves = !filtersActive();
  const list = shelves ? [] : sorted(visible());
  let html = '';
  if (S.maker) {
    const mk = S.makers[S.maker] || { name: S.maker };
    const c = brand(S.maker);
    html += `<div class="banner" style="--c1:${c[0]};--c2:${c[1]}">${avatar(S.maker, 52).replace('class="av', 'class="logo av')}
      <div><h2>${esc(mk.name)}</h2><p>Every model from ${esc(mk.name)}${mk.lab ? '' : ' — shared on Hugging Face'}.</p></div>
      ${mk.logo ? `<img class="wm" src="${mk.logo}" alt="" aria-hidden="true">` : ''}</div>`;
  }
  if (shelves) {
    html += SHELVES.map((sh, i) => {
      const items = sorted(S.models.filter(sh.test)).sort(sh.sort === 'liked' ? (a, b) => (b.likes || 0) - (a.likes || 0) : () => 0).slice(0, 6);
      return items.length ? `<section class="shelf"><div class="shelf-head"><h2>${esc(sh.title)}</h2><button class="see" data-shelf="${i}">See all ${I.go}</button></div>
        <div class="rows">${items.map(row).join('')}</div></section>` : '';
    }).join('');
  } else if (list.length) {
    html += `<div class="rows">${list.slice(0, S.limit).map(row).join('')}</div>`;
    if (list.length > S.limit) html += `<div class="more-wrap"><button class="btn" id="moreBtn">Show more</button></div>`;
  } else {
    html += `<div class="empty">No models match all of that. ${S.fits ? 'Try switching off “Fits my computer”, or pick a bigger memory size.' : 'Try another word, or fewer filters.'}<br><br><button class="btn btn-sm" id="emptyClear">Clear filters</button></div>`;
  }
  $('#groups').innerHTML = html;
  $('#picksWrap').hidden = !shelves;
  const picks = S.models.filter(m => m.pick).sort((a, b) => PICK_ORDER.indexOf(a.pick) - PICK_ORDER.indexOf(b.pick));
  $('#picks').innerHTML = picks.map(m => `<button class="pick" data-open="${m.id}" style="--c1:${brand(m.org)[0]}">
    ${avatar(m.org, 36).replace('class="av', 'class="logo av')}<span class="why">${esc(m.pick)}</span>
    <span class="nm">${esc(m.name)}</span><span class="sz">${esc(maker(m).name)} · ${gb(size(m) || 0)}${m.oriel ? ' · opens in Oriel' : ''}</span>
    ${S.makers[m.org]?.logo ? `<img class="wm" src="${S.makers[m.org].logo}" alt="" aria-hidden="true">` : ''}</button>`).join('');
  $('#useTabs').innerHTML = KINDS.map(k =>
    `<button class="utab" role="tab" data-kind="${k.id}" aria-selected="${S.kind === k.id}">${k.icon}${esc(k.label)}</button>`).join('')
    + (S.maker ? `<button class="utab" data-maker-clear aria-selected="true">By ${esc(S.makers[S.maker]?.name || S.maker)} ✕</button>` : '');
  $('#orielOnly').checked = S.oriel; $('#fitsOnly').checked = S.fits; $('#officialOnly').checked = S.official;
  $('#from').value = S.from; $('#when').value = S.when; $('#sort').value = S.sort;
  $('#clearAll').hidden = !filtersActive();
  $('#qClear').hidden = !S.q;
  const url = new URLSearchParams();
  if (S.q.trim()) url.set('q', S.q.trim());
  if (S.maker) url.set('maker', S.maker);
  if (S.kind !== 'all') url.set('kind', S.kind);
  history.replaceState(null, '', location.pathname + (url.toString() ? '?' + url : '') + location.hash);
}

/* ---------------------------------------------------------------- one model, in full */
const HOWTO = {
  image: 'Image models like this run in free apps such as <b>Draw Things</b> (Mac, iPhone, iPad) or <b>ComfyUI</b> (Windows, Mac, Linux): get the files from the maker’s page.',
  'image-edit': 'Image editors like this run in <b>ComfyUI</b> (Windows, Mac, Linux) or <b>Draw Things</b> (Mac): get the files from the maker’s page.',
  video: 'Video models run in <b>ComfyUI</b> and need a powerful graphics card: get the files from the maker’s page.',
  speech: 'The maker’s page shows how to run it. Apps like <b>MacWhisper</b> (Mac) and <b>Buzz</b> (Windows, Mac, Linux) run many speech-to-text models.',
  voice: 'The maker’s page shows how to run it — most voice models come with a small demo you can run on your computer.',
  audio: 'The maker’s page shows how to run it; many run in <b>ComfyUI</b>.',
  embed: 'Embedding models turn text into numbers for search and “chat with your documents” apps — <b>Ollama</b>, <b>LM Studio</b> and <b>AnythingLLM</b> can use them.',
};
// Text models run in LM Studio, Jan and Ollama; a .gguf of an image or video
// model is for ComfyUI instead, and sound models have their own tools.
const TEXT = m => !m.kinds.some(k => ['image', 'image-edit', 'video', 'voice', 'audio', 'speech'].includes(k));
const PICTURES = m => m.kinds.some(k => ['image', 'image-edit', 'video'].includes(k));
function ways(m) {
  const out = [];
  const g = TEXT(m) || PICTURES(m) ? m.gguf : null, q = g?.q ? ':' + g.q : '';
  if (g?.file) out.push(`<div class="way-item"><span class="wi-ic">${I.file}</span>
      <div class="wi-main"><b>Download the file</b><small>${gb(g.gb)}${g.exact ? '' : ' (about)'} · ${TEXT(m) ? 'a .gguf file that LM Studio, Jan and Ollama open' : 'a smaller .gguf copy, for ComfyUI’s GGUF add-on'}</small></div>
      <a class="btn btn-brand" href="${fileUrl(g)}" download>${I.down}Download</a></div>`);
  if (m.oriel) out.push(`<div class="way-item oriel"><span class="wi-ic">${I.orb}</span>
      <div class="wi-main"><b>Open in Oriel</b><small>Chat with it right in this browser — nothing to install, and <b>nothing you type leaves your device</b>.</small></div>
      <a class="btn ${g?.file ? 'btn-soft' : 'btn-brand'}" href="${APP}chat.html?model=${m.oriel.id}">Open in Oriel</a></div>`);
  if (g && TEXT(m)) out.push(`<div class="way-item"><span class="wi-ic">${I.box}</span>
      <div class="wi-main"><b>In LM Studio</b><small>The free LM Studio app downloads it and runs it for you.</small></div>
      <a class="btn" href="lmstudio://open_from_hf?model=${encodeURIComponent(g.repo)}${g.file ? '&file=' + encodeURIComponent(g.file) : ''}">Open in LM Studio</a></div>`);
  else if (m.lms) out.push(`<div class="way-item"><span class="wi-ic">${I.box}</span>
      <div class="wi-main"><b>In LM Studio</b><small>Search for it in the free LM Studio app, or run this in Terminal:</small>
      <div class="cmd"><code>lms get ${esc(m.lms.id)}</code><button data-copy="lms get ${esc(m.lms.id)}">Copy</button></div></div>
      <a class="btn" href="https://lmstudio.ai/models/${m.lms.slug}" target="_blank" rel="noopener">LM Studio ${I.ext}</a></div>`);
  const ollamaCmd = m.ollama && !m.ollama.cloud ? `ollama run ${m.ollama.name}${m.ollama.tag === 'latest' ? '' : ':' + m.ollama.tag}${m.ollama.mac ? ' "a lighthouse at sunset"' : ''}`
                  : g && TEXT(m) ? `ollama run hf.co/${g.repo}${q}` : '';
  if (ollamaCmd) out.push(`<div class="way-item"><span class="wi-ic">${I.term}</span>
      <div class="wi-main"><b>With Ollama${m.ollama?.mac ? ' (Mac, for now)' : ''}</b><small>Get the free <a href="https://ollama.com/download" target="_blank" rel="noopener">Ollama app</a>, then paste this into ${m.ollama?.mac ? 'Terminal' : 'Terminal (Mac) or Command Prompt (Windows)'}:</small>
      <div class="cmd"><code>${esc(ollamaCmd)}</code><button data-copy="${esc(ollamaCmd)}">Copy</button></div></div></div>`);
  if (m.ollama?.cloud) out.push(`<div class="way-item warn"><span class="wi-ic">${I.term}</span>
      <div class="wi-main"><b>Only in Ollama’s cloud</b><small>This one runs on Ollama’s computers, not yours — so what you type is sent to Ollama.</small></div>
      <a class="btn" href="${ollamaUrl(m.ollama)}" target="_blank" rel="noopener">Ollama ${I.ext}</a></div>`);
  if (m.hf) out.push(`<div class="way-item"><span class="wi-ic">${I.hub}</span>
      <div class="wi-main"><b>The maker’s own files</b><small>On Hugging Face: every file, the maker’s notes and the licence.${m.gated ? ' It asks you to sign in and accept the licence first.' : ''}</small></div>
      <a class="btn" href="https://huggingface.co/${m.hf}" target="_blank" rel="noopener">Hugging Face ${I.ext}</a></div>`);
  else if (m.ollama && !m.ollama.cloud) out.push(`<div class="way-item"><span class="wi-ic">${I.hub}</span>
      <div class="wi-main"><b>On Ollama’s site</b><small>Every size and version of it.</small></div>
      <a class="btn" href="${ollamaUrl(m.ollama)}" target="_blank" rel="noopener">Ollama ${I.ext}</a></div>`);
  return out.join('');
}
function sheet(m) {
  const f = fitOf(m), mk = maker(m), z = size(m);
  const how = !local(m) && !m.oriel ? HOWTO[m.kinds.find(k => HOWTO[k])] : '';
  const specs = [
    ['Size', paramsText(m) || '—', m.act ? 'mixture of experts' : m.b ? 'parameters' : ''],
    ['Download', z ? gb(z) : '—', m.oriel ? 'in Oriel' : m.gguf?.file ? 'one file' : m.ollama && !m.ollama.cloud ? 'with Ollama' : z ? '' : 'see the maker’s page'],
    ['Memory needed', f ? `~${gb(f.needs)}` : '—', f ? `<span class="fit ${f.level}"><i></i>${FIT[f.level]}</span>` : ''],
    [m.dateKind === 'updated' ? 'Updated' : 'Released', month(m.date) || '—', m.dateKind === 'updated' ? 'on Ollama' : 'on Hugging Face'],
    ['Good for', esc(m.kinds.filter(k => KIND[k]?.one).map(k => KIND[k].one).slice(0, 2).join(', ')), ''],
    ['Licence', esc(m.licName || '—'), m.biz ? 'business OK' : m.biz === false ? 'personal use only' : 'see its terms'],
    ['Liked by', m.likes ? short(m.likes) : '—', m.likes ? 'on Hugging Face' : ''],
    [m.ollama?.pulls ? 'Ollama pulls' : 'Downloads', m.ollama?.pulls ? short(m.ollama.pulls) : m.dl ? short(m.dl) : '—', m.ollama?.pulls ? 'all time' : m.dl ? 'last month' : ''],
  ].map(([k, v, s]) => `<div class="spec"><small>${k}</small><b>${v}</b><span>${s}</span></div>`).join('');
  const t = m.tested;
  const tested = t ? `<div class="tested-line">✓ Tested in Oriel on a ${esc(t.on)}${t.tokens_per_s ? ` — about ${Math.round(t.tokens_per_s * 0.75)} words a second` : ' — works'}</div>` : '';
  return `
    <div class="sheet-head">${avatar(m.org, 48)}
      <div><h2 id="sheetTitle">${esc(m.name)}</h2><div class="by">by <button class="linkish" data-maker="${esc(m.org)}">${esc(mk.name)}</button>${m.community ? ' · community model' : ''}${m.pick ? ' · <b>' + esc(m.pick) + '</b>' : ''}</div></div>
      <button class="x-btn" data-close aria-label="Close">${I.x}</button></div>
    <div class="sheet-body">
      <p class="about">${esc(m.about)}</p>
      ${m.from ? `<p class="note" style="margin:-8px 0 0">Built on ${esc(m.from)}.</p>` : ''}
      <section id="get" class="get"><h3>Get it</h3><div class="ways">${ways(m)}</div>${how ? `<p class="note">${how}</p>` : ''}</section>
      ${tested}
      <div class="specs">${specs}</div>
      ${f?.level === 'no' ? `<div class="warnbox">It needs about ${gb(f.needs)} of memory — more than your computer has. It may not start, or be very slow.</div>` : ''}
      <p class="lic"><b>Licence:</b> ${esc(m.licName || 'not stated')}${m.biz === false ? ' — for personal use only, not for business.' : m.biz ? ' — free to use, including for business.' : ' — read the terms before using it for business.'} ${m.hf ? `<a href="https://huggingface.co/${m.hf}" target="_blank" rel="noopener">Read it</a>` : ''}</p>
    </div>`;
}
function openSheet(id, focus) {
  const m = S.models.find(x => x.id === id); if (!m) return;
  if (!BROWSE) { location.href = 'models.html#model=' + id; return; }
  $('#sheetInner').innerHTML = sheet(m);
  const d = $('#sheet'); if (!d.open) d.showModal();
  $('#sheetInner').scrollTop = 0;
  if (focus === 'get') $('#get .btn')?.focus({ preventScroll: true });
  history.replaceState(null, '', location.pathname + location.search + '#model=' + id);
}

/* ---------------------------------------------------------------- home page */
function renderHome() {
  const makers = $('#makers');
  if (makers) makers.innerHTML = Object.entries(S.makers).filter(([, mk]) => mk.lab && mk.logo).slice(0, 14).map(([org, mk]) =>
    `<a class="maker-chip" href="models.html?maker=${encodeURIComponent(org)}"><img src="${mk.logo}" alt="" width="30" height="30">${esc(mk.name)}</a>`).join('');
}

/* ---------------------------------------------------------------- events */
let toastT;
function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2600); }
function set(patch) { Object.assign(S, patch, { limit: PAGE }); renderModels(); }

document.addEventListener('click', e => {
  const t = e.target.closest('[data-get],[data-open],[data-close],[data-copy],[data-kind],[data-ram],[data-shelf],[data-maker],[data-maker-clear],#emptyClear,#clearAll,#qClear,#moreBtn,.nav-menu');
  if (!t) return;
  if (t.dataset.get) { e.stopPropagation(); return openSheet(t.dataset.get, 'get'); }
  if (t.dataset.copy) { navigator.clipboard?.writeText(t.dataset.copy); t.textContent = 'Copied'; setTimeout(() => (t.textContent = 'Copy'), 1400); return; }
  if (t.hasAttribute('data-close')) { t.closest('dialog').close(); return; }
  if (t.classList.contains('nav-menu')) { const d = $('.nav-drop'); d.classList.toggle('open'); t.setAttribute('aria-expanded', String(d.classList.contains('open'))); return; }
  if (t.dataset.ram) { S.ram = +t.dataset.ram; try { localStorage.setItem('oriel-ram', S.ram); } catch (x) {} renderDevice(); return BROWSE && renderModels(); }
  if (t.dataset.kind) return set({ kind: t.dataset.kind });
  if (t.dataset.maker) { $('#sheet')?.close(); set({ maker: t.dataset.maker }); return $('.tabs-bar')?.scrollIntoView({ behavior: 'smooth' }); }
  if (t.hasAttribute('data-maker-clear')) return set({ maker: null });
  if (t.dataset.shelf) { set({ ...SHELVES[+t.dataset.shelf].set, ...(SHELVES[+t.dataset.shelf].title === 'Most popular' ? { sort: 'pop', when: 'year' } : {}) }); return $('.tabs-bar')?.scrollIntoView({ behavior: 'smooth' }); }
  if (t.id === 'moreBtn') { S.limit += PAGE; return renderModels(); }
  if (t.id === 'qClear') { S.q = ''; $('#q').value = ''; $('#q').focus(); return set({}); }
  if (t.id === 'emptyClear' || t.id === 'clearAll') { $('#q').value = ''; return set({ q: '', kind: 'all', maker: null, oriel: false, fits: false, official: false, from: 'any', when: 'any', sort: 'pop' }); }
  if (t.dataset.open) return openSheet(t.dataset.open);
});
document.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.classList?.contains('row')) { e.preventDefault(); openSheet(e.target.dataset.open); }
});
const sheetEl = $('#sheet');
if (sheetEl) {
  sheetEl.addEventListener('click', e => { if (e.target === sheetEl) sheetEl.close(); });   // click outside the card
  sheetEl.addEventListener('close', () => history.replaceState(null, '', location.pathname + location.search));
}
if (BROWSE) {
  let qT;
  $('#q').addEventListener('input', e => { clearTimeout(qT); qT = setTimeout(() => set({ q: e.target.value }), 90); });
  $('#searchForm').addEventListener('submit', e => { e.preventDefault(); set({ q: $('#q').value }); $('.tabs-bar')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  $('#orielOnly').addEventListener('change', e => set({ oriel: e.target.checked }));
  $('#fitsOnly').addEventListener('change', e => set({ fits: e.target.checked }));
  $('#officialOnly').addEventListener('change', e => set({ official: e.target.checked }));
  $('#from').addEventListener('change', e => set({ from: e.target.value }));
  $('#when').addEventListener('change', e => set({ when: e.target.value }));
  $('#sort').addEventListener('change', e => set({ sort: e.target.value }));
}

(async () => {
  S.ram = guessRam();
  const p = new URLSearchParams(location.search);
  S.q = p.get('q') || '';
  S.maker = p.get('maker');
  const kind = p.get('kind') || p.get('use');
  if (kind && KIND[kind]) S.kind = kind;
  if (BROWSE) $('#q').value = S.q;
  const [data, gpu] = await Promise.all([fetch('catalog.json', { cache: 'no-cache' }).then(r => r.json()), checkGpu()]);
  Object.assign(S, { models: data.models, makers: data.makers, gpu });
  if (S.maker && !S.makers[S.maker]) S.maker = null;
  if (!BROWSE) { renderHome(); floaters(HERO_HOME); return; }
  floaters(HERO_BROWSE);
  renderDevice();
  renderModels();
  const hash = location.hash.match(/model=([\w.-]+)/);
  if (hash) openSheet(hash[1]);
})();
