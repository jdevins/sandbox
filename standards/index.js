/**
 * Sandbox standards catalog.
 *
 * Rules are organized by concern. If a rule is in this file, it is active.
 * Add with status 'proposed' to flag for review without enforcing.
 * Set status 'deprecated' with a deprecatedReason to retire without deleting.
 *
 * origin tells — why a rule was added:
 *   design     intentional upfront decision
 *   bugfix     a preventable bug revealed the need
 *   rework     a task done twice revealed an implicit standard
 *   sweep      recurring violation found across apps
 *   override   a rule was excepted too often and needed revision
 */

// ─── PRINCIPLES ─────────────────────────────────────────────────────────────────
// Cross-cutting judgment calls, not mechanical pass/fail checks — for situations
// the concrete rules below don't cover yet. Apply these when venturing into a
// pattern this codebase hasn't done before. Not included in `rules`/`active`:
// nothing here is meant to be swept or auto-checked, only read and applied.
// When a principle violation actually happens, promote the specific lesson
// into a concrete rule below (origin: 'bugfix' or 'rework') so the next agent
// doesn't have to re-derive the same judgment call from scratch.

export const principles = [
  {
    id: 'principle-native-semantics',
    description: 'Prefer native platform/browser behavior over reimplementing it. If you must override a native element\'s default rendering (<dialog>, <details>, form controls), scope the override to the relevant state (e.g. a [open] selector) rather than applying it unconditionally — native elements often encode meaningful behavior in state-dependent defaults that a blanket override silently destroys.',
  },
  {
    id: 'principle-precedent-first',
    description: 'Before introducing a new pattern, check whether this codebase already has something similar (a comparable dialog, a comparable API shape) and understand why it works before deviating from it. An existing pattern can be correct in a way that is not obvious until you change it.',
  },
  {
    id: 'principle-verify-state-transitions',
    description: 'When a feature has more than one state (open/closed, loading/loaded, empty/populated), verify all of them, not just the one you were building toward. A feature that looks right when open and right when populated can still be broken at rest.',
  },
  {
    id: 'principle-minimize-speculative-surface',
    description: 'When a future need is plausible but not yet real, reserve the seam (a field, a hook point) rather than building the machinery around it. Don\'t add UI, validation, or processing for a capability nothing uses yet.',
  },
  {
    id: 'principle-promote-the-lesson',
    description: 'When a bug reveals a gap these principles didn\'t cover — or that a rule check would have caught — propose a concrete rule (status: proposed) instead of only fixing the instance. The lesson should outlive the bugfix that produced it.',
  },
];

// ─── CODE ─────────────────────────────────────────────────────────────────────
// Language-level rules: naming, comments, module conventions.

const code = [
  {
    id: 'code-esm-only',
    category: 'code',
    level: 'error',
    status: 'active',
    origin: 'design',
    description: 'Use ESM (import/export) throughout. require() is not allowed.',
  },
  {
    id: 'code-function-naming',
    category: 'code',
    level: 'warning',
    status: 'active',
    origin: 'design',
    description: 'Functions use camelCase. Factory functions are prefixed with "create" (e.g. createApp, createFeature).',
  },
  {
    id: 'code-variable-naming',
    category: 'code',
    level: 'warning',
    status: 'active',
    origin: 'design',
    description: 'Variables use camelCase. Constants that are truly fixed use UPPER_SNAKE_CASE.',
  },
  {
    id: 'code-comments-why-not-what',
    category: 'code',
    level: 'warning',
    status: 'active',
    origin: 'design',
    description: 'Comments explain WHY, not what. Comment hidden constraints, workarounds, or non-obvious invariants only. Do not describe what the code does.',
  },
]

// ─── ARCHITECTURE ─────────────────────────────────────────────────────────────
// System design rules: isolation, dependency injection, app contract, factory
// pattern. How apps and modules relate to each other.

