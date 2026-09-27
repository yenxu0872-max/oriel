#!/usr/bin/env python3
"""Builds web/models.json — the model catalog both web pages read.

    python3 web/_build/catalog.py            from the verified data in data/
    python3 web/_build/catalog.py --verify   re-check every size, name and licence online first

The words are ours (plain English, written for people who've never heard of a
"quantized 4B"); every fact is measured, never typed in by hand:
  - which models run in the browser: WebLLM's own model list, read by loading the
    engine itself (needs Node) — its source also names models that aren't in it
  - browser download sizes: summed from each model's own file index on Hugging Face
  - browser memory: WebLLM's own figure for the model (its `vram_required_MB`)
  - Ollama names and sizes: Ollama's registry manifests (the exact bytes `ollama pull` fetches)
  - licences and "sign in to download": the Hugging Face API
"""

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"
OUT = HERE.parent / "models.json"
WEBLLM = "0.2.85"   # the in-browser engine; its model list is what "browser" ids refer to

# id, name, maker, blurb, good-for tags, browser (WebLLM) id, ollama tag, Hugging Face repo, pick
M = [
    # ---- runs in the browser -------------------------------------------------------------
    ("smollm2-360m", "SmolLM2 360M", "Hugging Face",
     "The smallest model here. It starts in seconds and runs almost anywhere, but it only handles simple questions.",
     ["chat", "tiny"], "SmolLM2-360M-Instruct-q4f16_1-MLC", "smollm2:360m", "HuggingFaceTB/SmolLM2-360M-Instruct", None),
    ("qwen3-0.6b", "Qwen3 0.6B", "Alibaba",
     "Tiny, yet it can think step by step before it answers. Good for trying things out on an older computer.",
     ["chat", "reasoning", "tiny"], "Qwen3-0.6B-q4f16_1-MLC", "qwen3:0.6b", "Qwen/Qwen3-0.6B", None),
    ("qwen3.5-0.8b", "Qwen3.5 0.8B", "Alibaba",
     "The newest tiny Qwen: quick answers in many languages, on almost any device.",
     ["chat", "languages", "tiny"], "Qwen3.5-0.8B-q4f16_1-MLC", "qwen3.5:0.8b", "Qwen/Qwen3.5-0.8B", None),
    ("gemma3-1b", "Gemma 3 1B", "Google",
     "Google's smallest model: friendly writing and good with many languages, in well under 1 GB.",
     # Not in the browser: WebLLM 0.2.85 runs it, but with any instructions it
     # degenerates into repetition (tested 2026-09-27) — download only.
     ["chat", "writing", "languages", "tiny"], None, "gemma3:1b", "google/gemma-3-1b-it", None),
    ("llama3.2-1b", "Llama 3.2 1B", "Meta",
     "A fast, light everyday assistant that works on most laptops. The best place to start on an older computer.",
     ["chat", "tiny"], "Llama-3.2-1B-Instruct-q4f16_1-MLC", "llama3.2:1b", "meta-llama/Llama-3.2-1B-Instruct", "Best for older computers"),
    ("deepseek-r1-1.5b", "DeepSeek R1 1.5B", "DeepSeek",
     "Shows its working before it answers. Good at maths puzzles, but slower, because it always thinks first.",
     # Not in WebLLM's model list (its source mentions it, but it can't load) — download only.
     ["reasoning", "maths"], None, "deepseek-r1:1.5b", "deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B", None),
    ("qwen3-1.7b", "Qwen3 1.7B", "Alibaba",
     "A capable small all-rounder that can switch on step-by-step thinking for tricky questions.",
     ["chat", "reasoning"], "Qwen3-1.7B-q4f16_1-MLC", "qwen3:1.7b", "Qwen/Qwen3-1.7B", None),
    ("smollm2-1.7b", "SmolLM2 1.7B", "Hugging Face",
     "A fully open model trained on carefully chosen data. Good for everyday questions.",
     ["chat"], "SmolLM2-1.7B-Instruct-q4f16_1-MLC", "smollm2:1.7b", "HuggingFaceTB/SmolLM2-1.7B-Instruct", None),
    ("qwen2.5-coder-1.5b", "Qwen2.5 Coder 1.5B", "Alibaba",
     "A small coding helper: explains code, writes short functions and spots bugs.",
     ["coding"], "Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC", "qwen2.5-coder:1.5b", "Qwen/Qwen2.5-Coder-1.5B-Instruct", None),
    ("qwen2.5-math-1.5b", "Qwen2.5 Math 1.5B", "Alibaba",
     "Built for maths problems, worked step by step. Not meant for general chat.",
     ["maths"], "Qwen2.5-Math-1.5B-Instruct-q4f16_1-MLC", None, "Qwen/Qwen2.5-Math-1.5B-Instruct", None),
    ("qwen3.5-2b", "Qwen3.5 2B", "Alibaba",
     "The newest small Qwen, with a good balance of speed and smarts for everyday use.",
     ["chat", "languages"], "Qwen3.5-2B-q4f16_1-MLC", "qwen3.5:2b", "Qwen/Qwen3.5-2B", None),
    ("gemma2-2b", "Gemma 2 2B", "Google",
     "Google's popular small model, known for natural, pleasant writing.",
     ["chat", "writing"], "gemma-2-2b-it-q4f16_1-MLC", "gemma2:2b", "google/gemma-2-2b-it", None),
    ("llama3.2-3b", "Llama 3.2 3B", "Meta",
     "A solid everyday assistant: clearly smarter than the 1B, and still quick.",
     ["chat", "writing"], "Llama-3.2-3B-Instruct-q4f16_1-MLC", "llama3.2:3b", "meta-llama/Llama-3.2-3B-Instruct", None),
    ("hermes3-3b", "Hermes 3 3B", "Nous Research",
     "A Llama-based model tuned to follow instructions closely and stay in character.",
     ["chat", "writing"], "Hermes-3-Llama-3.2-3B-q4f16_1-MLC", "hermes3:3b", "NousResearch/Hermes-3-Llama-3.2-3B", None),
    ("qwen2.5-coder-3b", "Qwen2.5 Coder 3B", "Alibaba",
     "A stronger small coding helper. Its licence allows personal and research use only.",
     ["coding"], "Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC", "qwen2.5-coder:3b", "Qwen/Qwen2.5-Coder-3B-Instruct", None),
    ("phi3.5-mini", "Phi-3.5 mini", "Microsoft",
     "Microsoft's compact model, good at reasoning and explaining things for its size.",
     ["chat", "reasoning"], "Phi-3.5-mini-instruct-q4f16_1-MLC", "phi3.5:3.8b", "microsoft/Phi-3.5-mini-instruct", None),
    ("phi4-mini", "Phi-4 mini", "Microsoft",
     "Strong at maths and logic for its size.",
     ["reasoning", "maths"], "Phi-4-mini-instruct-q4f16_1-MLC", "phi4-mini:3.8b", "microsoft/Phi-4-mini-instruct", None),
    ("qwen3-4b", "Qwen3 4B", "Alibaba",
     "The best all-rounder that runs in a browser: it writes, explains, codes, and can think step by step on hard questions.",
     ["chat", "reasoning", "coding", "languages"], "Qwen3-4B-q4f16_1-MLC", "qwen3:4b", "Qwen/Qwen3-4B", "Best in the browser"),
    ("qwen3.5-4b", "Qwen3.5 4B", "Alibaba",
     "The newest mid-size Qwen, with sharper answers than Qwen3 4B at a similar size.",
     ["chat", "reasoning", "languages"], "Qwen3.5-4B-q4f16_1-MLC", "qwen3.5:4b", "Qwen/Qwen3.5-4B", None),
    ("phi3.5-vision", "Phi-3.5 Vision", "Microsoft",
     "Reads images: it can describe photos and read screenshots and charts.",
     ["vision"], "Phi-3.5-vision-instruct-q4f16_1-MLC", None, "microsoft/Phi-3.5-vision-instruct", None),
    ("mistral-7b", "Mistral 7B", "Mistral AI",
     "A classic, dependable model from France. Good general writing and chat.",
     ["chat", "writing"], "Mistral-7B-Instruct-v0.3-q4f16_1-MLC", "mistral:7b", "mistralai/Mistral-7B-Instruct-v0.3", None),
    ("deepseek-r1-7b", "DeepSeek R1 7B", "DeepSeek",
     "Thinks problems through step by step before answering. Strong at maths and logic.",
     ["reasoning", "maths"], "DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC", "deepseek-r1:7b", "deepseek-ai/DeepSeek-R1-Distill-Qwen-7B", None),
    ("qwen2.5-coder-7b", "Qwen2.5 Coder 7B", "Alibaba",
     "A serious coding assistant: it writes, explains and reviews real code.",
     ["coding"], "Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC", "qwen2.5-coder:7b", "Qwen/Qwen2.5-Coder-7B-Instruct", "Best for coding"),
    ("llama3.1-8b", "Llama 3.1 8B", "Meta",
     "Meta's well-known 8B model: reliable chat and writing in many languages.",
     ["chat", "writing", "languages"], "Llama-3.1-8B-Instruct-q4f16_1-MLC", "llama3.1:8b", "meta-llama/Llama-3.1-8B-Instruct", None),
    ("qwen3-8b", "Qwen3 8B", "Alibaba",
     "Smart and versatile, with optional step-by-step thinking. Needs a strong computer to run in the browser.",
     ["chat", "reasoning", "coding"], "Qwen3-8B-q4f16_1-MLC", "qwen3:8b", "Qwen/Qwen3-8B", None),
    ("qwen3.5-9b", "Qwen3.5 9B", "Alibaba",
     "The largest model that runs in a browser here, and the smartest — if your computer can handle it.",
     ["chat", "reasoning", "languages"], "Qwen3.5-9B-q4f16_1-MLC", "qwen3.5:9b", "Qwen/Qwen3.5-9B", None),
    ("gemma2-9b", "Gemma 2 9B", "Google",
     "Google's larger Gemma 2, with thoughtful, well-written answers.",
     ["chat", "writing"], "gemma-2-9b-it-q4f16_1-MLC", "gemma2:9b", "google/gemma-2-9b-it", None),

    # ---- download only: too big (or too new) for a browser --------------------------------
    ("gemma4-e2b", "Gemma 4 E2B", "Google",
     "Google's newest small model. It understands images and audio as well as text.",
     ["chat", "vision", "languages"], None, "gemma4:e2b", "google/gemma-4-E2B-it", None),
    ("gemma4-e4b", "Gemma 4 E4B", "Google",
     "What Oriel for Mac runs: quick and clever, and it can read photos and documents.",
     ["chat", "vision", "languages"], None, "gemma4:e4b-it-qat", "google/gemma-4-E4B-it", "Best to download"),
    ("gemma4-12b", "Gemma 4 12B", "Google",
     "More knowledge and sharper reasoning than E4B, and it sees images too.",
     ["chat", "reasoning", "vision"], None, "gemma4:12b", "google/gemma-4-12B-it", None),
    ("gemma3-4b", "Gemma 3 4B", "Google",
     "Small, but it can read images. A great first model for photos and screenshots.",
     ["chat", "vision"], None, "gemma3:4b", "google/gemma-3-4b-it", None),
    ("qwen2.5vl-7b", "Qwen2.5 VL 7B", "Alibaba",
     "Reads documents, charts and photos in fine detail.",
     ["vision"], None, "qwen2.5vl:7b", "Qwen/Qwen2.5-VL-7B-Instruct", None),
    ("llama3.2-vision-11b", "Llama 3.2 Vision 11B", "Meta",
     "Meta's model that understands images: describe, compare and read what's in a picture.",
     ["vision"], None, "llama3.2-vision:11b", "meta-llama/Llama-3.2-11B-Vision-Instruct", None),
    ("deepseek-r1-8b", "DeepSeek R1 8B", "DeepSeek",
     "DeepSeek's newer small thinker, built on Qwen3 8B. Strong reasoning for its size.",
     ["reasoning", "maths"], None, "deepseek-r1:8b", "deepseek-ai/DeepSeek-R1-0528-Qwen3-8B", None),
    ("qwen3-14b", "Qwen3 14B", "Alibaba",
     "A big step up in knowledge and reasoning, with step-by-step thinking.",
     ["chat", "reasoning", "coding"], None, "qwen3:14b", "Qwen/Qwen3-14B", None),
    ("phi4-14b", "Phi-4 14B", "Microsoft",
     "Microsoft's larger Phi: excellent at maths, science and careful reasoning.",
     ["reasoning", "maths"], None, "phi4:14b", "microsoft/phi-4", None),
    ("deepseek-r1-14b", "DeepSeek R1 14B", "DeepSeek",
     "Thinks long and hard before answering: very good at maths and logic.",
     ["reasoning", "maths"], None, "deepseek-r1:14b", "deepseek-ai/DeepSeek-R1-Distill-Qwen-14B", None),
    ("qwen2.5-coder-14b", "Qwen2.5 Coder 14B", "Alibaba",
     "A strong coding model for real projects, if you have the memory.",
     ["coding"], None, "qwen2.5-coder:14b", "Qwen/Qwen2.5-Coder-14B-Instruct", None),
    ("gpt-oss-20b", "gpt-oss 20B", "OpenAI",
     "OpenAI's open model: strong reasoning. It only just fits a 16 GB computer.",
     ["chat", "reasoning"], None, "gpt-oss:20b", "openai/gpt-oss-20b", None),
    ("mistral-small-24b", "Mistral Small 3.2", "Mistral AI",
     "Mistral's capable mid-size model. Good writing, follows instructions well, and reads images.",
     ["chat", "writing", "vision"], None, "mistral-small3.2:24b", "mistralai/Mistral-Small-3.2-24B-Instruct-2506", None),
    ("devstral-24b", "Devstral Small", "Mistral AI",
     "Made to work as a coding agent on real software projects.",
     ["coding"], None, "devstral:24b", "mistralai/Devstral-Small-2507", None),
    ("qwen3.5-27b", "Qwen3.5 27B", "Alibaba",
     "Large and very capable, with deep knowledge and careful reasoning.",
     ["chat", "reasoning", "languages"], None, "qwen3.5:27b", "Qwen/Qwen3.5-27B", None),
    ("gemma4-26b", "Gemma 4 26B", "Google",
     "A 'mixture of experts': big-model smarts that runs faster than its size suggests. Sees images.",
     ["chat", "reasoning", "vision"], None, "gemma4:26b", "google/gemma-4-26B-A4B-it", None),
    ("qwen3-30b", "Qwen3 30B", "Alibaba",
     "Also a mixture of experts: big-model answers at small-model speed, if you have 32 GB of memory.",
     ["chat", "reasoning", "coding"], None, "qwen3:30b", "Qwen/Qwen3-30B-A3B", None),
    ("qwen3-coder-30b", "Qwen3 Coder 30B", "Alibaba",
     "One of the best open coding models, and fast for its size.",
     ["coding"], None, "qwen3-coder:30b", "Qwen/Qwen3-Coder-30B-A3B-Instruct", None),
    ("gemma4-31b", "Gemma 4 31B", "Google",
     "Google's most capable open model. Needs a powerful computer.",
     ["chat", "reasoning", "vision"], None, "gemma4:31b", "google/gemma-4-31B-it", None),
    ("llama3.3-70b", "Llama 3.3 70B", "Meta",
     "Meta's large model, close to the best there is. Needs 64 GB of memory.",
     ["chat", "writing", "languages"], None, "llama3.3:70b", "meta-llama/Llama-3.3-70B-Instruct", None),
    ("gpt-oss-120b", "gpt-oss 120B", "OpenAI",
     "OpenAI's biggest open model. Needs a workstation with 80 GB of memory or more.",
     ["chat", "reasoning"], None, "gpt-oss:120b", "openai/gpt-oss-120b", None),
]

