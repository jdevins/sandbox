# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A **sandbox / prototype server**: one Express process that hosts multiple, often
unrelated, apps behind a single management dashboard. Optimized for spinning up
throwaway prototypes fast, not for production. Auth is intentionally light. Claude
is expected to be the primary operator — adding apps, launching/restarting them,
and checking health from the dashboard or its JSON API.

## Commands

```bash
npm install
npm run dev                       # run with auto-restart (node --watch server.js)
npm start                         # run once
npm test                          # run all node:test files
node --test test/smoke.test.js    # run a single test file
npm run setup:hooks               # install git hooks (run once after clone)
```

Server defaults to port 3000 (`PORT` env to change). Dashboard at `/`.

## Architecture

The system is a thin Express shell around a **live app registry**. The key idea:
sandbox apps are mounted *dynamically* so they can be launched, stopped, and
restarted without restarting the Node process.

- **`server.js`** — entry point. Builds the app, runs initial discovery, listens.
- **`src/app.js`** — `createServer()` wires middleware, views, the dashboard
  router, and the **app dispatcher**. Returns `{ app, appManager }` without binding
  a port (so tests can use it). The dispatcher at `/apps/:name` resolves the target
  app's router *at request time* from the `AppManager` — this indirection is what
  makes hot start/stop/restart work.
