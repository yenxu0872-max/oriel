"""The Mac app and the login item, as installed by `oriel install`.

    build_app()       compile native/OrielApp.swift (swiftc — no Xcode needed)
                      into ~/Applications/oriel.ai.app, with its icon
    install_agent()   run the oriel server at every login, and start it now
    agent_state()     (state, pid) of that login item, or None if not installed

The app is deliberately a different program from the Oriel notch app in
/Applications (bundle id app.oriel.Oriel): its own name, its own bundle id,
installed in your personal Applications folder. Nothing here touches that app.
"""

import os
import plistlib
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
APP_NAME = "oriel.ai"
APP_ID = "ai.oriel.chat"
APP = Path.home() / "Applications" / f"{APP_NAME}.app"
LABEL = "ai.oriel.server"
AGENT = Path.home() / "Library" / "LaunchAgents" / f"{LABEL}.plist"
LOGS = Path.home() / "Library" / "Logs" / "oriel.ai"
BUILD = HERE / "build"
VERSION = "1.0"
LSREGISTER = ("/System/Library/Frameworks/CoreServices.framework/Frameworks/"
              "LaunchServices.framework/Support/lsregister")
SWIFTC = ["xcrun", "swiftc", "-O", "-swift-version", "5", "-target", "arm64-apple-macos13.0"]


def python():
    """A stable interpreter path for the login item: Homebrew's python3
    symlink survives `brew upgrade`, the versioned Cellar path does not."""
    p = Path("/opt/homebrew/bin/python3")
    return str(p) if p.exists() else sys.executable


def _run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        raise RuntimeError(f"{Path(cmd[0]).name} {cmd[1] if len(cmd) > 1 else ''} failed: "
                           f"{(r.stderr or r.stdout).strip()[:600]}")
    return r


def _icon(res):
    tools = BUILD / "tools"
    iconset = tools / "AppIcon.iconset"
    shutil.rmtree(iconset, ignore_errors=True)
    iconset.mkdir(parents=True)
    _run(SWIFTC + [str(HERE / "native" / "makeicon.swift"), "-o", str(tools / "makeicon")])
    _run([str(tools / "makeicon"), str(tools / "AppIcon.png")])
    for pt in (16, 32, 128, 256, 512):
        for scale in (1, 2):
            name = f"icon_{pt}x{pt}{'@2x' if scale == 2 else ''}.png"
            _run(["sips", "-z", str(pt * scale), str(pt * scale), str(tools / "AppIcon.png"), "--out", str(iconset / name)])
    _run(["iconutil", "-c", "icns", str(iconset), "-o", str(res / "AppIcon.icns")])


def build_app():
    """Build the app into build/, then install it to ~/Applications."""
    staged = BUILD / f"{APP_NAME}.app"
    shutil.rmtree(staged, ignore_errors=True)
    macos, res = staged / "Contents" / "MacOS", staged / "Contents" / "Resources"
    macos.mkdir(parents=True)
    res.mkdir(parents=True)
    _run(SWIFTC + ["-parse-as-library", "-framework", "AppKit", "-framework", "WebKit",
                   str(HERE / "native" / "OrielApp.swift"), "-o", str(macos / APP_NAME)])
    _icon(res)
    with (staged / "Contents" / "Info.plist").open("wb") as f:
        plistlib.dump({
            "CFBundleName": APP_NAME,
            "CFBundleDisplayName": APP_NAME,
            "CFBundleIdentifier": APP_ID,
            "CFBundleExecutable": APP_NAME,
            "CFBundleIconFile": "AppIcon",
            "CFBundlePackageType": "APPL",
            "CFBundleShortVersionString": VERSION,
            "CFBundleVersion": time.strftime("%Y%m%d.%H%M"),
            "LSMinimumSystemVersion": "13.0",
            "LSApplicationCategoryType": "public.app-category.productivity",
            "NSHighResolutionCapable": True,
            "NSHumanReadableCopyright": "A local mind — runs entirely on this Mac.",
            "NSMicrophoneUsageDescription": "oriel.ai listens only while you dictate, and turns your speech "
                                            "into text right here on this Mac.",
            "NSAppTransportSecurity": {"NSAllowsLocalNetworking": True},
            # where the server lives, for when there's no login item to start it
            "OrielHome": str(HERE),
            "OrielPython": python(),
        }, f)
    _run(["codesign", "--force", "--sign", "-", str(staged)])   # ad hoc: runs on this Mac
    APP.parent.mkdir(exist_ok=True)
    if APP.exists():
        shutil.rmtree(APP)
    shutil.copytree(staged, APP, symlinks=True)
    subprocess.run([LSREGISTER, "-f", str(APP)], capture_output=True)
    return APP


def remove_app():
    if APP.exists():
        shutil.rmtree(APP)
        subprocess.run([LSREGISTER, "-u", str(APP)], capture_output=True)


def _domain():
    return f"gui/{os.getuid()}"


def _loaded():
    return subprocess.run(["launchctl", "print", f"{_domain()}/{LABEL}"], capture_output=True).returncode == 0


def install_agent():
    """Write the LaunchAgent and load it, which also starts the server now.
    KeepAlive only on failure: `oriel stop` (a clean exit) keeps it stopped."""
    LOGS.mkdir(parents=True, exist_ok=True)
    AGENT.parent.mkdir(parents=True, exist_ok=True)
    with AGENT.open("wb") as f:
        plistlib.dump({
            "Label": LABEL,
            "ProgramArguments": [python(), str(HERE / "oriel"), "--service"],
            "RunAtLoad": True,
            "KeepAlive": {"SuccessfulExit": False},
            "ThrottleInterval": 30,
            "ProcessType": "Interactive",    # full speed: it serves a window you're typing in
            "WorkingDirectory": str(HERE),
            "EnvironmentVariables": {"PATH": "/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin",
                                     "PYTHONUNBUFFERED": "1"},
            "StandardOutPath": str(LOGS / "server.log"),
            "StandardErrorPath": str(LOGS / "server.log"),
        }, f)
    uninstall_agent(keep_file=True)
    _run(["launchctl", "bootstrap", _domain(), str(AGENT)])


def uninstall_agent(keep_file=False):
    subprocess.run(["launchctl", "bootout", f"{_domain()}/{LABEL}"], capture_output=True)
    for _ in range(50):            # bootout returns before the job is gone
        if not _loaded():
            break
        time.sleep(0.1)
    if not keep_file:
        AGENT.unlink(missing_ok=True)


def agent_state():
    """(state, pid) — e.g. ("running", 1234) or ("not running", None) — or
    None when the login item isn't installed."""
    if not AGENT.exists():
        return None
    r = subprocess.run(["launchctl", "print", f"{_domain()}/{LABEL}"], capture_output=True, text=True)
    if r.returncode:
        return ("not loaded", None)
    state = re.search(r"^\s*state = (.+)$", r.stdout, re.M)
    pid = re.search(r"^\s*pid = (\d+)$", r.stdout, re.M)
    return (state.group(1).strip() if state else "unknown", int(pid.group(1)) if pid else None)


def kickstart(restart=False):
    args = ["launchctl", "kickstart"] + (["-k"] if restart else []) + [f"{_domain()}/{LABEL}"]
    return subprocess.run(args, capture_output=True).returncode == 0
