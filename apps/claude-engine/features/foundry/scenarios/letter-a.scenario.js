// Scenario: target-fill the letter "A".
//
// A scenario is the pluggable unit. It owns the world (grid, raw pieces, goal)
// and the agent roster configs — but NOT the chrome (canvas, controls, log),
// which the shell provides, so every scenario feels the same to operate.
//
// The target shape is authored as string-art so it's trivial to hand-edit.

const ART = [
  '.XXX.',
  'X...X',
  'X...X',
  'XXXXX',
  'X...X',
  'X...X',
  'X...X',
];

const GRID = { w: 14, h: 12 };
const OFFSET = { x: 5, y: 2 }; // where the letter sits in the grid

function targetCells() {
  const cells = [];
  ART.forEach((row, r) => {
    [...row].forEach((ch, c) => {
      if (ch === 'X') cells.push({ x: OFFSET.x + c, y: OFFSET.y + r });
    });
  });
  return cells;
}

const DEPOTS = [
  { x: 1, y: 11 },
  { x: 2, y: 11 },
  { x: 3, y: 11 },
  { x: 1, y: 10 },
];

export const definition = {
  id: 'letter-a',
  name: 'Build the letter A',
  description:
    'Loose pieces are scattered across the box. Agents must carry them onto the ' +
    'target cells until the letter A is complete. Score = % of target cells filled.',
  grid: GRID,
};

// Token economy. A worker's backpack (its context window) lets it carry several
// pieces, but every held piece costs `holdCost` each tick and every step costs
// `moveCost`. The run fails if the budget is spent before the letter is done —
// so hauling a full backpack across the map is a real, punishable trade-off.
export const economy = { budget: 1600, holdCost: 1, moveCost: 1 };

// Deterministic world build from a seeded rng (so replay reproduces it exactly).
export function build(rng) {
  const targets = targetCells();
  const blocked = new Set([
    ...targets.map((t) => `${t.x},${t.y}`),
    ...DEPOTS.map((d) => `${d.x},${d.y}`),
  ]);

  // Scatter exactly one loose piece per target cell, on free cells.
  const free = [];
  for (let y = 0; y < GRID.h; y++) {
    for (let x = 0; x < GRID.w; x++) {
      if (!blocked.has(`${x},${y}`)) free.push({ x, y });
    }
  }
  // Fisher–Yates with the seeded rng.
  for (let i = free.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [free[i], free[j]] = [free[j], free[i]];
  }
  const pieces = targets.map((_, i) => ({
    id: i + 1,
    x: free[i].x,
    y: free[i].y,
    color: 'raw',
    placed: false,
    carriedBy: null,
    placedBy: null,
  }));

  return { grid: GRID, targets, pieces, depots: DEPOTS };
}

// Two run configs on the same world: a lone builder vs a coordinated crew.
export const configs = {
  solo: [
    { id: 'mason', agent: 'builder', name: 'Mason', role: 'builder', strategy: { pick: 'nearest', fill: 'nearest', capacity: 3, deliver: 'nearest' } },
  ],
  crew: [
    { id: 'otis', agent: 'foreman', name: 'Otis', role: 'foreman', strategy: { assign: 'nearest' } },
    { id: 'dot', agent: 'fetcher', name: 'Dot', role: 'fetcher', strategy: { pick: 'nearest', capacity: 3, deliver: 'nearest' } },
    { id: 'pip', agent: 'fetcher', name: 'Pip', role: 'fetcher', strategy: { pick: 'nearest', capacity: 3, deliver: 'nearest' } },
    { id: 'vera', agent: 'inspector', name: 'Vera', role: 'inspector', strategy: {} },
  ],
};
