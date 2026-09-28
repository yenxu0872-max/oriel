/* Oriel's picture maker, in its own worker so the page stays smooth.

   Z-Image Turbo (Alibaba Tongyi Lab, Apache 2.0) running on this computer's
   graphics chip through ONNX Runtime Web — ported from Microsoft's WebNN
   developer preview demo (MIT): Qwen3-4B reads the prompt, a 6B diffusion
   transformer paints it in 9 steps, a VAE turns that into pixels, and a
   safety checker looks at the result.

   Private: the model downloads once, from Hugging Face, into this site's own
   storage (OPFS) and is read from there; prompts and pictures never leave
   this worker except to the page that asked. */

const REV = '02e1d8cc5d10d9ff6c7ed1f54b173bd981381bc2';            // pinned: the files can never change under us
const REPO = `https://huggingface.co/webnn/Z-Image-Turbo/resolve/${REV}/`;
const ORT = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.29.0/dist/';
const TFJS = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js';
const FILES = {                                                     // exact sizes, from Hugging Face
  'tokenizer/tokenizer.json': 11422654, 'tokenizer/tokenizer_config.json': 9732,
  'onnx/text_encoder_model_q4f16.onnx': 57983622, 'onnx/text_encoder_model_q4f16.onnx_data': 2036236288,
  'onnx/text_encoder_model_q4f16.onnx_data_1': 124387328,
  'onnx/transformer_model_q4f16.onnx': 129947430, 'onnx/transformer_model_q4f16.onnx_data': 2032271360,
  'onnx/transformer_model_q4f16.onnx_data_1': 1507590144,
  'onnx/scheduler_step_model_f16.onnx': 3902, 'onnx/vae_pre_process_model_f16.onnx': 346,
  'onnx/vae_decoder_model_f16.onnx': 99209498,
  'onnx/sc_prep_model_f16.onnx': 1434, 'onnx/safety_checker_model_f16.onnx': 1604491,
  'onnx/safety_checker_model_f16.onnx_data': 606797824,
};
const TOTAL = Object.values(FILES).reduce((a, b) => a + b, 0);
const PARTS = {
  text_encoder: ['onnx/text_encoder_model_q4f16.onnx', 'onnx/text_encoder_model_q4f16.onnx_data', 'onnx/text_encoder_model_q4f16.onnx_data_1'],
  transformer: ['onnx/transformer_model_q4f16.onnx', 'onnx/transformer_model_q4f16.onnx_data', 'onnx/transformer_model_q4f16.onnx_data_1'],
  scheduler_step: ['onnx/scheduler_step_model_f16.onnx'],
  vae_pre_process: ['onnx/vae_pre_process_model_f16.onnx'],
  vae_decoder: ['onnx/vae_decoder_model_f16.onnx'],
  sc_prep: ['onnx/sc_prep_model_f16.onnx'],
  safety_checker: ['onnx/safety_checker_model_f16.onnx', 'onnx/safety_checker_model_f16.onnx_data'],
};

