// Tool registry — the ONLY way an agent affects the world.
//
// Every capability is a registered tool, including movement. Agents emit an
// abstract action envelope { tool, args, rationale }; the engine looks the tool
// up here and applies it. This is the seam that keeps future capabilities
// (web fetch, Playwright, MCP calls, writing files) additive: register another
// tool, no change to the loop or the agents that don't use it.
//
// A tool is: (state, worker, args) => { ok, detail, meaningful? }. It mutates
// `state`. Token costs are accounted centrally in the engine, not here.
//
// Carrying model: a worker has a `backpack` (array of piece ids) up to
// `capacity`. This is the analog of an agent's context window — it can hold
// several things at once, which is what makes the budget trade-off matter.

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

const pieceById = (state, id) => state.pieces.find((p) => p.id === id);
const placedAt = (state, x, y) =>
  state.pieces.some((p) => p.placed && p.x === x && p.y === y);
const isTarget = (state, x, y) => state.targets.some((t) => t.x === x && t.y === y);

export const builtinTools = {
  move(state, w, { dx = 0, dy = 0 } = {}) {
    const nx = clamp(w.x + dx, 0, state.grid.w - 1);
    const ny = clamp(w.y + dy, 0, state.grid.h - 1);
    w.x = nx;
    w.y = ny;
    for (const id of w.backpack) {
      const p = pieceById(state, id);
      if (p) { p.x = nx; p.y = ny; }
    }
    return { ok: true, detail: `→ (${nx},${ny})`, meaningful: true };
  },

  pickup(state, w, { pieceId } = {}) {
    if (w.backpack.length >= w.capacity) return { ok: false, detail: `backpack full (${w.capacity})` };
    const p = pieceById(state, pieceId);
    if (!p || p.placed || p.carriedBy) return { ok: false, detail: `#${pieceId} unavailable` };
    if (p.x !== w.x || p.y !== w.y) return { ok: false, detail: 'not standing on piece' };
    w.backpack.push(pieceId);
    p.carriedBy = w.id;
    return { ok: true, detail: `loaded #${pieceId} (${w.backpack.length}/${w.capacity})`, meaningful: true };
  },

  place(state, w, { x, y } = {}) {
    if (!w.backpack.length) return { ok: false, detail: 'backpack empty' };
    if (w.x !== x || w.y !== y) return { ok: false, detail: 'not at target cell' };
    if (!isTarget(state, x, y)) return { ok: false, detail: `(${x},${y}) is not a target` };
    if (placedAt(state, x, y)) return { ok: false, detail: 'cell already filled' };
    const id = w.backpack.shift(); // FIFO: place the oldest carried piece
    const p = pieceById(state, id);
    p.placed = true;
    p.x = x;
    p.y = y;
    p.placedBy = w.id;
    p.carriedBy = null;
    return { ok: true, detail: `placed #${id} at (${x},${y})`, meaningful: true };
  },

  // Coordination tool: an orchestrator writes a target onto the shared
  // blackboard for a worker (or clears it with target=null).
  assign(state, w, { worker, target } = {}) {
    if (target) {
      state.blackboard.assignments[worker] = { x: target.x, y: target.y };
      return { ok: true, detail: `${worker} → (${target.x},${target.y})` };
    }
    delete state.blackboard.assignments[worker];
    return { ok: true, detail: `cleared ${worker}` };
  },

  // No-effect tool: the agent looked but chose not to act this tick.
  observe(state, w, { note } = {}) {
    return { ok: true, detail: note || 'scan' };
  },

  // Evaluator tool: confirm progress; may declare the mission complete.
  inspect(state, w, { done } = {}) {
    if (done) state.done = true;
    return { ok: true, detail: done ? 'verified complete' : 'in progress' };
  },
};

// Discoverable tool list handed to agents each tick (the "what can I do" view —
// the same mental model as a real tool/MCP catalog).
export const toolCatalog = [
  { name: 'move', description: 'step one cell (dx,dy)' },
  { name: 'pickup', description: 'load a loose piece you stand on into your backpack' },
  { name: 'place', description: 'place one carried piece on a target cell' },
  { name: 'assign', description: 'assign a target to a worker (orchestration)' },
  { name: 'observe', description: 'look without acting' },
  { name: 'inspect', description: 'verify progress / completion' },
];
