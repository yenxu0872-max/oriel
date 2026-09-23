"""Real web search, used only when the user switches Search on.

    search("solid-state battery news") ->
        [{"n": 1, "title": ..., "url": ..., "domain": ..., "snippet": ..., "text": ...}, ...]

Results come from DuckDuckGo's plain-HTML endpoint; the top few pages are then
actually fetched and reduced to readable text, so the model answers from what
the pages say and cites links that exist — unlike the design's original
"Search", which asked an offline model to invent sources.

Safety:
  - only public internet addresses are fetched. A page (or a redirect) that
    points at localhost, the router or anything else on the local network is
    refused, so search results cannot be used to reach into this machine or
    the LAN.
  - page text is returned as data; the caller frames it to the model as
    untrusted information, never as instructions.
  - response sizes and times are capped.
"""

import concurrent.futures
import html
import ipaddress
import re
import socket
import urllib.parse
import urllib.request
from html.parser import HTMLParser

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 "
      "(KHTML, like Gecko) Version/18.0 Safari/605.1.15 oriel.ai/1.0")
SEARCH_URLS = ("https://html.duckduckgo.com/html/?q={q}", "https://lite.duckduckgo.com/lite/?q={q}")
MAX_PAGE_BYTES = 1_500_000
PAGE_CHARS = 3000
TIMEOUT = 8


class SearchError(Exception):
    pass


def _public(host):
    """True only if every address the host resolves to is on the public internet."""
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror:
        return False
    for info in infos:
        ip = ipaddress.ip_address(info[4][0].split("%")[0])
        if (ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved
                or ip.is_multicast or ip.is_unspecified):
            return False
    return True


def _check(url):
    p = urllib.parse.urlparse(url)
    if p.scheme not in ("http", "https") or not p.hostname or not _public(p.hostname):
        raise SearchError(f"refused non-public address: {p.hostname}")


class _SafeRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        _check(newurl)   # a redirect is re-validated like any other address
        return super().redirect_request(req, fp, code, msg, headers, newurl)


_opener = urllib.request.build_opener(_SafeRedirect())


def _get(url, limit):
    _check(url)
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "en;q=0.9"})
    with _opener.open(req, timeout=TIMEOUT) as r:
        ctype = r.headers.get("Content-Type", "")
        body = r.read(limit + 1)
    if len(body) > limit:
        body = body[:limit]
    charset = re.search(r"charset=([\w-]+)", ctype)
    return body.decode(charset.group(1) if charset else "utf-8", errors="replace"), ctype


class _Text(HTMLParser):
    """Readable text from a page: drops scripts, menus and furniture, prefers
    the <article>/<main> region when there is a substantial one."""
    SKIP = {"script", "style", "noscript", "nav", "header", "footer", "aside",
            "form", "svg", "iframe", "button", "select", "template"}
    BLOCK = {"p", "div", "br", "li", "tr", "h1", "h2", "h3", "h4", "h5", "h6",
             "section", "article", "blockquote", "pre", "dd", "dt"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.skip = 0
        self.main = 0
        self.all, self.core = [], []

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP:
            self.skip += 1
        elif tag in ("article", "main"):
            self.main += 1
        if tag in self.BLOCK:
            self.all.append("\n")
            if self.main:
                self.core.append("\n")

    def handle_endtag(self, tag):
        if tag in self.SKIP and self.skip:
            self.skip -= 1
        elif tag in ("article", "main") and self.main:
            self.main -= 1

    def handle_data(self, data):
        if self.skip:
            return
        self.all.append(data)
        if self.main:
            self.core.append(data)

    def text(self):
        def tidy(parts):
            t = re.sub(r"[ \t\r\f\v]+", " ", "".join(parts))
            t = re.sub(r"\n\s*\n+", "\n\n", t)
            return "\n".join(l.strip() for l in t.split("\n")).strip()
        core = tidy(self.core)
        return core if len(core) > 500 else tidy(self.all)


def _page_text(url):
    try:
        body, ctype = _get(url, MAX_PAGE_BYTES)
    except Exception:
        return ""
    if "html" not in ctype and "text" not in ctype:
        return ""
    if "html" in ctype:
        p = _Text()
        try:
            p.feed(body)
        except Exception:
            return ""
        text = p.text()
    else:
        text = body
    return text[:PAGE_CHARS].strip()


def _strip(s):
    return html.unescape(re.sub(r"<[^>]+>", "", s)).strip()


def _parse_ddg(page):
    links = re.findall(r'<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>(.*?)</a>', page, re.S)
    snips = re.findall(r'class="result__snippet"[^>]*>(.*?)</(?:a|td|div)>', page, re.S)
    if not links:   # lite layout
        links = re.findall(r"<a[^>]+rel=\"nofollow\"[^>]+href=\"([^\"]+)\"[^>]*class='result-link'[^>]*>(.*?)</a>", page, re.S) \
             or re.findall(r'<a[^>]+class=["\']result-link["\'][^>]+href=["\']([^"\']+)["\'][^>]*>(.*?)</a>', page, re.S)
        snips = re.findall(r"class=['\"]result-snippet['\"][^>]*>(.*?)</td>", page, re.S)
    out = []
    for i, (href, title) in enumerate(links):
        href = html.unescape(href)
        if href.startswith("//"):
            href = "https:" + href
        q = urllib.parse.parse_qs(urllib.parse.urlparse(href).query)
        url = q.get("uddg", [href])[0]
        if "duckduckgo.com/y.js" in url or not url.startswith("http"):
            continue   # ads and internal links
        out.append({"title": _strip(title), "url": url,
                    "snippet": _strip(snips[i]) if i < len(snips) else ""})
    return out


def search(query, results=5, read=3):
    """Search, then read the top `read` pages. Raises SearchError when the
    search itself is unavailable (offline, blocked, rate-limited)."""
    query = query.strip()[:300]
    if not query:
        raise SearchError("empty query")
    hits, last = [], None
    for tmpl in SEARCH_URLS:
        try:
            page, _ = _get(tmpl.format(q=urllib.parse.quote_plus(query)), 800_000)
            hits = _parse_ddg(page)
            if hits:
                break
        except Exception as e:
            last = e
    if not hits:
        raise SearchError("search unavailable" + (f": {last}" if last else " — no results"))
    seen, uniq = set(), []
    for h in hits:
        if h["url"] not in seen:
            seen.add(h["url"])
            uniq.append(h)
    uniq = uniq[:results]
    with concurrent.futures.ThreadPoolExecutor(max_workers=read) as pool:
        texts = list(pool.map(_page_text, [h["url"] for h in uniq[:read]]))
    for i, h in enumerate(uniq, 1):
        h["n"] = i
        h["domain"] = urllib.parse.urlparse(h["url"]).hostname.removeprefix("www.")
        h["text"] = texts[i - 1] if i <= len(texts) else ""
    return uniq
