import fs from 'node:fs/promises';
import path from 'node:path';
import { APP_DIR } from './env.js';

// Persistent run log. One JSON file per run under data/runs/ (gitignored).
const RUNS_DIR = path.join(APP_DIR, 'data', 'runs');

// Keep only the newest N run files so the log can't grow without bound. Run ids
// start with an ISO timestamp, so lexical filename order == chronological order.
const MAX_RUNS = 100;

export async function save(record) {
  if (!record?.id) throw new Error('run record needs an id');
  await fs.mkdir(RUNS_DIR, { recursive: true });
  await fs.writeFile(path.join(RUNS_DIR, `${path.basename(record.id)}.json`), JSON.stringify(record, null, 2));
  await prune();
  return record.id;
}

async function prune() {
  let names = (await fs.readdir(RUNS_DIR)).filter((n) => n.endsWith('.json'));
  if (names.length <= MAX_RUNS) return;
  names.sort(); // oldest first
  for (const n of names.slice(0, names.length - MAX_RUNS)) {
    await fs.rm(path.join(RUNS_DIR, n)).catch(() => {});
  }
}

export async function get(id) {
  try {
    return JSON.parse(await fs.readFile(path.join(RUNS_DIR, `${path.basename(id)}.json`), 'utf8'));
  } catch {
    return null;
  }
}

/** Newest-first list of run summaries (no per-item detail). */
export async function list() {
  let names = [];
  try {
    names = (await fs.readdir(RUNS_DIR)).filter((n) => n.endsWith('.json'));
  } catch {
    return [];
  }
  const runs = [];
  for (const n of names) {
    try {
      const r = JSON.parse(await fs.readFile(path.join(RUNS_DIR, n), 'utf8'));
      const { items, ...summary } = r;
      runs.push(summary);
    } catch {
      // skip unreadable
    }
  }
  runs.sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)));
  return runs;
}