- **`src/appManager.js`** — the core. Discovers folders under `apps/`, imports each
  app's `index.js`, and tracks its `status` (`running` / `stopped` / `errored`).
  **Restart works by re-importing the module with a cache-busting `?v=` query**
  (ES modules can't be uncached), which rebuilds both code and in-module state.
  Also runs each app's optional `health()` probe.
- **`src/routes/dashboard.js`** — dashboard UI route + the management JSON API
  (`/healthz`, `/api/apps`, `/api/apps/:name/{start,stop,restart,test,deploy}`,
  `/api/discover`).
- **`src/auth.js`** — `lightAuth` middleware. No-op unless `SANDBOX_TOKEN` is set.
- **`src/views/`** — EJS templates (`partials/head` + `partials/foot` wrap pages).
- **`public/`** — static assets served at `/static`; `css/dark.css` is the shared theme.
- **`apps/`** — one folder per sandbox app. This is where prototypes live.

## The app contract

Every app is a folder `apps/<name>/` with an `index.js` that exports:

- `meta` — `{ name?, description, version }` (name defaults to the folder name).
- `createApp(ctx)` — **a factory** returning an Express `Router`. `ctx` is
  `{ name, meta }`. Must be a factory (not a bare router) so restart can rebuild
  state. May be async.
- `health()` — *optional*; returns `{ ok, detail }` for the dashboard/`/healthz`.

The app is mounted at `/apps/<name>`, so its router uses paths relative to that.
Folders starting with `.` or `_` are skipped by discovery.

Copy `apps/hello/` (minimal) or `apps/guestbook/` (in-memory state + form) as a
starting template for new apps.

## App isolation

Apps must not commingle. Each app owns its own `components/`, `lib/`, `public/`
(served at `/apps/<name>/assets`), and any sub-structure. **The only shared layer
is the theme** — every UI links `/static/css/dark.css` for design tokens
(`--bg`, `.card`, `.btn`, `.badge`, …) so all apps look consistent, but component
*code/markup* lives inside each app and is not reused across apps. New UI should be
built from an app's own components on top of the shared tokens.

## Claude Engine (`apps/claude-engine/`) — the flagship app

An authoring + ops console for Claude. It is the reference example of the deeper
patterns every rich app should follow. Layout:

- **`index.js`** — builds the engine **context** (`ctx`) and hands it to every
  feature: `{ stores, provider, ui, page, paths, base }`. Dependencies are passed
  explicitly (no globals) so capabilities are modular and swappable.
- **`features/<id>/`** — a **feature** = `meta` + `createFeature(ctx)` → Express
  Router, auto-discovered (see `lib/features.js`) and mounted at
  `/apps/claude-engine/features/<id>`. Each is launchable from the app dashboard.
  Ships: `skill-builder` (skills library + code-first builder wizard + evaluation
  runner) and `agent-composer` (agent library + builder that composes skills).
  Drop a new folder to add a feature.
- **`pages/`** — non-feature pages exposing vital components: `overview.js` (the
  app dashboard) and `memories.js`.
- **`components/`** — app-local UI: `layout.js` (page shell) and `widgets.js`
  (cards, tables, and the schema-driven `configForm` — every configurable
  component renders its UI widget from an `inputs`/schema array).
- **`lib/`** — `store.js` (`codeStore` + `jsonStore`), `provider.js` (LLM provider
  interface), `features.js` (discovery), `html.js` (escaping `html` tagged template).
- **`data/`** — the self-contained store: `skills/*.skill.js`, `agents/*.agent.js`,
  `memories/*.json`. These are tracked in git (sandbox state), not ignored.

### Code-first skills & agents

Skills and agents are stored as **executable ES modules, not markdown** — the
engine prefers repeatable functionality as code. The builder wizards *generate*
these modules (see each feature's `codegen.js`); they're plain `.js` and safe to
hand-edit.

- **Skill module**: `export const definition = { id, name, inputs, ... }`,
  `export async function run(input, ctx)`, `export const tests = [{name,input,expect}]`.
  The evaluation runner executes `run` against `tests` and reports pass/fail.
- **Agent module**: `export const definition = { model, systemPrompt, skills, ... }`
  and `export async function run(input, ctx)` where `ctx = { provider, skills.run(id,input) }`.
  Default composition runs each referenced skill, then calls the provider.

### LLM provider (swappable)

`lib/provider.js` defines the provider interface (`complete({system, prompt, model})`).
The **mock provider is the default** so everything runs offline and deterministically.
`getProvider()` selects from env; to go live, implement `anthropicProvider` and set
`ANTHROPIC_API_KEY` + `ENGINE_LLM=anthropic`. Callers never change.

## Standards

Active coding standards live in [`standards/index.js`](standards/index.js), organized by concern: `code`, `structure`, `ui`, `llm`, `versioning`.

**Before declaring any task done**, verify the changes comply with applicable active rules. Load the relevant category — not the full list unless doing a sweep.

Per-app exceptions are declared in [`standards/overrides.js`](standards/overrides.js) with a required reason. Three or more exceptions to the same rule signals the rule needs review.

When a bug fix or rework reveals a pattern, propose a new rule: add it to `standards/index.js` with `status: 'proposed'`. User promotes to `active`.

## Conventions specific to this repo

- **ESM throughout** (`"type": "module"`). Use `import`, not `require`.
- **Shared dark mode is the default.** New UI — whether in EJS views or an app's
  inline HTML — should link `/static/css/dark.css` and reuse its primitives
  (`.card`, `.btn`, `.btn.primary`, `.badge`, `.wrap`, `.row`, `.empty`) and CSS
  variables rather than inventing new styles.
- **App state in module scope is intentionally ephemeral** — a dashboard Restart
  clears it (see `apps/guestbook`). Don't rely on persistence unless you add it.
- **Prefer code over markdown** for anything repeatable — author skills/agents and
  similar capabilities as `.js` modules with a `definition` + executable functions.
- **Make capabilities modular and swappable** — pass dependencies in explicitly via
  a context object (see the engine's `ctx`); select implementations behind a small
  interface (see the provider) rather than hardcoding.
- **Every built component gets a UI wrapper or config widget** — drive forms from a
  schema (`configForm`) so configurable components expose their UI automatically.
- **`test` and `deploy` dashboard actions are stubs** in `dashboard.js`. Wire them
  to real per-app commands when needed.
- Tests use the built-in `node:test` runner and boot the app via `createServer()`
  with `app.listen(0)` (ephemeral port) — follow that pattern for new tests.
