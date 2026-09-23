
/* oriel.ai — interface logic.
 *
 * Built on the "Oriel v3" design. Visual design and interaction model are the
 * design's own; this file replaces its demo plumbing with a real local model:
 *
 *   - replies STREAM from ollama as they are generated (the design faked this
 *     by animating a finished reply, which hid the 0.25 s first-token latency)
 *   - reasoning is the model's native thinking, not a prompted imitation
 *   - the model menu lists what is actually installed
 *   - attachments are really sent: images to the vision model, text inlined
 *   - chats and settings persist in this browser
 *
 * Deliberately removed, because they cannot be real on an offline model and
 * would otherwise invent sources, URLs and "images": web search, deep
 * research, image generation, and the canned fallback replies.
 */

/* Presets, not models: Flash and the standard Oriel 2 run on the same weights
   and differ only in how much they write, so switching between them costs
   nothing. Measured on "Why does the moon cause tides?" with the detailed
   instructions: the 4B wrote 292 words in 18.7 s; the 12B wrote 329 more
   precise words in 41.4 s. The standard preset uses the 4B for speed; Deep is
   there when the extra precision is worth the wait. */
const PRESETS = [
  { id: 'flash',  name: 'Oriel 2 Flash', desc: 'Fastest, short answers · Gemma 4 4B',   model: 'gemma4:e4b-it-qat', detail: 'brief',    deep: false },
  { id: 'normal', name: 'Oriel 2',       desc: 'Detailed, longer answers · Gemma 4 4B', model: 'gemma4:e4b-it-qat', detail: 'detailed', deep: false },
  { id: 'deep',   name: 'Oriel 2 Deep',  desc: 'Reasons first, slowest · Gemma 4 12B',  model: 'gemma4:12b',        detail: 'detailed', deep: true },
];
const DEFAULT_PRESET = 'normal';
const FALLBACK_MODEL = PRESETS.find(p => p.id === DEFAULT_PRESET);

const STYLES = ['Concise', 'Balanced', 'Detailed'];
/* Length is set by the preset (brief vs detailed), and the Concise / Balanced /
   Detailed setting shifts it within that. Every line is a ceiling or a scale,
   never a quota: phrased as a target, the model padded short answers with
   filler to reach the word count. */
const LENGTH = {
  brief: {
    Concise:  'Keep answers short: one to three sentences unless the user asks for more.',
    Balanced: 'Answer as briefly as the question allows — a simple question gets a sentence or two. Go up to about 130 words only when the question really needs it.',
    Detailed: 'Give thorough, well-explained answers, up to about 250 words when the question warrants it.',
  },
  detailed: {
    Concise:  'Give a complete but compact answer: lead with the direct answer, then the key explanation and one concrete example — around 150 words for a substantial question.',
    Balanced: 'Give a detailed answer: lead with the direct answer, then explain the why and the how, with concrete examples. Use short paragraphs, and "- " lists where they help. Around 300 words for a substantial question.',
    Detailed: 'Give a comprehensive answer: lead with the direct answer, then cover the topic fully — causes, mechanisms, examples, caveats and practical implications — organised in short paragraphs and "- " lists. Around 500 words for a substantial question.',
  },
};
const DETAIL_NOTE = 'Scale to the question: a simple fact needs only a short paragraph, while an explanation deserves the full length. Add substance, never filler — every sentence should carry information.';
const TOOLS = { canvas: 'Canvas' };
const PLACEHOLDERS = { canvas: 'What should we write?' };
const SUGGESTIONS = [
  { label: 'Write an email',   text: 'Write a polite email asking my landlord to fix a leaking tap this week', dot: 'oklch(0.65 0.13 282)', tool: 'canvas' },
  { label: 'Solve a puzzle',   text: 'A bat and a ball cost $1.10 in total. The bat costs $1 more than the ball. How much is the ball?', dot: 'oklch(0.65 0.13 320)', think: true },
  { label: 'Explain something', text: 'How do noise-cancelling headphones actually work?', dot: 'oklch(0.65 0.13 240)' },
  { label: 'Brainstorm',        text: 'Give me 8 name ideas for a small neighbourhood bakery', dot: 'oklch(0.65 0.13 200)' },
  { label: 'Write code',        text: 'Write a Python function that checks whether a word is a palindrome, with a short explanation', dot: 'oklch(0.65 0.13 150)' },
  { label: 'Plan a trip',       text: 'Plan a relaxed 3-day trip to Penang focused on food', dot: 'oklch(0.65 0.13 30)', tool: 'canvas' },
];
const TEXT_EXT = /\.(txt|md|markdown|csv|tsv|json|jsonl|js|mjs|ts|tsx|jsx|py|rb|go|rs|java|kt|swift|c|h|cpp|hpp|cs|php|sh|zsh|sql|html|htm|css|scss|xml|yaml|yml|toml|ini|cfg|log|tex|rtf)$/i;
const MAX_TEXT = 24000;  // characters of an attached text file sent to the model
const LS_KEY = 'oriel.v3';
const DAY = 864e5;

