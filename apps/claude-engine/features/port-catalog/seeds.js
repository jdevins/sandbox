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
];
