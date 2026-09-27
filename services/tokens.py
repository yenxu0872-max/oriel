"""Exact token counts from the model's own tokenizer.

    count("gemma4:e4b-it-qat", ["hello", "Selamat pagi"]) -> [1, 3]

Ollama has no API for this, but the llama.cpp runner it starts for each
loaded model does (POST /tokenize, ~30 ms for 100 KB). The runner is found by
the model's weights file on its command line. Whenever that isn't possible —
model not loaded, Ollama changed how it runs models — this returns None and
the page falls back to its own (deliberately cautious) estimate.
"""

import json
import os
import re
import subprocess
import time
import urllib.request
from pathlib import Path

MODELS = Path(os.environ.get("OLLAMA_MODELS") or Path.home() / ".ollama" / "models")
MAX_TEXTS = 400
_ports = {}  # model -> (port, when found)


def _weights(model):
    """'gemma4:e4b-it-qat' -> 'sha256-e8b6…', the blob the runner loads."""
    name, _, tag = model.partition(":")
    if "/" not in name:
        name = "library/" + name
    manifest = MODELS / "manifests" / "registry.ollama.ai" / name / (tag or "latest")
    for layer in json.loads(manifest.read_text())["layers"]:
        if layer.get("mediaType") == "application/vnd.ollama.image.model":
            return layer["digest"].replace(":", "-")
    return None


def _port(model, fresh=False):
    hit = _ports.get(model)
    if hit and not fresh and time.time() - hit[1] < 60:
        return hit[0]
    _ports.pop(model, None)
    try:
        blob = _weights(model)
        out = subprocess.run(["ps", "-axo", "command"], capture_output=True, text=True, timeout=5).stdout
    except (OSError, ValueError, KeyError, subprocess.SubprocessError):
        return None
    for line in out.splitlines():
        if blob and "llama-server" in line and blob in line:
            m = re.search(r"--port (\d+)", line)
            if m:
                _ports[model] = (int(m.group(1)), time.time())
                return int(m.group(1))
    return None


def _tokenize(port, text):
    req = urllib.request.Request(f"http://127.0.0.1:{port}/tokenize",
                                 json.dumps({"content": text, "add_special": False}).encode(),
                                 {"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=15) as r:
        return len(json.load(r)["tokens"])


def count(model, texts):
    if not isinstance(model, str) or not isinstance(texts, list) or len(texts) > MAX_TEXTS:
        raise ValueError("expected a model name and a list of texts")
    for attempt in (0, 1):
        port = _port(model, fresh=attempt == 1)
        if not port:
            return None
        try:
            return [_tokenize(port, t if isinstance(t, str) else "") for t in texts]
        except OSError:
            continue  # the runner restarted on another port: look again once
    return None
