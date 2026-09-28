#!/usr/bin/env python3
"""Builds web/catalog.json — every model worth finding, from every app.

    python3 web/_build/hub_fetch.py hf gguf ollama lmstudio   (fetch the raw lists, ~10 min)
    python3 web/_build/hub_build.py                            (merge them, seconds)

What goes in:
  - every model on Hugging Face from the past year that people actually use
    (10+ likes), of the kinds you can run yourself: chat, vision, image, video,
    speech, voices, embeddings — minus compressed copies (they become download
    options of their original), add-ons (LoRAs) and adults-only models
  - every model in Ollama's library and LM Studio's catalog, whatever its age
  - every model Oriel runs in the browser (web/models.json, hand-written words)
The same model is usually in several places under different names
(`qwen3.5:9b`, `Qwen/Qwen3.5-9B`, `qwen/qwen3.5-9b`): they're matched by name
and size, so each model appears once with all the ways to get it.
"""
import json
import math
import re
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
CACHE = HERE / "cache"
WEB = HERE.parent
OUT = WEB / "catalog.json"
CUTOFF = "2025-09-27"          # "released in the past year"
MIN_LIKES = 10

KIND = {
    "text-generation": ["chat"], "image-text-to-text": ["chat", "vision"], "any-to-any": ["chat", "vision", "omni"],
    "text-to-image": ["image"], "image-to-image": ["image-edit"], "text-to-video": ["video"], "image-to-video": ["video"],
    "automatic-speech-recognition": ["speech"], "text-to-speech": ["voice"], "text-to-audio": ["audio"],
    "audio-text-to-text": ["chat", "hearing"], "feature-extraction": ["embed"], "sentence-similarity": ["embed"],
}

# Orgs that re-upload other people's models in other formats: never a model of their own.
MIRRORS = {"mlx-community", "lmstudio-community", "bartowski", "mradermacher", "onnx-community", "QuantFactory",
           "TheBloke", "RedHatAI", "nm-testing", "second-state", "ggml-org", "MaziyarPanahi", "DevQuasar", "NexaAI",
           "Xenova", "unsloth", "noctrex", "cpatonn", "QuantTrio", "Intel", "AMD", "amd", "webnn", "gaianet",
           "ModelCloud", "neuralmagic", "turboderp", "LoneStriker", "bullerwins", "tensorblock", "legraphista",
           "lefromage", "Mungert", "calcuis", "city96", "Kijai", "Comfy-Org", "jinaai-mirror", "openvino",
           "OpenVINO", "FastFlowLM", "llmware", "nvidia-mirror", "mlx-vision", "Qwen-mirror"}
CONVERTED = re.compile(r"[-_.](gguf|awq|gptq|fp8|fp4|nvfp4|mxfp4|int4|int8|w4a16|w8a8|4bit|8bit|6bit|3bit|bnb|mlx|exl2|exl3|onnx|dwq|q4|q8|quantized|quant|abliterated-gguf)\b", re.I)

