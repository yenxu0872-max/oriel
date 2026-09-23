#!/usr/bin/env python3
"""Assemble ui/index.html from the Oriel v3 design.

    python3 ui/_build/build.py

Takes the design's markup unchanged except for the edits below, swaps in the
local logic from component.js, and replaces Google Fonts with the vendored
Geist files so the page loads with no network at all.
"""
import html
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
UI = HERE.parent
SRC = UI / "_design" / "Oriel v3.dc.html"
OUT = UI / "index.html"


def match_close(s, start, tag):
    """Index just past the close tag matching the open tag at `start`,
    counting nested tags of the same name."""
    depth, i = 0, start
    open_re = re.compile(rf"<{tag}\b")
    close = f"</{tag}>"
    while i < len(s):
        o = open_re.search(s, i)
        c = s.find(close, i)
        if c == -1:
            raise ValueError(f"unclosed <{tag}> at {start}")
        if o and o.start() < c:
            depth += 1
            i = o.end()
        else:
            depth -= 1
            i = c + len(close)
            if depth == 0:
                return i
    raise ValueError(f"unclosed <{tag}> at {start}")


def remove_blocks(s, tag, opener, label):
    """Remove every <tag …> element whose opening text starts with `opener`."""
    n = 0
    while True:
        i = s.find(opener)
        if i == -1:
            break
        j = match_close(s, i, tag)
        s = s[:i] + s[j:]
        n += 1
    print(f"  removed {n}× {label}")
    return s


def must_replace(s, old, new, label, count=None):
    k = s.count(old)
    if not k or (count is not None and k != count):
        sys.exit(f"  ✗ {label}: expected {count or '≥1'} match, found {k}")
    print(f"  replaced {k}× {label}")
    return s.replace(old, new)


src = SRC.read_text()

# ---- split: head / component script / template -------------------------
m = re.search(r'<script type="text/x-dc"[^>]*>.*?</script>', src, re.S)
if not m:
    sys.exit("  ✗ component script not found")
tpl_part = src[:m.start()] + "\x00LOGIC\x00" + src[m.end():]

# ---- template edits ------------------------------------------------------
print("template:")
# features an offline model cannot really provide; left in, they would
# fabricate sources, citations and "images"
tpl_part = remove_blocks(tpl_part, "button", '<button onClick="{{ pickResearch }}"', "Deep research tool")
tpl_part = remove_blocks(tpl_part, "button", '<button onClick="{{ pickImage }}"', "Create image tool")
tpl_part = remove_blocks(tpl_part, "sc-if", '<sc-if value="{{ webOn }}"', "Search toggle (on)")
tpl_part = remove_blocks(tpl_part, "sc-if", '<sc-if value="{{ webOff }}"', "Search toggle (off)")

tpl_part = must_replace(tpl_part, ">Free plan<", ">{{ planLabel }}<", "'Free plan' → offline status")
tpl_part = must_replace(tpl_part, "Images, PDFs, docs, spreadsheets", "Images and text files",
                        "attachment description")
tpl_part = must_replace(
    tpl_part, 'type="file" multiple="{{ true }}"',
    'type="file" multiple="{{ true }}" accept="image/*,text/*,.md,.csv,.json,.js,.ts,.py,.html,.css,.xml,.yaml,.yml,.log,.sql,.sh"',
    "file picker accepts images + text")

# the share button copied a link to nowhere; it now copies the conversation
i = tpl_part.find('onClick="{{ share }}"')
j = tpl_part.find("</button>", i)
seg = tpl_part[i:j]
seg2 = re.sub(r">(\s*)Share(\s*)<", r">\1Copy chat\2<", seg)
if seg2 == seg:
    seg2 = re.sub(r"(</svg>\s*)Share(\s*)$", r"\1Copy chat\2", seg)
if seg2 == seg:
    sys.exit("  ✗ share label not found")
tpl_part = tpl_part[:i] + seg2 + tpl_part[j:]
print("  replaced 1× 'Share' → 'Copy chat'")

# ---- head: local fonts, title, icon -------------------------------------
print("head:")
tpl_part = re.sub(r'\s*<link rel="preconnect" href="https://fonts\.googleapis\.com">', "", tpl_part)
tpl_part = must_replace(
    tpl_part,
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap">',
    "<style>"
    "@font-face{font-family:'Geist';src:url('fonts/Geist-Variable.woff2') format('woff2');font-weight:100 900;font-style:normal;font-display:swap}"
    "@font-face{font-family:'Geist Mono';src:url('fonts/GeistMono-Variable.woff2') format('woff2');font-weight:100 900;font-style:normal;font-display:swap}"
    "</style>",
    "Google Fonts → vendored Geist", count=1)
icon = ("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E"
        "%3Ccircle cx='16' cy='16' r='14' fill='%2317171a'/%3E"
        "%3Ccircle cx='15' cy='17' r='8' fill='%237b8cf5'/%3E"
        "%3Ccircle cx='22.5' cy='9.5' r='3.6' fill='%23fff' stroke='%2317171a' stroke-width='1.6'/%3E%3C/svg%3E")
tpl_part = must_replace(
    tpl_part, '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
    '<title>oriel.ai</title>\n'
    f'<link rel="icon" href="{icon}">',
    "title + favicon", count=1)

# ---- logic ---------------------------------------------------------------
logic = (HERE / "component.js").read_text()
props = html.escape('{"thinkDefault":{"editor":"boolean","default":false,"tsType":"boolean"}}', quote=True)
out = tpl_part.replace(
    "\x00LOGIC\x00",
    f'<script type="text/x-dc" data-dc-script data-props="{props}">{logic}</script>')

# ---- checks --------------------------------------------------------------
remote = re.findall(r'(?:src|href)="(https?://[^"]+)"', out)
if remote:
    sys.exit(f"  ✗ remote resources still referenced: {remote}")
for gone in ("webOn", "webOff", "toggleWeb", "pickResearch", "pickImage", "Free plan"):
    if re.search(rf"\b{gone}\b", out.split('data-dc-script')[0]):
        sys.exit(f"  ✗ template still references {gone}")

OUT.write_text(out)
print(f"\n  wrote {OUT.relative_to(UI.parent)} — {len(out):,} bytes, no remote resources")
