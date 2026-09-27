# oriel.ai

A local mind, running on your own machine.

A polished Mac app over a model sitting on your own disk. No account, no API key, no cloud.
Turn off your Wi-Fi and it keeps working — only the optional web **Search** ever goes online.

Runs **gemma4:e4b-it-qat** through [Ollama](https://ollama.com) by default — Metal-accelerated on
Apple Silicon. A [colibri](https://github.com/JustVugg/colibri) backend is still supported via
`oriel --backend colibri` if you point it at a colibri model directory.

## Run it

```bash
oriel install
```

Once. It builds the Mac app into `~/Applications/oriel.ai.app` (Spotlight finds it as
**oriel.ai**), sets the oriel server to start when you log in, and opens the app. From then on
open it like any other app, or type `oriel`.

The server and engine idle at under 30 MB until a window opens. The model (about 6 GB of
memory) is loaded when you open the app and freed the moment you quit it.

Not installed? `oriel` still works the old way: it runs everything in the terminal and opens your
browser at `http://127.0.0.1:7171`; `Ctrl-C` (or closing the terminal) stops it all.

## Every command

| Command | What it does |
|---|---|
| `oriel` | Open the app (starting the server if needed) |
| `oriel web` | Open it in your browser instead |
| `oriel chat` | Talk to the model in this terminal |
| `oriel run "..."` | One-shot prompt, no session |
| `oriel install` | Build and install the Mac app, and start the server at login |
| `oriel uninstall` | Remove both — your chats stay |
| `oriel start` / `restart` | Start or restart the background server |
| `oriel stop` | Stop everything, including engines an earlier `oriel` left behind |
| `oriel ps` | What is running: login item, app, server, engine, the model in memory |
| `oriel logs` | The recent server and engine logs |
| `oriel app` | Rebuild the Mac app (after changing `native/`) |
| `oriel help` | All of the above |

`oriel doctor`, `plan`, `tune` and `dashboard` are colibri-only; with no colibri model installed
they explain that and exit.

### Running it in a terminal instead

| Flag | Default | Meaning |
|---|---|---|
| `--port` | `7171` | Port for the interface. Falls back to a free one if taken. |
| `--model` | `gemma4:e4b-it-qat` | Ollama model tag, or a colibri model directory. |
| `--backend` | `ollama` | `ollama` or `colibri`. |
| `--no-browser` | off | Start without opening a browser. |

`ORIEL_VERBOSE=1` shows the engine's own log in the terminal. `oriel chat --model qwen3.5:9b` picks
a different model for one session.

## What's in it

The interface is the **Oriel v3** design, rebuilt to run against a local model.

- **Chat** that streams token by token, with Copy, Retry, Edit and 👍/👎 on each reply.
- **Model picker** with three presets:

  | Preset | Runs on | Answers |
  |---|---|---|
  | **Oriel 2 Flash** | Gemma 4 4B | Fastest, short and direct — about 33 words, 3 s |
  | **Oriel 2** (default) | Gemma 4 4B | Detailed and longer — about 226 words, 13 s |
  | **Oriel 2 Deep** | Gemma 4 12B | Detailed, and always reasons first — slowest |

  Flash and Oriel 2 share one model, so switching is instant; only Deep loads other weights.
  Concise / Balanced / Detailed in Settings makes each a notch shorter or longer.
- **Think** — off by default. On, the model reasons first ("Thought for 19s", expandable).
  Slower, but it is what gets maths and logic puzzles right.
- **Search** — off by default; the globe button turns it on. It really searches (DuckDuckGo),
  reads the top pages, and the answer cites them as [1], [2]… with the sources listed. Weather
  questions also get live numbers from Open-Meteo, because weather sites fill in theirs with
  scripts a search can't read. Only public addresses are ever fetched.
- **Attachments** — photos and screenshots go to the model's vision; PDFs (scanned ones too,
  read with macOS's own text recognition), Word, RTF, OpenDocument, Excel and PowerPoint files are
  turned into text on this Mac; text and code files are read as they are.
- **Dictation** — the mic button records you and the same local model transcribes it. Nothing is
  sent anywhere.
- **Canvas** — emails, letters, plans and itineraries open beside the chat and write themselves
  in live. Edit them directly; **Make shorter**, **Polish** and **More formal** rewrite them.
- **Code** is shown as code: monospaced, syntax-coloured, with the language named and a Copy
  button — even when the model forgets to mark it as code.
- **Export** — a chat or a canvas draft to Word, Markdown or plain text, saved in Downloads.
- **Your chats** live on disk (see below), survive everything, and can be searched — titles and
  everything said in them.
- **Light and dark** — follows the Mac, or pick one in Settings.
- **Settings** — your name, answer length, custom instructions, appearance.

### Memory

Each chat remembers as much as fits the model's 32K-token window (about 20,000 words of English),
minus room for the answer. Sizes are counted with the model's own tokenizer, so nothing is guessed:
a Malay or English chat keeps everything it can, and a Chinese document or a spreadsheet full of
digits (every digit is a token) is never undercounted.

When a chat outgrows the window, its oldest messages drop out and the chat says so. A single
message too big on its own — two long PDFs at once, say — has its documents shortened to fit, and
you're told which ones. The model never gets a prompt the engine would silently chop.

Long documents take a while to read before the first word appears (about 300 tokens a second on
an M4 — a minute for a 15,000-token PDF); the reply says "Reading your files" meanwhile.

### Where your things are

| What | Where |
|---|---|
| Chats, settings, attachments | `~/Library/Application Support/oriel.ai/` |
| Backups | same folder: `state.previous.json`, plus one snapshot a day for 14 days |
| Logs | `~/Library/Logs/oriel.ai/` — `server.log`, `engine.log` (`oriel logs` shows them) |
| The app | `~/Applications/oriel.ai.app` |
| Login item | `~/Library/LaunchAgents/ai.oriel.server.plist` |

Chats are kept out of the code folder, so this git repository never contains a conversation.
Saves are atomic, and every save is numbered: with the app and a browser tab open at once, a
window holding an older copy can't overwrite newer chats — it merges instead (latest edit of each
chat wins, a chat deleted anywhere stays deleted), and a window catches up when you switch to it.

### What changed from the design, and why

The design was a prototype for a cloud assistant. Running it against a local model meant:

| Design | Here | Why |
|---|---|---|
| Waited for the full reply, then animated it | Streams for real | Showed nothing for seconds |
| **Search** asked the model to *"cite real, well-known sources"* | Search really searches, and cites what it read | Offline, the model invented citations |
| **Deep research**, **Create image** | Removed | No research agent or image model exists here |
| Sent attachments as a filename only | Sends the actual image / document text | The model pretended to see files it never received |
| Canned "backup" replies when AI unavailable | An error that says so | Fake answers indistinguishable from real ones |
| "Alex Tan · Free plan", fake chat history | Your name (optional) · "On this Mac", your real chats | Placeholders |
| Share (copied a link to nowhere) | Copy chat, Export | Nothing to share a link to |
| Loaded React, Babel and fonts from the internet | All vendored locally | A blank page with Wi-Fi off |

The previous amber interface is kept as `ui/index.classic.html`.

## How it's wired

```
oriel.ai.app ──► oriel server (:7171) ──► ollama (:11434) ──► gemma4 ──► weights on disk
 (WKWebView)      page + API proxy          Metal / GPU
                  chats, files, search,
                  documents, tokens
```

The server is started at login by launchd (`ai.oriel.server`), restarted if it ever crashes, and
owns the engine: if Ollama dies, the next request brings it back. It proxies `/v1/*` and `/api/*`
to the engine so the page talks to a single origin, forwarding streams byte by byte. It only
answers requests addressed to `127.0.0.1:7171` from its own page — other websites open in your
browser can't reach your chats.

The app is a native window (Swift/AppKit, built with `swiftc` — no Xcode needed): real menus
(⌘N new chat, ⌘, settings, ⌃⌘S sidebar, zoom), the system file picker, the microphone for
dictation, links that open in your browser, and a native start screen while the server comes up.
It is a different program from the Oriel notch app in /Applications, with its own bundle id
(`ai.oriel.chat`).

## Files

```
oriel.ai/
├── oriel                    launcher + CLI — Python 3 stdlib only
├── services/                the server's features
│   ├── store.py             chats and files on disk: atomic, numbered, backed up
│   ├── documents.py         PDF / Word / Excel / PowerPoint → text
│   ├── web.py               search, with the public-address-only fetcher
│   ├── weather.py           live weather for weather questions (Open-Meteo)
│   ├── tokens.py            exact token counts from the model's own tokenizer
│   ├── exporter.py          chats and drafts → Word / Markdown / text
│   └── macapp.py            builds the app, installs the login item
├── native/
│   ├── OrielApp.swift       the Mac app
│   ├── makeicon.swift       draws the app icon
│   └── pdftext.swift        PDF text + OCR helper (compiled on first use)
├── ui/
│   ├── index.html           the interface (built — edit _build/, not this)
│   ├── index.classic.html   the previous amber interface
│   ├── support.js           the design's runtime, repointed at vendor/
│   ├── vendor/              React, ReactDOM, Babel, highlight.js — fetched via npm and
│   │                        checked against the registry's integrity hashes
│   ├── fonts/               Geist + Geist Mono variable fonts (SIL Open Font License)
│   ├── _build/              component.js (the logic) and build.py (assembles index.html)
│   └── _design/             the original design export, the build's source
└── build/                   generated: the app bundle, the OCR helper (not in git)
```

To change the interface, edit `ui/_build/component.js` (behaviour) or the design in `ui/_design/`
(markup), then run `python3 ui/_build/build.py` and reload. The build refuses to write a page that
still references any remote resource. After changing the server, `oriel restart`; after changing
`native/`, `oriel app`.

## The model

**gemma4:e4b-it-qat** — Gemma 4's efficient 4B-effective variant, quantization-aware trained: 6.1 GB
on disk and about 6 GB of memory while loaded (Ollama reports 3.2 GB, but that counts only the
part on the GPU). Chosen by measurement over the larger `gemma4:12b`, which is also
installed (and used by Oriel 2 Deep):

| Model | Median speed | Long answer (120 words) | Accuracy on test set |
|---|---|---|---|
| gemma4:12b | 14.1 tok/s | 18.5 s | 2/3 |
| **gemma4:e4b-it-qat** | **28.3 tok/s** | **10.0 s** | **2/3** |

Twice the speed, same answers right and wrong. Both got a maths word problem wrong with thinking
off and right with it on — that is what the Think toggle is for.

Anything else in Ollama's library that fits 16 GB works the same way:

```bash
ollama pull qwen3.5:9b
oriel --model qwen3.5:9b
```

Too big for 16 GB: `gpt-oss:20b` (14 GB), `qwen3.5:27b` (17 GB), `gemma4:26b` (19 GB).

## If something's off

- **Suddenly about half as fast** — check Activity Monitor for something busy in the background.
  On this MacBook Air a System Settings › Storage scan stuck for a day
  (`ApplicationsStorageExtension`) halved it: 14 instead of 26 tokens a second. Quitting System
  Settings fixed it. The Air has no fan, so anything else keeping it warm costs speed too.
- **The app says it couldn't start** — `oriel logs`, then `oriel restart`.
- **Everything, from scratch** — `oriel uninstall && oriel install`. Chats are kept.