# The makers people know, by their Hugging Face name. Anyone else is shown as
# "community" — often good, but not from the lab that made the original.
LABS = {
    "Qwen": "Alibaba (Qwen)", "meta-llama": "Meta", "google": "Google", "microsoft": "Microsoft", "mistralai": "Mistral AI",
    "deepseek-ai": "DeepSeek", "nvidia": "NVIDIA", "openai": "OpenAI", "ibm-granite": "IBM", "LiquidAI": "Liquid AI",
    "zai-org": "Z.ai (GLM)", "THUDM": "Z.ai (GLM)", "tencent": "Tencent", "allenai": "Ai2", "black-forest-labs": "Black Forest Labs",
    "Lightricks": "Lightricks", "stepfun-ai": "StepFun", "ByteDance": "ByteDance", "ByteDance-Seed": "ByteDance",
    "bytedance-research": "ByteDance", "XiaomiMiMo": "Xiaomi", "moonshotai": "Moonshot AI", "MiniMaxAI": "MiniMax",
    "baidu": "Baidu", "inclusionAI": "Ant Group", "CohereLabs": "Cohere", "CohereForAI": "Cohere", "HuggingFaceTB": "Hugging Face",
    "HuggingFaceM4": "Hugging Face", "huggingface": "Hugging Face", "openbmb": "OpenBMB", "Tongyi-MAI": "Alibaba (Tongyi)",
    "stabilityai": "Stability AI", "apple": "Apple", "amazon": "Amazon", "Salesforce": "Salesforce", "tiiuae": "TII (Falcon)",
    "LGAI-EXAONE": "LG AI", "NousResearch": "Nous Research", "ServiceNow-AI": "ServiceNow", "Snowflake": "Snowflake",
    "BAAI": "BAAI", "jinaai": "Jina AI", "nomic-ai": "Nomic", "mixedbread-ai": "Mixedbread", "Alibaba-NLP": "Alibaba",
    "hexgrad": "Kokoro (hexgrad)", "ResembleAI": "Resemble AI", "sesame": "Sesame", "coqui": "Coqui", "fishaudio": "Fish Audio",
    "k2-fsa": "k2-fsa", "openai-community": "OpenAI", "facebook": "Meta", "Wan-AI": "Alibaba (Wan)", "tencent-hunyuan": "Tencent",
    "HiDream-ai": "HiDream", "rednote-hilab": "Xiaohongshu", "meituan-longcat": "Meituan (LongCat)", "ACE-Step": "ACE Studio",
    "OpenGVLab": "Shanghai AI Lab", "internlm": "Shanghai AI Lab", "Skywork": "Skywork", "arcee-ai": "Arcee",
    "PrimeIntellect": "Prime Intellect", "swiss-ai": "Swiss AI", "utter-project": "EuroLLM", "ai21labs": "AI21",
    "01-ai": "01.AI", "upstage": "Upstage", "kyutai": "Kyutai", "canopylabs": "Canopy Labs", "SWivid": "F5-TTS",
    "nari-labs": "Nari Labs", "Zyphra": "Zyphra", "vikhyatk": "Moondream", "moondream": "Moondream", "h2oai": "H2O.ai",
    "prism-ml": "PrismML", "essentialai": "Essential AI", "Motif-Technologies": "Motif", "kakaocorp": "Kakao",
    "naver-hyperclovax": "Naver", "sarvamai": "Sarvam AI", "trillionlabs": "Trillion Labs", "OpenMOSS-Team": "OpenMOSS (Fudan)",
    "fal": "fal", "Hcompany": "H Company", "ZhipuAI": "Z.ai (GLM)", "lightonai": "LightOn", "answerdotai": "Answer.AI",
    "bigcode": "BigCode", "Kwai-Kolors": "Kuaishou (Kolors)", "Kwaipilot": "Kuaishou", "AIDC-AI": "Alibaba (AIDC)",
    "SmilingWolf": "SmilingWolf", "zed-industries": "Zed", "all-hands": "All Hands", "mistral-community": "Mistral AI",
    "ibm": "IBM", "ibm-research": "IBM", "Alibaba-Apsara": "Alibaba", "ggerganov": "ggml", "FunAudioLLM": "Alibaba (FunAudio)",
    "Kijai-official": "Kijai", "playgroundai": "Playground", "Efficient-Large-Model": "NVIDIA (MIT Han Lab)",
}
# Ollama and LM Studio models that don't match anything on Hugging Face: guess the maker from the name.
PREFIX_MAKER = [
    ("llama", "meta-llama"), ("codellama", "meta-llama"), ("gemma", "google"), ("codegemma", "google"), ("functiongemma", "google"),
    ("embeddinggemma", "google"), ("medgemma", "google"), ("qwen", "Qwen"), ("qwq", "Qwen"), ("phi", "microsoft"),
    ("mistral", "mistralai"), ("mixtral", "mistralai"), ("codestral", "mistralai"), ("devstral", "mistralai"),
    ("magistral", "mistralai"), ("ministral", "mistralai"), ("mathstral", "mistralai"), ("voxtral", "mistralai"),
    ("deepseek", "deepseek-ai"), ("granite", "ibm-granite"), ("gpt-oss", "openai"), ("glm", "zai-org"), ("codegeex", "zai-org"),
    ("kimi", "moonshotai"), ("minimax", "MiniMaxAI"), ("nemotron", "nvidia"), ("olmo", "allenai"), ("tulu", "allenai"),
    ("smollm", "HuggingFaceTB"), ("falcon", "tiiuae"), ("command", "CohereLabs"), ("aya", "CohereLabs"), ("lfm", "LiquidAI"),
    ("exaone", "LGAI-EXAONE"), ("hermes", "NousResearch"), ("nous-hermes", "NousResearch"), ("moondream", "vikhyatk"),
    ("nomic", "nomic-ai"), ("mxbai", "mixedbread-ai"), ("bge", "BAAI"), ("snowflake", "Snowflake"), ("starcoder", "bigcode"),
    ("ernie", "baidu"), ("hunyuan", "tencent"), ("seed", "ByteDance-Seed"), ("mimo", "XiaomiMiMo"), ("ling", "inclusionAI"),
    ("ring", "inclusionAI"), ("internvl", "OpenGVLab"), ("internlm", "internlm"), ("minicpm", "openbmb"), ("yi", "01-ai"),
    ("solar", "upstage"), ("cogito", "deepcogito"), ("orca", "microsoft"), ("wizardlm", "microsoft"), ("llava", "liuhaotian"),
    ("bonsai", "prism-ml"), ("jina", "jinaai"), ("all-minilm", "sentence-transformers"), ("paraphrase", "sentence-transformers"),
    ("tinyllama", "TinyLlama"), ("dolphin", "cognitivecomputations"), ("openchat", "openchat"), ("zephyr", "HuggingFaceH4"),
    ("stablelm", "stabilityai"), ("stable-code", "stabilityai"), ("sailor", "sail"), ("athene", "Nexusflow"), ("reflection", "mattshumer"),
    ("marco", "AIDC-AI"), ("r1-1776", "perplexity-ai"), ("opencoder", "infly"), ("smallthinker", "PowerInfer"),
    ("apertus", "swiss-ai"), ("step", "stepfun-ai"), ("longcat", "meituan-longcat"), ("ling", "inclusionAI"),
]
EXTRA_NAMES = {"deepcogito": "Deep Cogito", "liuhaotian": "LLaVA", "sentence-transformers": "Sentence Transformers",
               "TinyLlama": "TinyLlama", "cognitivecomputations": "Cognitive Computations", "openchat": "OpenChat",
               "HuggingFaceH4": "Hugging Face", "sail": "Sea AI Lab", "Nexusflow": "Nexusflow", "mattshumer": "Matt Shumer",
               "perplexity-ai": "Perplexity", "infly": "INF", "PowerInfer": "PowerInfer"}

