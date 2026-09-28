#!/usr/bin/env python3
"""Fetches the raw lists the big catalog is built from, into web/_build/cache/.

    python3 web/_build/hub_fetch.py hf        Hugging Face: every popular model, per kind
    python3 web/_build/hub_fetch.py gguf      Hugging Face: GGUF files (what LM Studio and Ollama run)
    python3 web/_build/hub_fetch.py ollama    Ollama's library, with every size's download
    python3 web/_build/hub_fetch.py lmstudio  LM Studio's catalog

Only public pages and APIs, read politely (Hugging Face allows 500 requests
per 5 minutes; this uses a handful). Nothing here is sent anywhere.
"""
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

CACHE = Path(__file__).resolve().parent / "cache"
UA = {"User-Agent": "oriel-catalog/1.0 (+https://github.com/)"}

# Hugging Face's kinds of model -> what we call them. Only kinds people download
# to run themselves.
KINDS = {
    "text-generation": "chat",
    "image-text-to-text": "vision",
    "any-to-any": "omni",
    "text-to-image": "image",
    "image-to-image": "image-edit",
    "text-to-video": "video",
    "image-to-video": "video",
    "automatic-speech-recognition": "speech-to-text",
    "text-to-speech": "text-to-speech",
    "text-to-audio": "audio",
    "audio-text-to-text": "audio-chat",
    "feature-extraction": "embeddings",
    "sentence-similarity": "embeddings",
}
MIN_LIKES = 10          # below this, lists are mostly personal experiments
EXPAND = ["createdAt", "lastModified", "likes", "downloads", "downloadsAllTime", "safetensors", "baseModels",
          "gated", "library_name", "tags", "pipeline_tag", "trendingScore"]


def get(url, tries=4):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=90) as r:
                return r.read(), dict(r.headers)
        except Exception as e:
            if i == tries - 1:
                raise
            wait = 30 if "429" in str(e) else 3 * (i + 1)
            print(f"  retry in {wait}s: {e}", file=sys.stderr)
            time.sleep(wait)


def next_link(headers):
    link = headers.get("Link") or headers.get("link") or ""
    m = re.search(r'<([^>]+)>;\s*rel="next"', link)
    return m.group(1) if m else None


def hf_list(query, stop):
    """Pages through /api/models until `stop(page)` says enough."""
    url = "https://huggingface.co/api/models?" + query + "".join(f"&expand[]={e}" for e in EXPAND)
    out = []
    while url:
        body, headers = get(url)
        page = json.loads(body)
        out += page
        if not page or stop(page):
            break
        url = next_link(headers)
        time.sleep(0.4)
    return out


def fetch_hf():
    for tag in KINDS:
        rows = hf_list(f"pipeline_tag={tag}&sort=likes&direction=-1&limit=1000", lambda p: p[-1].get("likes", 0) < MIN_LIKES)
        rows = [r for r in rows if r.get("likes", 0) >= MIN_LIKES]
        (CACHE / f"hf-{tag}.json").write_text(json.dumps(rows))
        print(f"{tag}: {len(rows)} models with {MIN_LIKES}+ likes")


def fetch_gguf():
    rows = hf_list("filter=gguf&sort=downloads&direction=-1&limit=1000&expand[]=siblings", lambda p: p[-1].get("downloads", 0) < 200)
    rows = [{k: r.get(k) for k in ("id", "createdAt", "likes", "downloads", "baseModels", "tags", "gated")}
            | {"files": [s["rfilename"] for s in r.get("siblings") or [] if s["rfilename"].endswith(".gguf")]} for r in rows]
    (CACHE / "hf-gguf.json").write_text(json.dumps(rows))
    print(f"gguf: {len(rows)} repos")


def page(url):
    body, _ = get(url)
    return body.decode("utf-8", "replace")


def fetch_ollama():
    """Every model in Ollama's library, each size with its download."""
    lib = page("https://ollama.com/library?sort=newest")
    out = []
    for b in re.findall(r'<li\s+class="flex items-baseline border-b[^"]*">(.*?)</li>', lib, re.S):
        name = re.search(r'href="/library/([^"]+)"', b).group(1)
        desc = re.search(r'<p class="max-w-lg[^"]*">(.*?)</p>', b, re.S)
        chips = re.findall(r'<span[^>]*class="inline-flex items-center rounded-md ([^"]*)"[^>]*>([^<]+)</span>', b)
        caps = [t.strip() for c, t in chips if "indigo" in c or "cyan" in c]
        sizes = [t.strip() for c, t in chips if "ddf4ff" in c]
        pulls = re.search(r'<span\s*>([\d.,]+[KMB]?)</span>\s*<span class="hidden sm:flex">&nbsp;Pulls', b)
        upd = re.search(r'title="([A-Z][a-z]{2} \d{1,2}, \d{4}[^"]*)"', b)
        tags = page(f"https://ollama.com/library/{name}/tags")
        found = {}
        for tag, info in re.findall(r'<a href="/library/([^"]+)" class="md:hidden[^"]*">(.*?)</a>', tags, re.S):
            info = re.sub(r"<[^>]+>", " ", info)
            info = re.sub(r"\s+", " ", info)
            m = re.search(r"•\s*([\d.]+\s*[KMGT]B)\s*•\s*(\S+)\s*context window\s*•\s*([^•]*?)\s*input", info)
            found[tag.split(":", 1)[1]] = {"size": m.group(1) if m else None, "ctx": m.group(2) if m else None,
                                             "input": m.group(3).strip() if m else None}
        out.append({"name": name, "about": re.sub(r"\s+", " ", desc.group(1)).strip() if desc else "", "caps": caps,
                    "sizes": sizes, "pulls": pulls.group(1) if pulls else None, "updated": upd.group(1) if upd else None,
                    "tags": found})
        time.sleep(0.25)
    (CACHE / "ollama.json").write_text(json.dumps(out))
    print(f"ollama: {len(out)} models, {sum(len(o['tags']) for o in out)} tags")


