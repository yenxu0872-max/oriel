"""Turn attached documents into text the model can read.

    PDF                         native/pdftext (PDFKit, with Vision OCR for scans)
    Word / RTF / OpenDocument   macOS textutil
    Excel (.xlsx)               read directly: every sheet as tab-separated rows
    PowerPoint (.pptx)          read directly: the text of every slide

All of it runs on this Mac; nothing is uploaded anywhere.
"""

import re
import subprocess
import tempfile
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PDF_SRC = ROOT / "native" / "pdftext.swift"
PDF_BIN = ROOT / "build" / "pdftext"

TEXTUTIL = {".docx", ".doc", ".rtf", ".rtfd", ".odt", ".wordml", ".webarchive"}
MAX_CHARS = 60000   # about 15k tokens: fits the 32k window with room to talk


class Unsupported(Exception):
    pass


def _pdf_helper():
    """Compile the PDFKit helper on first use (a few seconds, once)."""
    if PDF_BIN.exists() and PDF_BIN.stat().st_mtime >= PDF_SRC.stat().st_mtime:
        return PDF_BIN
    PDF_BIN.parent.mkdir(parents=True, exist_ok=True)
    r = subprocess.run(["xcrun", "swiftc", "-O", str(PDF_SRC), "-o", str(PDF_BIN)],
                       capture_output=True, text=True, timeout=300)
    if r.returncode != 0:
        raise RuntimeError("could not build the PDF reader: " + r.stderr[-300:])
    return PDF_BIN


def _xlsx(path):
    z = zipfile.ZipFile(path)
    ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    shared = []
    if "xl/sharedStrings.xml" in z.namelist():
        root = ET.fromstring(z.read("xl/sharedStrings.xml"))
        for si in root.findall("m:si", ns):
            shared.append("".join(t.text or "" for t in si.iter(f"{{{ns['m']}}}t")))
    out = []
    sheets = sorted(n for n in z.namelist() if re.match(r"xl/worksheets/sheet\d+\.xml$", n))
    for n in sheets:
        num = re.search(r"(\d+)", n).group(1)
        out.append(f"[Sheet {num}]")
        root = ET.fromstring(z.read(n))
        for row in root.iter(f"{{{ns['m']}}}row"):
            cells = []
            for c in row.findall("m:c", ns):
                v = c.find("m:v", ns)
                val = v.text if v is not None else ""
                if c.get("t") == "s" and val.isdigit() and int(val) < len(shared):
                    val = shared[int(val)]
                elif c.get("t") == "inlineStr":
                    val = "".join(t.text or "" for t in c.iter(f"{{{ns['m']}}}t"))
                cells.append(val or "")
            if any(cells):
                out.append("\t".join(cells))
    return "\n".join(out)


def _pptx(path):
    z = zipfile.ZipFile(path)
    a = "{http://schemas.openxmlformats.org/drawingml/2006/main}t"
    slides = sorted((n for n in z.namelist() if re.match(r"ppt/slides/slide\d+\.xml$", n)),
                    key=lambda n: int(re.search(r"(\d+)", n).group(1)))
    out = []
    for i, n in enumerate(slides, 1):
        text = " ".join(t.text or "" for t in ET.fromstring(z.read(n)).iter(a)).strip()
        if text:
            out.append(f"[Slide {i}]\n{text}")
    return "\n\n".join(out)


def extract_text(data, filename):
    """Return (text, note). `note` is a short remark for the user, e.g. that
    OCR was used or the document was cut to fit."""
    ext = Path(filename).suffix.lower()
    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / f"in{ext}"
        src.write_bytes(data)
        note = ""
        if ext == ".pdf":
            r = subprocess.run([str(_pdf_helper()), str(src)], capture_output=True, text=True, timeout=240)
            if r.returncode != 0:
                raise RuntimeError(r.stderr.strip() or "could not read this PDF")
            text = r.stdout
            m = re.search(r"ocr:(\d+)", r.stderr)
            if m:
                note = f"read {m.group(1)} scanned page(s) with on-device OCR"
        elif ext in TEXTUTIL:
            r = subprocess.run(["textutil", "-convert", "txt", "-stdout", str(src)],
                               capture_output=True, text=True, timeout=120)
            if r.returncode != 0:
                raise RuntimeError(r.stderr.strip() or "could not read this document")
            text = r.stdout
        elif ext == ".xlsx":
            text = _xlsx(src)
        elif ext == ".pptx":
            text = _pptx(src)
        else:
            raise Unsupported(ext or "unknown")
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    if not text:
        raise RuntimeError("no readable text found in this document")
    if len(text) > MAX_CHARS:
        text = text[:MAX_CHARS]
        note = (note + "; " if note else "") + f"long document — only the first {MAX_CHARS // 1000}k characters were read"
    return text, note
