#!/usr/bin/env python3
"""Assemble ui/index.html from the Oriel v3 design.

    python3 ui/_build/build.py          the Mac app's page (ui/index.html)
    python3 ui/_build/build.py --web    the website's chat page (web/chat.html),
                                        where models run in the browser itself

Steps, in order:
  1. take the design's markup
  2. edit it: remove what an offline build can't back, add oriel's features
     (voice, code blocks, export, appearance, memory notice)
  3. dark mode: every colour in the markup becomes a CSS variable with a light
     value (the design's own) and a dark value derived by rule in OKLCH
  4. swap Google Fonts for the vendored Geist, add highlight.js, set the title
  5. drop in the logic from component.js
  6. refuse to write the page if anything would load from the network
"""
import html
import json
import math
import re
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
UI = HERE.parent
SRC = UI / "_design" / "Oriel v3.dc.html"
WEB = "--web" in sys.argv
SITE = UI.parent / "web"
OUT = SITE / "chat.html" if WEB else UI / "index.html"

# The web page's model download, shown in the empty chat and above the messages.
LOAD_NOTE = """<sc-if value="{{ hasLoad }}"><div style="width:100%;max-width:640px;margin:18px auto 0;padding:12px 16px;border:1px solid #eeeef1;border-radius:14px;background:#f6f6f8;font-size:13.5px;color:#4a4a46;text-align:left">
<div style="display:flex;justify-content:space-between;gap:12px;align-items:baseline"><span>{{ loadText }}</span><span style="color:#8a8a84;font-variant-numeric:tabular-nums">{{ loadPct }}</span></div>
<sc-if value="{{ loadBar }}"><div style="height:4px;border-radius:999px;background:#e4e4e9;margin-top:9px;overflow:hidden"><div style="height:100%;width:{{ loadWidth }};background:linear-gradient(90deg,oklch(0.68 0.19 300),oklch(0.7 0.15 230));border-radius:999px;transition:width .3s"></div></div></sc-if>
</div></sc-if>"""


# ------------------------------------------------------------------ helpers

def match_close(s, start, tag):
    """Index just past the close tag matching the open tag at `start`."""
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
    n = 0
    while (i := s.find(opener)) != -1:
        s = s[:i] + s[match_close(s, i, tag):]
        n += 1
    print(f"  removed {n}× {label}")
    return s


def must_replace(s, old, new, label, count=None):
    k = s.count(old)
    if not k or (count is not None and k != count):
        sys.exit(f"  ✗ {label}: expected {count or '≥1'} match, found {k}")
    print(f"  replaced {k}× {label}")
    return s.replace(old, new)


def insert_after_block(s, opener, tag, markup, label):
    """Insert `markup` right after the element that starts with `opener`."""
    i = s.find(opener)
    if i == -1:
        sys.exit(f"  ✗ {label}: anchor not found")
    j = match_close(s, i, tag)
    print(f"  inserted {label}")
    return s[:j] + markup + s[j:]


# ------------------------------------------------------------- new markup

ITEM = ("display:flex;align-items:center;gap:10px;height:36px;padding:0 10px;border:0;border-radius:9px;"
        "background:transparent;font-family:inherit;font-size:14px;color:#1d1d1b;cursor:pointer;text-align:left")
MENU = ("position:absolute;top:42px;right:0;width:196px;background:#fff;border:1px solid #e8e8ec;border-radius:14px;"
        "box-shadow:0 12px 36px rgba(20,20,18,.12);padding:5px;z-index:31;display:flex;flex-direction:column;gap:1px")
DL_ICON = ('<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
           'stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>'
           '<path d="M7 10l5 5 5-5"></path><path d="M12 15V3"></path></svg>')