# licence id (Hugging Face tag) -> (words, free for business?)
LICENCE = {
    "apache-2.0": ("Apache 2.0", True), "mit": ("MIT", True), "bsd-3-clause": ("BSD", True), "bsd-2-clause": ("BSD", True),
    "cc-by-4.0": ("CC BY 4.0", True), "cc-by-sa-4.0": ("CC BY-SA 4.0", True), "cc0-1.0": ("Public domain", True),
    "openrail": ("OpenRAIL", True), "openrail++": ("OpenRAIL++", True), "creativeml-openrail-m": ("OpenRAIL-M", True),
    "bigscience-openrail-m": ("OpenRAIL-M", True), "llama2": ("Llama 2", True), "llama3": ("Llama 3", True),
    "llama3.1": ("Llama 3.1", True), "llama3.2": ("Llama 3.2", True), "llama3.3": ("Llama 3.3", True), "llama4": ("Llama 4", True),
    "gemma": ("Gemma", True), "gpl-3.0": ("GPL 3.0", True), "agpl-3.0": ("AGPL 3.0", True), "lgpl-3.0": ("LGPL 3.0", True),
    "afl-3.0": ("AFL 3.0", True), "artistic-2.0": ("Artistic 2.0", True), "unlicense": ("Unlicense", True),
    "cc-by-nc-4.0": ("CC BY-NC 4.0", False), "cc-by-nc-sa-4.0": ("CC BY-NC-SA 4.0", False), "cc-by-nc-nd-4.0": ("CC BY-NC-ND 4.0", False),
    "cc-by-nc-3.0": ("CC BY-NC 3.0", False), "cc-by-nc-2.0": ("CC BY-NC 2.0", False), "deepseek": ("DeepSeek", True),
    "other": ("The maker's own licence", None), "unknown": ("Not stated", None),
}
PRONOUN = {"chat": "chat model", "vision": "chat model that also sees images", "omni": "model that handles text, images and sound",
           "image": "image generator", "image-edit": "image editor", "video": "video generator", "speech": "speech-to-text model",
           "voice": "text-to-speech voice model", "audio": "sound and music generator", "hearing": "model that listens to audio",
           "embed": "embedding model for search"}