const post = (m, t) => self.postMessage(m, t || []);
const key = p => p.replace(/\//g, '__');
let ort, tokenizer, sessions = null, loading = null, fetching = null, abort = null;

async function folder() {
  const root = await navigator.storage.getDirectory();
  const top = await root.getDirectoryHandle('oriel-image', { create: true });
  return top.getDirectoryHandle('z-image-turbo-' + REV.slice(0, 7), { create: true });
}
async function sizeOf(dir, p) {
  try { return (await (await dir.getFileHandle(key(p))).getFile()).size; } catch (e) { return 0; }
}
async function status() {
  const dir = await folder();
  let have = 0;
  for (const [p, n] of Object.entries(FILES)) have += Math.min(n, await sizeOf(dir, p));
  return { have, total: TOTAL, ready: have >= TOTAL, loaded: !!sessions };
}

/* ------------------------------------------------------------------ download */
/* One file at a time, straight to disk; an interrupted download carries on
   where it stopped (Hugging Face honours byte ranges). */
async function download() {
  if (fetching) return fetching;
  abort = new AbortController();
  fetching = (async () => {
    navigator.storage?.persist?.().catch(() => {});
    const dir = await folder();
    const est = await navigator.storage?.estimate?.().catch(() => null);
    const need = TOTAL - (await status()).have;
    if (est && est.quota && est.quota - est.usage < need * 1.02) throw new Error(`QuotaExceeded: needs ${(need / 1e9).toFixed(1)} GB of free space`);
    let done = 0, last = 0;
    const tick = force => {
      const now = performance.now();
      if (force || now - last > 250) { last = now; post({ type: 'progress', have: done, total: TOTAL }); }
    };
    for (const [p, n] of Object.entries(FILES)) {
      const base = done;
      // a dropped connection is retried by itself, from where it stopped
      for (let attempt = 0; ; attempt++) {
        try { await fetchFile(dir, p, n, bytes => { done = base + bytes; tick(); }); break; }
        catch (e) {
          if (e.name === 'AbortError' || attempt >= 5) throw e;
          await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
        }
      }
      done = base + n;
    }
    tick(true);
    return status();
  })();
  try { return await fetching; } finally { fetching = null; abort = null; }
}

async function fetchFile(dir, p, n, onBytes) {
  let have = await sizeOf(dir, p);
  onBytes(have);
  if (have === n) return;
  const handle = await dir.getFileHandle(key(p), { create: true });
  const file = await handle.createSyncAccessHandle();
  try {
    if (have > n) { file.truncate(0); have = 0; }
    const res = await fetch(REPO + p, { headers: have ? { Range: `bytes=${have}-` } : {}, signal: abort.signal });
    if (have && res.status !== 206) { file.truncate(0); have = 0; }          // no ranges: start this file again
    if (!res.ok) throw new Error(`download failed (${res.status}) for ${p}`);
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      file.write(value, { at: have });
      have += value.byteLength;
      onBytes(have);
    }
    file.flush();
  } finally { file.close(); }
  if (have !== n) throw new Error(`network: ${p} stopped at ${have} of ${n} bytes`);
}

/* ------------------------------------------------------------------ load */
async function load() {
  if (sessions) return sessions;
  if (loading) return loading;
  loading = (async () => {
    const dir = await folder();
    const file = async p => (await dir.getFileHandle(key(p))).getFile();
    // the tokenizer: Qwen3's, from the files we stored
    const T = await import(TFJS);
    const json = JSON.parse(await (await file('tokenizer/tokenizer.json')).text());
    const cfg = JSON.parse(await (await file('tokenizer/tokenizer_config.json')).text());
    const Cls = T[cfg.tokenizer_class] || T.PreTrainedTokenizer;
    tokenizer = new Cls(json, cfg);
    // the engine: JSPI build where the browser has it (smaller, faster)
    const dist = typeof WebAssembly.Suspending === 'function' ? 'jspi' : 'webgpu';
    ort = await import(`${ORT}ort.${dist}.bundle.min.mjs`);
    ort.env.wasm.wasmPaths = ORT;
    ort.env.logLevel = 'error';
    const s = {};
    const names = Object.keys(PARTS);
    for (let i = 0; i < names.length; i++) {
      const name = names[i], [graph, ...data] = PARTS[name];
      post({ type: 'loading', part: name, i, n: names.length });
      const opts = { executionProviders: ['webgpu'], logSeverityLevel: 3,
                     externalData: await Promise.all(data.map(async p => ({ path: p.split('/').pop(), data: await file(p) }))) };
      s[name] = await ort.InferenceSession.create(new Uint8Array(await (await file(graph)).arrayBuffer()), opts);
    }
    sessions = s;
    return s;
  })();
  try { return await loading; } finally { loading = null; }
}
async function unload() {
  const s = sessions; sessions = null;
  if (s) await Promise.allSettled(Object.values(s).map(x => x.release()));
}