def export_menu(toggle, is_open, options, height):
    return (
        f'<div style="position:relative">'
        f'<button onClick="{{{{ {toggle} }}}}" title="Save to Downloads" style="display:flex;align-items:center;gap:7px;'
        f'height:{height}px;padding:0 12px;border-radius:999px;border:1px solid #e8e8ec;background:transparent;'
        f'font-family:inherit;font-size:13px;font-weight:500;color:#1d1d1b;cursor:pointer" style-hover="background:#f4f4f7">'
        f'{DL_ICON} Export</button>'
        f'<sc-if value="{{{{ {is_open} }}}}">'
        f'<div onClick="{{{{ closeMenus }}}}" style="position:fixed;inset:0;z-index:30"></div>'
        f'<div style="{MENU}">'
        f'<div style="padding:6px 10px 4px;font-size:12px;color:#8a8a84">Save to Downloads as</div>'
        f'<sc-for list="{{{{ {options} }}}}" as="eo">'
        f'<button onClick="{{{{ eo.pick }}}}" style="{ITEM}" style-hover="background:#f4f4f7">{{{{ eo.label }}}}</button>'
        f'</sc-for></div></sc-if></div>')


MIC = (
    '<sc-if value="{{ micIdle }}">'
    '<button onClick="{{ toggleMic }}" title="Dictate — transcribed on this Mac" style="display:flex;align-items:center;'
    'justify-content:center;width:36px;height:36px;padding:0;border-radius:999px;border:1px solid #e8e8ec;'
    'background:transparent;color:#3a3a37;cursor:pointer" style-hover="background:#f4f4f7">'
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
    'stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z"></path>'
    '<path d="M5 11a7 7 0 0 0 14 0"></path><path d="M12 18v3"></path></svg></button></sc-if>'
    '<sc-if value="{{ micRec }}">'
    '<button onClick="{{ toggleMic }}" title="Stop and transcribe" style="display:flex;align-items:center;gap:8px;'
    'height:36px;padding:0 12px;border-radius:999px;border:1px solid oklch(0.85 0.08 25);background:oklch(0.96 0.03 25);'
    'color:oklch(0.48 0.18 25);font-family:inherit;font-size:13px;font-weight:500;cursor:pointer;font-variant-numeric:tabular-nums">'
    '<span style="width:8px;height:8px;border-radius:999px;background:oklch(0.62 0.2 25);animation:pulse 1.2s infinite"></span>'
    '{{ micTime }}</button></sc-if>'
    '<sc-if value="{{ micBusy }}">'
    '<div style="display:flex;align-items:center;height:36px;padding:0 12px;border-radius:999px;border:1px solid #e8e8ec;'
    'color:#6b6b66;font-size:13px">Transcribing…</div></sc-if>')

CODE_BLOCK = (
    '<sc-if value="{{ p.isCode }}">'
    '<div style="border:1px solid #e8e8ec;border-radius:12px;overflow:hidden;background:#fafafb">'
    '<div style="display:flex;align-items:center;justify-content:space-between;height:34px;padding:0 6px 0 14px;'
    'border-bottom:1px solid #eeeef1;font-size:12px;color:#8a8a84">'
    '<span style="font-family:\'Geist Mono\',ui-monospace,monospace">{{ p.lang }}</span>'
    '<button onClick="{{ p.copy }}" style="height:26px;padding:0 10px;border:0;border-radius:7px;background:transparent;'
    'font-family:inherit;font-size:12px;font-weight:500;color:#6b6b66;cursor:pointer" style-hover="background:#f0f0f3">'
    '{{ p.copyLabel }}</button></div>'
    '<pre style="margin:0;padding:12px 14px;overflow-x:auto;font-family:\'Geist Mono\',ui-monospace,monospace;'
    'font-size:13px;line-height:1.6;tab-size:4"><code><sc-for list="{{ p.tokens }}" as="tk">'
    '<span style="color:{{ tk.c }}">{{ tk.t }}</span></sc-for></code></pre></div></sc-if>')

MEMORY_NOTE = (
    '<sc-if value="{{ hasMemoryNote }}">'
    '<div style="display:flex;align-items:flex-start;gap:9px;padding:10px 13px;border:1px solid #e8e8ec;border-radius:12px;'
    'background:#fafafb;font-size:13px;line-height:1.5;color:#6b6b66">'
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
    'stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:2px"><circle cx="12" cy="12" r="10"></circle>'
    '<path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>{{ memoryNote }}</div></sc-if>')


