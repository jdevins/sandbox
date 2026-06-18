import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { mulberry32 } from './rng.js';
import { builtinTools, toolCatalog } from './tools.js';

// The tick engine. Runs a scenario + a roster of embodied agents in a throttled,
// pausable, replayable loop — entirely server-side (so future tools that must run
// in Node, like Playwright, slot in without moving the loop to the browser).
//
// It emits events to a single `onEvent(type, data)` sink; the feature router
// fans those out to SSE clients. Events:
//   log    — one per worker action  { tick, agent, tool, rationale, detail, ok }
//   frame  — full render snapshot after each tick
//   status — { running }
//   done   — { score, ticks, stalled? }

const MAX_TICKS = 4000;
const STALL_TICKS = 300; // ticks with no successful pickup/place before giving up

const DEFAULT_ECONOMY = { budget: 1600, holdCost: 1, moveCost: 1 };

export async function createEngine(opts) {
  const engine = new FoundryEngine(opts);
  await engine.loadAgents();
  engine.init();
  return engine;
}

class FoundryEngine {
  constructor({ scenario, configName, workerOverrides = [], roster = null, throttle = 300, agentsDir, seed = 1234, budget = null }) {
    this.scenario = scenario;
    this.configName = configName;
    this.overrides = workerOverrides;
    this.fullRoster = roster && roster.length ? roster : null;
    this.throttle = clamp(toMs(throttle, 300), 0, 3000);
    this.agentsDir = agentsDir;
    this.seed = seed;
    this.econ = { ...DEFAULT_ECONOMY, ...(scenario.economy || {}) };
    this.budgetOverride = budget == null ? null : Number(budget);
    this.onEvent = () => {};
    this.tools = builtinTools;
    this.toolList = toolCatalog;
    this.agents = {}; // agentId -> { decide }
    this.timer = null;
    this.running = false;
    this.agentVersion = 0;
  }

  // Build the worker roster. A full roster from the UI (composable: any roles,
  // any count) wins; otherwise fall back to the named preset, applying per-worker
  // overrides (rename, role/agent change, edited strategy) matched by id.
  roster() {
    if (this.fullRoster) {
      return this.fullRoster.map((w) => ({
        id: w.id,
        agent: w.agent,
        role: w.role || w.agent,
        name: w.name || w.agent,
        strategy: { ...(w.strategy || {}) },
      }));
    }
    const config = this.scenario.configs[this.configName] || [];
    return config.map((w) => {
      const ov = this.overrides.find((o) => o.id === w.id) || {};
      return {
        ...w,
        agent: ov.agent || w.agent,
        role: ov.role || w.role,
        name: ov.name || w.name,
        strategy: { ...(w.strategy || {}), ...(ov.strategy || {}) },
      };
    });
  }

  async loadAgents() {
    this.agentVersion++;
    const ids = [...new Set(this.roster().map((w) => w.agent).filter(Boolean))];
    for (const id of ids) {
      const file = path.join(this.agentsDir, `${id}.agent.js`);
      const url = pathToFileURL(file).href + `?v=${this.agentVersion}`; // cache-bust so edits hot-reload on replay
      try {
        this.agents[id] = await import(url);
      } catch {
        this.agents[id] = null; // unknown agent type → that worker just observes
      }
    }
  }

  // (Re)build the world from the seed. Deterministic, so replay reproduces it.
  init() {
    this.stop();
    const rng = mulberry32(this.seed);
    const built = this.scenario.build(rng);
    const depots = built.depots || [{ x: 0, y: 0 }];
    const workers = this.roster().map((w, i) => {
      const d = depots[i % depots.length];
      const capacity = Math.max(1, Number(w.strategy?.capacity) || 1);
      return { ...w, x: d.x, y: d.y, backpack: [], capacity };
    });
    const total = this.budgetOverride != null ? this.budgetOverride : this.econ.budget;
    this.state = {
      grid: built.grid,
      pieces: built.pieces,
      targets: built.targets,
      workers,
      blackboard: { assignments: {} },
      budget: { total, remaining: total, spentHold: 0, spentMove: 0 },
      tick: 0,
      done: false,
    };
    this.lastActiveTick = 0;
  }

  emit(type, data) {
    this.onEvent(type, data);
  }

  score() {
    const placed = new Set(
      this.state.pieces.filter((p) => p.placed).map((p) => `${p.x},${p.y}`),
    );
    const filled = this.state.targets.filter((t) => placed.has(`${t.x},${t.y}`)).length;
    return Math.round((filled / this.state.targets.length) * 100);
  }

  buildPerception(w) {
    const s = this.state;
    const placed = new Set(s.pieces.filter((p) => p.placed).map((p) => `${p.x},${p.y}`));
    const targets = s.targets.map((t) => ({ x: t.x, y: t.y, filled: placed.has(`${t.x},${t.y}`) }));
    const loose = s.pieces
      .filter((p) => !p.placed && !p.carriedBy)
      .map((p) => ({ id: p.id, x: p.x, y: p.y, color: p.color }));
    const workers = s.workers.map((o) => ({
      id: o.id, name: o.name, role: o.role, x: o.x, y: o.y,
      load: o.backpack.length, capacity: o.capacity,
    }));
    return {
      tick: s.tick,
      grid: s.grid,
      budget: { ...s.budget },
      self: {
        id: w.id, name: w.name, role: w.role, x: w.x, y: w.y,
        load: w.backpack.length, capacity: w.capacity, strategy: w.strategy,
        assignedTarget: s.blackboard.assignments[w.id] || null,
      },
      tools: this.toolList,
      view: { loose, targets, workers, blackboard: s.blackboard },
    };
  }