const architecture = [
  {
    id: 'arch-app-contract',
    category: 'architecture',
    level: 'error',
    status: 'active',
    origin: 'design',
    description: 'Every app exports meta ({ name?, description, version }) and createApp(ctx) returning an Express Router. health() is optional but encouraged.',
  },
  {
    id: 'arch-factory-not-router',
    category: 'architecture',
    level: 'error',
    status: 'active',
    origin: 'design',
    description: 'createApp must be a factory function, not a bare exported router. This enables restart to rebuild state cleanly.',
  },
  {
    id: 'arch-app-isolation',
    category: 'architecture',
    level: 'error',
    status: 'active',
    origin: 'design',
    description: 'Apps must not import from other apps. Each app owns its own components/, lib/, and public/. The only shared layer is /static/css/dark.css.',
  },
  {
    id: 'arch-explicit-dependencies',
    category: 'architecture',
    level: 'error',
    status: 'active',
    origin: 'design',
    description: 'Dependencies are passed explicitly via context objects (ctx). No module-level globals shared across apps or features.',
  },
  {
    id: 'arch-swappable-interfaces',
    category: 'architecture',
    level: 'warning',
    status: 'active',
    origin: 'design',
    description: 'Capabilities that may change implementation (LLM provider, store, etc.) are accessed through a small interface, not called directly. Callers never change when the implementation swaps.',
  },
  {
    id: 'arch-ephemeral-state',
    category: 'architecture',
    level: 'warning',
    status: 'active',
    origin: 'design',
    description: 'Module-scope state is ephemeral — a Restart clears it. Do not rely on in-memory state for anything that must survive restarts unless a store is explicitly added.',
  },
  {
    id: 'arch-prefer-code-over-config',
    category: 'architecture',
    level: 'warning',
    status: 'active',
    origin: 'design',
    description: 'Repeatable capabilities (skills, agents, configs) are authored as .js modules with a definition + executable functions, not as markdown or prose.',
  },
]

// ─── CONVENTIONS ──────────────────────────────────────────────────────────────
// File layout, folder naming, asset paths, discovery expectations.
// How things are arranged, not how they relate.

const conventions = [
  {
    id: 'conv-assets-path',
    category: 'conventions',
    level: 'warning',
    status: 'active',
    origin: 'design',
    description: 'App-local static assets are served at /apps/<name>/assets, not at the root.',
  },
  {
    id: 'conv-skip-prefix',
    category: 'conventions',
    level: 'warning',
    status: 'active',
    origin: 'design',
    description: 'Folders starting with . or _ are skipped by app discovery. Use these prefixes for private or work-in-progress directories.',
  },
  {
    id: 'conv-schema-driven-forms',
    category: 'conventions',
    level: 'warning',
    status: 'active',
    origin: 'design',
    description: 'Configurable components render their settings UI via the configForm schema pattern (inputs array), not ad-hoc forms.',
  },
]

// ─── UI ───────────────────────────────────────────────────────────────────────
// All presentation rules: theme adherence, layout, button placement, component
// patterns, LLM-session indicators. How things look and behave for the user.

const ui = [
  {
    id: 'ui-dialog-open-state',
    category: 'ui',
    level: 'error',
    status: 'active',
    origin: 'bugfix',
    description: '<dialog> CSS must not set a non-"none" display value unconditionally — scope it to the [open] attribute selector (e.g. `dialog#x[open] { display:flex }`). The browser\'s native closed-state display:none is what makes a missing/removed open attribute actually hide the element; an unscoped override leaves it permanently visible regardless of .show()/.close(). Found when a sidebar flyout rendered "latched open" with no content from page load, because its layout rule (display:flex) applied whether or not the dialog had been opened.',
  },
  {
    id: 'ui-dark-theme',
    category: 'ui',
    level: 'error',
    status: 'active',
    origin: 'design',
    description: 'Every UI page links /static/css/dark.css. Override is allowed but must be declared in overrides.js with a reason.',
  },
  {
    id: 'ui-use-primitives',
    category: 'ui',
    level: 'warning',
    status: 'active',
    origin: 'design',
    description: 'Use shared primitives (.card, .btn, .btn.primary, .badge, .wrap, .row, .empty) and CSS variables before inventing new styles.',
  },
  {
    id: 'ui-card-button-anchor',
    category: 'ui',
    level: 'warning',
    status: 'active',
    origin: 'design',
    description: 'Action buttons inside a card are anchored to the bottom of the card, right-aligned. Do not scatter buttons mid-card.',
  },
  {
    id: 'ui-llm-button-signature',
    category: 'ui',
    level: 'error',
    status: 'active',
    origin: 'design',
    description: 'Any button that triggers an active LLM session must have an icon and use the .btn-llm class for consistent coloring. Users must always identify LLM-backed actions at a glance.',
  },
  {
    id: 'ui-collapsible-group',
    category: 'ui',
    level: 'warning',
    status: 'active',
    origin: 'design',
    description: 'Collapsible content groups use <details class="collapsible"> with a <summary> containing a label and optional .coll-count span. Body content goes in .coll-body. The chevron and open/close animation are handled by CSS — no custom JS or inline styles needed.',
  },
  {
    id: 'ui-no-smart-quote-attrs',
    category: 'ui',
    level: 'error',
    status: 'active',
    origin: 'bugfix',
    description: 'Never use smart/curly quotes (“ ” ‘ ’) as HTML attribute or tag delimiters in `html` template code. A smart quote in place of a straight " or \' as the opening delimiter (for example, writing the class attribute as class followed by a curly quote instead of a straight one) is read literally, so the class never matches and all CSS silently fails. Smart quotes in display TEXT are fine — only delimiter positions are forbidden. Enforced by .hooks/check-smart-quotes.js.',
  },
  {
    id: 'ui-edit-in-place',
    category: 'ui',
    level: 'warning',
    status: 'active',
    origin: 'design',
    description: 'Editable fields (title, description, etc.) render as the editor itself (.inline-field input/textarea), not a read-only display plus a separate duplicate edit form. Submit on change/blur. Do not build a second "edit" affordance for a field that is already shown.',
  },
  {
    id: 'ui-llm-active-state',
    category: 'ui',
    level: 'warning',
    status: 'active',
    origin: 'design',
    description: 'While an LLM session is in flight, the triggering button shows a loading state (disabled + spinner or label change). No silent waits.',
  },
  {
    id: 'ui-text-wraps-code-scrolls',
    category: 'ui',
    level: 'warning',
    status: 'active',
    origin: 'rework',
    description: 'Prose text (descriptions, summaries, prompt fields) always wraps within its container — use .summary-text for LLM summary blocks, plain textarea (type "text") for prose entry fields. Only literal code/data blocks (raw JSON, transcripts) may overflow horizontally to scroll — use .eng-source or textarea.code. Found while cleaning up session-repack cards, which had ad-hoc inline white-space styles and a prose prompt field mistakenly typed as code (forced no-wrap + horizontal scroll).',
  },
]

