import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Append-only usage event log — correlates every skill/agent invocation, LLM
 * call, and build-time standards check back to the component that triggered
 * it. One JSON object per line (not jsonStore: these are high-frequency
 * appends, not named records you look up by id).
 *
 * Read side is deliberately just array filtering — at this volume a query
 * DSL would be solving a problem that doesn't exist yet.
 *
 * Event shape: { ts, kind, id, owner?, ok, ms?, calledBy?, meta? }
 *   kind: 'skill' | 'agent' | 'llm' | 'standards-check'
 */
export function usageLog({ dataDir }) {
  const file = path.join(dataDir, 'usage.jsonl');

  async function append(event) {
    const line = JSON.stringify({ ts: new Date().toISOString(), ...event });
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.appendFile(file, line + '\n', 'utf8');
  }

  async function all() {
    let raw;
    try {
      raw = await fs.readFile(file, 'utf8');
    } catch {
      return [];
    }
    return raw
      .split('\n')
      .filter(Boolean)
      .map((l) => {
        try { return JSON.parse(l); } catch { return null; }
      })
      .filter(Boolean);
  }

  /** Usage rollup per (kind, owner, id) — what the registry cards display. */
  async function summary() {
    const events = await all();
    const byKey = new Map();
    for (const e of events) {
      const key = `${e.kind}:${e.owner || ''}:${e.id}`;
      const s = byKey.get(key) || { kind: e.kind, owner: e.owner, id: e.id, count: 0, errors: 0, lastAt: null };
      s.count++;
      if (e.ok === false) s.errors++;
      if (!s.lastAt || e.ts > s.lastAt) s.lastAt = e.ts;
      byKey.set(key, s);
    }
    return [...byKey.values()];
  }

  /** Wraps an async fn so every call is logged as one invocation event. */
  function track(kind, { id, owner, calledBy } = {}) {
    return async (fn) => {
      const start = Date.now();
      try {
        const result = await fn();
        await append({ kind, id, owner, calledBy, ok: true, ms: Date.now() - start });
        return result;
      } catch (err) {
        await append({ kind, id, owner, calledBy, ok: false, ms: Date.now() - start, meta: { error: err.message } });
        throw err;
      }
    };
  }

  /** Wraps a provider so every complete() call is logged, tagged with the caller. */
  function withCaller(provider, calledBy) {
    return {
      ...provider,
      complete: (args) => track('llm', { id: provider.name, calledBy })(() => provider.complete(args)),
    };
  }

  return { file, append, all, summary, track, withCaller };
}