# Size in parameters, as the makers publish it ("active" = what a mixture-of-
# experts model actually runs for each word; "effective" = Gemma 4's own term).
PARAMS = {
    "smollm2-360m": "360M", "qwen3-0.6b": "0.6B", "qwen3.5-0.8b": "0.8B", "gemma3-1b": "1B", "llama3.2-1b": "1B",
    "deepseek-r1-1.5b": "1.5B", "qwen3-1.7b": "1.7B", "smollm2-1.7b": "1.7B", "qwen2.5-coder-1.5b": "1.5B",
    "qwen2.5-math-1.5b": "1.5B", "qwen3.5-2b": "2B", "gemma2-2b": "2B", "llama3.2-3b": "3B", "hermes3-3b": "3B",
    "qwen2.5-coder-3b": "3B", "phi3.5-mini": "3.8B", "phi4-mini": "3.8B", "qwen3-4b": "4B", "qwen3.5-4b": "4B",
    "phi3.5-vision": "4.2B", "mistral-7b": "7B", "deepseek-r1-7b": "7B", "qwen2.5-coder-7b": "7B", "llama3.1-8b": "8B",
    "qwen3-8b": "8B", "qwen3.5-9b": "9B", "gemma2-9b": "9B", "gemma4-e2b": "2B effective", "gemma4-e4b": "4B effective",
    "gemma4-12b": "12B", "gemma3-4b": "4B", "qwen2.5vl-7b": "7B", "llama3.2-vision-11b": "11B", "deepseek-r1-8b": "8B",
    "qwen3-14b": "14B", "phi4-14b": "14B", "deepseek-r1-14b": "14B", "qwen2.5-coder-14b": "14B",
    "gpt-oss-20b": "21B · 3.6B active", "mistral-small-24b": "24B", "devstral-24b": "24B", "qwen3.5-27b": "27B",
    "gemma4-26b": "26B · 4B active", "qwen3-30b": "30B · 3B active", "qwen3-coder-30b": "30B · 3B active",
    "gemma4-31b": "31B", "llama3.3-70b": "70B", "gpt-oss-120b": "117B · 5.1B active",
}