// ─── PROCESS ──────────────────────────────────────────────────────────────────
// Workflow discipline: versioning, commit hygiene, testing conventions.

const process = [
  {
    id: 'process-version-required',
    category: 'process',
    level: 'error',
    status: 'active',
    origin: 'design',
    description: 'Every app exports a version field in meta (e.g. version: "1.0.0"). Missing version is a contract violation.',
  },
  {
    id: 'process-version-on-commit',
    category: 'process',
    level: 'warning',
    status: 'active',
    origin: 'design',
    description: 'Every commit that changes an app increments its patch version in meta. Exceptions: documentation-only changes, standards updates, dependency bumps with no behavior change.',
  },
  {
    id: 'process-test-pattern',
    category: 'process',
    level: 'warning',
    status: 'active',
    origin: 'design',
    description: 'Tests use node:test and boot the server via createServer() with app.listen(0) (ephemeral port). Do not bind to a fixed port in tests.',
  },
  {
    id: 'process-no-hardcoded-prompt-urls',
    category: 'process',
    level: 'error',
    status: 'active',
    origin: 'bugfix',
    description: 'Scheduled/agent prompts (prompts/*.md) must reference the server via the {{BASE_URL}} placeholder, not a hardcoded host:port. src/scheduler.js substitutes it at runtime with the actual instance\'s base URL. Found when a prompt\'s hardcoded http://localhost:3000 caused a test run (against an alternate port) to silently mutate production backlog data instead of the test instance — the agent had no way to know which server it was supposed to target.',
  },
  {
    id: 'process-test-server-cleanup',
    category: 'process',
    level: 'error',
    status: 'active',
    origin: 'bugfix',
    description: 'Any test that opens a server with app.listen() must close it in a try/finally (or t.after hook), not as the last line of the test body. A thrown assertion before close() leaves the listener open, which keeps the node:test child process alive indefinitely and stalls every subsequent test file. Found when a route change broke test/engine.test.js and the dangling server hung npm test for the rest of the session.',
  },
]

// ─── SECURITY ─────────────────────────────────────────────────────────────────
// Input validation, injection prevention, secrets discipline.
// Thin now — exists as a placeholder so the category is established.

const security = [
  {
    id: 'security-no-hardcoded-secrets',
    category: 'security',
    level: 'error',
    status: 'active',
    origin: 'design',
    description: 'Secrets (API keys, tokens, passwords) are read from environment variables, never hardcoded in source files.',
  },
  {
    id: 'security-validate-external-input',
    category: 'security',
    level: 'warning',
    status: 'active',
    origin: 'design',
    description: 'Validate and sanitize input at system boundaries: user-submitted form data, external API responses. Trust internal module interfaces without defensive checks.',
  },
  {
    id: 'security-llm-provider-only',
    category: 'security',
    level: 'error',
    status: 'active',
    origin: 'design',
    description: 'LLM calls go through the provider interface (ctx.provider.complete(...)). Never call the Anthropic SDK or any LLM directly from app code. This enforces a single point of control for auth, logging, and future cost tracking.',
  },
]

// ─── EXPORT ───────────────────────────────────────────────────────────────────

export const rules = [
  ...code,
  ...architecture,
  ...conventions,
  ...ui,
  ...process,
  ...security,
]

export const byCategory = { code, architecture, conventions, ui, process, security }

export const active   = rules.filter(r => r.status === 'active')
export const proposed = rules.filter(r => r.status === 'proposed')
