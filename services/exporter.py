"""Save a chat or a canvas draft to ~/Downloads.

    export("Thank You Note", text, "docx") -> Path("~/Downloads/Thank You Note.docx")

Formats: md, txt, and docx (a real Word document, made with macOS textutil).
Never overwrites: an existing name gets " (2)", " (3)" … appended.
"""

import html
import re
import subprocess
import tempfile
from pathlib import Path

DOWNLOADS = Path.home() / "Downloads"
FORMATS = {"md", "txt", "docx"}


def _safe(name):
    name = re.sub(r'[\\/:*?"<>|\x00-\x1f]', "", name).strip().strip(".")
    return (name or "oriel export")[:80]


def _unique(path):
    if not path.exists():
        return path
    for i in range(2, 1000):
        p = path.with_name(f"{path.stem} ({i}){path.suffix}")
        if not p.exists():
            return p
    raise RuntimeError("too many files with this name")


def _to_html(title, text):
    """Plain text with blank-line paragraphs and '- ' lists → simple HTML, so
    the Word file gets real paragraphs, lists and a heading."""
    out = [f"<h1>{html.escape(title)}</h1>"]
    for block in re.split(r"\n\s*\n", text.strip()):
        lines = block.split("\n")
        if all(l.lstrip().startswith(("- ", "• ")) for l in lines if l.strip()):
            items = "".join(f"<li>{html.escape(l.lstrip()[2:])}</li>" for l in lines if l.strip())
            out.append(f"<ul>{items}</ul>")
        elif block.startswith("```"):
            code = re.sub(r"^```\w*\n?|```$", "", block.strip())
            out.append(f"<pre>{html.escape(code)}</pre>")
        else:
            out.append("<p>" + "<br>".join(html.escape(l) for l in lines) + "</p>")
    return ("<html><head><meta charset='utf-8'></head><body style='font-family:Helvetica'>"
            + "".join(out) + "</body></html>")


def export(title, text, fmt):
    if fmt not in FORMATS:
        raise ValueError(f"format must be one of {sorted(FORMATS)}")
    DOWNLOADS.mkdir(exist_ok=True)
    target = _unique(DOWNLOADS / f"{_safe(title)}.{fmt}")
    if fmt in ("md", "txt"):
        target.write_text(text if fmt == "txt" else f"# {title}\n\n{text}\n", encoding="utf-8")
    else:
        with tempfile.TemporaryDirectory() as tmp:
            src = Path(tmp) / "doc.html"
            src.write_text(_to_html(title, text), encoding="utf-8")
            r = subprocess.run(["textutil", "-convert", "docx", "-output", str(target), str(src)],
                               capture_output=True, text=True, timeout=60)
            if r.returncode != 0 or not target.exists():
                raise RuntimeError(r.stderr.strip() or "could not create the Word file")
    return target


def reveal(path):
    """Show a file we exported in Finder. Only files inside ~/Downloads."""
    p = Path(path).expanduser().resolve()
    if DOWNLOADS.resolve() not in p.parents or not p.exists():
        raise ValueError("can only reveal exported files")
    subprocess.run(["open", "-R", str(p)], timeout=10)
