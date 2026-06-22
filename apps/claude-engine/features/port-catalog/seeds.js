// Initial catalog entries. Seeded once when the store is empty (see index.js).
// Each entry is a *portable delivery*: a standalone prompt you can run cold in a
// fresh Claude Code session on another machine (e.g. the work node server).
//
// `prompt` is stored VERBATIM — regeneration is deterministic retrieval, not a
// re-derivation. Mark status: 'ready' (prompt is final) | 'planned' (placeholder,
// prompt still to author) | 'draft' (being worked on).

export const seeds = [
  {
    id: 'claude-client',
    title: 'Claude CLI seam (ask + askStream)',
    dependsOn: [],
    status: 'ready',
    notes:
      'The foundation. A dependency-free wrapper around the local `claude -p` CLI — ' +
      'prompts Claude with NO API key. Everything else ports on top of this.',
    prompt: `Build a portable, dependency-free Node module that prompts Claude WITHOUT an
Anthropic API key, by shelling out to the locally installed \`claude\` CLI in
headless mode. Use ONLY node:child_process — no @anthropic-ai SDK, no
ANTHROPIC_API_KEY. This file is a shared "seam": other features will import it,
so keep it self-contained and stable.

PREREQUISITE CHECK (do this first, STOP if it fails):
Run \`claude --version\`. If the binary isn't on PATH or isn't logged in, report
that plainly and do not continue — the entire approach depends on the CLI being
installed and authenticated on this machine.

Create \`src/claudeClient.js\` (ESM) exporting TWO functions:

1) async function ask(promptText, opts = {})
   opts: { allowedTools = [], cwd = process.cwd(), timeoutMs = 120000 }
   - spawn \`claude\` with args ['-p']; append '--allowedTools', allowedTools.join(',')
     ONLY when allowedTools is non-empty. (Headless runs can't approve permission
     prompts, so any tool the prompt uses must be pre-allowed and scoped tightly.)
   - write promptText to child stdin, then end it (avoids arg-quoting issues).
   - collect stdout/stderr; resolve { status, output } where output falls back to
     stderr, then '(no output)'.
   - exit code 0 = 'ok' EXCEPT when output matches a permission-block signature
     (/(needs?|requires?).{0,30}(approval|permission)|permission prompt|I'?m blocked/i)
     — headless \`claude -p\` exits 0 even when it silently gave up on a gated tool,
     so flag that as 'error', not success.
   - enforce timeoutMs: kill the child and resolve { status:'error', output:'timeout' }.
   - on spawn 'error', resolve { status:'error', output:\`Failed to launch claude: <msg>\` }.

2) async function askStream(promptText, opts = {})
   opts: same as ask() PLUS { onText } — a callback invoked with each text delta
   as it arrives.
   - spawn \`claude\` with args ['-p', '--output-format', 'stream-json', '--verbose']
     (plus --allowedTools as above).
   - stdout is newline-delimited JSON. Buffer partial lines; for each complete line,
     JSON.parse it in a try/catch (ignore unparseable lines). When an event carries
     assistant text (e.g. a content block with type 'text'), call onText(delta) and
     append it to an aggregate string.
   - resolve { status, output } with the full aggregated text, applying the SAME
     exit-code, permission-block, timeout, and spawn-error handling as ask().
   - never throw from a malformed stream line; degrade gracefully.

Keep both functions consistent — factor shared spawn/timeout/error logic so they
don't drift. Add \`test/claudeClient.test.js\` (node:test) that:
   - skips gracefully if \`claude --version\` fails (so CI without the CLI passes),
   - asserts ask("Reply with the single word: pong").output contains "pong",
   - asserts askStream of the same prompt fires onText at least once and the final
     output contains "pong".

Show me the file shape (both signatures + how shared logic is factored) BEFORE
writing the implementation.`,
  },
  {
    id: 'scheduler',
    title: 'Cron prompt scheduler (prompt files + run log + drift guard)',
    dependsOn: ['claude-client'],
    status: 'planned',
    notes:
      'Ports src/scheduler.js: cron-driven prompt files, per-job run log with history, ' +
      'and the out-of-band drift guard on schedules.json. Prompt still to author — ' +
      'will route through the claude-client seam instead of spawning claude directly.',
    prompt:
      '(planned — not yet authored. Ask Claude in this session to "write Delivery #2" ' +
      'and paste the result here, or edit this entry once the prompt is final.)',
  },
  {
    id: 'engine-provider',
    title: 'LLM provider → route through CLI seam',
    dependsOn: ['claude-client'],
    status: 'ready',
    notes:
      'Wires lib/provider.js to call Claude via the claude-client seam ' +
      '(no API key) instead of the mock echo. Selects the cli provider when ENGINE_LLM=cli.',
    prompt:
      `Wire the LLM provider module to call Claude through the local CLI seam (no\n` +
      `API key, no SDK) instead of the mock echo.\n\n` +
      `PREREQUISITE CHECK (do this first, STOP if it fails):\n` +
      `Verify that \`src/claudeClient.js\` exists in the project root. If it is missing,\n` +
      `stop and tell the user to run Delivery #1 (claude-client) first — this\n` +
      `delivery depends on that module.\n\n` +
      `BACKGROUND:\n` +
      `\`lib/provider.js\` defines the LLM provider interface used throughout this\n` +
      `server. The interface contract is:\n\n` +
      `  name:  string\n` +
      `  model: string\n` +
      `  async complete({ system, prompt, model }) → { text, usage, provider, model }\n\n` +
      `The existing \`mockProvider()\` echoes input deterministically; it stays in place\n` +
      `as the offline fallback. The \`anthropicProvider()\` stub throws — ignore it.\n` +
      `\`getProvider()\` selects the active provider from the environment.\n\n` +
      `TASK:\n` +
      `Add a \`cliProvider()\` to \`lib/provider.js\` that routes completions through\n` +
      `the \`ask()\` function from \`src/claudeClient.js\`. Select it automatically when\n` +
      `\`ENGINE_LLM=cli\`. No API key or network call involved.\n\n` +
      `1. Import \`ask\` from \`../src/claudeClient.js\` (path relative to\n` +
      `   \`lib/provider.js\`; adjust if your directory layout differs).\n\n` +
      `2. Implement \`cliProvider({ model } = {})\` returning an object with:\n` +
      `   - \`name: 'cli'\`\n` +
      `   - \`model: model || 'claude-cli'\`   (cosmetic; the CLI picks the real model)\n` +
      `   - \`async complete({ system, prompt, model: m } = {})\`:\n` +
      `       • Build a single combined prompt string. Recommended format:\n` +
      `           \`<system>\\n\${system}\\n</system>\\n\\n\${prompt}\`\n` +
      `         If \`system\` is empty/undefined, omit the \`<system>\` wrapper and\n` +
      `         pass \`prompt\` alone — do not send empty XML tags.\n` +
      `       • Call \`await ask(combined)\` (no extra opts needed).\n` +
      `       • If the result's \`status\` is not \`'ok'\`, throw an Error whose message\n` +
      `         is the result's \`output\` string so callers get a meaningful rejection.\n` +
      `       • On success, return:\n` +
      `           {\n` +
      `             text:     result.output,\n` +
      `             usage:    estimateUsage(combined, result.output),\n` +
      `             provider: 'cli',\n` +
      `             model:    m || 'claude-cli',\n` +
      `           }\n\n` +
      `3. Add a private helper \`estimateUsage(inputStr, outputStr)\` that counts\n` +
      `   whitespace-separated tokens and returns \`{ input, output }\`. The CLI does\n` +
      `   not expose token counts; this is a rough proxy so callers expecting a usage\n` +
      `   object are not broken.\n\n` +
      `4. Update \`getProvider(env = process.env)\`:\n` +
      `   - If \`env.ENGINE_LLM === 'cli'\`, return \`cliProvider()\`.\n` +
      `   - If \`env.ANTHROPIC_API_KEY && env.ENGINE_LLM === 'anthropic'\`, return\n` +
      `     the existing anthropic stub (or a real implementation if present).\n` +
      `   - Otherwise return \`mockProvider()\`.\n\n` +
      `5. Keep \`mockProvider()\` and \`getProvider()\` export signatures unchanged so\n` +
      `   existing callers need zero edits.\n\n` +
      `Add \`test/provider.test.js\` (node:test) that:\n` +
      `  - skips gracefully if \`claude --version\` fails (no CLI = no live test).\n` +
      `  - instantiates \`cliProvider()\` and calls \`complete({ prompt: 'Say only: pong' })\`.\n` +
      `  - asserts \`result.text\` contains 'pong' and \`result.provider === 'cli'\`.\n` +
      `  - asserts that a non-ok result (simulate by patching \`ask\` to return\n` +
      `    \`{ status: 'error', output: 'test error' }\`) causes \`complete()\` to throw.\n\n` +
      `Show me the file shape (new export list, cliProvider signature, updated\n` +
      `getProvider branch) BEFORE writing the implementation.`,
  },
  {
    id: 'markitdown',
    title: 'MarkItDown app (Python service + Node adapter)',
    dependsOn: [],
    status: 'ready',
    notes:
      'Two-layer file-to-Markdown converter: a Python FastAPI service wraps Microsoft\'s ' +
      'markitdown library; a Node Express adapter mounts it into the sandbox server. ' +
      'UI (inline HTML/CSS/JS in index.js) is copied verbatim from source — the prompt ' +
      'covers the Python service, Node lib files, policy.json, and setup script only.',
    prompt:
      `Build the **MarkItDown** app on this server — a two-layer system that converts\n` +
      `PDF/Office/image files to Markdown. A Python FastAPI service does the actual\n` +
      `conversion via Microsoft's \`markitdown\` library; a Node.js Express adapter\n` +
      `mounts it into the existing sandbox server, proxying uploads and managing the\n` +
      `Python process lifecycle.\n\n` +
      `PREREQUISITE CHECK (do this first, STOP if fails):\n` +
      `Confirm Python 3.10+ is available (\`py --version\` on Windows,\n` +
      `\`python3 --version\` on Linux/Mac). Stop and tell the user to install from\n` +
      `https://python.org if not found.\n\n` +
      `## File layout\n\n` +
      `\`\`\`\n` +
      `apps/markitdown/\n` +
      `  index.js          ← Express router + inline UI (see Step 4)\n` +
      `  policy.json       ← accepted types, file limits, token-savings estimates\n` +
      `  lib/\n` +
      `    env.js          ← paths + config() from env vars\n` +
      `    launcher.js     ← getLauncher() — spawn/external/off strategies\n` +
      `    policy.js       ← policy() reader (cached)\n` +
      `    runs.js         ← save/get/list run records under data/runs/\n` +
      `    setup.js        ← one-command venv + pip setup\n` +
      `  service/\n` +
      `    main.py         ← FastAPI wrapper around markitdown\n` +
      `    requirements.txt\n` +
      `\`\`\`\n\n` +
      `## Step 1 — policy.json\n\n` +
      `Create \`apps/markitdown/policy.json\`:\n\n` +
      `\`\`\`json\n` +
      `{\n` +
      `  "extensions": [".csv",".docx",".epub",".htm",".html",".msg",".pdf",".pptx",".xls",".xlsx",".zip"],\n` +
      `  "maxFileMB": 50,\n` +
      `  "oneOffBatch": { "maxFiles": 100, "maxTotalMB": 250 },\n` +
      `  "tokenSavings": {\n` +
      `    "charsPerToken": 4,\n` +
      `    "defaultDensity": 0.2,\n` +
      `    "density": {\n` +
      `      ".html": 0.9, ".htm": 0.9, ".csv": 1.0, ".docx": 0.15, ".pptx": 0.1,\n` +
      `      ".xls": 0.12, ".xlsx": 0.12, ".pdf": 0.08, ".epub": 0.25, ".msg": 0.5, ".zip": 0.1\n` +
      `    }\n` +
      `  }\n` +
      `}\n` +
      `\`\`\`\n\n` +
      `Single source of truth — Python service reads it at startup to enforce limits;\n` +
      `Node adapter reads it to populate the UI.\n\n` +
      `## Step 2 — Python service\n\n` +
      `**\`apps/markitdown/service/requirements.txt\`:**\n` +
      `\`\`\`\n` +
      `markitdown[all]\n` +
      `fastapi\n` +
      `uvicorn[standard]\n` +
      `python-multipart\n` +
      `\`\`\`\n\n` +
      `**\`apps/markitdown/service/main.py\`** — FastAPI wrapper:\n\n` +
      `- Read \`policy.json\` from the same directory at startup; derive \`ACCEPTED\`\n` +
      `  (set of lowercase extensions) and \`MAX_FILE_BYTES\`.\n` +
      `- Instantiate \`MarkItDown()\` once at startup; if import fails, all convert\n` +
      `  calls return 503 with the import error.\n` +
      `- Endpoints:\n` +
      `  - \`GET /health\` → \`{ ok, detail }\` (503 if markitdown not importable)\n` +
      `  - \`GET /policy\` → the policy dict\n` +
      `  - \`POST /convert\` — multipart \`file\` upload:\n` +
      `    - Reject if extension not in \`ACCEPTED\` (415) or size > \`MAX_FILE_BYTES\` (413)\n` +
      `    - Write to tempfile; call \`_md.convert(tmp_path).text_content\`\n` +
      `    - \`.csv\` plaintext fallback: if conversion raises, decode as UTF-8\n` +
      `    - Always delete the tempfile in a \`finally\` block\n` +
      `    - Return \`{ ok: true, filename, markdown }\`\n` +
      `  - \`GET /api/runs\`, \`GET /api/runs/{id}\`, \`POST /api/runs\` — run log\n` +
      `    (persist to \`data/runs/\` next to \`main.py\`; prune to 100 files)\n` +
      `  - \`GET /api/status\` → \`{ ok, detail }\` (markitdown readiness)\n` +
      `  - \`POST /api/notify\` → stub, returns \`{ ok: true, detail: 'notification stub' }\`\n` +
      `  - \`POST /shutdown\` → \`threading.Timer(0.3, lambda: os._exit(0)).start()\`\n` +
      `- Standalone entry point (\`if __name__ == '__main__'\`): run uvicorn in a daemon\n` +
      `  thread, poll \`/health\` until it responds (up to 10s), then open the browser.\n` +
      `  Default port 8200 (\`MARKITDOWN_PORT\` env to change).\n\n` +
      `## Step 3 — Node adapter lib files (ESM throughout)\n\n` +
      `**\`lib/env.js\`** — paths + config:\n` +
      `- \`APP_DIR\` — the \`apps/markitdown\` directory (resolved from this file)\n` +
      `- \`SERVICE_DIR = path.join(APP_DIR, 'service')\`\n` +
      `- \`VENV_PYTHON\` — \`service/.venv/Scripts/python.exe\` on Windows,\n` +
      `  \`service/.venv/bin/python\` elsewhere\n` +
      `- \`config()\` returns \`{ port, url, launch, python }\`:\n` +
      `  - port: \`MARKITDOWN_PORT\` || 8200\n` +
      `  - url: \`MARKITDOWN_URL\` || \`http://127.0.0.1:\${port}\`\n` +
      `  - launch: \`MARKITDOWN_LAUNCH\` || \`'spawn'\` (values: spawn | external | off)\n` +
      `  - python: \`MARKITDOWN_PYTHON\` || \`VENV_PYTHON\`\n\n` +
      `**\`lib/launcher.js\`** — one child process tracked at module scope (survives app\n` +
      `restarts because the sandbox re-imports the app module, not this lib).\n\n` +
      `\`getLauncher()\` returns \`{ config, ensureUp(), restart(), status() }\`:\n\n` +
      `- \`ensureUp()\`: skip unless \`launch === 'spawn'\`; ping first (800ms), skip if\n` +
      `  already reachable; skip if venv python missing (setup not run yet); otherwise\n` +
      `  spawn: \`python -m uvicorn main:app --host 127.0.0.1 --port <port>\` with\n` +
      `  \`cwd = SERVICE_DIR\`, \`stdio: 'ignore'\`, \`windowsHide: true\`,\n` +
      `  \`env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' }\`.\n` +
      `- \`restart()\`: spawn mode only — POST to the service \`/shutdown\`, kill the child,\n` +
      `  wait up to 5s for the port to free, spawn fresh, wait up to 10s for it to\n` +
      `  answer. Returns \`status()\`.\n` +
      `- \`status()\`: ping with 1500ms timeout. Returns \`{ ok, detail }\` with actionable\n` +
      `  messages: "setup not run — run: npm run markitdown:setup", "service starting…\n` +
      `  (refresh in a moment)", "disabled (MARKITDOWN_LAUNCH=off)", etc.\n` +
      `- Ping helper: \`GET {url}/health\` with an AbortController timeout;\n` +
      `  returns \`{ reachable: false }\` on any error.\n\n` +
      `**\`lib/policy.js\`** — \`export function policy()\`: read and cache \`policy.json\`\n` +
      `from \`APP_DIR\`. Return a safe fallback (\`{ extensions: [], maxFileMB: 50, ... }\`)\n` +
      `if the file is unreadable.\n\n` +
      `**\`lib/runs.js\`** — persistent run log under \`apps/markitdown/data/runs/\`\n` +
      `(one JSON file per run id). Exports:\n` +
      `- \`save(record)\` — write \`<id>.json\`, prune to 100 files (delete oldest by name)\n` +
      `- \`get(id)\` — read one record or return \`null\`\n` +
      `- \`list()\` — newest-first array of run summaries with the \`items\` array stripped\n\n` +
      `**\`lib/setup.js\`** — run via \`node apps/markitdown/lib/setup.js\`:\n` +
      `1. Find Python 3.10+ on PATH (try \`py\`, \`python\`, \`python3\`; non-Windows: \`python3\` first).\n` +
      `2. Create the venv at \`service/.venv\` if not already there.\n` +
      `3. \`pip install --quiet --upgrade pip\` then \`pip install -r requirements.txt\`.\n` +
      `4. Verify: \`python -c "import markitdown"\`.\n` +
      `5. Print clear, actionable errors at each step — tell the user exactly what\n` +
      `   command to run if something fails.\n\n` +
      `Register in \`package.json\` scripts:\n` +
      `\`"markitdown:setup": "node apps/markitdown/lib/setup.js"\`\n\n` +
      `## Step 4 — index.js\n\n` +
      `Exports:\n` +
      `- \`export const meta = { name: 'MarkItDown', description: 'Convert PDF/Office/image files to Markdown via a Python markitdown service.', version: '0.1.0' }\`\n` +
      `- \`export function createApp({ name })\` → Express Router:\n` +
      `  - \`launcher.ensureUp().catch(() => {})\` on every load (safe no-op if already up)\n` +
      `  - \`POST /convert\` — stream the multipart request straight to the Python service:\n` +
      `    forward \`content-type\` and \`content-length\` headers, pass \`body: req, duplex: 'half'\`.\n` +
      `    On fetch failure → 502 \`{ ok: false, detail: 'service unreachable: ...' }\`.\n` +
      `  - \`express.json({ limit: '8mb' })\` middleware for the JSON routes below\n` +
      `  - \`GET /api/runs\` → \`runs.list()\`\n` +
      `  - \`GET /api/runs/:id\` → \`runs.get(id)\` (404 if null)\n` +
      `  - \`POST /api/runs\` → \`runs.save(req.body)\` (400 on error)\n` +
      `  - \`GET /api/status\` → \`launcher.status()\`\n` +
      `  - \`POST /api/service/restart\` → \`launcher.restart()\`\n` +
      `  - \`POST /api/notify\` → log + \`{ ok: true, detail: 'notification stub' }\`\n` +
      `  - \`GET /\` → \`res.type('html').send(page(name))\`\n` +
      `- \`export async function health()\` → \`getLauncher().status()\`\n\n` +
      `**UI — the \`page(name)\` function:**\n` +
      `The UI is a self-contained inline HTML/CSS/JS page. Do NOT redesign or regenerate\n` +
      `it from scratch — copy \`page()\` verbatim from the source repository\n` +
      `(\`apps/markitdown/index.js\`). The function reads \`policy()\` for accepted types\n` +
      `and limits, sets \`base = \`/apps/\${name}\`\`, and returns the full HTML string.\n` +
      `It links \`/static/css/dark.css\` for theming and uses two CDN scripts\n` +
      `(marked.js + jszip).\n\n` +
      `## Verification\n\n` +
      `1. \`npm run markitdown:setup\` — should end with "Setup complete."\n` +
      `2. \`npm run dev\` — start the server.\n` +
      `3. Open \`/apps/markitdown\` — the status banner should go green within ~5s.\n` +
      `4. Drop a .pdf or .docx — confirm it converts and the Markdown appears in the flyout.\n` +
      `5. Check Runs section shows the completed run.`,
  },
];