const fmtSize = b => b > 1e6 ? (b / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1e3)) + ' KB';

/* Small models slip into markdown even when told not to; the renderer shows
   plain paragraphs, so strip the common marks rather than show raw ** and #. */
function clean(t) {
  return String(t)
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^(\s*)[*•]\s+/gm, '$1- ')
    .replace(/\n{3,}/g, '\n\n');
}

/* Split a reply into chat text, an optional canvas piece and follow-ups.
   `live` is for a reply still streaming in: it also hides a marker that has
   only partly arrived, so "<<<CANV" never flashes up in the chat. */
function parse(raw, live) {
  let r = String(raw).replace(/<<<THINK>>>[\s\S]*?(?:<<<ENDTHINK>>>|$)/, '');
  let artifact = null;
  const c = r.match(/<<<\s*CANVAS:?\s*([^>\n]*?)\s*>>>\s*([\s\S]*?)(?:<<<\s*END\s*>>>|(?=\n[ \t]*FOLLOW-?UPS?:)|$)/i);
  if (c) {
    artifact = { title: clean(c[1]).trim() || 'Draft', body: clean(c[2]).replace(/\s+$/, '') };
    r = r.replace(c[0], '\n');
  }
  const parts = r.split(/^[ \t]*FOLLOW-?UPS?:[ \t]*$/im);
  let text = parts[0];
  const followUps = parts.length > 1
    ? parts[1].split('\n').map(x => x.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, '').trim()).filter(Boolean).slice(0, 3)
    : [];
  if (live) {
    text = text.replace(/<<<[^>]*$/, '')
               .replace(/\n[ \t]*F(?:O(?:L(?:L(?:O(?:W(?:-?U(?:P(?:S?:?)?)?)?)?)?)?)?)?[ \t]*$/i, '');
  }
  return { text: clean(text).trim(), artifact, followUps };
}

function readFile(f) {
  return new Promise(resolve => {
    const isImage = f.type.startsWith('image/');
    const isText = !isImage && (f.type.startsWith('text/') || TEXT_EXT.test(f.name) || f.type === 'application/json');
    const ext = (f.name.split('.').pop() || 'file').slice(0, 4).toUpperCase();
    const base = { name: f.name, size: fmtSize(f.size), ext };
    if (!isImage && !isText) return resolve({ ...base, unsupported: true });
    const rd = new FileReader();
    rd.onerror = () => resolve({ ...base, unsupported: true });
    if (isImage) {
      rd.onload = () => {
        const url = URL.createObjectURL(f);
        resolve({ ...base, isImage: true, isDoc: false, url, bg: `url("${url}")`, data: rd.result });
      };
      rd.readAsDataURL(f);
    } else {
      rd.onload = () => {
        const t = String(rd.result);
        resolve({ ...base, isImage: false, isDoc: true, bg: 'none', url: '',
                  text: t.length > MAX_TEXT ? t.slice(0, MAX_TEXT) + '\n[…file truncated]' : t });
      };
      rd.readAsText(f);
    }
  });
}

function loadSaved() {
  try {
    const d = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    const chats = (d.chats || []).map(c => ({
      ...c,
      messages: (c.messages || []).map(m => ({
        ...m, shown: m.text, thoughtShown: m.thought || '',
        // image data is not kept between sessions (it would overflow storage),
        // so a restored image shows as a named file chip instead of a blank tile
        files: (m.files || []).map(f => ({ ...f, isImage: false, isDoc: true, bg: 'none', url: '' })),
      })),
    }));
    return { chats, settings: d.settings || {} };
  } catch (e) {
    return { chats: [], settings: {} };
  }
}

/* The menu: every preset whose model is installed, then any other installed
   model under its own name so nothing pulled with `ollama pull` is hidden. */
