# oriel.ai

A local mind, running on your own machine.

A polished web interface over a model sitting on your own disk. No account, no API key, no
network. Turn off your Wi-Fi and it keeps working.

Runs **gemma4:e4b-it-qat** through [Ollama](https://ollama.com) by default — Metal-accelerated on Apple
Silicon. A [colibri](https://github.com/JustVugg/colibri) backend is still supported via
`oriel --backend colibri` if you point it at a colibri model directory.

## Run it

```bash
oriel
```

That's it. The launcher starts the engine, waits for the weights to load, serves the interface
and opens your browser at `http://127.0.0.1:7171`.

Press `Ctrl-C` to stop. The engine is shut down with it — no orphaned processes holding a port.

## Every command

One command runs everything. `chat` and `run` go to Ollama; the colibri-only commands work
only when a colibri model is installed (there isn't one by default any more).

| Command | What it does |
|---|---|
| `oriel` | Start the interface and open the browser |
| `oriel chat` | Talk to the model in this terminal |
| `oriel run "..."` | One-shot prompt, no session |
| `oriel stop` | Stop everything (leaves Ollama, a shared service, running) |
| `oriel ps` | Show what is running |
| `oriel help` | All of the above |

`oriel doctor`, `plan`, `tune` and `dashboard` are colibri-only. With no colibri model installed
they explain that and exit rather than crashing.

### Start options

| Flag | Default | Meaning |
|---|---|---|
| `--port` | `7171` | Port for the interface. Falls back to a free one if taken. |
| `--model` | `gemma4:e4b-it-qat` | Ollama model tag, or a colibri model directory. |
| `--backend` | `ollama` | `ollama` or `colibri`. |
| `--coli` | `~/colibri/c/coli` | Path to the colibri launcher. |
| `--ram` | `10` | Engine RAM budget in GB. See below. |
| `--no-browser` | off | Start without opening a browser. |

Set `ORIEL_VERBOSE=1` to see the engine's own log instead of hiding it.

### Flags on `chat` / `run` / `dashboard`

`oriel chat --model qwen3.5:9b` picks a different model for that session. `Ctrl-D` exits.

### Why `oriel stop` exists

Colibri's own `coli stop` reports success while leaving processes alive holding the port — the
chain is `oriel → coli serve → olmoe`, and signalling only the middle one orphans the C binary.
`oriel stop` walks the actual process table, SIGTERMs everything, then SIGKILLs whatever refuses.
It deliberately skips its own ancestors (so it never kills the shell you typed it in) and anything
under `/Applications` (so it never touches the Oriel.app notch app, which shares the name).

## What's in it

The interface is the **Oriel v3** design, rebuilt to run against a local model.

- **Chat** that streams token by token, with Copy, Retry, Edit and 👍/👎 on each reply.
- **Sidebar history** — search, pin, rename, delete. Chats are saved in this browser and survive
  reloads and restarts.
- **Model picker** with three presets:

  | Preset | Runs on | Answers |
  |---|---|---|
  | **Oriel 2 Flash** | Gemma 4 4B | Fastest, short and direct — about 33 words, 3 s |
  | **Oriel 2** (default) | Gemma 4 4B | Detailed and longer — about 226 words, 13 s |
  | **Oriel 2 Deep** | Gemma 4 12B | Detailed, and always reasons first — slowest |

  Measured on "Why do we have seasons?". Flash and Oriel 2 share the same model, so switching
  between them is instant; only Deep loads different weights, and the in-memory pin moves with
  it so a single model is held in RAM. Presets are only shown if their model is installed.
  The Concise / Balanced / Detailed setting still works on top: it makes each preset a notch
  shorter or longer.
- **Think** — off by default. On, the model reasons first ("Thinking…", then "Thought for 19s",
  expandable). Slower, but it is what gets the bat-and-ball puzzle right.
- **Canvas** — ask for an email, letter, plan or itinerary and it opens beside the chat and writes
  itself in live. Edit it directly; **Make shorter**, **Polish** and **More formal** rewrite it.
- **Follow-ups** — three suggested next questions under each reply.
- **Attachments** — images go to the model's vision input; text and code files are read and
  included. Other types (PDF, Word) are refused with a message rather than silently ignored.
- **Settings** — your name, answer length (Concise / Balanced / Detailed), custom instructions.

### What changed from the design, and why

The design was a prototype for a cloud assistant. Running it against an offline model meant:

| Design | Here | Why |
|---|---|---|
| Waited for the full reply, then animated it | Streams for real | Showed nothing for seconds; threw away the 0.25 s first token |
| **Search**, **Deep research**, **Latest news** | Removed | The prompt told the model to *"cite real, well-known sources"* while the UI showed "Reading 14 sources". Offline, it would invent citations and present them as research |
| **Create image** | Removed | Rendered four text captions as image tiles; no image model exists here |
| Sent attachments as a filename only | Sends the actual image / text | The model pretended to see files it never received |
| Canned "backup" replies when AI unavailable | An error that says so | Fake answers indistinguishable from real ones |
| "Alex Tan · Free plan", fake chat history | Your name (optional) · "On this Mac · offline", empty history | Placeholders |
| Oriel 2 / Swift / Deep | Only models that are installed | "Swift" had nothing behind it |
| Share (copied a link to nowhere) | Copy chat | Nothing to share a link to |
| Loaded React, Babel and fonts from the internet | All vendored locally | Would be a blank page with Wi-Fi off |

The previous amber interface is kept as `ui/index.classic.html`.

## How it's wired

```
browser  ──►  oriel (:7171)  ──►  ollama (:11434)  ──►  gemma4:12b  ──►  weights on disk
              static UI           OpenAI-compatible     Metal / GPU
              + API proxy         HTTP API
```

The launcher proxies `/v1/*`, `/api/*` and `/health` through to the engine, so the browser talks
to a single origin and there is no CORS configuration to get wrong. Streaming responses are
forwarded byte-by-byte, so tokens appear as they are generated rather than arriving in a lump.

## Files

```
oriel.ai/
├── oriel                    launcher + CLI — Python 3 stdlib only
├── ui/
│   ├── index.html           the interface (built — edit _build/, not this)
│   ├── index.classic.html   the previous amber interface
│   ├── support.js           the design's runtime, repointed at vendor/
│   ├── vendor/              React 18.3.1, ReactDOM 18.3.1, Babel 7.29.0 — fetched via npm
│   │                        so each was checked against the registry's integrity hash
│   ├── fonts/               Geist + Geist Mono variable fonts (SIL Open Font License)
│   ├── _build/              component.js (the logic) and build.py (assembles index.html)
│   └── _design/             the original design export, the build's source
└── README.md
```

To change the interface, edit `ui/_build/component.js` (behaviour) or the design in `ui/_design/`
(markup), then:

```bash
python3 ~/oriel.ai/ui/_build/build.py
```

The build refuses to write a page that still references any remote resource.

## The model

**gemma4:e4b-it-qat** — Gemma 4's efficient 4B-effective variant, quantization-aware trained, 6.1 GB.
Chosen by measurement over the larger `gemma4:12b`, which is also installed:

| Model | Median speed | Long answer (120 words) | Accuracy on test set |
|---|---|---|---|
| gemma4:12b | 14.1 tok/s | 18.5 s | 2/3 |
| **gemma4:e4b-it-qat** | **28.3 tok/s** | **10.0 s** | **2/3** |

Twice the speed, same answers right and wrong. In the real interface, warmed up, it runs at
**~26 tok/s with 0.2 s to first token**.

Both models got a maths word problem **wrong with thinking off** and right with it on. That is what
the thinking toggle is for: leave it off for conversation, turn it on for maths and logic.

`oriel --model gemma4:12b` switches back to the bigger one. Anything else in Ollama's library that
fits 16 GB works the same way:

```bash
ollama pull qwen3.5:9b
oriel --model qwen3.5:9b
```

Too big for 16 GB: `gpt-oss:20b` (14 GB), `qwen3.5:27b` (17 GB), `gemma4:26b` (19 GB).

### Why Decide disappeared

Decide wrapped colibri's `/v1/brio` endpoint, which Ollama does not have. The interface asks
`/oriel/info` what the backend supports and removes the tab when `brio` is false. Point it back at
a colibri model and the tab returns on its own.
