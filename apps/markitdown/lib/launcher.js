import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { config, SERVICE_DIR, VENV_PYTHON } from './env.js';

// One child per Node process, tracked at module scope. The sandbox re-imports
// app modules on restart (cache-busting) but this lib is imported once via the
// server boot hook, so the handle survives app restarts.
let child = null;
let lastSpawnError = null;

async function ping(url, ms = 1500) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(`${url}/health`, { signal: ctrl.signal });
    const body = await res.json().catch(() => ({}));
    return { reachable: res.ok, ...body };
  } catch {
    return { reachable: false };
  } finally {
    clearTimeout(t);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(url, wantUp, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if ((await ping(url, 600)).reachable === wantUp) return true;
    await sleep(300);
  }
  return false;
}

function spawnService(cfg) {
  if (child && !child.killed) return;
  // Prefer the configured python; if that's the venv path and it's missing,
  // we don't silently fall back — status() reports the exact fix instead.
  const py = cfg.python;
  child = spawn(py, ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', String(cfg.port)], {
    cwd: SERVICE_DIR,
    stdio: 'ignore',
    windowsHide: true,
    // Force UTF-8 so markitdown's text converters don't fall back to the OS
    // default codec (ascii on some Windows setups) and choke on non-ASCII bytes.
    env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' },
  });
  child.on('error', (err) => {
    lastSpawnError = err.message;
    child = null;
  });
  child.on('exit', () => {
    child = null;
  });
}

/**
 * Strategy selector — the whole point of the seam. The app only ever calls
 * ensureUp()/status(); how the service comes to life is decided here by env.
 */
export function getLauncher() {
  const cfg = config();

  return {
    config: cfg,

    /** Bring the service up if this strategy is responsible for it. */
    async ensureUp() {
      if (cfg.launch !== 'spawn') return; // external/off: not our job
      const live = await ping(cfg.url, 800);
      if (live.reachable) return; // already running (e.g. you started it manually)
      if (cfg.python === VENV_PYTHON && !fs.existsSync(VENV_PYTHON)) return; // setup not run yet
      spawnService(cfg);
    },

    /** Recycle the service so it picks up new code/policy/env. Spawn mode only.
     *  Asks the running instance to /shutdown (frees the port even if we don't
     *  own the process), waits for it to die, then spawns a fresh one. */
    async restart() {
      if (cfg.launch !== 'spawn') {
        return { ok: false, detail: `restart is spawn-mode only (current: ${cfg.launch})` };
      }
      if (cfg.python === VENV_PYTHON && !fs.existsSync(VENV_PYTHON)) {
        return { ok: false, detail: 'setup not run — run: npm run markitdown:setup' };
      }
      try { await fetch(`${cfg.url}/shutdown`, { method: 'POST' }); } catch { /* may already be down */ }
      if (child) { try { child.kill(); } catch {} child = null; }
      await waitFor(cfg.url, false, 5000); // wait until the port is free
      lastSpawnError = null;
      spawnService(cfg);
      await waitFor(cfg.url, true, 10000); // wait until it answers again
      return this.status();
    },

    /** Rich status for health() — always says exactly what to do next. */
    async status() {
      if (cfg.launch === 'off') {
        return { ok: false, detail: 'disabled (MARKITDOWN_LAUNCH=off)' };
      }

      const live = await ping(cfg.url);
      if (live.reachable) {
        return { ok: !!live.ok, detail: live.detail || `service at ${cfg.url}` };
      }

      if (cfg.launch === 'external') {
        return { ok: false, detail: `no service at ${cfg.url} — start it, or set MARKITDOWN_LAUNCH=spawn` };
      }

      // spawn mode, but nothing is answering — diagnose why
      if (cfg.python === VENV_PYTHON && !fs.existsSync(VENV_PYTHON)) {
        return { ok: false, detail: 'setup not run — run: npm run markitdown:setup' };
      }
      if (lastSpawnError) {
        return { ok: false, detail: `failed to start python: ${lastSpawnError}` };
      }
      return { ok: false, detail: 'service starting… (refresh in a moment)' };
    },
  };
}