# Who makes them, keyed by their Hugging Face organisation (logos in web/logos/
# are each organisation's own avatar there). Listed in the order shown.
MAKERS = {
    "Qwen": ("Alibaba", "Qwen", "The widest range here — tiny to huge, with step-by-step thinking and strong coding."),
    "meta-llama": ("Meta", "Llama", "The open models much of the field is built on: reliable all-rounders."),
    "google": ("Google", "Gemma", "Google's open models: natural writing, many languages, and with Gemma 4, images too."),
    "microsoft": ("Microsoft", "Phi", "Small models trained to reason well for their size."),
    "mistralai": ("Mistral AI", "Mistral", "Dependable models from France, including one built for coding."),
    "deepseek-ai": ("DeepSeek", "R1", "Models that think out loud before answering — strong at maths and logic."),
    "openai": ("OpenAI", "gpt-oss", "OpenAI's open-weight models, built for careful reasoning."),
    "HuggingFaceTB": ("Hugging Face", "SmolLM", "Tiny, fully open models that run almost anywhere."),
    "NousResearch": ("Nous Research", "Hermes", "Tuned to follow instructions closely and stay in character."),
}

# Loaded and answered correctly in Oriel's browser build, on a MacBook Air M4
# (16 GB), with Oriel's own instructions; writing speed in tokens a second.
TESTED = {"llama3.2-1b": 60, "smollm2-360m": 65, "qwen3.5-0.8b": 34, "qwen3-0.6b": None, "qwen2.5-coder-1.5b": 13,
          "gemma2-2b": 16, "phi3.5-mini": 20, "phi3.5-vision": 21, "mistral-7b": 11}
