/* oriel.ai website — shared by the home page and the models page. */
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const gb = n => n >= 10 ? Math.round(n) + ' GB' : n >= 1 ? n.toFixed(1) + ' GB' : Math.round(n * 1000) + ' MB';
const WEBLLM = v => `https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@${v}/+esm`;
const S = { models: [], engine: {}, gpu: null, ram: 16, filter: 'all', q: '', fitsOnly: false, have: {} };

/* ---------------------------------------------------------------- device */
function guessRam() {
  try { const r = +localStorage.getItem('oriel-ram'); if (r) return r; } catch (e) {}
  if (/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)) return 4;
  const dm = navigator.deviceMemory;          // Chrome only, and never above 8
  return dm && dm < 8 ? 8 : 16;
}
async function checkGpu() {
  if (!navigator.gpu) return { ok: false, why: "This browser can't run models itself. Use recent Chrome or Edge, or Safari 26+ — or download a model to run with Ollama." };
  try {
    const a = await navigator.gpu.requestAdapter();
    if (!a) return { ok: false, why: 'WebGPU is on, but no graphics chip is available to it. Try Chrome or Edge.' };
    return { ok: true, f16: a.features.has('shader-f16') };
  } catch (e) { return { ok: false, why: 'WebGPU is switched off in this browser.' }; }
}
/* Which models are fully downloaded in this browser: WebLLM keeps each one in
   Cache Storage ("webllm/model"), so compare the cached pieces with the
   model's own list of files. */
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

/* ---------------------------------------------------------------- fit */
// Browser runs share memory with everything else open; Ollama uses it more
// efficiently. Both thresholds err towards "won't fit".
function fitOf(m, ram = S.ram) {
  if (m.browser && S.gpu?.ok && !(m.browser.f16 && !S.gpu.f16)) {
    const n = m.browser.needs_gb;
    return { way: 'browser', level: n <= ram * 0.6 ? 'yes' : n <= ram * 0.8 ? 'tight' : 'no', needs: n };
  }
  const o = m.ollama || (m.browser && { needs_gb: m.browser.needs_gb });
  const n = o.needs_gb;
  return { way: 'download', level: n <= ram * 0.75 ? 'yes' : n <= ram ? 'tight' : 'no', needs: n };
}
const FIT_TEXT = { yes: 'Fits your computer', tight: 'Tight fit — close other apps', no: 'Needs more memory' };
const runsHere = m => !!m.browser && !!S.gpu?.ok && !(m.browser.f16 && !S.gpu.f16);

/* ---------------------------------------------------------------- render */
function tagsOf(m) {
  const t = [];
  const done = m.browser && S.have[m.browser.id] === 'complete';
  if (done) t.push('<span class="tag have">Downloaded</span>');
  else if (m.browser) t.push('<span class="tag browser">Runs in your browser</span>');
  if (m.good.includes('vision')) t.push('<span class="tag">Sees images</span>');
  if (m.good.includes('coding')) t.push('<span class="tag">Coding</span>');
  if (m.good.includes('reasoning')) t.push('<span class="tag">Thinks step by step</span>');
  if (m.licence.business === false) t.push('<span class="tag personal">Personal use only</span>');
  return t.join('');
}
function sizeOf(m) { return m.browser ? m.browser.download_gb : m.ollama.download_gb; }

function card(m) {
  const f = fitOf(m);
  const run = runsHere(m)
    ? `<button class="btn small soft" data-run="${m.id}">Run in Oriel</button>`
    : `<button class="btn small" data-open="${m.id}">Download</button>`;
  return `<article class="card" data-open="${m.id}" tabindex="0" aria-label="${esc(m.name)}">
    <div class="card-top"><div><h3>${esc(m.name)}</h3><div class="maker">${esc(m.maker)} · ${gb(sizeOf(m))}</div></div></div>
    <p>${esc(m.blurb)}</p>
    <div class="tags">${tagsOf(m)}</div>
    <div class="card-foot"><span class="fit ${f.level}"><i></i>${FIT_TEXT[f.level]}</span>${run}</div>
  </article>`;
}

function visible() {
  const q = S.q.trim().toLowerCase();
  return S.models.filter(m => {
    if (S.filter === 'browser' && !m.browser) return false;
    if (S.filter === 'chat' && !m.good.some(g => g === 'chat' || g === 'writing')) return false;
    if (S.filter === 'reasoning' && !m.good.some(g => g === 'reasoning' || g === 'maths')) return false;
    if (['coding', 'vision', 'tiny'].includes(S.filter) && !m.good.includes(S.filter)) return false;
    if (S.fitsOnly && fitOf(m).level === 'no') return false;
    if (!q) return true;
    return [m.name, m.maker, m.blurb, ...m.good, m.ollama?.tag || ''].join(' ').toLowerCase().includes(q);
  });
}

