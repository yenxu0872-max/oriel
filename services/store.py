"""Chats, settings and attachments, kept on disk.

Everything lives in ~/Library/Application Support/oriel.ai — the Mac's proper
place for app data, and deliberately outside the code folder so the git repo
never contains anyone's conversations.

    state.json            chats + settings, one JSON document
    state.previous.json   the version before the last save
    backups/state-<day>.json   one snapshot per day, the last 14 kept
    files/<id>            attachment bytes, content-addressed
    files/<id>.json       attachment metadata (name, type, size)

Writes are atomic (temp file + rename), so a crash mid-save can never leave a
half-written state.json behind.

Several windows can be open at once (the app, a browser tab). Each save names
the revision it was based on; if another window saved in between, the save is
refused with the current document (Conflict) and the window merges and retries
— so a stale window can never overwrite newer chats.
"""

import hashlib
import json
import os
import re
import shutil
import threading
import time
from pathlib import Path

# ORIEL_DATA points a test server at a scratch folder instead of your chats.
DATA = Path(os.environ.get("ORIEL_DATA") or Path.home() / "Library" / "Application Support" / "oriel.ai")
STATE = DATA / "state.json"
PREVIOUS = DATA / "state.previous.json"
BACKUPS = DATA / "backups"
FILES = DATA / "files"

MAX_STATE = 64 * 1024 * 1024   # a lifetime of text chats fits easily
MAX_FILE = 50 * 1024 * 1024
KEEP_DAILY = 14

_lock = threading.Lock()
_ID = re.compile(r"^[0-9a-f]{24}$")
_rev = None  # current revision, read from disk once


class Conflict(Exception):
    """Another window saved first. Carries the current document to merge."""

    def __init__(self, current):
        super().__init__("changed in another window")
        self.current = current


def _ensure():
    for d in (DATA, BACKUPS, FILES):
        d.mkdir(parents=True, exist_ok=True)


def _atomic_write(path, data):
    tmp = path.with_suffix(path.suffix + ".tmp")
    with open(tmp, "wb") as f:
        f.write(data)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, path)


def load_state():
    """The saved state as raw JSON bytes, or b'{}' when there is none yet."""
    _ensure()
    try:
        return STATE.read_bytes()
    except FileNotFoundError:
        return b"{}"


def _current_rev():
    global _rev
    if _rev is None:
        try:
            _rev = int(json.loads(STATE.read_bytes()).get("rev") or 0)
        except (OSError, ValueError, AttributeError):
            _rev = 0
    return _rev


def state_rev():
    with _lock:
        return _current_rev()


def save_state(raw):
    """Validate and persist; returns the new revision. Raises ValueError on
    anything that isn't a reasonable state document, so a buggy client can't
    overwrite good data with garbage, and Conflict if the document it was
    based on is no longer the latest."""
    global _rev
    if len(raw) > MAX_STATE:
        raise ValueError("state too large")
    doc = json.loads(raw)
    if not isinstance(doc, dict) or not isinstance(doc.get("chats", []), list):
        raise ValueError("state must be an object with a chats list")
    _ensure()
    with _lock:
        cur, base = _current_rev(), doc.get("rev")
        # A page from before revisions existed sends none: fine until the
        # first versioned save, refused after it.
        if (base is None and cur > 0) or (base is not None and base != cur):
            raise Conflict(STATE.read_bytes())
        doc["rev"] = cur + 1
        raw = json.dumps(doc, ensure_ascii=False, separators=(",", ":")).encode()
        if STATE.exists():
            shutil.copyfile(STATE, PREVIOUS)
            daily = BACKUPS / f"state-{time.strftime('%Y-%m-%d')}.json"
            if not daily.exists():
                shutil.copyfile(STATE, daily)
                for old in sorted(BACKUPS.glob("state-*.json"))[:-KEEP_DAILY]:
                    old.unlink(missing_ok=True)
        _atomic_write(STATE, raw)
        _rev = cur + 1
        return _rev


def save_file(data, name, ctype):
    """Store an attachment; identical bytes are stored once."""
    if len(data) > MAX_FILE:
        raise ValueError("file too large (50 MB max)")
    _ensure()
    fid = hashlib.sha256(data).hexdigest()[:24]
    blob = FILES / fid
    if not blob.exists():
        _atomic_write(blob, data)
    meta = {"name": name[:200], "type": ctype or "application/octet-stream", "size": len(data)}
    _atomic_write(FILES / f"{fid}.json", json.dumps(meta).encode())
    return {"id": fid, "url": f"/oriel/files/{fid}", **meta}


def load_file(fid):
    """(bytes, content_type) for a stored attachment, or None."""
    if not _ID.match(fid or ""):
        return None
    blob = FILES / fid
    if not blob.is_file():
        return None
    try:
        meta = json.loads((FILES / f"{fid}.json").read_text())
    except Exception:
        meta = {}
    return blob.read_bytes(), meta.get("type", "application/octet-stream")