def load(name, default=None):
    p = CACHE / name
    return json.loads(p.read_text()) if p.exists() else default


def norm(s):
    return re.sub(r"[^a-z0-9]", "", s.lower())


def core(name):
    """A model's name without the words that differ between apps."""
    n = name.lower().split("/")[-1]
    for _ in range(3):
        n = re.sub(r"[-_.](instruct|it|chat|hf|gguf|mlx|latest|preview)$", "", n)
        n = re.sub(r"[-_.](2[3-9][01]\d)$", "", n)          # release codes like -2506 / -2507
    return norm(n)


def keys(name):
    """Every spelling a model might go by, most exact first: its core name,
    without the "active parameters" part (30B-A3B vs 30b), and as a bag of
    words (llama3.2-vision-11b vs Llama-3.2-11B-Vision)."""
    c = core(name)
    n = name.lower().split("/")[-1]
    for _ in range(3):
        n = re.sub(r"[-_.](instruct|it|chat|hf|gguf|mlx|latest|preview)$", "", n)
        n = re.sub(r"[-_.](2[3-9][01]\d)$", "", n)
    noact = re.sub(r"[-_.]a\d+(?:\.\d+)?b(?=$|[-_.])", "", n)
    bag = lambda x: " ".join(sorted(t for t in re.split(r"[^a-z0-9]+|(?<=[a-z])(?=\d)|(?<=\d)(?=[a-z])", x) if t))
    out = [c, norm(noact), "bag:" + bag(n), "bag:" + bag(noact)]
    return list(dict.fromkeys(out))


def num(s):
    """'53.3K' -> 53300."""
    if not s:
        return 0
    m = re.match(r"([\d.,]+)\s*([KMB]?)", str(s).replace(",", ""))
    if not m:
        return 0
    return float(m.group(1)) * {"": 1, "K": 1e3, "M": 1e6, "B": 1e9}[m.group(2)]


def params_from_name(name):
    """(total, active) in billions from names like 'Qwen3-30B-A3B' or 'gemma-3n-E4B'."""
    n = name.split("/")[-1]
    tot = re.search(r"(?<![\w.])(?:e)?(\d+(?:\.\d+)?)\s*([bm])(?![a-z])", n, re.I)
    act = re.search(r"[-_]a(\d+(?:\.\d+)?)b\b", n, re.I)
    t = float(tot.group(1)) / (1000 if tot and tot.group(2).lower() == "m" else 1) if tot else None
    return t, (float(act.group(1)) if act else None)


ACRONYMS = {"asr", "tts", "ocr", "vl", "moe", "gpt", "llm", "r1", "rl", "sft", "dpo", "api", "ai", "3d", "hd", "xl", "sd", "vae", "ar", "omni"}


def pretty(repo):
    """'meta-llama/Llama-2-7b-chat-hf' -> 'Llama 2 7B Chat'; leaves names a maker already styled alone."""
    n = repo.split("/")[-1]
    n = re.sub(r"[-_]+", " ", n)
    for _ in range(2):
        n = re.sub(r"\s+(instruct|it|hf|gguf)$", "", n, flags=re.I).strip()
    words = []
    for w in n.split():
        if re.fullmatch(r"\d+(\.\d+)?[bmk]", w, re.I):
            w = w[:-1] + w[-1].upper()                      # 7b -> 7B
        elif w.lower() in ACRONYMS and w.islower():
            w = w.upper()
        elif w.isalpha() and w.islower() and len(w) > 1:
            w = w.capitalize()
        words.append(w)
    return " ".join(words)


BRANDS = {"deepseek": "DeepSeek", "minicpm": "MiniCPM", "llava": "LLaVA", "olmo": "OLMo", "tinyllama": "TinyLlama",
          "smollm": "SmolLM", "openchat": "OpenChat", "codellama": "Code Llama", "starcoder": "StarCoder", "qwq": "QwQ",
          "gpt": "gpt", "oss": "oss", "mxbai": "mxbai", "exaone": "EXAONE", "glm": "GLM", "ernie": "ERNIE", "internvl": "InternVL",
          "lfm": "LFM", "vl": "VL", "ocr": "OCR", "moe": "MoE", "tts": "TTS", "r1": "R1", "v": "V", "embed": "Embed",
          "nomic": "Nomic", "bge": "BGE", "kimi": "Kimi", "phi": "Phi"}