  tick() {
    const s = this.state;
    if (s.done) return;
    s.tick++;

    // Workers act in roster order; perception is rebuilt per worker so an
    // orchestrator's assignment is visible to fetchers within the same tick.
    let moves = 0;
    for (const w of s.workers) {
      const agent = this.agents[w.agent];
      let action;
      try {
        action = (agent && agent.decide(this.buildPerception(w), {})) || {
          tool: 'observe', args: { note: 'idle' }, rationale: 'no decision',
        };
      } catch (err) {
        action = { tool: 'observe', args: { note: 'error' }, rationale: `decide() threw: ${err.message}` };
      }
      const tool = this.tools[action.tool];
      const result = tool
        ? tool(s, w, action.args || {})
        : { ok: false, detail: `unknown tool "${action.tool}"` };
      if (result.ok && action.tool === 'move') moves++;
      if (result.meaningful && result.ok && action.tool !== 'move') this.lastActiveTick = s.tick;
      this.emit('log', {
        tick: s.tick,
        agent: { id: w.id, name: w.name, role: w.role },
        tool: action.tool,
        rationale: action.rationale || '',
        detail: result.detail,
        ok: result.ok,
      });
    }

    // Token budget: every carried piece costs to hold each tick (this is what
    // punishes hoarding), and every step costs a little. Run ends when spent.
    const held = s.workers.reduce((n, w) => n + w.backpack.length, 0);
    const holdSpend = held * this.econ.holdCost;
    const moveSpend = moves * this.econ.moveCost;
    s.budget.remaining = Math.max(0, s.budget.remaining - holdSpend - moveSpend);
    s.budget.spentHold += holdSpend;
    s.budget.spentMove += moveSpend;

    const score = this.score();
    this.emit('frame', this.frame(score));

    if (score >= 100 || s.done) {
      s.done = true;
      this.emit('done', { score, ticks: s.tick, budget: s.budget });
      this.stop();
    } else if (s.budget.remaining <= 0) {
      s.done = true;
      this.emit('done', { score, ticks: s.tick, budget: s.budget, overBudget: true });
      this.stop();
    } else if (s.tick >= MAX_TICKS || s.tick - this.lastActiveTick > STALL_TICKS) {
      s.done = true;
      this.emit('done', { score, ticks: s.tick, budget: s.budget, stalled: true });
      this.stop();
    }
  }

  frame(score = this.score()) {
    const s = this.state;
    const placed = new Set(s.pieces.filter((p) => p.placed).map((p) => `${p.x},${p.y}`));
    const byId = new Map(s.pieces.map((p) => [p.id, p]));
    return {
      tick: s.tick,
      score,
      done: s.done,
      grid: s.grid,
      budget: { ...s.budget },
      pieces: s.pieces.map((p) => ({
        id: p.id, x: p.x, y: p.y, placed: p.placed,
        carried: !!p.carriedBy, placedBy: p.placedBy || null,
      })),
      targets: s.targets.map((t) => ({ x: t.x, y: t.y, filled: placed.has(`${t.x},${t.y}`) })),
      workers: s.workers.map((w) => ({
        id: w.id, name: w.name, role: w.role, x: w.x, y: w.y,
        load: w.backpack.length, capacity: w.capacity,
        // What's in the backpack right now — scenarios can attach their own
        // display fields to a piece (here: a `color`/type) and they ride along.
        carrying: w.backpack.map((id) => {
          const p = byId.get(id);
          return { id, color: p ? p.color : 'raw' };
        }),
      })),
    };
  }

  // ---- run controls ----
  start() {
    if (this.timer || this.state.done) return;
    this.running = true;
    this.emit('status', { running: true });
    this.schedule();
  }

  schedule() {
    this.timer = setTimeout(() => {
      this.timer = null;
      if (!this.running) return;
      this.tick();
      if (this.running && !this.state.done) this.schedule();
    }, this.throttle);
  }

  pause() {
    this.running = false;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    this.emit('status', { running: false });
  }

  resume() {
    if (this.running || this.state.done) return;
    this.running = true;
    this.emit('status', { running: true });
    this.schedule();
  }

  step() {
    if (this.state.done) return;
    this.tick();
  }

  setThrottle(ms) {
    this.throttle = clamp(toMs(ms, 0), 0, 3000);
  }

  async replay() {
    this.stop();
    await this.loadAgents(); // pick up any hand-edited agent code
    this.init();
    this.emit('frame', this.frame());
    this.emit('status', { running: false });
  }

  stop() {
    this.running = false;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
  }
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

// Parse a throttle value, preserving an explicit 0 (max speed) rather than
// letting `|| default` swallow it.
function toMs(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