function render() {
  document.querySelectorAll('#ramSeg button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.ram === S.ram)));
  if (!$('#grid')) return;              // the home page has no catalog
  const list = visible();
  $('#grid').innerHTML = list.length ? list.map(card).join('')
    : `<div class="empty" style="grid-column:1/-1">No models match. ${S.fitsOnly ? 'Try switching off “Only models that fit”, or pick a bigger memory size above.' : 'Try another search.'}</div>`;
  const ORDER = ['Best in the browser', 'Best for older computers', 'Best for coding', 'Best to download'];
  const picks = S.models.filter(m => m.pick).sort((a, b) => ORDER.indexOf(a.pick) - ORDER.indexOf(b.pick));
  $('#picks').innerHTML = picks.map(m => `<button class="pick" data-open="${m.id}"><span class="why">${esc(m.pick)}</span><span class="nm">${esc(m.name)}</span><span class="sz">${esc(m.maker)} · ${gb(sizeOf(m))} · ${m.browser ? 'runs in your browser' : 'download'}</span></button>`).join('');
  document.querySelectorAll('#chips .chip').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.f === S.filter)));
}

/* ---------------------------------------------------------------- sheet */
function sheet(m) {
  const f = fitOf(m);
  const b = m.browser, o = m.ollama;
  const hereOk = runsHere(m);
  const facts = [
    b ? `<div class="fact"><small>Download to your browser</small><b>${gb(b.download_gb)}</b><span>once — then it's stored</span></div>` : '',
    o ? `<div class="fact"><small>Download with Ollama</small><b>${gb(o.download_gb)}</b><span>on your computer</span></div>` : '',
    `<div class="fact"><small>Memory it needs</small><b>about ${gb(f.needs)}</b><span class="fit ${f.level}" style="font-size:12px"><i></i>${FIT_TEXT[f.level]}</span></div>`,
  ].join('');
  const here = b ? `
    <div class="way">
      <h3>Run it here, in Oriel</h3>
      <p>Chat with ${esc(m.name)} right in this browser with the Oriel app. ${S.have[b.id] === 'complete' ? "It's already downloaded, so it starts in seconds." : `It downloads ${gb(b.download_gb)} once, then starts in seconds.`} Nothing you type leaves your device.</p>
      ${hereOk ? `<button class="btn primary" data-run="${m.id}">Run in Oriel</button>`
               : `<button class="btn" disabled>Run in Oriel</button><div class="warnbox">${esc(S.gpu && !S.gpu.ok ? S.gpu.why : 'This model needs a graphics feature (16-bit shaders) your browser doesn’t offer. Try Chrome or Edge, or download it below.')}</div>`}
      ${hereOk && f.level === 'no' ? `<div class="warnbox">This model needs about ${gb(f.needs)} of memory — more than your computer has. It may fail to start or be very slow.</div>` : ''}
    </div>` : '';
  const hfUrl = `https://huggingface.co/${m.hf.repo}`;
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
      <p class="note" style="margin:0 0 12px">The model's own page: the full files, the maker's notes and the licence.</p>
      <a class="btn" href="${hfUrl}" target="_blank" rel="noopener">Open on Hugging Face ↗</a>
      ${m.hf.gated ? '<p class="note">Hugging Face asks you to sign in and accept the licence before downloading these files. The Ollama and Oriel downloads don’t need this.</p>' : ''}` },
  ].filter(Boolean);
  return `
    <div class="sheet-head"><div><h2 id="sheetTitle">${esc(m.name)}</h2><div class="maker">${esc(m.maker)}${m.pick ? ' · ' + esc(m.pick) : ''}</div></div>
      <button class="x" data-close aria-label="Close"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>
    <div class="sheet-body">
      <div><p style="margin:0 0 12px;font-size:16px">${esc(m.blurb)}</p><div class="tags">${tagsOf(m)}</div></div>
      <div class="facts">${facts}</div>
      ${here}
      <div class="way">
        <h3>Run it anywhere</h3>
        <p>Download ${esc(m.name)} to your computer and use it in any app that runs AI models.</p>
        <div class="tabs" role="tablist">${tabs.map((t, i) => `<button role="tab" aria-selected="${i === 0}" data-tab="${t.id}">${t.label}</button>`).join('')}</div>
        ${tabs.map((t, i) => `<div role="tabpanel" data-panel="${t.id}" ${i ? 'hidden' : ''}>${t.body}</div>`).join('')}
      </div>
      <p class="lic"><b>Licence:</b> ${esc(m.licence.label)} — ${esc(m.licence.meaning)} <a href="${hfUrl}" target="_blank" rel="noopener">Read it</a></p>
    </div>`;
}
function openSheet(id) {
  const m = S.models.find(x => x.id === id); if (!m) return;
  if (!$('#grid')) { location.href = 'models.html#model=' + id; return; }
  $('#sheetInner').innerHTML = sheet(m);
  const d = $('#sheet'); if (!d.open) d.showModal();
  history.replaceState(null, '', '#model=' + id);
}

/* ---------------------------------------------------------------- downloads */
async function refreshStored() {
  S.have = await scanDownloads();
  const mine = S.models.filter(m => m.browser && S.have[m.browser.id] === 'complete');
  const el = $('#stored');
  if (!mine.length) { el.hidden = true; return; }
  el.hidden = false;
  $('#storedText').textContent = `${mine.length} model${mine.length > 1 ? 's' : ''} downloaded here · ${gb(mine.reduce((a, m) => a + m.browser.download_gb, 0))}`;
}
function manageView() {
  const mine = S.models.filter(m => m.browser && S.have[m.browser.id]);
  return `
    <div class="sheet-head"><div><h2 id="manageTitle">Models in this browser</h2><div class="maker">Delete any you don't need to free up space.</div></div>
      <button class="x" data-close aria-label="Close"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>
    <div class="sheet-body"><div class="mylist">${mine.length ? mine.map(m => `
      <div class="myrow"><span><b>${esc(m.name)}</b> · ${gb(m.browser.download_gb)}${S.have[m.browser.id] === 'partial' ? ' · unfinished download' : ''}</span>
      <span style="display:flex;gap:6px"><button class="btn small" data-run="${m.id}">Open</button><button class="btn small" data-delete="${m.id}">Delete</button></span></div>`).join('')
      : '<p class="note">Nothing downloaded in this browser.</p>'}</div></div>`;
}
async function deleteModel(id) {
  const m = S.models.find(x => x.id === id);
  toast(`Deleting ${m.name}…`);
  try {
    const lib = await import(WEBLLM(S.engine.webllm));
    // the chat page fetches engine code from jsDelivr (see chat's fastAppConfig), so delete that copy
    const cfg = lib.prebuiltAppConfig;
    await lib.deleteModelAllInfoInCache(m.browser.id, { ...cfg, model_list: cfg.model_list.map(x => ({ ...x, model_lib: x.model_lib.replace(
      'https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/', 'https://cdn.jsdelivr.net/gh/mlc-ai/binary-mlc-llm-libs@main/') })) });
    // WebLLM's delete leaves the model's file list behind; remove every trace
    for (const name of ['webllm/model', 'webllm/config', 'webllm/wasm']) {
      const ch = await caches.open(name);
      for (const k of await ch.keys()) {
        if (k.url.includes('/' + m.browser.id + '/') || (name === 'webllm/wasm' && k.url.includes(m.browser.id.replace(/-MLC$/, '')))) await ch.delete(k);
      }
    }
  } catch (e) { toast("Couldn't delete it — try clearing this site's data in your browser settings"); return; }
  await refreshStored(); render();
  $('#manageInner').innerHTML = manageView();
  toast(`Deleted ${m.name}`);
}

/* ---------------------------------------------------------------- misc */
let toastT;
function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2400); }
function run(id) { location.href = 'chat.html?model=' + encodeURIComponent(id); }

document.addEventListener('click', e => {
  const t = e.target.closest('[data-run],[data-open],[data-close],[data-copy],[data-tab],[data-delete],[data-f],[data-ram]');
  if (!t) return;
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
  if (t.dataset.f) { S.filter = t.dataset.f; return render(); }
  if (t.dataset.ram) { S.ram = +t.dataset.ram; try { localStorage.setItem('oriel-ram', S.ram); } catch (e) {} return render(); }
  if (t.dataset.open) return openSheet(t.dataset.open);
});
document.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.classList?.contains('card')) { e.preventDefault(); openSheet(e.target.dataset.open); }
});
for (const id of ['sheet', 'manage']) {
  const d = $('#' + id);
  d.addEventListener('click', e => { if (e.target === d) d.close(); });   // click outside the card
  d.addEventListener('close', () => { if (id === 'sheet') history.replaceState(null, '', location.pathname); });
}
$('#q')?.addEventListener('input', e => { S.q = e.target.value; render(); });
$('#fitsOnly')?.addEventListener('change', e => { S.fitsOnly = e.target.checked; render(); });
$('#manageBtn').addEventListener('click', () => { $('#manageInner').innerHTML = manageView(); $('#manage').showModal(); });
addEventListener('scroll', () => $('#top').classList.toggle('scrolled', scrollY > 8), { passive: true });

(async () => {
  S.ram = guessRam();
  const [data, gpu] = await Promise.all([fetch('models.json').then(r => r.json()), checkGpu()]);
  S.models = data.models; S.engine = data.engine; S.gpu = gpu;
  const st = $('#gpuStatus');
  st.className = 'status ' + (gpu.ok ? 'ok' : 'no');
  st.innerHTML = gpu.ok
    ? `<span class="dot"></span><div><b>This browser can run models</b><small>Models marked “Runs in your browser” work right here${gpu.f16 ? '' : ' — except a few that need newer graphics support'}.</small></div>`
    : `<span class="dot"></span><div><b>This browser can't run models itself</b><small>${esc(gpu.why)}</small></div>`;
  render();
  await refreshStored();
  render();
  const hash = location.hash.match(/model=([\w.-]+)/);
  if (hash) openSheet(hash[1]);
})();
