import { stepToward, pickCell } from '../lib/grid.js';
import { deliverNow } from './builder.agent.js';

// A fetcher worker in the crew. Like the builder it loads a backpack and
// delivers, but it prefers the cell the foreman assigned it via the shared
// blackboard, falling back to the nearest open cell. With a backpack, a fetcher
// can serve several cells per trip — so the foreman's job shifts from micro-
// managing every piece toward keeping the crew pointed at open work.
//
// Strategy knobs:
//   pick: 'nearest' | 'farthest'
//   capacity: number
//   deliver: 'nearest' | 'full' | 'half'

export const definition = {
  id: 'fetcher',
  name: 'Fetcher',
  role: 'fetcher',
  strategy: { pick: 'nearest', capacity: 3, deliver: 'nearest' },
};

export function decide(p, _ctx) {
  const me = p.self;
  const cap = me.capacity;
  const load = me.load;
  const empty = p.view.targets.filter((t) => !t.filled);
  const loose = p.view.loose;

  // Prefer the assigned cell if it is still open, else the nearest open cell.
  const assigned = me.assignedTarget && empty.find((t) => t.x === me.assignedTarget.x && t.y === me.assignedTarget.y);
  const target = assigned || (empty.length ? pickCell(empty, me, 'nearest') : null);
  const piece = loose.length ? pickCell(loose, me, me.strategy.pick === 'farthest' ? 'farthest' : 'nearest') : null;

  if (deliverNow({ me, load, cap, loose, target, piece, deliver: me.strategy.deliver }) && target) {
    if (me.x === target.x && me.y === target.y) {
      return { tool: 'place', args: { x: target.x, y: target.y }, rationale: `lay piece at ${assigned ? 'assigned ' : ''}(${target.x},${target.y})` };
    }
    return { tool: 'move', args: stepToward(me, target), rationale: `haul to (${target.x},${target.y}) · carrying ${load}/${cap}` };
  }

  if (load < cap && piece) {
    if (me.x === piece.x && me.y === piece.y) {
      return { tool: 'pickup', args: { pieceId: piece.id }, rationale: `grab #${piece.id} (${load}/${cap})` };
    }
    return { tool: 'move', args: stepToward(me, piece), rationale: `fetch #${piece.id} at (${piece.x},${piece.y})` };
  }

  if (load > 0 && target) {
    if (me.x === target.x && me.y === target.y) return { tool: 'place', args: { x: target.x, y: target.y }, rationale: `lay last piece at (${target.x},${target.y})` };
    return { tool: 'move', args: stepToward(me, target), rationale: `haul remainder to (${target.x},${target.y})` };
  }

  return { tool: 'observe', args: { note: 'idle' }, rationale: load ? 'holding — no open cells' : 'no materials available' };
}
