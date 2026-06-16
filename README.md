# Sandbox Server

A prototype-oriented Express server that hosts multiple, unrelated apps behind one
dashboard. Built to be managed by Claude — drop a folder in `apps/`, rescan, launch.

## Run

```bash
npm install
npm run dev      # auto-restart on file changes (node --watch)
npm start        # plain run
```

Then open the dashboard at http://localhost:3000.

## What you get

- **Dashboard** at `/` — per-app health, and Launch / Stop / Restart / Test / Deploy buttons.
- **Auto-discovery** — every folder under `apps/` with an `index.js` is mounted at `/apps/<name>`.
- **In-process apps** — Launch/Restart re-imports the module live; no server restart.
- **Shared dark mode** — `public/css/dark.css` is the default theme for the dashboard and apps.
- **Light auth** — off by default; set `SANDBOX_TOKEN` to require a token on every request.

## Add an app

Create `apps/my-app/index.js`:

```js
import express from 'express';

export const meta = { name: 'My App', description: 'what it does', version: '1.0.0' };

export function createApp({ name }) {
  const router = express.Router();
  router.get('/', (req, res) => res.send('hi'));
  return router;
}

export function health() { return { ok: true, detail: 'optional probe' }; }
```

Click **Rescan apps/** on the dashboard (or `POST /api/discover`). See `apps/hello`
and `apps/guestbook` for minimal examples.

## Claude Engine

`apps/claude-engine` is the flagship app — an authoring & ops console for Claude
with its own dashboard, sidebar nav, and launchable **features**:

- **Skill Builder** — skills library + code-first builder wizard + evaluation runner.
- **Agent Composer** — agent library + wizard that composes agents from skills.
- **Memories** page — view/add facts the engine keeps.

Skills and agents are stored as executable `.js` modules (code, not markdown) under
`apps/claude-engine/data/`. The LLM provider is swappable and ships a deterministic
mock by default, so everything runs offline. See `CLAUDE.md` for the full design.

## Test

```bash
npm test                          # all tests
node --test test/smoke.test.js    # a single file
```
