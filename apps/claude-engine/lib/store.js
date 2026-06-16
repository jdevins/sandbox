import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const slug = (s) =>
  String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);

/**
 * Code-first store: each record is an executable ES module on disk
 * (e.g. data/skills/<id>.skill.js). This is deliberate — the engine prefers
 * repeatable functionality as code over markdown. Modules are imported with a
 * cache-busting query so edits/restarts pick up new code and state.
 *
 * Each module must `export const definition = { id, name, ... }`.
 */
export function codeStore({ dir, suffix }) {
  const file = (id) => path.join(dir, `${slug(id)}${suffix}`);

  async function ensure() {
    await fs.mkdir(dir, { recursive: true });
  }

  async function ids() {
    await ensure();
    const names = await fs.readdir(dir);
    return names.filter((n) => n.endsWith(suffix)).map((n) => n.slice(0, -suffix.length));
  }

  async function load(id) {
    const url = pathToFileURL(file(id)).href + `?v=${Date.now()}`;
    return import(url);
  }

  async function get(id) {
    const mod = await load(id);
    return { id, definition: mod.definition || { id }, module: mod };
  }

  async function list() {
    const out = [];
    for (const id of await ids()) {
      try {
        const { definition } = await get(id);
        out.push({ id, ...definition });
      } catch (err) {
        out.push({ id, name: id, broken: true, error: err.message });
      }
    }
    return out.sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
  }

  async function source(id) {
    return fs.readFile(file(id), 'utf8');
  }

  async function save(id, code) {
    await ensure();
    await fs.writeFile(file(id), code, 'utf8');
    return id;
  }

  async function remove(id) {
    await fs.rm(file(id), { force: true });
  }

  async function exists(id) {
    try { await fs.access(file(id)); return true; } catch { return false; }
  }

  return { dir, suffix, ids, list, get, load, source, save, remove, exists, file };
}

/** Simple JSON-record store: one .json file per record under dir. */
export function jsonStore({ dir }) {
  const file = (id) => path.join(dir, `${slug(id)}.json`);

  async function ensure() { await fs.mkdir(dir, { recursive: true }); }

  async function list() {
    await ensure();
    const names = (await fs.readdir(dir)).filter((n) => n.endsWith('.json'));
    const out = [];
    for (const n of names) {
      try { out.push(JSON.parse(await fs.readFile(path.join(dir, n), 'utf8'))); } catch {}
    }
    return out.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }

  async function get(id) {
    return JSON.parse(await fs.readFile(file(id), 'utf8'));
  }

  async function save(record) {
    await ensure();
    const id = record.id || slug(record.name || `rec-${Date.now()}`);
    const full = { id, createdAt: new Date().toISOString(), ...record, id };
    await fs.writeFile(file(id), JSON.stringify(full, null, 2), 'utf8');
    return full;
  }

  async function remove(id) { await fs.rm(file(id), { force: true }); }

  return { dir, list, get, save, remove, file };
}
