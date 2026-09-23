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
"""

import hashlib
import json
import os
import re
import shutil
import threading
import time
from pathlib import Path

DATA = Path.home() / "Library" / "Application Support" / "oriel.ai"
STATE = DATA / "state.json"
PREVIOUS = DATA / "state.previous.json"
BACKUPS = DATA / "backups"
FILES = DATA / "files"

MAX_STATE = 64 * 1024 * 1024   # a lifetime of text chats fits easily
MAX_FILE = 50 * 1024 * 1024
KEEP_DAILY = 14

_lock = threading.Lock()
_ID = re.compile(r"^[0-9a-f]{24}$")


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


def save_state(raw):
    """Validate and persist. Raises ValueError on anything that isn't a
    reasonable state document, so a buggy client can't overwrite good data
    with garbage."""
    if len(raw) > MAX_STATE:
        raise ValueError("state too large")
    doc = json.loads(raw)
    if not isinstance(doc, dict) or not isinstance(doc.get("chats", []), list):
        raise ValueError("state must be an object with a chats list")
    _ensure()
    with _lock:
        if STATE.exists():
            shutil.copyfile(STATE, PREVIOUS)
            daily = BACKUPS / f"state-{time.strftime('%Y-%m-%d')}.json"
            if not daily.exists():
                shutil.copyfile(STATE, daily)
                for old in sorted(BACKUPS.glob("state-*.json"))[:-KEEP_DAILY]:
                    old.unlink(missing_ok=True)
        _atomic_write(STATE, raw)


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