SPACED = {"llama", "gemma", "granite", "olmo", "falcon", "nemotron", "hermes", "dolphin", "exaone", "ernie", "aya", "phi"}


def pretty_ollama(name, tag):
    words = []
    for w in name.split("-"):
        m = re.fullmatch(r"([a-z]+)([\d.]*)", w)
        if m:
            brand = BRANDS.get(m.group(1)) or m.group(1).capitalize()
            ver = m.group(2)
            sep = " " if ver and m.group(1) in SPACED else ""
            if brand == "Phi" and ver:
                sep = "-"
            words.append(brand + sep + ver)
        else:
            words.append(BRANDS.get(w) or w.upper() if re.fullmatch(r"[a-z]\d|r\d|v\d", w) else BRANDS.get(w, w.capitalize()))
    fam = " ".join(words)
    size = tag.upper() if re.fullmatch(r"[\d.]+[bm]|e\d+b|\d+x\d+b", tag) else tag.replace("-", " ")
    return f"{fam} {size}".strip() if tag not in ("latest",) else fam


BITS = {"Q4_K_M": 4.85, "Q4_K_S": 4.6, "IQ4_XS": 4.3, "Q4_0": 4.55, "Q5_K_M": 5.7, "Q6_K": 6.6, "Q8_0": 8.5}


def gb_est(b, q):
    """What a file weighs when nobody says: parameters x bits per parameter."""
    return round(b * BITS.get(q or "Q4_K_M", 4.85) / 8 + 0.05, 1) if b else None


def licence(tags):
    for t in tags or []:
        if t.startswith("license:"):
            return t.split(":", 1)[1]
    return "unknown"


def maker_of(org):
    return LABS.get(org) or EXTRA_NAMES.get(org) or org


