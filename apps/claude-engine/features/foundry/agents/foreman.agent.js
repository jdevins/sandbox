import { manhattan, pickCell } from '../lib/grid.js';

// The foreman is the ORCHESTRATOR. It never moves or carries — it watches the
// crew and the board, then assigns empty target cells to free fetchers via the
// blackboard. This is the heart of the multi-agent pattern: the leverage is in
// how it delegates, not in any single worker.
//
// Strategy knobs:
//   assign: 'nearest' | 'round-robin'
//     nearest      — give each free fetcher the open cell closest to it
//     round-robin  — hand out work in worker order regardless of distance

export const definition = {
  id: 'foreman',
  name: 'Foreman',
  role: 'foreman',
  strategy: { assign: 'nearest' },
};

export function decide(p, _ctx) {
  const me = p.self;
  const assignments = p.view.blackboard.assignments || {};
  const fetchers = p.view.workers.filter((w) => w.role === 'fetcher');
  const empty = p.view.targets.filter((t) => !t.filled);

  // 1. Clear any assignment whose target is now filled (frees the fetcher).
  for (const w of fetchers) {
    const a = assignments[w.id];
    if (a && !empty.some((t) => t.x === a.x && t.y === a.y)) {
      return { tool: 'assign', args: { worker: w.id, target: null }, rationale: `clear ${w.name}'s completed assignment` };
    }
  }

  // 2. Assign one un-tasked fetcher to an open, unclaimed cell.
  const taken = new Set(
    Object.values(assignments).filter(Boolean).map((t) => `${t.x},${t.y}`),
  );
  const free = empty.filter((t) => !taken.has(`${t.x},${t.y}`));
  const need = fetchers.filter((w) => !assignments[w.id]);

  if (!need.length || !free.length) {
    return { tool: 'observe', args: { note: 'supervising' }, rationale: `crew tasked · ${empty.length} cells open` };
  }

  let worker;
  if ((me.strategy.assign || 'nearest') === 'round-robin') {
    worker = need[0];
  } else {
    worker = need
      .map((w) => ({ w, d: Math.min(...free.map((t) => manhattan(w, t))) }))
      .sort((a, b) => a.d - b.d)[0].w;
  }
  const target = pickCell(free, worker, 'nearest');
  return {
    tool: 'assign',
    args: { worker: worker.id, target: { x: target.x, y: target.y } },
    rationale: `assign ${worker.name} → (${target.x},${target.y})`,
  };
}