/* ------------------------------------------------------------------ paint */
function schedule(steps) {             // flow-matching timesteps with shift 3, as the demo's scheduler.js
  const shift = 3, T = 1000;
  const sig = s => (shift * s) / (1 + (shift - 1) * s);
  const smax = sig(1), smin = sig(1 / T);
  const out = new Float32Array(steps);
  for (let i = 0; i < steps; i++) {
    const t = steps === 1 ? smax * T : smax * T + ((smin * T - smax * T) * i) / (steps - 1);
    out[i] = (T - sig(t / T) * T) / T;
  }
  out[steps - 1] = 1;
  return out;
}
function noise(n, seed) {              // seeded normal noise (mulberry32 + Box-Muller)
  let t = seed >>> 0;
  const rand = () => { t += 0x6d2b79f5; let r = Math.imul(t ^ (t >>> 15), t | 1); r ^= r + Math.imul(r ^ (r >>> 7), r | 61); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
  const out = new Float16Array(n);
  for (let i = 0; i < n; i += 2) {
    const u = rand() || Number.EPSILON, v = rand();
    const m = Math.sqrt(-2 * Math.log(u));
    out[i] = m * Math.cos(2 * Math.PI * v);
    if (i + 1 < n) out[i + 1] = m * Math.sin(2 * Math.PI * v);
  }
  return out;
}
async function paint({ prompt, seed, steps = 9, size = 512 }) {
  const s = await load();
  const t0 = performance.now();
  post({ type: 'painting', step: 0, steps });
  const text = tokenizer.apply_chat_template([{ role: 'user', content: prompt }], { tokenize: false, add_generation_prompt: true, enable_thinking: true });
  const enc = tokenizer([text], { padding: false, max_length: 512, truncation: true, return_tensor: false });
  const ids = BigInt64Array.from(enc.input_ids[0].map(BigInt)), mask = BigInt64Array.from(enc.attention_mask[0].map(BigInt));
  const L = ids.length;
  const { encoder_hidden_states: hidden } = await s.text_encoder.run({
    input_ids: new ort.Tensor('int64', ids, [1, L]), attention_mask: new ort.Tensor('int64', mask, [1, L]) });
  const dims = [1, 16, size / 8, size / 8];
  let latents = new ort.Tensor('float16', noise(dims.reduce((a, b) => a * b, 1), seed), dims);
  const ts = schedule(steps);
  for (let i = 0; i < steps; i++) {
    const { sample } = await s.transformer.run({ hidden_states: latents, timestep: new ort.Tensor('float16', Float16Array.of(ts[i]), [1]),
                                                 encoder_hidden_states: hidden });
    const { latents_out } = await s.scheduler_step.run({ noise_pred: sample, latents, step_info: new ort.Tensor('float16', Float16Array.of(i, steps), [2]) });
    latents = latents_out;
    post({ type: 'painting', step: i + 1, steps });
  }
  const { scaled_latents } = await s.vae_pre_process.run({ latents });
  const { sample: img } = await s.vae_decoder.run({ latent_sample: scaled_latents });
  const { clip_input } = await s.sc_prep.run({ sample: img });
  const { has_nsfw_concepts } = await s.safety_checker.run({ clip_input });
  // [-1, 1] planar RGB -> RGBA bytes
  const px = img.data, n = size * size, rgba = new Uint8ClampedArray(n * 4);
  for (let j = 0; j < n; j++) {
    rgba[j * 4] = (px[j] / 2 + 0.5) * 255;
    rgba[j * 4 + 1] = (px[j + n] / 2 + 0.5) * 255;
    rgba[j * 4 + 2] = (px[j + 2 * n] / 2 + 0.5) * 255;
    rgba[j * 4 + 3] = 255;
  }
  return { rgba, size, flagged: !!has_nsfw_concepts.data[0], ms: Math.round(performance.now() - t0) };
}

/* ------------------------------------------------------------------ messages */
self.onmessage = async ({ data: m }) => {
  try {
    if (m.type === 'status') post({ type: 'status', id: m.id, ...(await status()) });
    else if (m.type === 'download') post({ type: 'downloaded', id: m.id, ...(await download()) });
    else if (m.type === 'cancel') { abort?.abort(); post({ type: 'cancelled', id: m.id }); }
    else if (m.type === 'load') { await load(); post({ type: 'loaded', id: m.id }); }
    else if (m.type === 'paint') { const r = await paint(m); post({ type: 'image', id: m.id, ...r }, [r.rgba.buffer]); }
    else if (m.type === 'unload') { await unload(); post({ type: 'unloaded', id: m.id }); }
    else if (m.type === 'delete') {
      abort?.abort(); await unload();
      const root = await navigator.storage.getDirectory();
      await root.removeEntry('oriel-image', { recursive: true }).catch(() => {});
      post({ type: 'deleted', id: m.id });
    }
  } catch (e) {
    post({ type: 'error', id: m.id, error: String(e?.message || e), name: e?.name || '' });
  }
};
