// Grid geometry helpers shared by agent modules. Pure functions — no state —
// so an agent's decide() stays a clean perception -> action mapping.

export const manhattan = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

const sign = (n) => (n > 0 ? 1 : n < 0 ? -1 : 0);

/**
 * One grid step from `from` toward `to`, moving along the larger remaining axis
 * (so workers walk the grid one cell at a time — legible to watch, never diagonal).
 */
export function stepToward(from, to) {
  const ax = to.x - from.x;
  const ay = to.y - from.y;
  if (Math.abs(ax) >= Math.abs(ay)) return { dx: sign(ax), dy: 0 };
  return { dx: 0, dy: sign(ay) };
}

/**
 * Choose one cell from `cells` relative to `from`.
 * mode: 'nearest' | 'farthest' | 'bottom-up' | 'top-down'
 * Ties (and the secondary key for bottom-up/top-down) break on nearest.
 */
export function pickCell(cells, from, mode = 'nearest') {
  if (!cells.length) return null;
  const byDist = (a, b) => manhattan(a, from) - manhattan(b, from);
  const sorted = [...cells];
  switch (mode) {
    case 'farthest':
      sorted.sort((a, b) => manhattan(b, from) - manhattan(a, from));
      break;
    case 'bottom-up':
      sorted.sort((a, b) => b.y - a.y || byDist(a, b));
      break;
    case 'top-down':
      sorted.sort((a, b) => a.y - b.y || byDist(a, b));
      break;
    default:
      sorted.sort(byDist);
  }
  return sorted[0];
}