# --------------------------------------------------------- dark-mode colours

def _lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def srgb_to_oklch(r, g, b):
    r, g, b = _lin(r), _lin(g), _lin(b)
    l = (0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b) ** (1 / 3)
    m = (0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b) ** (1 / 3)
    s = (0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b) ** (1 / 3)
    L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s
    a = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s
    bb = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
    return L, math.hypot(a, bb), math.degrees(math.atan2(bb, a)) % 360


def parse_color(col):
    """→ (L, C, H, alpha) in OKLCH, or None."""
    col = col.strip().lower()
    if col.startswith("#"):
        h = col[1:]
        if len(h) == 3:
            h = "".join(ch * 2 for ch in h)
        r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
        return (*srgb_to_oklch(r, g, b), 1.0)
    m = re.match(r"oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:/\s*([\d.]+))?\s*\)", col)
    if m:
        return float(m[1]), float(m[2]), float(m[3]), float(m[4] or 1)
    m = re.match(r"rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)", col)
    if m:
        r, g, b = (int(m[i]) / 255 for i in (1, 2, 3))
        return (*srgb_to_oklch(r, g, b), float(m[4] or 1))
    return None


def dark_of(col, role):
    """The dark-mode counterpart of a design colour, by rule:
         neutrals        lightness inverted, so light surfaces go dark, dark
                         text goes light, and an inverted pair (white text on a
                         black button) stays readable as a pair
         pale tints      become dark tints of the same hue
         vivid colours   kept (brand orb, accents, dots) — except as text,
                         where they are lifted to stay legible
         shadows         deepened; white glass overlays become dark glass
    """
    p = parse_color(col)
    if not p:
        return col
    L, C, H, A = p
    raw = col.strip().lower()
    if raw.startswith("rgba") or A < 1:
        if raw.startswith("rgb"):
            nums = [int(x) for x in re.findall(r"\d+", raw)[:3]]
            if max(nums) < 80:        # dark shadow / scrim
                return f"rgba(0,0,0,{min(A * 2.2, 0.7):.2f})"
            if min(nums) > 200:       # white glass
                return f"rgba(26,26,30,{A:.2f})"
        # translucent oklch tint (the glow behind the greeting)
        return f"oklch({min(max(1.16 - L, 0.26), 0.42):.3f} {C:.3f} {H:.1f} / {A * 0.75:.2f})"
    if C < 0.04:
        Ld = min(max(1.16 - L, 0.12), 0.97)
        return f"oklch({Ld:.3f} {C:.3f} {H:.1f})"
    if L > 0.84:                      # pastel surfaces and borders
        return f"oklch({min(max(1.16 - L, 0.22), 0.4):.3f} {min(C * 1.3, 0.09):.3f} {H:.1f})"
    if role == "t" and L < 0.72:      # accent text on a dark page
        return f"oklch({max(1.16 - L, 0.74):.3f} {C:.3f} {H:.1f})"
    return col


ROLE = {"color": "t", "caret-color": "t", "fill": "t", "stroke": "t", "outline": "l", "outline-color": "l",
        "box-shadow": "s", "text-shadow": "s"}
COLOR_RE = re.compile(r"#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|oklch\([^)]*\)|rgba?\([^)]*\)")


def slug(col):
    c = col.lower()
    if re.fullmatch(r"#[0-9a-f]{3}", c):
        c = "#" + "".join(ch * 2 for ch in c[1:])
    if c.startswith("#"):
        return c[1:]
    return re.sub(r"[^0-9a-z]+", "-", c).strip("-")   # oklch(0.95 0.03 282) → oklch-0-95-0-03-282