def fetch_lmstudio():
    """LM Studio's catalog: its families, and the models inside each."""
    def payload(html):
        chunks = re.findall(r'self\.__next_f\.push\(\[1,"(.*?)"\]\)', html, re.S)
        return "".join(json.loads('"' + c + '"') for c in chunks)
    top = page("https://lmstudio.ai/models")
    slugs = sorted(set(re.findall(r'href="/models/([a-z0-9._-]+)"', top)))
    out = []
    for slug in slugs:
        html = page(f"https://lmstudio.ai/models/{slug}")
        p = payload(html)
        title = re.search(r"<title>([^<]*)</title>", html)
        meta = re.search(r'<meta name="description" content="([^"]*)"', html)
        arts = []
        for m in re.finditer(r'\{"artifact":\{"identifier":"([^"]+)","owner":"([^"]*)","name":"([^"]*)","type":"([^"]*)"[^{}]*?"description":"((?:[^"\\]|\\.)*)","createdAt":"([^"]*)"', p):
            ident = m.group(1)
            rest = p[m.end():m.end() + 4000]
            size = re.search(r'"identifier":"' + re.escape(ident) + r'","sizeRequirement":"([^"]*)"', rest)
            arts.append({"id": ident, "type": m.group(4), "about": json.loads('"' + m.group(5) + '"'), "created": m.group(6),
                         "size": size.group(1) if size else None})
        seen = set()
        arts = [a for a in arts if not (a["id"] in seen or seen.add(a["id"]))]
        out.append({"slug": slug, "title": (title.group(1) if title else slug).split("|")[0].strip(),
                    "about": meta.group(1) if meta else "", "models": arts})
        time.sleep(0.3)
    (CACHE / "lmstudio.json").write_text(json.dumps(out))
    print(f"lmstudio: {len(out)} families, {sum(len(o['models']) for o in out)} models")


def fetch_logos(limit=320):
    """Each maker's picture from Hugging Face, 64 px, for the makers people will see most."""
    import subprocess
    cat = json.loads((CACHE.parent.parent / "catalog.json").read_text())
    dest = CACHE.parent.parent / "logos" / "hub"
    dest.mkdir(parents=True, exist_ok=True)
    score = {}
    for e in cat["models"]:
        score[e["org"]] = score.get(e["org"], 0) + e.get("score", 0)
    orgs = sorted(score, key=lambda o: (not cat["makers"].get(o, {}).get("lab"), -score[o]))[:limit]
    got = 0
    for org in orgs:
        out = dest / f"{org}.png"
        if out.exists() or org in ("ollama",):
            continue
        url = None
        for kind in ("organizations", "users"):
            try:
                body, _ = get(f"https://huggingface.co/api/{kind}/{org}/avatar", tries=1)
                url = json.loads(body).get("avatarUrl")
                if url:
                    break
            except Exception:
                pass
        if not url:
            continue
        if url.startswith("/"):
            url = "https://huggingface.co" + url
        try:
            raw, _ = get(url, tries=2)
        except Exception:
            continue
        tmp = dest / f".{org}.src"
        tmp.write_bytes(raw)
        r = subprocess.run(["sips", "-s", "format", "png", "-z", "64", "64", str(tmp), "--out", str(out)], capture_output=True)
        tmp.unlink(missing_ok=True)
        if r.returncode == 0:
            got += 1
        time.sleep(0.35)
    print(f"logos: {got} new, {len(list(dest.glob('*.png')))} in all")


def fetch_sizes():
    """The exact size of every file the catalog offers to download (one request per repo)."""
    cat = json.loads((CACHE.parent.parent / "catalog.json").read_text())
    path = CACHE / "sizes.json"
    sizes = json.loads(path.read_text()) if path.exists() else {}
    repos = sorted({e["gguf"]["repo"] for e in cat["models"] if e.get("gguf")} - set(sizes))
    for i, repo in enumerate(repos):
        try:
            body, _ = get(f"https://huggingface.co/api/models/{repo}/tree/main?recursive=false", tries=2)
            sizes[repo] = {f["path"]: (f.get("lfs") or {}).get("size") or f.get("size") for f in json.loads(body)
                           if f.get("type") == "file" and f["path"].endswith(".gguf")}
        except Exception as e:
            print(f"  {repo}: {e}", file=sys.stderr)
        if i % 50 == 0:
            path.write_text(json.dumps(sizes))
        time.sleep(0.62)          # stays under Hugging Face's 500 requests / 5 minutes
    path.write_text(json.dumps(sizes))
    print(f"sizes: {len(sizes)} repos")


if __name__ == "__main__":
    CACHE.mkdir(exist_ok=True)
    for what in sys.argv[1:] or ["hf", "gguf"]:
        {"hf": fetch_hf, "gguf": fetch_gguf, "ollama": fetch_ollama, "lmstudio": fetch_lmstudio, "logos": fetch_logos, "sizes": fetch_sizes}[what]()