function presetsFor(installed) {
  const have = new Set(installed);
  const known = PRESETS.filter(p => have.has(p.model));
  const covered = new Set(PRESETS.map(p => p.model));
  const extra = installed.filter(m => !covered.has(m))
    .map(m => ({ id: m, name: m, desc: 'Installed model', model: m, detail: 'detailed', deep: false }));
  return [...known, ...extra];
}

/* Chats saved before presets existed stored a model name; map it forward. */
function migratePreset(id) {
  if (PRESETS.some(p => p.id === id)) return id;
  if (id === 'gemma4:12b') return 'deep';
  return DEFAULT_PRESET;
}

const saved = loadSaved();

class Component extends DCLogic {
  state = {
    chats: saved.chats,
    activeId: null, input: '', busy: false, copied: '', search: '',
    sidebarOpen: true, modelMenu: false, toolsOpen: false, chatMenu: null, renamingId: null, renameVal: '',
    think: saved.settings.think ?? this.props.thinkDefault ?? false,
    tool: null, pending: [], canvas: null, toast: '',
    models: [FALLBACK_MODEL], modelId: migratePreset(saved.settings.modelId || DEFAULT_PRESET),
    settingsOpen: false,
    name: saved.settings.name ?? '',
    style: saved.settings.style || 'Balanced',
    instructions: saved.settings.instructions || '',
    memory: saved.settings.memory ?? true,
    followups: saved.settings.followups ?? true,
    autoExpand: saved.settings.autoExpand ?? false,
  };
  scrollRef = React.createRef();
  fileRef = React.createRef();
  inputRef = React.createRef();

  async componentDidMount() {
    // Which models are really installed, and which one oriel pinned in memory.
    let info = {}, installed = [];
    try { info = await (await fetch('/oriel/info', { cache: 'no-store' })).json(); } catch (e) {}
    try {
      const tags = await (await fetch('/api/tags', { cache: 'no-store' })).json();
      installed = (tags.models || []).map(m => m.name).filter(n => !/embed/i.test(n));
    } catch (e) {}
    if (!installed.length && info.model) installed = [info.model];
    if (!installed.length) return;
    const models = presetsFor(installed);
    let modelId = this.state.modelId;
    if (!models.some(p => p.id === modelId)) modelId = (models.find(p => p.id === DEFAULT_PRESET) || models[0]).id;
    this.setState({ models, modelId });
    // oriel pinned its default model at startup; if this browser's preset runs
    // on a different one, move the pin so exactly one model is held in memory.
    const want = models.find(p => p.id === modelId).model;
    if (info.model && want !== info.model) this.swapPin(info.model, want);
  }

  componentDidUpdate() {
    const el = this.scrollRef.current;
    if (el && this.state.busy && el.scrollHeight - el.scrollTop - el.clientHeight < 240) el.scrollTop = el.scrollHeight;
    const ta = this.inputRef.current;
    if (ta) { ta.style.height = 'auto'; ta.style.height = Math.min(200, ta.scrollHeight) + 'px'; }
    clearTimeout(this.saveT);
    this.saveT = setTimeout(() => this.save(), 400);
  }
  componentWillUnmount() { clearTimeout(this.liveT); clearTimeout(this.saveT); try { this.ctrl?.abort(); } catch (e) {} }

  save() {
    const s = this.state;
    const chats = s.chats.map(c => ({
      id: c.id, title: c.title, pinned: !!c.pinned, updated: c.updated || Date.now(),
      messages: c.messages.filter(m => !m.awaiting).map(m => {
        const { shown, thoughtShown, awaiting, expanded, ...rest } = m;
        return { ...rest, files: (m.files || []).map(({ data, url, bg, text, ...f }) => f) };
      }),
    }));
    const settings = { name: s.name, style: s.style, instructions: s.instructions, memory: s.memory,
                       followups: s.followups, autoExpand: s.autoExpand, think: s.think, modelId: s.modelId };
    try { localStorage.setItem(LS_KEY, JSON.stringify({ chats, settings })); }
    catch (e) { this.showToast('Storage full — delete some old chats'); }
  }

  swapPin(from, to) {
    const post = body => fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    (from ? post({ model: from, keep_alive: 0 }) : Promise.resolve())
      .catch(() => {})
      .then(() => post({ model: to, keep_alive: -1 }))
      .catch(() => {});
  }