def main():
    curated = json.loads((WEB / "models.json").read_text())
    file_sizes = load("sizes.json", {})
    # ---------------------------------------------------------------- Hugging Face
    hf = {}
    for f in sorted(CACHE.glob("hf-*.json")):
        if f.name == "hf-gguf.json":
            continue
        tag = f.name[3:-5]
        for r in json.loads(f.read_text()):
            e = hf.setdefault(r["id"], dict(r, kinds=[]))
            for k in KIND.get(tag, []):
                if k not in e["kinds"]:
                    e["kinds"].append(k)

    def keep(r, recent_only=True):
        org = r["id"].split("/")[0]
        rel = (r.get("baseModels") or {}).get("relation")
        if rel in ("quantized", "adapter") or org in MIRRORS or CONVERTED.search(r["id"].split("/")[-1]):
            return False
        if "not-for-all-audiences" in (r.get("tags") or []):
            return False
        if r.get("likes", 0) < MIN_LIKES:
            return False
        return not recent_only or (r.get("createdAt") or "") >= CUTOFF

    by_key = defaultdict(list)
    for r in hf.values():
        if keep(r, recent_only=False):
            for k in keys(r["id"]):
                by_key[k].append(r)
    for v in by_key.values():             # the lab's own chat version first
        v.sort(key=lambda r: (r["id"].split("/")[0] not in LABS, "conversational" not in (r.get("tags") or []),
                              bool(re.search(r"base\b", r["id"], re.I)), -r.get("likes", 0)))

    def match(*names):
        for n in names:
            if not n:
                continue
            for k in keys(n):
                if by_key.get(k):
                    return by_key[k][0]
        return None

    chosen = {r["id"]: r for r in hf.values() if keep(r)}

    # ---------------------------------------------------------------- GGUF files
    gguf_for = defaultdict(list)
    for g in load("hf-gguf.json", []):
        bm = g.get("baseModels") or {}
        if bm.get("relation") != "quantized":
            continue
        for b in bm.get("models", []):
            gguf_for[b["id"]].append(g)
    QUANTIZERS = ["unsloth", "bartowski", "lmstudio-community", "ggml-org", "mradermacher", "QuantFactory", "second-state", "MaziyarPanahi"]

    def best_gguf(base_id):
        cands = gguf_for.get(base_id) or []
        if not cands:
            return None
        org = base_id.split("/")[0]

        def rank(g):
            o = g["id"].split("/")[0]
            return (o != org, QUANTIZERS.index(o) if o in QUANTIZERS else 99, -(g.get("downloads") or 0))
        for g in sorted(cands, key=rank):
            files = [f for f in g["files"] if "/" not in f and "mmproj" not in f.lower()]
            for q in ("Q4_K_M", "Q4_K_S", "IQ4_XS", "Q4_0", "Q5_K_M", "Q6_K", "Q8_0"):
                pick = [f for f in files if q.lower() in f.lower() and not re.search(r"-\d{5}-of-\d{5}", f)]
                if pick:
                    return {"repo": g["id"], "file": sorted(pick, key=len)[0], "q": q}
            if g["files"]:
                return {"repo": g["id"], "file": None, "q": None}     # split or unusual: link to the page
        return None

    # ---------------------------------------------------------------- entries
    out = {}

    def entry_from_hf(r):
        repo = r["id"]
        org = repo.split("/")[0]
        st = (r.get("safetensors") or {}).get("total")
        tot, act = params_from_name(repo)
        b = round(st / 1e9, 2) if st else tot
        kinds = list(r.get("kinds") or ["chat"])
        low = repo.lower()
        if "chat" in kinds and re.search(r"cod(e|er|ing)|devstral|swe", low):
            kinds.append("code")
        if "chat" in kinds and (re.search(r"think|reason|[-_]r1\b|qwq|math", low) or "reasoning" in (r.get("tags") or [])):
            kinds.append("reason")
        base = "chat" in kinds and "conversational" not in (r.get("tags") or []) and (re.search(r"base\b|pretrain", low) or r.get("pipeline_tag") == "text-generation")
        lic = licence(r.get("tags"))
        bm = r.get("baseModels") or {}
        e = {
            "id": norm(repo)[:60], "name": pretty(repo), "org": org, "kinds": kinds,
            "b": b, "act": act, "date": (r.get("createdAt") or "")[:10], "lic": lic,
            "likes": r.get("likes", 0), "dl": r.get("downloads", 0), "trend": r.get("trendingScore", 0),
            "hf": repo, "gated": bool(r.get("gated")),
        }
        if base:
            e["base"] = True
        if org not in LABS:
            e["community"] = True
            if bm.get("relation") in ("finetune", "merge") and bm.get("models"):
                e["from"] = bm["models"][0]["id"]
        g = best_gguf(repo)
        if g:
            e["gguf"] = g
        return e

    for r in chosen.values():
        e = entry_from_hf(r)
        out[e["hf"]] = e

    # ---------------------------------------------------------------- Ollama
    for o in load("ollama.json", []):
        cloud_only = "cloud" in o["caps"] and not any(t.get("size") for t in o["tags"].values() if t)
        sizes = o["sizes"] or ["latest"]
        for size in sizes:
            tag = o["tags"].get(size) or o["tags"].get("latest") or {}
            if cloud_only:
                tag = {}
            hit = match(f"{o['name']}-{size}", o["name"] if len(sizes) == 1 else None)
            info = {"name": o["name"], "tag": size, "gb": round(num((tag.get("size") or "").replace("GB", "").strip()) or 0, 1) or None,
                    "pulls": num(o["pulls"]), "cloud": cloud_only}
            if (tag.get("size") or "").endswith("MB"):
                info["gb"] = round(num(tag["size"].replace("MB", "").strip()) / 1000, 2)
            if hit:
                e = out.get(hit["id"]) or entry_from_hf(hit)
                out[hit["id"]] = e
                if "ollama" not in e:
                    e["ollama"] = info
                    e.setdefault("about", o["about"])
                continue
            org = next((m for p, m in PREFIX_MAKER if o["name"].startswith(p)), None)
            kinds = ["chat"]
            if "embedding" in o["caps"]:
                kinds = ["embed"]
            if "vision" in o["caps"]:
                kinds.append("vision")
            if "thinking" in o["caps"]:
                kinds.append("reason")
            if re.search(r"cod(e|er)|devstral|starcoder", o["name"]):
                kinds.append("code")
            tot, act = params_from_name(f"{o['name']}-{size}")
            upd = o.get("updated") or ""
            m = re.match(r"([A-Z][a-z]{2}) (\d{1,2}), (\d{4})", upd)
            date = ""
            if m:
                mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].index(m.group(1)) + 1
                date = f"{m.group(3)}-{mon:02d}-{int(m.group(2)):02d}"
            key = f"ollama:{o['name']}:{size}"
            out[key] = {"id": norm(key)[:60], "name": pretty_ollama(o["name"], size), "org": org or "ollama", "kinds": kinds,
                        "b": tot, "act": act, "date": date, "lic": "unknown", "likes": 0, "dl": 0, "trend": 0,
                        "about": o["about"], "ollama": info, "dateKind": "updated"}

    # ---------------------------------------------------------------- LM Studio
    for fam in load("lmstudio.json", []):
        for a in fam["models"]:
            ident = a["id"]
            hit = match(ident.split("/")[-1])
            lm = {"id": ident, "slug": fam["slug"], "gb": num((a.get("size") or "").replace("GB", "").strip()) or None}
            if hit:
                e = out.get(hit["id"]) or entry_from_hf(hit)
                out[hit["id"]] = e
                e.setdefault("lms", lm)
                if a.get("about") and not a["about"].endswith(ident.split("/")[-1]):
                    e.setdefault("about", a["about"])
                continue
            owner = ident.split("/")[0]
            org = next((m for p, m in PREFIX_MAKER if ident.split("/")[-1].startswith(p)), owner)
            tot, act = params_from_name(ident)
            key = f"lms:{ident}"
            out[key] = {"id": norm(key)[:60], "name": fam["title"] if len(fam["models"]) == 1 else pretty(ident).title(),
                        "org": org, "kinds": ["chat"], "b": tot, "act": act, "date": (a.get("created") or "")[:10],
                        "lic": "unknown", "likes": 0, "dl": 0, "trend": 0, "about": a.get("about") or fam["about"], "lms": lm}

    # ---------------------------------------------------------------- Ollama's image models (Mac only, for now)
    for repo, (name, tag, gb) in {"Tongyi-MAI/Z-Image-Turbo": ("x/z-image-turbo", "latest", 13.0),
                                  "black-forest-labs/FLUX.2-klein-4B": ("x/flux2-klein", "4b", 5.7),
                                  "black-forest-labs/FLUX.2-klein-9B": ("x/flux2-klein", "9b", 12.0)}.items():
        if repo in out:
            out[repo]["ollama"] = {"name": name, "tag": tag, "gb": gb, "pulls": 0, "cloud": False, "mac": True}

    # ---------------------------------------------------------------- Oriel's own (hand-written words, tested)
    for m in curated["models"]:
        repo = m["hf"]["repo"]
        hit = hf.get(repo) or match(repo)
        e = out.get(hit["id"]) if hit else out.get(repo)
        if not e:
            e = entry_from_hf(hit) if hit else {"id": m["id"], "name": m["name"], "org": m["org"], "kinds": ["chat"], "b": None,
                                                  "act": None, "date": m.get("released") or "", "lic": "unknown", "likes": 0,
                                                  "dl": 0, "trend": 0, "hf": repo}
            out[e.get("hf") or repo] = e
        e["name"] = m["name"]
        e["about"] = m["blurb"]
        if m.get("browser") and m["id"] not in ("gemma3-1b", "deepseek-r1-1.5b"):
            e["oriel"] = {"id": m["id"], "gb": m["browser"]["download_gb"], "needs": m["browser"]["needs_gb"]}
        if m.get("tested"):
            e["tested"] = m["tested"]
        if m.get("pick"):
            e["pick"] = m["pick"]
        if m.get("ollama") and "ollama" not in e:
            e["ollama"] = {"name": m["ollama"]["tag"].split(":")[0], "tag": m["ollama"]["tag"].split(":")[1],
                           "gb": m["ollama"]["download_gb"], "pulls": 0, "cloud": False}
        e["curated"] = True

    # ---------------------------------------------------------------- one entry per model
    # An Ollama or LM Studio name can end up both on its own and attached to a
    # Hugging Face model (e.g. through Oriel's own list): keep the attached one.
    attached = {(e["ollama"]["name"], e["ollama"]["tag"]) for k, e in out.items() if "ollama" in e and not k.startswith("ollama:")}
    attached_lms = {e["lms"]["id"] for k, e in out.items() if "lms" in e and not k.startswith("lms:")}
    for k in [k for k, e in out.items() if (k.startswith("ollama:") and (e["ollama"]["name"], e["ollama"]["tag"]) in attached)
              or (k.startswith("lms:") and e["lms"]["id"] in attached_lms)]:
        del out[k]

    # ---------------------------------------------------------------- words, sizes, ranking
    models = []
    for e in out.values():
        k = e["kinds"]
        b = e.get("b")
        if not e.get("about"):
            what = PRONOUN.get(k[0], "model")
            if "vision" in k and k[0] == "chat":
                what = PRONOUN["vision"]
            size = (f"{b:g}B" if b and b >= 1 else f"{round(b * 1000)}M" if b else "")
            lead = f"A {size} {what}" if size else f"A {what}"
            lead = lead.replace("A 8", "An 8").replace("A 11", "An 11").replace("A 18", "An 18").replace("A 80", "An 80")
            who = maker_of(e["org"])
            s = f"{lead} from {who}." if not e.get("community") else f"{lead}, shared by {who}."
            if e.get("from"):
                s = f"{lead}: a community version of {pretty(e['from'])}, by {who}."
            extra = []
            if "code" in k:
                extra.append("Made for coding.")
            if "reason" in k:
                extra.append("Thinks step by step before it answers.")
            if e.get("act"):
                extra.append(f"Only {e['act']:g}B of it works at a time, so it runs faster than its size suggests.")
            if e.get("base"):
                extra.append("A base model: for developers to build on, not for chatting.")
            e["about"] = " ".join([s] + extra)
        # what a download weighs: measured when we could, else worked out
        g = e.get("gguf")
        if g:
            exact = (file_sizes.get(g["repo"]) or {}).get(g.get("file") or "")
            g["gb"] = round(exact / 1e9, 2) if exact else gb_est(b, g.get("q"))
            if exact:
                g["exact"] = True
        e["maker"] = maker_of(e["org"])
        lic = LICENCE.get(e["lic"], (e["lic"].replace("-", " ").title(), None))
        e["licName"], e["biz"] = lic
        pop = 2.2 * math.log10(1 + e.get("likes", 0)) + math.log10(1 + e.get("dl", 0)) \
            + 1.6 * math.log10(1 + (e.get("ollama") or {}).get("pulls", 0))
        if e.get("community"):
            pop -= 1.2
        if e.get("base"):
            pop -= 1.5
        if e.get("curated"):
            pop += 1.5
        e["score"] = round(pop, 2)
        for f in ("trend",):
            e.pop(f, None)
        models.append({k2: v for k2, v in e.items() if not (v is None or v is False or v == "" or v == [])})

    models.sort(key=lambda e: -e["score"])
    seen = set()
    for e in models:                          # ids must be unique for links
        while e["id"] in seen:
            e["id"] += "x"
        seen.add(e["id"])
    makers = defaultdict(int)
    for e in models:
        makers[e["org"]] += 1
    def logo(o):
        for rel in (f"logos/{o}.webp", f"logos/hub/{o}.png"):
            if (WEB / rel).exists():
                return rel
        return None
    doc = {"v": 2, "built": CUTOFF, "cutoff": CUTOFF,
           "makers": {o: {k: v for k, v in {"name": maker_of(o), "n": n, "lab": o in LABS, "logo": logo(o)}.items() if v}
                      for o, n in sorted(makers.items(), key=lambda x: -x[1])},
           "models": models}
    OUT.write_text(json.dumps(doc, separators=(",", ":"), ensure_ascii=False))
    kinds = defaultdict(int)
    for e in models:
        for k in e["kinds"]:
            kinds[k] += 1
    print(f"{len(models)} models from {len(makers)} makers -> {OUT.name} ({OUT.stat().st_size / 1e6:.1f} MB)")
    print("kinds:", dict(sorted(kinds.items(), key=lambda x: -x[1])))
    print("with a file to download:", sum(1 for e in models if e.get("gguf", {}).get("file")),
          "| in Ollama:", sum(1 for e in models if "ollama" in e), "| in LM Studio:", sum(1 for e in models if "lms" in e),
          "| in Oriel:", sum(1 for e in models if "oriel" in e))


if __name__ == "__main__":
    main()
