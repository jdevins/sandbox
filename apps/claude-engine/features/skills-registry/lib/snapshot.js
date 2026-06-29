// Generic before/after snapshot of a directory tree, used to make Test runs
// undoable without any cooperation from the skill being run — the registry
// wraps the skill, the skill stays unaware it's being watched.

import fs from 'node:fs/promises';
import path from 'node:path';

async function walk(dir, base = dir, out = []) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    const rel = path.relative(base, full);
    if (e.isDirectory()) {
      out.push({ rel, isDir: true });
      await walk(full, base, out);
    } else {
      let content = null;
      try {
        content = await fs.readFile(full, 'utf8');
      } catch {
        /* binary or unreadable — treated as opaque, not diffable */
      }
      out.push({ rel, isDir: false, content });
    }
  }
  return out;
}

export async function snapshot(dir) {
  const entries = await walk(dir);
  const map = new Map();
  for (const e of entries) map.set(e.rel, e);
  return map;
}

/** Diff two snapshots into an undo manifest. */
export function diff(before, after) {
  const created = [];
  const modified = [];
  for (const [rel, entry] of after) {
    if (!before.has(rel)) {
      created.push({ rel, isDir: entry.isDir });
    } else if (!entry.isDir && entry.content !== before.get(rel).content) {
      modified.push({ rel, previousContent: before.get(rel).content });
    }
  }
  // deepest first, so files are removed before the directories that held them
  created.sort((a, b) => b.rel.split(path.sep).length - a.rel.split(path.sep).length);
  return { created, modified };
}

/** Reverses a manifest produced by diff() against the same watch dir. */
export async function undo(dir, manifest) {
  const undone = { removed: [], restored: [], skipped: [] };
  for (const { rel, isDir } of manifest.created) {
    const full = path.join(dir, rel);
    try {
      if (isDir) await fs.rmdir(full);
      else await fs.unlink(full);
      undone.removed.push(rel);
    } catch (err) {
      undone.skipped.push({ rel, reason: err.message });
    }
  }
  for (const { rel, previousContent } of manifest.modified) {
    const full = path.join(dir, rel);
    try {
      await fs.writeFile(full, previousContent ?? '', 'utf8');
      undone.restored.push(rel);
    } catch (err) {
      undone.skipped.push({ rel, reason: err.message });
    }
  }
  return undone;
}