  model() { return this.state.models.find(m => m.id === this.state.modelId) || this.state.models[0] || FALLBACK_MODEL; }
  active() { return this.state.chats.find(c => c.id === this.state.activeId); }
  patchChat(id, fn) { this.setState(s => ({ chats: s.chats.map(c => c.id === id ? fn(c) : c) })); }
  patchMsg(idx, patch) {
    this.patchChat(this.state.activeId, c => ({ ...c, messages: c.messages.map((m, i) => i === idx ? { ...m, ...(typeof patch === 'function' ? patch(m) : patch) } : m) }));
  }
  patchLast(patch) { const c = this.active(); if (c) this.patchMsg(c.messages.length - 1, patch); }
  showToast(t) { this.setState({ toast: t }); clearTimeout(this.toastT); this.toastT = setTimeout(() => this.setState({ toast: '' }), 1800); }

  systemPrompt(tool) {
    const { name, style, instructions, memory, followups } = this.state;
    const L = [
      'You are Oriel, a helpful AI assistant. Tone: neutral, clear, direct.',
      // Worded carefully: an earlier "you cannot … see anything live" made the
      // model refuse attached images ("I am unable to process visual input").
      'You run entirely offline on the user\'s own computer, with no internet access: you cannot browse the web or look anything up.',
      'You CAN read images and text files the user attaches — describe and use them directly.',
      'If you are not sure of a fact, say so plainly. Never invent sources, links, names, numbers or dates.',
      // The design said "balanced about 130 words", which the model read as a
      // target: watched live, it reasoned "48 words … I need to elaborate to hit
      // 130" and padded a two-fact answer with filler. Phrase length as a
      // ceiling, and forbid padding outright.
      this.model().detail === 'detailed'
        ? `${LENGTH.detailed[style]} ${DETAIL_NOTE}`
        : `${LENGTH.brief[style]} Never pad an answer to reach a length.`,
    ];
    const first = name.trim().split(' ')[0];
    if (memory && first) L.push(`The user's name is ${first}.`);
    if (instructions.trim()) L.push(`The user's custom instructions: ${instructions.trim()}`);
    L.push('Formatting: plain text only, no markdown symbols such as ** or #. Leave a blank line between paragraphs. Use "- " for list items.');
    if (tool === 'canvas') {
      L.push('Reply with ONE short sentence, then a line "<<<CANVAS: Title>>>", then the full piece, then a line "<<<END>>>".');
    } else {
      L.push('If the user asks you to write or draft a longer piece (an email, letter, plan, essay, itinerary or story), reply with ONE short sentence, then a line "<<<CANVAS: Title>>>", then the piece, then a line "<<<END>>>". Otherwise just answer.');
    }
    if (followups) L.push('Finally, on its own line write "FOLLOWUPS:" and then 3 short follow-up questions the user might ask next (under 9 words each), one per line.');
    return L.join('\n');
  }

  toContent(m) {
    let text = m.text || '';
    for (const f of (m.files || [])) if (f.isDoc && f.text) text += `\n\n[Attached file: ${f.name}]\n${f.text}`;
    const imgs = (m.files || []).filter(f => f.isImage && f.data);
    if (!imgs.length) return text;
    return [{ type: 'text', text: text || 'Describe this image.' },
            ...imgs.map(f => ({ type: 'image_url', image_url: { url: f.data } }))];
  }

  buildMessages(history, tool) {
    const turns = history.filter(m => m.text || (m.files && m.files.length)).slice(-12).map(m => {
      if (m.role === 'user') return { role: 'user', content: this.toContent(m) };
      const piece = m.artifact ? `\n\n<<<CANVAS: ${m.artifact.title}>>>\n${m.artifact.body}\n<<<END>>>` : '';
      return { role: 'assistant', content: (m.text || '') + piece };
    });
    return [{ role: 'system', content: this.systemPrompt(tool) }, ...turns];
  }

