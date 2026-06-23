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
    id: 'ui-llm-active-state',
    category: 'ui',
    level: 'warning',
    status: 'active',
    origin: 'design',
    description: 'While an LLM session is in flight, the triggering button shows a loading state (disabled + spinner or label change). No silent waits.',
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