def colour_pass(markup):
    """Every colour inside style declarations → var(--c-<slug>-<role>)."""
    table = {}

    def decls(text):
        def one(m):
            prop, val = m.group(1), m.group(2)
            role = ROLE.get(prop.strip().lower(),
                            "l" if prop.strip().lower().startswith(("border", "outline")) else "b")

            def sub(cm):
                col = cm.group(0)
                name = f"--c-{slug(col)}-{role}"
                table[name] = (col, role)
                return f"var({name})"
            return f"{prop}:{COLOR_RE.sub(sub, val)}"
        return re.sub(r"([a-zA-Z-]+)\s*:\s*([^;{}\"]+)", one, text)

    markup = re.sub(r'(style(?:-[a-z]+)?)="([^"]*)"', lambda m: f'{m.group(1)}="{decls(m.group(2))}"', markup)
    markup = re.sub(r"(<style>)(.*?)(</style>)", lambda m: m.group(1) + decls(m.group(2)) + m.group(3), markup, flags=re.S)

    # SVG presentation attributes can't hold var(); override them from CSS
    attr_rules_l, attr_rules_d = [], []
    for attr, col in sorted(set(re.findall(r'\b(stroke|fill)="(#[0-9a-fA-F]{3,6})"', markup))):
        attr_rules_l.append(f'[{attr}="{col}"]{{{attr}:{col}}}')
        attr_rules_d.append(f'[{attr}="{col}"]{{{attr}:{dark_of(col, "t")}}}')

    light = ";".join(f"{k}:{c}" for k, (c, r) in sorted(table.items()))
    dark = ";".join(f"{k}:{dark_of(c, r)}" for k, (c, r) in sorted(table.items()))
    hl_light = ("--hl-pl:#1d1d1b;--hl-kw:oklch(0.5 0.17 300);--hl-bi:oklch(0.5 0.12 250);--hl-ty:oklch(0.52 0.12 200);"
                "--hl-nu:oklch(0.56 0.14 50);--hl-st:oklch(0.5 0.13 150);--hl-co:#8a8a84;--hl-fn:oklch(0.5 0.15 262);"
                "--hl-at:oklch(0.5 0.12 225);--hl-me:oklch(0.56 0.1 60);--hl-tg:oklch(0.52 0.15 20);--hl-de:oklch(0.52 0.18 25)")
    hl_dark = ("--hl-pl:#e7e7e4;--hl-kw:oklch(0.78 0.13 300);--hl-bi:oklch(0.8 0.1 250);--hl-ty:oklch(0.8 0.09 200);"
               "--hl-nu:oklch(0.8 0.12 60);--hl-st:oklch(0.8 0.13 150);--hl-co:#85857f;--hl-fn:oklch(0.8 0.12 262);"
               "--hl-at:oklch(0.8 0.1 225);--hl-me:oklch(0.78 0.1 60);--hl-tg:oklch(0.78 0.13 20);--hl-de:oklch(0.75 0.15 25)")
    css = (
        "<style>"
        f":root{{color-scheme:light;{light};{hl_light}}}{''.join(attr_rules_l)}"
        f"@media (prefers-color-scheme:dark){{:root:not([data-theme=light]){{color-scheme:dark;{dark};{hl_dark}}}"
        + "".join(f":root:not([data-theme=light]) {r}" for r in attr_rules_d) + "}"
        f":root[data-theme=dark]{{color-scheme:dark;{dark};{hl_dark}}}"
        + "".join(f":root[data-theme=dark] {r}" for r in attr_rules_d)
        + "</style>")
    print(f"  dark mode: {len(table)} colour variables, {len(attr_rules_l)} SVG overrides")
    return markup, css, table


# -------------------------------------------------------------------- build

src = SRC.read_text()
m = re.search(r'<script type="text/x-dc"[^>]*>.*?</script>', src, re.S)
if not m:
    sys.exit("  ✗ component script not found")
tpl = src[:m.start()] + "\x00LOGIC\x00" + src[m.end():]