  async send(textArg, opts = {}) {
    const text = (textArg ?? this.state.input).trim();
    if ((!text && !this.state.pending.length) || this.state.busy) return;
    const model = this.model();
    const tool = opts.tool !== undefined ? opts.tool : this.state.tool;
    const think = model.deep || !!(opts.think ?? this.state.think);
    const files = opts.keepFiles ? (opts.files || []) : this.state.pending;

    if (!this.state.activeId) {
      const id = 'c' + Date.now();
      const t = text || files[0]?.name || 'New chat';
      await new Promise(r => this.setState(s => ({ chats: [{ id, title: t.length > 40 ? t.slice(0, 40) + '…' : t, updated: Date.now(), messages: [] }, ...s.chats], activeId: id, canvas: null }), r));
    }
    const chatId = this.state.activeId;
    await new Promise(r => this.setState(s => ({
      chats: s.chats.map(c => c.id !== chatId ? c : { ...c, updated: Date.now(), messages: [
        ...(opts.replaceLast ? c.messages.slice(0, -1) : c.messages),
        ...(opts.replaceLast ? [] : [{ role: 'user', text, files, tool, think }]),
        { role: 'assistant', model: model.name, text: '', shown: '', thought: '', thoughtShown: '', awaiting: true, think, tool, steps: null, status: 'Working on it' },
      ] }),
      input: '', pending: [], busy: true, tool: null, toolsOpen: false,
    }), r));

    const started = Date.now();
    this.token = started;
    const ctrl = new AbortController();
    this.ctrl = ctrl;
    const history = this.active().messages.slice(0, -1);
    let content = '', reasoning = '', answerAt = 0;

    const render = final => {
      const p = parse(content, !final);
      const patch = { shown: p.text, thoughtShown: reasoning, awaiting: !content && !reasoning };
      if (!think || content) {
        patch.thinkDone = true;
        if (think && answerAt) patch.thoughtSecs = Math.max(1, Math.round((answerAt - started) / 1000));
      }
      if (p.artifact) patch.artifact = p.artifact;
      if (final) Object.assign(patch, { text: p.text, thought: reasoning, followUps: p.followUps, awaiting: false });
      this.patchLast(patch);
      // open the canvas the moment a piece starts arriving, so long drafts
      // are visibly being written rather than hidden behind a status line
      if (p.artifact && !this.state.canvas) {
        const c = this.active();
        if (c) this.setState({ canvas: { chatId: c.id, idx: c.messages.length - 1 } });
      }
    };
    const schedule = () => { if (!this.liveT) this.liveT = setTimeout(() => { this.liveT = 0; if (this.token === started) render(false); }, 40); };

    try {
      const res = await fetch('/v1/chat/completions', {
        method: 'POST', signal: ctrl.signal, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model.model, stream: true,
          temperature: tool === 'canvas' ? 0.7 : 0.5,
          max_tokens: model.detail === 'detailed' || think || tool === 'canvas' ? 4096 : 2048,
          ...(think ? {} : { reasoning_effort: 'none' }),
          messages: this.buildMessages(history, tool),
        }),
      });
      if (!res.ok) throw new Error(res.status === 404 ? `model ${model.model} is not installed` : `the engine returned ${res.status}`);
      const reader = res.body.getReader(), dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;
          let j; try { j = JSON.parse(payload); } catch (e) { continue; }
          const d = j.choices?.[0]?.delta || {};
          const r = d.reasoning || d.reasoning_content;
          if (r) reasoning += r;
          if (d.content) { if (!answerAt) answerAt = Date.now(); content += d.content; }
        }
        if (this.token !== started) return;
        schedule();
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return;  // stop() already tidied up
      if (this.token !== started) return;
      clearTimeout(this.liveT); this.liveT = 0;
      const msg = `I couldn't reach the local model (${e && e.message ? e.message : 'no response'}). Check that oriel is still running, then try again.`;
      this.patchLast({ awaiting: false, thinkDone: true, think: false, text: msg, shown: msg, error: true });
      this.setState({ busy: false });
      return;
    }
    if (this.token !== started) return;
    clearTimeout(this.liveT); this.liveT = 0;
    if (!content.trim() && !reasoning.trim()) content = 'The model returned an empty reply. Try rephrasing, or switch model.';
    render(true);
    this.finish();
  }

  finish() {
    const chat = this.active(); if (!chat) return;
    const idx = chat.messages.length - 1;
    this.patchLast({ thinkDone: true, awaiting: false });
    this.setState({ busy: false, ...(chat.messages[idx]?.artifact ? { canvas: { chatId: chat.id, idx } } : {}) });
  }

  stop() {
    this.token = null;
    try { this.ctrl?.abort(); } catch (e) {}
    clearTimeout(this.liveT); this.liveT = 0;
    this.patchLast(m => ({ awaiting: false, thinkDone: true, text: m.shown || '', shown: m.shown || '', stopped: true,
                           think: m.think && !!m.thoughtShown, thought: m.thoughtShown }));
    this.setState({ busy: false });
  }

  canvasMsg() {
    const cv = this.state.canvas; if (!cv) return null;
    const chat = this.state.chats.find(c => c.id === cv.chatId);
    return chat?.messages[cv.idx]?.artifact ? chat.messages[cv.idx] : null;
  }
  editCanvas(body) {
    const cv = this.state.canvas;
    this.patchChat(cv.chatId, c => ({ ...c, messages: c.messages.map((m, i) => i === cv.idx ? { ...m, artifact: { ...m.artifact, body } } : m) }));
  }
  copy(key, text) { navigator.clipboard?.writeText(text); this.setState({ copied: key }); setTimeout(() => this.setState(s => s.copied === key ? { copied: '' } : null), 1400); }
  commitRename() {
    const { renamingId, renameVal } = this.state;
    if (renamingId && renameVal.trim()) this.patchChat(renamingId, c => ({ ...c, title: renameVal.trim() }));
    this.setState({ renamingId: null });
  }
  copyChat() {
    const c = this.active(); if (!c) return;
    const txt = c.messages.map(m => {
      const who = m.role === 'user' ? 'You' : (m.model || 'Oriel');
      const piece = m.artifact ? `\n\n[${m.artifact.title}]\n${m.artifact.body}` : '';
      return `${who}:\n${m.text || ''}${piece}`;
    }).join('\n\n');
    navigator.clipboard?.writeText(`${c.title}\n\n${txt}`);
    this.showToast('Chat copied');
  }

  renderVals() {
    const s = this.state;
    const chat = this.active();
    const msgs = chat ? chat.messages : [];
    const lastIdx = msgs.length - 1;
    const q = s.search.trim().toLowerCase();
    const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
    const bucket = c => (c.updated || 0) >= startToday.getTime() ? 'Today' : Date.now() - (c.updated || 0) < 7 * DAY ? 'Previous 7 days' : 'Older';
    const filtered = s.chats.filter(c => !q || c.title.toLowerCase().includes(q)).sort((a, b) => (b.updated || 0) - (a.updated || 0));
    const groups = ['Pinned', 'Today', 'Previous 7 days', 'Older'].map(label => ({
      label,
      items: filtered.filter(c => label === 'Pinned' ? c.pinned : !c.pinned && bucket(c) === label).map(c => {
        const active = c.id === s.activeId, renaming = s.renamingId === c.id;
        return {
          title: c.title, renaming, showActive: active && !renaming, showInactive: !active && !renaming,
          open: () => !s.busy && this.setState({ activeId: c.id, canvas: null, chatMenu: null }),
          menuOpen: s.chatMenu === c.id,
          toggleMenu: () => this.setState({ chatMenu: s.chatMenu === c.id ? null : c.id }),
          pinLabel: c.pinned ? 'Unpin' : 'Pin',
          pin: () => { this.patchChat(c.id, x => ({ ...x, pinned: !x.pinned })); this.setState({ chatMenu: null }); },
          rename: () => this.setState({ renamingId: c.id, renameVal: c.title, chatMenu: null }),
          remove: () => { this.setState(st => ({ chats: st.chats.filter(x => x.id !== c.id), chatMenu: null, activeId: st.activeId === c.id ? null : st.activeId, canvas: st.activeId === c.id ? null : st.canvas })); this.showToast('Chat deleted'); },
        };
      }),
    })).filter(g => g.items.length);
    const model = this.model();
    const cmsg = this.canvasMsg();
    const canvasOpen = !!cmsg && s.canvas.chatId === s.activeId;
    const lastArtifactIdx = msgs.map((m, i) => m.artifact ? i : -1).filter(i => i >= 0).pop();
    const hour = new Date().getHours();
    const first = s.name.trim().split(' ')[0];
    const files = s.pending.map((f, i) => ({ ...f, remove: () => this.setState(st => ({ pending: st.pending.filter((_, k) => k !== i) })) }));
    const canSend = !s.busy && (!!s.input.trim() || s.pending.length > 0);
    const last = msgs[lastIdx];
    const followUps = !s.busy && s.followups && last?.role === 'assistant' && last.followUps?.length ? last.followUps : [];
    const deep = !!model.deep;
    const thinkOn = s.think || deep;

    return {
      sidebarOpen: s.sidebarOpen, sidebarClosed: !s.sidebarOpen,
      toggleSidebar: () => this.setState({ sidebarOpen: !s.sidebarOpen }),
      newChat: () => !s.busy && this.setState({ activeId: null, input: '', canvas: null }),
      search: s.search, onSearch: e => this.setState({ search: e.target.value }),
      groups, noResults: !!q && groups.length === 0,
      renameVal: s.renameVal, onRename: e => this.setState({ renameVal: e.target.value }),
      renameKey: e => { if (e.key === 'Enter') this.commitRename(); if (e.key === 'Escape') this.setState({ renamingId: null }); },
      renameCommit: () => this.commitRename(),
      closeMenus: () => this.setState({ modelMenu: false, toolsOpen: false, chatMenu: null }),
      userName: s.name.trim() || 'You', initial: (s.name.trim()[0] || 'O').toUpperCase(),
      planLabel: 'On this Mac · offline',
      openSettings: () => this.setState({ settingsOpen: true }),
      modelName: model.name, modelMenuOpen: s.modelMenu,
      toggleModelMenu: () => this.setState({ modelMenu: !s.modelMenu }),
      models: s.models.map(m => ({ ...m, active: m.id === s.modelId, pick: () => {
        const prev = this.model().model;
        this.setState({ modelId: m.id, modelMenu: false });
        // Flash ↔ Oriel 2 share weights: nothing to load. Only move the pin
        // when the preset really runs on a different model.
        if (prev !== m.model) this.swapPin(prev, m.model);
      } })),
      share: () => this.copyChat(),
      greeting: `${hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'}${s.memory && first ? ', ' + first : ''}. Where should we start?`,
      isEmpty: msgs.length === 0, hasMessages: msgs.length > 0,
      suggestions: SUGGESTIONS.map(x => ({ ...x, use: () => this.send(x.text, { think: !!x.think || s.think, tool: x.tool || null }) })),
      messages: msgs.map((m, idx) => {
        const shown = m.shown ?? m.text;
        const paras = m.role === 'assistant' ? (shown || '').split(/\n\s*\n/).filter(x => x.trim()).map(p => ({
          segs: [{ isCite: false, isText: true, t: p }],
        })) : [];
        const streaming = s.busy && idx === lastIdx;
        const done = m.role === 'assistant' && !streaming;
        const thinkLive = !!m.think && !m.thinkDone;
        const live = streaming && thinkLive;
        const expanded = m.expanded ?? (live ? true : s.autoExpand);
        const labelDone = m.think ? (m.thoughtSecs ? `Thought for ${m.thoughtSecs}s` : 'Thought') : '';
        return {
          isUser: m.role === 'user', isAssistant: m.role === 'assistant', text: m.text,
          modelLabel: m.model || 'Oriel',
          files: m.files || [], hasFiles: !!(m.files && m.files.length),
          hasToolTag: m.role === 'user' && !!m.tool, toolTag: TOOLS[m.tool] || '',
          edit: () => { this.setState({ input: m.text }); setTimeout(() => this.inputRef.current?.focus(), 0); },
          showDots: !!m.awaiting && !m.think, status: m.status,
          hasProcess: !!m.think && !m.error,
          processLive: live, processIdle: !live,
          processLabel: live ? 'Thinking…' : labelDone,
          chevron: expanded ? '180deg' : '0deg',
          toggleProcess: () => this.patchMsg(idx, { expanded: !expanded }),
          showThought: expanded && !!m.think && !!(m.thoughtShown || m.thought),
          thoughtShown: streaming ? m.thoughtShown : (m.thought || m.thoughtShown),
          showSteps: false, steps: [],
          meta: m.stopped ? 'Stopped' : m.error ? 'Not answered' : '', hasMeta: done && !!(m.stopped || m.error),
          paras,
          hasImages: false, images: [],
          hasArtifact: !!m.artifact && done,
          artifactTitle: m.artifact?.title,
          openArtifact: () => this.setState({ canvas: { chatId: s.activeId, idx } }),
          hasSources: false, sources: [],
          done, isLast: idx === lastIdx,
          copyLabel: s.copied === 'm' + idx ? 'Copied' : 'Copy',
          copy: () => this.copy('m' + idx, m.text + (m.artifact ? `\n\n${m.artifact.body}` : '')),
          upColor: m.rating === 'up' ? 'oklch(0.5 0.15 282)' : '#6b6b66',
          downColor: m.rating === 'down' ? 'oklch(0.52 0.18 25)' : '#6b6b66',
          like: () => this.patchMsg(idx, { rating: m.rating === 'up' ? null : 'up' }),
          dislike: () => this.patchMsg(idx, { rating: m.rating === 'down' ? null : 'down' }),
        };
      }),
      regenerate: () => {
        const u = msgs.filter(m => m.role === 'user').pop();
        if (u) this.send(u.text, { replaceLast: true, keepFiles: true, files: u.files || [], think: u.think, tool: u.tool || null });
      },
      hasFollowUps: followUps.length > 0,
      followUps: followUps.map(t => ({ text: t, use: () => this.send(t) })),
      dots: [{ delay: '0s' }, { delay: '.2s' }, { delay: '.4s' }],
      scrollRef: this.scrollRef, fileRef: this.fileRef, inputRef: this.inputRef,
      input: s.input,
      onInput: e => this.setState({ input: e.target.value }),
      onKey: e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.send(); } },
      placeholder: s.tool ? PLACEHOLDERS[s.tool] : 'Ask Oriel anything, or describe a task…',
      toolsOpen: s.toolsOpen, toggleTools: () => this.setState({ toolsOpen: !s.toolsOpen }),
      pickFiles: () => { this.setState({ toolsOpen: false }); this.fileRef.current?.click(); },
      pickCanvas: () => { this.setState({ tool: 'canvas', toolsOpen: false }); this.inputRef.current?.focus(); },
      hasTool: !!s.tool, toolLabel: TOOLS[s.tool] || '', clearTool: () => this.setState({ tool: null }),
      onFiles: async e => {
        const picked = [...(e.target.files || [])];
        e.target.value = '';
        const read = await Promise.all(picked.map(readFile));
        const ok = read.filter(f => !f.unsupported);
        const bad = read.filter(f => f.unsupported);
        if (ok.length) this.setState(st => ({ pending: [...st.pending, ...ok] }));
        if (bad.length) this.showToast(`Can't read ${bad.map(f => f.ext).join(', ')} yet — images and text files only`);
      },
      pending: files, hasPending: files.length > 0,
      thinkOn, thinkOff: !thinkOn,
      thinkTitle: deep ? `${model.name} always reasons first` : 'Reason before answering — slower, better at maths and logic',
      toggleThink: () => deep ? this.showToast(`${model.name} always reasons first`) : this.setState({ think: !s.think }),
      busy: s.busy, canSend, idleEmpty: !s.busy && !canSend,
      send: () => this.send(), stop: () => this.stop(),
      canvasOpen,
      hasCanvasClosed: !canvasOpen && lastArtifactIdx !== undefined,
      reopenCanvas: () => this.setState({ canvas: { chatId: s.activeId, idx: lastArtifactIdx } }),
      canvasTitle: cmsg?.artifact.title, canvasBody: cmsg?.artifact.body || '',
      canvasWords: cmsg ? cmsg.artifact.body.split(/\s+/).filter(Boolean).length + ' words' : '',
      onCanvasEdit: e => this.editCanvas(e.target.value),
      closeCanvas: () => this.setState({ canvas: null }),
      canvasCopyLabel: s.copied === 'canvas' ? 'Copied' : 'Copy',
      copyCanvas: () => this.copy('canvas', cmsg?.artifact.body || ''),
      canvasShorter: () => this.send(`Make “${cmsg?.artifact.title}” shorter and tighter. Current version:\n\n${cmsg?.artifact.body}`, { tool: 'canvas' }),
      canvasPolish: () => this.send(`Polish the wording of “${cmsg?.artifact.title}” without changing its meaning. Current version:\n\n${cmsg?.artifact.body}`, { tool: 'canvas' }),
      canvasFormal: () => this.send(`Rewrite “${cmsg?.artifact.title}” in a more formal tone. Current version:\n\n${cmsg?.artifact.body}`, { tool: 'canvas' }),
      hasToast: !!s.toast, toast: s.toast,
      settingsOpen: s.settingsOpen, closeSettings: () => this.setState({ settingsOpen: false }),
      onName: e => this.setState({ name: e.target.value }),
      styles: STYLES.map(x => ({ label: x, active: x === s.style, inactive: x !== s.style, pick: () => this.setState({ style: x }) })),
      instructions: s.instructions, onInstructions: e => this.setState({ instructions: e.target.value }),
      toggles: [
        { key: 'memory', label: 'Use my name', desc: 'Let Oriel address you by the name above.' },
        { key: 'followups', label: 'Suggest follow-ups', desc: 'Show suggested next questions under replies.' },
        { key: 'autoExpand', label: 'Show thinking by default', desc: 'Keep reasoning expanded after replies finish.' },
      ].map(t => ({ ...t, on: !!s[t.key], off: !s[t.key], flip: () => this.setState({ [t.key]: !s[t.key] }) })),
    };
  }
}
