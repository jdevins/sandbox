// Command Center · declared registry.
//
// Personas (agents) and Skills are read LIVE from the engine stores. The other
// component kinds aren't first-class modules yet, so they're declared here —
// grounded in real code (apps/backlog/index.js, src/scheduler.js). This file is
// the seam: as capabilities/gates/tools become first-class, replace these
// literals with live discovery without changing the inspector.

// Server-side functions an agent can call. `gate` names the gate (see GATES)
// that guards the endpoint, if any. `read` marks read-only (safe) capabilities.
export const CAPABILITIES = [
  { id: 'backlog-list', app: 'backlog', method: 'GET', path: '/api/items', read: true,
    description: 'Read every backlog item. Safe — no mutation.' },
  { id: 'backlog-annotate', app: 'backlog', method: 'POST', path: '/api/items/:id/annotate', gate: 'annotate-append-only',
    description: 'Append feedback to an item. Can only nudge ready-to-groom → groomed.' },
  { id: 'backlog-groom-block', app: 'backlog', method: 'POST', path: '/api/items/:id/groom-block',
    description: 'Mark an item groomer-blocked when it cannot be correlated.' },
  { id: 'backlog-approve', app: 'backlog', method: 'POST', path: '/approve', gate: 'approved-for-build',
    description: 'Human gate. Flips approvedForBuild — the leash before any build.' },
  { id: 'backlog-claim', app: 'backlog', method: 'POST', path: '/api/items/:id/claim', gate: 'atomic-claim',
    description: 'Atomically claim a ready + approved item. 409 otherwise.' },
  { id: 'backlog-complete', app: 'backlog', method: 'POST', path: '/api/items/:id/complete', gate: 'claimer-only-complete',
    description: 'Finish an item. Only the claimer may call it; 403 otherwise.' },
  { id: 'scheduler-run', app: 'scheduler', method: 'spawn', path: 'claude -p', gate: 'allowed-tools',
    description: 'Headless agent run. Tools restricted via --allowedTools (the bound).' },
];

// Gates. `kind` is the crux of the whole model:
//   hard  = enforced by structure/code — a guarantee. Cannot be bypassed by prose.
//   soft  = a request (prompt text) or a judgement (LLM score) — not a guarantee.
export const GATES = [
  { id: 'approved-for-build', kind: 'hard', enforces: 'Nothing builds until a human flips approvedForBuild.',
    where: 'apps/backlog/index.js:241', how: 'Boolean flag set only by the human /approve route; claim checks it.' },
  { id: 'atomic-claim', kind: 'hard', enforces: 'One worker per item; only ready + approved items are claimable.',
    where: 'apps/backlog/index.js:298', how: 'Check-and-set; second claimer or unready item gets HTTP 409.' },
  { id: 'claimer-only-complete', kind: 'hard', enforces: 'Only the agent that claimed an item may complete it.',
    where: 'apps/backlog/index.js:313', how: 'Compares by === claim.by; mismatch gets HTTP 403.' },
  { id: 'annotate-append-only', kind: 'hard', enforces: 'Groomer can only append notes — no path to status/claim/approval.',
    where: 'apps/backlog/index.js:264', how: 'Endpoint shape: it writes annotations[] and at most pending → groomed.' },
  { id: 'allowed-tools', kind: 'hard', enforces: 'Headless runs can only use the tools on the allowlist.',
    where: 'src/scheduler.js:130', how: 'claude -p --allowedTools; everything else stays gated and stalls.' },
  { id: 'tests-pass', kind: 'hard', enforces: 'No item advances past Test unless the suite is green.',
    where: '(planned · delivery loop)', how: 'npm test exit code — deterministic, runs before the critic.' },
  { id: 'critic-score', kind: 'soft', enforces: 'Critic must score the diff ≥ threshold to reach Done.',
    where: '(planned · delivery loop)', how: 'Independent LLM judgement — advisory, can be wrong; pair with tests.' },
  { id: 'prompt-please', kind: 'soft', enforces: 'Prompt says "only leave feedback, don’t change status".',
    where: 'prompts/backlog-groom.md', how: 'Documentation only. The append-only ENDPOINT is the real bound.' },
];

// Tool vocabulary — what an agent's bounds can grant. denyByDefault flags the
// irreversible ones that should stay off unless a verb on the job demands them.
export const TOOLS = [
  { id: 'read', label: 'Read', risk: 'read', denyByDefault: false, description: 'Read files. The safest capability.' },
  { id: 'git', label: 'git (branch/commit)', risk: 'write', denyByDefault: false, description: 'Branch + commit. Local, reversible.' },
  { id: 'edit', label: 'Edit / Write', risk: 'write', denyByDefault: false, description: 'Modify files in the working tree.' },
  { id: 'npm-test', label: 'Bash(npm test)', risk: 'exec', denyByDefault: false, description: 'Run the test suite. No side effects here.' },
  { id: 'gh-pr', label: 'gh pr create', risk: 'external', denyByDefault: false, description: 'Open a PR. Outward-facing but not a merge.' },
  { id: 'http', label: 'http / curl', risk: 'external', denyByDefault: true, description: 'Arbitrary HTTP — dual-use; can mutate. Scope tightly.' },
  { id: 'git-merge', label: 'git merge / push --force', risk: 'irreversible', denyByDefault: true, description: 'Merge or force-push. Keep off — humans own this.' },
  { id: 'deploy', label: 'deploy', risk: 'irreversible', denyByDefault: true, description: 'Ship to a target. Never on an unattended agent.' },
];

// Loops — none authored yet. The delivery loop is the first.
export const LOOPS = [];