TESTED_ON = "MacBook Air M4, 16 GB"

# What each licence means, in a sentence, and whether a business may use it.
LICENCES = {
    "apache-2.0": ("Apache 2.0", "Free for any use, including business.", True),
    "mit": ("MIT", "Free for any use, including business.", True),
    "llama3": ("Llama 3 Community Licence", "Free for personal and most business use; read Meta's terms.", True),
    "llama3.1": ("Llama 3.1 Community Licence", "Free for personal and most business use; read Meta's terms.", True),
    "llama3.2": ("Llama 3.2 Community Licence", "Free for personal and most business use; read Meta's terms.", True),
    "llama3.3": ("Llama 3.3 Community Licence", "Free for personal and most business use; read Meta's terms.", True),
    "gemma": ("Gemma Terms of Use", "Free, including business, within Google's use policy.", True),
    "qwen-research": ("Qwen Research Licence", "Personal and research use only — not for business.", False),
}


def overhead(gb):
    """Memory a model needs beyond its own weights: the runtime and a working
    context. Rounded up so the advice errs on the safe side."""
    return round(gb + 1.5, 1)


def verify():
    """Re-measure everything from the source, rewriting data/*.json."""
    import concurrent.futures
    import urllib.request

    def get_json(url, headers=None):
        req = urllib.request.Request(url, headers=headers or {})
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.load(r)

    import subprocess
    import tempfile
    # The engine's real model list: load the same bundle the pages load.
    with tempfile.TemporaryDirectory() as tmp:
        bundle = Path(tmp) / "webllm.mjs"
        with urllib.request.urlopen(f"https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@{WEBLLM}/+esm", timeout=120) as r:
            bundle.write_bytes(r.read())
        out = subprocess.run(["node", "-e", f"import({json.dumps(str(bundle))}).then(m => console.log(JSON.stringify("
                              "m.prebuiltAppConfig.model_list.map(x => ({id: x.model_id, hf: x.model, vram_mb: x.vram_required_MB, "
                              "f16: (x.required_features || []).includes('shader-f16'), ctx: (x.overrides || {}).context_window_size})))))"],
                             capture_output=True, text=True, timeout=120)
    if out.returncode:
        sys.exit("✗ couldn't read WebLLM's model list (is Node installed?): " + out.stderr[:300])
    engine = {e["id"]: e for e in json.loads(out.stdout)}
    missing = [m[5] for m in M if m[5] and m[5] not in engine]
    if missing:
        sys.exit("✗ not in WebLLM's model list: " + ", ".join(missing))
    browser = {m[5]: {k: v for k, v in engine[m[5]].items() if k != "id"} for m in M if m[5]}
    ollama, hf = {}, {}

    def browse(mid):
        e = browser[mid]
        for name in ("ndarray-cache.json", "tensor-cache.json"):
            try:
                recs = get_json(e["hf"].rstrip("/") + "/resolve/main/" + name)["records"]
                return mid, sum(r["nbytes"] for r in recs)
            except Exception:
                continue
        return mid, None

    def pull(tag):
        name, t = tag.split(":")
        m = get_json(f"https://registry.ollama.ai/v2/library/{name}/manifests/{t}",
                     {"Accept": "application/vnd.docker.distribution.manifest.v2+json"})
        return tag, {"bytes": sum(l["size"] for l in m["layers"])}

    def repo(r):
        d = get_json(f"https://huggingface.co/api/models/{r}")
        card = d.get("cardData") or {}
        lic = card.get("license")
        if lic in (None, "other"):
            lic = card.get("license_name") or next((t.split(":", 1)[1] for t in d.get("tags", []) if t.startswith("license:")), "?")
        return r, {"license": lic, "gated": bool(d.get("gated")), "id": d.get("id"), "created": (d.get("createdAt") or "")[:10]}

    with concurrent.futures.ThreadPoolExecutor(10) as pool:
        for mid, size in pool.map(browse, [m[5] for m in M if m[5]]):
            browser[mid]["download_bytes"] = size
        ollama.update(pool.map(pull, [m[6] for m in M if m[6]]))
        hf.update(pool.map(repo, [m[7] for m in M]))
    (DATA / "browser-models.json").write_text(json.dumps(browser, indent=1))
    (DATA / "ollama-tags.json").write_text(json.dumps(ollama, indent=1))
    (DATA / "hf-repos.json").write_text(json.dumps(hf, indent=1))