print("template:")
# can't be real offline, and would fabricate: removed
tpl = remove_blocks(tpl, "button", '<button onClick="{{ pickResearch }}"', "Deep research tool")
tpl = remove_blocks(tpl, "button", '<button onClick="{{ pickImage }}"', "Create image tool")
# Search stays: it is backed by a real web search now. Voice goes beside it.
tpl = insert_after_block(tpl, '<sc-if value="{{ webOff }}"', "sc-if", MIC, "microphone button")

tpl = must_replace(tpl, ">Free plan<", ">{{ planLabel }}<", "'Free plan' → status")
tpl = must_replace(tpl, "Images, PDFs, docs, spreadsheets",
                   "PDFs, text and code, and images for Phi-3.5 Vision" if WEB else "Images, PDFs, Word, Excel, text",
                   "attachment description")
tpl = must_replace(
    tpl, 'type="file" multiple="{{ true }}"',
    'type="file" multiple="{{ true }}" accept="image/*,text/*,.pdf,' + ('' if WEB else '.doc,.docx,.rtf,.odt,.xlsx,.pptx,') +
    '.md,.csv,.json,.js,.ts,.py,.swift,.html,.css,.xml,.yaml,.yml,.log,.sql,.sh"',
    "file picker types")

# code blocks: each paragraph is now either prose (the design's own markup) or code
i = tpl.find('<sc-for list="{{ m.paras }}" as="p">')
j = match_close(tpl, i, "sc-for")
block = tpl[i:j]
k = block.find("<p ")
prose_p = block[k:block.rfind("</p>") + 4]
tpl = tpl[:i] + ('<sc-for list="{{ m.paras }}" as="p"><sc-if value="{{ p.isProse }}">' + prose_p
                 + "</sc-if>" + CODE_BLOCK + "</sc-for>") + tpl[j:]
print("  replaced paragraph renderer: prose + highlighted code")

# share → Copy chat, with Export beside it
i = tpl.find('<button onClick="{{ share }}"')
j = match_close(tpl, i, "button")
share = re.sub(r">(\s*)Share(\s*)<", r">\1Copy chat\2<", tpl[i:j])
if share == tpl[i:j]:
    share = re.sub(r"(</svg>\s*)Share(\s*)</button>$", r"\1Copy chat\2</button>", tpl[i:j])
tpl = (tpl[:i] + '<div style="display:flex;align-items:center;gap:8px">' + share
       + export_menu("toggleExportChat", "exportChatOpen", "exportChatOptions", 36) + "</div>" + tpl[j:])
print("  'Share' → 'Copy chat' + Export menu")

tpl = insert_after_block(tpl, '<button onClick="{{ copyCanvas }}"', "button",
                         export_menu("toggleExportCanvas", "exportCanvasOpen", "exportCanvasOptions", 34),
                         "canvas Export menu")

# Settings → Appearance, cloned from the design's own Response length picker
i = tpl.find('<span style="font-size:14px;font-weight:500">Response length</span>')
start = tpl.rfind("<div", 0, i)
end = match_close(tpl, start, "div")
appearance = (tpl[start:end].replace("Response length", "Appearance").replace("{{ styles }}", "{{ themes }}")
              .replace('as="st"', 'as="th"').replace("{{ st.", "{{ th."))
tpl = tpl[:end] + appearance + tpl[end:]
print("  inserted Appearance setting")

tpl = must_replace(tpl, '<sc-for list="{{ messages }}" as="m">',
                   (LOAD_NOTE if WEB else "") + MEMORY_NOTE + '<sc-for list="{{ messages }}" as="m">', "memory notice", count=1)
if WEB:
    i = tpl.find("{{ greeting }}</h1>")
    if i < 0:
        sys.exit("  ✗ greeting not found")
    i += len("{{ greeting }}</h1>")
    tpl = tpl[:i] + LOAD_NOTE + tpl[i:]
    print("  inserted model download progress")

