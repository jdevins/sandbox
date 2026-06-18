import { stepToward, pickCell, manhattan } from '../lib/grid.js';

// A self-sufficient builder: load pieces into its backpack, carry them to
// targets, place them, repeat. The single-agent baseline — it does every
// sub-task itself, in sequence.
//
// decide(perception, ctx) -> { tool, args, rationale }
// Strategy knobs (editable in the UI):
//   pick: 'nearest' | 'farthest'                 — which loose piece to grab
//   fill: 'nearest' | 'bottom-up' | 'top-down'   — which empty cell to fill next
//   capacity: number                             — backpack size (context window)
//   deliver: 'nearest' | 'full' | 'half'         — when to stop gathering and deliver

export const definition = {
  id: 'builder',
  name: 'Builder',
  role: 'builder',
  strategy: { pick: 'nearest', fill: 'nearest', capacity: 3, deliver: 'nearest' },
};

export function decide(p, _ctx) {
  const me = p.self;
  const cap = me.capacity;
  const load = me.load;
  const empty = p.view.targets.filter((t) => !t.filled);
  const loose = p.view.loose;

  const target = empty.length ? pickCell(empty, me, me.strategy.fill || 'nearest') : null;
  const piece = loose.length ? pickCell(loose, me, me.strategy.pick === 'farthest' ? 'farthest' : 'nearest') : null;

  if (deliverNow({ me, load, cap, loose, target, piece, deliver: me.strategy.deliver }) && target) {
    if (me.x === target.x && me.y === target.y) {
      return { tool: 'place', args: { x: target.x, y: target.y }, rationale: `place piece at (${target.x},${target.y})` };
    }
    return { tool: 'move', args: stepToward(me, target), rationale: `deliver to (${target.x},${target.y}) · carrying ${load}/${cap}` };
  }

  if (load < cap && piece) {
    if (me.x === piece.x && me.y === piece.y) {
      return { tool: 'pickup', args: { pieceId: piece.id }, rationale: `load piece #${piece.id} (${load}/${cap})` };
    }
    return { tool: 'move', args: stepToward(me, piece), rationale: `go to piece #${piece.id} at (${piece.x},${piece.y})` };
  }

  if (load > 0 && target) {
    if (me.x === target.x && me.y === target.y) return { tool: 'place', args: { x: target.x, y: target.y }, rationale: `place last piece at (${target.x},${target.y})` };
    return { tool: 'move', args: stepToward(me, target), rationale: `carry remainder to (${target.x},${target.y})` };
  }

  return { tool: 'observe', args: { note: 'nothing to do' }, rationale: load ? 'waiting — no open cells' : 'waiting for materials' };
}

// Shared gather-vs-deliver decision (also used by the fetcher).
export function deliverNow({ me, load, cap, loose, target, piece, deliver = 'nearest' }) {
  if (load === 0) return false;
  if (!target) return false;
  if (load >= cap) return true; // backpack full — must deliver
  if (!loose.length || !piece) return true; // nothing left to gather
  if (deliver === 'full') return false;
  if (deliver === 'half') return load >= Math.ceil(cap / 2);
  // 'nearest' (reachable): deliver when a target is at least as close as the next piece
  return manhattan(me, target) <= manhattan(me, piece);
}