def build():
    browser = json.loads((DATA / "browser-models.json").read_text())
    ollama = json.loads((DATA / "ollama-tags.json").read_text())
    hf = json.loads((DATA / "hf-repos.json").read_text())
    models, problems = [], []
    for mid, name, maker, blurb, good, b, o, h, pick in M:
        entry = {"id": mid, "name": name, "maker": maker, "blurb": blurb, "good": good, "pick": pick}
        if b:
            e = browser.get(b)
            if not e or not e.get("download_bytes"):
                problems.append(f"{mid}: browser model {b} not verified")
                continue
            entry["browser"] = {"id": b, "download_gb": round(e["download_bytes"] / 1e9, 2),
                                "needs_gb": overhead(e["vram_mb"] / 1024), "f16": e["f16"]}
        if o:
            if o not in ollama:
                problems.append(f"{mid}: ollama tag {o} not verified")
                continue
            gb = ollama[o]["bytes"] / 1e9
            entry["ollama"] = {"tag": o, "download_gb": round(gb, 1), "needs_gb": overhead(gb)}
        r = hf.get(h)
        if not r:
            problems.append(f"{mid}: Hugging Face repo {h} not verified")
            continue
        label, meaning, business = LICENCES.get(r["license"], (r["license"], "Read the licence before using it.", None))
        entry["hf"] = {"repo": r["id"] or h, "gated": r["gated"]}
        entry["licence"] = {"id": r["license"], "label": label, "meaning": meaning, "business": business}
        org = entry["hf"]["repo"].split("/")[0]
        if org not in MAKERS:
            problems.append(f"{mid}: no maker entry for {org}")
            continue
        entry["org"] = org
        entry["params"] = PARAMS.get(mid)
        entry["released"] = r.get("created", "")[:7] or None
        if mid in TESTED:
            entry["tested"] = {"on": TESTED_ON, "tokens_per_s": TESTED[mid]}
        if not entry["params"]:
            problems.append(f"{mid}: no parameter count")
        models.append(entry)
    if problems:
        sys.exit("✗ " + "\n✗ ".join(problems))
    makers = {org: {"name": n, "family": f, "about": a, "logo": f"logos/{org}.webp"} for org, (n, f, a) in MAKERS.items()}
    for org in makers:
        if not (HERE.parent / makers[org]["logo"]).exists():
            sys.exit(f"✗ missing logo {makers[org]['logo']}")
    OUT.write_text(json.dumps({"engine": {"webllm": WEBLLM}, "makers": makers, "models": models}, indent=1, ensure_ascii=False) + "\n")
    inb = sum(1 for m in models if "browser" in m)
    print(f"  wrote {OUT.relative_to(HERE.parent.parent)} — {len(models)} models, {inb} run in the browser")


if __name__ == "__main__":
    if "--verify" in sys.argv:
        verify()
    build()
