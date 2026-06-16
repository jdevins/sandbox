import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Discovers, mounts, and supervises sandbox apps living under apps/.
 *
 * App contract — each apps/<name>/index.js must export:
 *   export const meta = { description, version }   // name defaults to folder
 *   export function createApp(ctx) { ... return router }   // factory → Express router
 *   export async function health() { return { ok, detail } }   // optional
 *
 * Apps run in-process. "Launch / restart" re-imports the module with a
 * cache-busting query so code + state are rebuilt without restarting Express.
 */
export class AppManager {
  constructor({ appsDir }) {
    this.appsDir = appsDir;
    /** @type {Map<string, AppEntry>} */
    this.apps = new Map();
  }

  /** Scan apps/ and load every app that isn't already known. */
  async discoverAll() {
    let dirents = [];
    try {
      dirents = await fs.readdir(this.appsDir, { withFileTypes: true });
    } catch {
      return; // apps/ may not exist yet
    }
    for (const d of dirents) {
      if (!d.isDirectory() || d.name.startsWith('.') || d.name.startsWith('_')) continue;
      if (!this.apps.has(d.name)) {
        await this.load(d.name).catch((err) => this.#setError(d.name, err));
      }
    }
  }

  /** (Re)load a single app from disk and start it. */
  async load(name) {
    const entryFile = path.join(this.appsDir, name, 'index.js');
    await fs.access(entryFile); // throws → caught by caller as a load error

    const url = pathToFileURL(entryFile).href + `?v=${Date.now()}`;
    const mod = await import(url);

    if (typeof mod.createApp !== 'function') {
      throw new Error(`apps/${name}/index.js must export a createApp(ctx) factory.`);
    }

    const meta = { name, description: '', version: '0.0.0', ...(mod.meta || {}) };
    const router = await mod.createApp({ name, meta });

    this.apps.set(name, {
      name,
      meta,
      router,
      health: typeof mod.health === 'function' ? mod.health : null,
      status: 'running',
      error: null,
      startedAt: new Date().toISOString(),
    });
    return this.apps.get(name);
  }

  get(name) {
    return this.apps.get(name);
  }

  list() {
    return [...this.apps.values()].map(({ router, health, ...rest }) => rest);
  }

  async stop(name) {
    const entry = this.apps.get(name);
    if (!entry) return null;
    entry.status = 'stopped';
    entry.router = (req, res) => res.status(503).send('stopped');
    return entry;
  }

  async start(name) {
    return this.load(name);
  }

  async restart(name) {
    return this.load(name);
  }

  /** Run each app's optional health() probe; fall back to status. */
  async healthReport() {
    const report = {};
    for (const [name, entry] of this.apps) {
      if (entry.status !== 'running') {
        report[name] = { ok: false, status: entry.status, detail: entry.error?.message || null };
        continue;
      }
      if (entry.health) {
        try {
          const r = await entry.health();
          report[name] = { ok: !!r?.ok, status: 'running', detail: r?.detail ?? null };
        } catch (err) {
          report[name] = { ok: false, status: 'running', detail: `health() threw: ${err.message}` };
        }
      } else {
        report[name] = { ok: true, status: 'running', detail: null };
      }
    }
    return report;
  }

  #setError(name, err) {
    this.apps.set(name, {
      name,
      meta: { name, description: '(failed to load)', version: '0.0.0' },
      router: (req, res) => res.status(500).send(err.message),
      health: null,
      status: 'errored',
      error: { message: err.message },
      startedAt: null,
    });
  }
}

/** @typedef {{ name: string, meta: object, router: Function, health: Function|null, status: string, error: object|null, startedAt: string|null }} AppEntry */