print("head:")
tpl = re.sub(r'\s*<link rel="preconnect" href="https://fonts\.googleapis\.com">', "", tpl)
tpl = must_replace(
    tpl,
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap">',
    "<style>"
    "@font-face{font-family:'Geist';src:url('fonts/Geist-Variable.woff2') format('woff2');font-weight:100 900;font-display:swap}"
    "@font-face{font-family:'Geist Mono';src:url('fonts/GeistMono-Variable.woff2') format('woff2');font-weight:100 900;font-display:swap}"
    "</style>",
    "Google Fonts → vendored Geist", count=1)

tpl, theme_css, _ = colour_pass(tpl)
if WEB:
    WEB_CONFIG = json.dumps({"webllm": json.loads((SITE / "models.json").read_text())["engine"]["webllm"],
                             "models": "models.json", "worker": "engine-worker.js", "browse": "models.html"})

icon = ("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E"
        "%3Ccircle cx='16' cy='16' r='14' fill='%2317171a'/%3E"
        "%3Ccircle cx='15' cy='17' r='8' fill='%237b8cf5'/%3E"
        "%3Ccircle cx='22.5' cy='9.5' r='3.6' fill='%23fff' stroke='%2317171a' stroke-width='1.6'/%3E%3C/svg%3E")
# theme applied before first paint, so a dark-mode user never sees a white flash
early_theme = ("<script>try{var t=localStorage.getItem('oriel-theme');"
               "if(t==='Dark')document.documentElement.dataset.theme='dark';"
               "else if(t==='Light')document.documentElement.dataset.theme='light';}catch(e){}</script>")
# Inside the Mac app the window has no separate title bar: the traffic lights
# sit over the page, so each column keeps a strip clear at the top, in its own
# colour. The app marks <html data-app="mac"> and keeps --titlebar at 28
# points whatever the page zoom.
app_css = ("<style>html[data-app=mac]{--titlebar:28px}"
           "html[data-app=mac] aside[data-screen-label=Sidebar]{padding-top:calc(12px + var(--titlebar))!important}"
           "html[data-app=mac] main[data-screen-label=Chat]{padding-top:var(--titlebar)}</style>")
tpl = must_replace(
    tpl, '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
    f'<title>{"Oriel — private AI in your browser" if WEB else "oriel.ai"}</title>\n'
    f'<link rel="icon" href="{icon}">\n'
    f'{early_theme}\n{theme_css}\n{"" if WEB else app_css}\n'
    + (f'<script>window.ORIEL_WEB = {WEB_CONFIG};</script>\n' if WEB else '') +
    '<script src="./vendor/highlight.min.js"></script>',
    "title, favicon, theme, highlight.js", count=1)

logic = (HERE / "component.js").read_text()
props = html.escape('{"thinkDefault":{"editor":"boolean","default":false,"tsType":"boolean"}}', quote=True)
out = tpl.replace("\x00LOGIC\x00",
                  f'<script type="text/x-dc" data-dc-script data-props="{props}">{logic}</script>')

# ------------------------------------------------------------------- checks
remote = re.findall(r'(?:src|href)="(https?://[^"]+)"', out)
if remote:
    sys.exit(f"  ✗ remote resources still referenced: {remote}")
for gone in ("pickResearch", "pickImage", "Free plan"):
    if re.search(rf"\b{gone}\b", out.split("data-dc-script")[0]):
        sys.exit(f"  ✗ template still references {gone}")
left = COLOR_RE.findall(re.sub(r"<script.*?</script>", "", re.sub(r"<style>.*?</style>", "", out.split("data-dc-script")[0], flags=re.S), flags=re.S))
left = [c for c in left if not re.search(r'(stroke|fill)="' + re.escape(c), out)]
OUT.write_text(out)
if WEB:
    # the runtime files the page loads, next to it
    (SITE / "vendor").mkdir(exist_ok=True)
    shutil.copy2(UI / "support.js", SITE / "support.js")
    for f in (UI / "vendor").iterdir():
        shutil.copy2(f, SITE / "vendor" / f.name)
print(f"\n  wrote {OUT.relative_to(UI.parent)} — {len(out):,} bytes, no remote resources"
      + (f" · {len(left)} colours outside style attributes" if left else ""))
