import fs from 'node:fs/promises';
import path from 'node:path';
import { codeStore } from './store.js';

/**
 * Claude Engine leases the right to manage skills/agents owned by other
 * sandbox apps: each owner keeps its own folder (and runs its own copy at
 * request time), the engine just gets a codeStore pointed at it so it can
 * craft/compose across owners from one workbench.
 *
 * Owner dirs are `apps/<app>/<kind>/` for every app, plus the engine's own
 * `data/<kind>/`. A missing folder is fine — codeStore creates it lazily on
 * first save.
 */
export async function discoverOwners({ appsDir, engineOwner, engineDir, kind, suffix }) {
  const owners = { [engineOwner]: codeStore({ dir: engineDir, suffix }) };
  let dirents = [];
  try {
    dirents = await fs.readdir(appsDir, { withFileTypes: true });
  } catch {
    return owners;
  }
  for (const d of dirents) {
    if (!d.isDirectory() || d.name.startsWith('.') || d.name.startsWith('_') || d.name === engineOwner) continue;
    owners[d.name] = codeStore({ dir: path.join(appsDir, d.name, kind), suffix });
  }
  return owners;
}

/** Merges per-owner codeStores into one store keyed by (owner, id). */
export function multiStore(owners) {
  const of = (owner) => {
    const store = owners[owner];
    if (!store) throw new Error(`unknown owner "${owner}"`);
    return store;
  };

  async function list() {
    const out = [];
    for (const [owner, store] of Object.entries(owners)) {
      for (const rec of await store.list()) out.push({ ...rec, owner });
    }
    return out.sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
  }

  return {
    owners: Object.keys(owners),
    list,
    get: (owner, id) => of(owner).get(id),
    source: (owner, id) => of(owner).source(id),
    save: (owner, id, code) => of(owner).save(id, code),
    remove: (owner, id) => of(owner).remove(id),
  };
}
