"""`oriel publish` — puts the two websites online with Cloudflare Pages.

    oriel publish                     both sites, on free *.pages.dev addresses
    oriel publish --domain oriel.chat  the Oriel app at oriel.chat, Oriel Models at models.oriel.chat
    oriel publish --dry-run           build them into build/site/ and stop

Two Pages projects, one per product: the Oriel app (web/app/) and Oriel
Models (web/, without the app). Each links to the other by its public address,
so the links are rewritten in the copies built here — the sources keep their
relative links for local testing. Nothing private goes up: build caches,
experiments and the Mac app stay home.

Needs a free Cloudflare account. The first run opens Cloudflare in the
browser to let this computer publish (`wrangler login`); you approve it there.
"""
import json
import re
import shutil
import subprocess
import sys
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
WEB = HERE / "web"
OUT = HERE / "build" / "site"
CONFIG = HERE / "publish.json"
WRANGLER = ["npx", "--yes", "wrangler@4"]
HEADERS = """/*
  Referrer-Policy: no-referrer
  X-Content-Type-Options: nosniff
"""


def config():
    c = {"domain": None, "app_project": "oriel", "models_project": "oriel-models"}
    if CONFIG.exists():
        c.update(json.loads(CONFIG.read_text()))
    return c


def save_config(c):
    CONFIG.write_text(json.dumps(c, indent=2) + "\n")


# ------------------------------------------------------------------ build

def _copy(src, dst, skip=()):
    if dst.exists():
        shutil.rmtree(dst)
    shutil.copytree(src, dst, ignore=shutil.ignore_patterns(".DS_Store", *skip))


def _rewrite(path, pairs):
    s = path.read_text()
    for old, new in pairs:
        if old not in s:
            raise RuntimeError(f"{path.relative_to(OUT)}: expected {old!r} to rewrite")
        s = s.replace(old, new)
    path.write_text(s)


def build(app_url, models_url):
    """Two folders ready to upload, each linking to the other's public address."""
    app_url, models_url = app_url.rstrip("/") + "/", models_url.rstrip("/") + "/"
    app, models = OUT / "app", OUT / "models"
    _copy(WEB / "app", app)
    _copy(WEB, models, skip=("app", "_build", "_lab"))
    # the app's links to the finder
    _rewrite(app / "index.html", [('href="../"', f'href="{models_url}"')])
    _rewrite(app / "chat.html", [('"browse": "../models.html"', f'"browse": "{models_url}models.html"')])
    # the finder's links to the app
    for page in ("index.html", "models.html"):
        _rewrite(models / page, [('href="app/"', f'href="{app_url}"')])
    _rewrite(models / "site.js", [("const APP = 'app/';", f"const APP = '{app_url}';")])
    for d in (app, models):
        (d / "_headers").write_text(HEADERS)
        left = [p for p in d.rglob("*") if p.is_file() and p.stat().st_size > 25 * 1024 * 1024]
        if left:
            raise RuntimeError(f"Cloudflare Pages takes files up to 25 MB: {left}")
    return app, models


# ------------------------------------------------------------------ Cloudflare

def wrangler(*args, capture=False):
    r = subprocess.run(WRANGLER + list(args), cwd=HERE, text=True,
                       capture_output=capture, stdin=subprocess.DEVNULL if capture else None)
    return r


def _token():
    """Wrangler's own sign-in (refreshed by any wrangler command), for the two API calls it has no command for."""
    for p in (Path.home() / "Library/Preferences/.wrangler/config/default.toml", Path.home() / ".wrangler/config/default.toml"):
        if p.exists():
            m = re.search(r'oauth_token\s*=\s*"([^"]+)"', p.read_text())
            if m:
                return m.group(1)
    return None


def api(path, method="GET", body=None):
    req = urllib.request.Request("https://api.cloudflare.com/client/v4" + path, method=method,
                                 data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Authorization": f"Bearer {_token()}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        return json.loads(e.read() or b"{}") | {"success": False, "status": e.code}


def signed_in():
    r = wrangler("whoami", capture=True)
    return r.returncode == 0 and "not authenticated" not in (r.stdout + r.stderr).lower()


def account_id():
    accounts = api("/accounts").get("result") or []
    if not accounts:
        raise RuntimeError("couldn't read your Cloudflare account — try `npx wrangler login` again")
    return accounts[0]["id"]


def ensure_project(acct, name):
    got = api(f"/accounts/{acct}/pages/projects/{name}")
    if got.get("success"):
        return got["result"]
    made = api(f"/accounts/{acct}/pages/projects", "POST", {"name": name, "production_branch": "main"})
    if not made.get("success"):
        raise RuntimeError(f"couldn't create the Pages project {name}: {made.get('errors')}")
    return made["result"]


def attach_domain(acct, project, host):
    """Point a domain you own on Cloudflare at a project (Cloudflare adds the DNS record)."""
    got = api(f"/accounts/{acct}/pages/projects/{project}/domains/{host}")
    if got.get("success"):
        return got["result"].get("status")
    made = api(f"/accounts/{acct}/pages/projects/{project}/domains", "POST", {"name": host})
    return made["result"].get("status") if made.get("success") else f"not attached: {made.get('errors')}"


def publish(argv, say=print):
    c = config()
    if "--domain" in argv:
        i = argv.index("--domain")
        c["domain"] = argv[i + 1].strip().lower().removeprefix("https://").strip("/") if i + 1 < len(argv) else None
        save_config(c)
    dry = "--dry-run" in argv
    if dry:
        d = c["domain"]
        app, models = build(f"https://{d}" if d else "https://oriel.pages.dev",
                             f"https://models.{d}" if d else "https://oriel-models.pages.dev")
        say(f"built    {app}\n         {models}")
        return 0
    if not signed_in():
        say("First, let this computer publish to your Cloudflare account — your browser opens; press Allow there.")
        if wrangler("login").returncode != 0 or not signed_in():
            say("not signed in to Cloudflare — nothing was published")
            return 1
    acct = account_id()
    projects = {k: ensure_project(acct, c[f"{k}_project"]) for k in ("app", "models")}
    d = c["domain"]
    urls = {"app": f"https://{d}" if d else f"https://{projects['app']['subdomain']}",
            "models": f"https://models.{d}" if d else f"https://{projects['models']['subdomain']}"}
    app_dir, models_dir = build(urls["app"], urls["models"])
    for key, folder in (("app", app_dir), ("models", models_dir)):
        say(f"uploading {c[key + '_project']}…")
        r = wrangler("pages", "deploy", str(folder), "--project-name", c[f"{key}_project"], "--branch", "main", "--commit-dirty=true")
        if r.returncode != 0:
            say(f"the upload of {c[key + '_project']} failed")
            return 1
    if d:
        for key, host in (("app", d), ("models", f"models.{d}")):
            say(f"domain   {host} → {c[key + '_project']}: {attach_domain(acct, c[key + '_project'], host)}")
    say(f"\nlive     Oriel         {urls['app']}\n         Oriel Models  {urls['models']}")
    if not d:
        say("         (free addresses — `oriel publish --domain yourdomain` moves them to your own domain)")
    return 0
