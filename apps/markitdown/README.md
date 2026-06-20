# MarkItDown app

Converts PDF / Office / image files to Markdown. The UI is a Node sandbox app;
the conversion is done by a small Python [markitdown](https://github.com/microsoft/markitdown)
service that this app talks to over HTTP. The service only converts bytes — it has
no filesystem of its own, so it can run locally or on a remote host unchanged.

## Two ways to run

- **Files** — drag-drop or pick files (ad-hoc). Guardrails apply (see Limits).
- **Directory** — pick a folder via the browser's File System Access API; the app
  crawls it (optionally recursive) and converts every supported file. Output modes:
  - **zip + receipt** — download a bundle (works in any case).
  - **alongside originals** — write `foo.md` next to `foo.pdf` on disk.
  - **chosen folder** — pick a second folder; `.md` files mirror the source tree.

  Directory mode is **Chrome/Edge only** (File System Access API). You pick the
  folder once; write modes ask for edit permission once. Because the crawl and
  write-back happen in the browser, this works the same whether the service is
  local or remote — nothing extra is installed on the client.

Both methods are logged as **runs** (see the Runs panel); the log is capped at the
newest 100 and stored under `data/runs/` (gitignored). `Clear results` resets the
on-screen columns between runs.

## Limits (Files mode)

To stop a careless drop from exhausting memory: max 100 files, 50 MB per file,
250 MB per batch. Over-limit files are skipped and recorded in the run. Tune in
`LIMITS` at the top of `index.js`. Directory mode is unconstrained — it's scoped by
the folder you pick.

## Stand it up on a new machine

```bash
npm install              # Node deps (from repo root)
npm run markitdown:setup # finds python, makes venv, installs markitdown
npm run dev              # start sandbox; the service auto-starts
```

Open the dashboard → the **MarkItDown** card goes green when the service is ready.
That's it. `markitdown:setup` needs python 3.10+ on PATH; if it's missing it tells
you where to get it.

## How starting the service is decoupled

The app only depends on a URL. *How* something answers that URL is chosen by one
env var — change it without touching code:

| `MARKITDOWN_LAUNCH` | Behavior |
|---------------------|----------|
| `spawn` (default)   | Node starts & supervises the Python service for you. |
| `external`          | You run the service (terminal, Docker, shared host). App just consumes it. |
| `off`               | Disabled. |

### Running it yourself (external mode)
```bash
cd apps/markitdown/service
.venv/Scripts/python -m uvicorn main:app --port 8200   # Windows
# .venv/bin/python -m uvicorn main:app --port 8200     # macOS/Linux
```
Then set `MARKITDOWN_LAUNCH=external` (and `MARKITDOWN_URL` if not localhost:8200).

## All env knobs (all optional)

| Var | Default | Purpose |
|-----|---------|---------|
| `MARKITDOWN_LAUNCH` | `spawn` | start strategy (see above) |
| `MARKITDOWN_PORT`   | `8200`  | port for the service |
| `MARKITDOWN_URL`    | `http://127.0.0.1:8200` | where the app looks for the service |
| `MARKITDOWN_PYTHON` | venv python | python used in `spawn` mode |
