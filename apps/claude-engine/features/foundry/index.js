import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { html, raw } from '../../lib/html.js';
import { createEngine } from './lib/engine.js';
import { toolCatalog } from './lib/tools.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const meta = {
  name: 'Pixel Foundry',
  description: 'Define a goal, unleash agents on a box of raw pieces, and watch — slowed down — how they build it.',
  icon: '🏗️',
};

// Editable strategy knobs surfaced in the UI, per agent kind. Editing one and
// replaying re-runs the same world so the behavior change is directly observable.
const STRATEGY_SCHEMA = {
  builder: [
    { key: 'pick', label: 'Piece choice', type: 'select', options: ['nearest', 'farthest'] },
    { key: 'fill', label: 'Fill order', type: 'select', options: ['nearest', 'bottom-up', 'top-down'] },
    { key: 'capacity', label: 'Backpack size', type: 'range', min: 1, max: 8, step: 1 },
    { key: 'deliver', label: 'Deliver when', type: 'select', options: ['nearest', 'half', 'full'] },
  ],
  fetcher: [
    { key: 'pick', label: 'Piece choice', type: 'select', options: ['nearest', 'farthest'] },
    { key: 'capacity', label: 'Backpack size', type: 'range', min: 1, max: 8, step: 1 },
    { key: 'deliver', label: 'Deliver when', type: 'select', options: ['nearest', 'half', 'full'] },
  ],
  foreman: [{ key: 'assign', label: 'Assignment policy', type: 'select', options: ['nearest', 'round-robin'] }],
  inspector: [],
};

async function loadScenarios() {
  const dir = path.join(__dirname, 'scenarios');
  const map = {};
  let files = [];
  try {
    files = (await fs.readdir(dir)).filter((f) => f.endsWith('.scenario.js'));
  } catch {
    return map;
  }
  for (const f of files) {
    const mod = await import(pathToFileURL(path.join(dir, f)).href);
    const id = mod.definition?.id || f.replace('.scenario.js', '');
    map[id] = mod;
  }
  return map;
}

// Available agent types (roles) the user can compose a roster from — discovered
// from the agents/ folder, with their default strategy and editable schema.
async function loadAgentTypes(dir) {
  const types = [];
  let files = [];
  try {
    files = (await fs.readdir(dir)).filter((f) => f.endsWith('.agent.js'));
  } catch {
    return types;
  }
  for (const f of files) {
    const id = f.replace('.agent.js', '');
    try {
      const mod = await import(pathToFileURL(path.join(dir, f)).href);
      const def = mod.definition || {};
      types.push({
        id,
        name: def.name || id,
        role: def.role || id,
        strategy: def.strategy || {},
        schema: STRATEGY_SCHEMA[id] || [],
      });
    } catch {
      // skip an agent module that fails to import
    }
  }
  return types.sort((a, b) => a.name.localeCompare(b.name));
}

export async function createFeature(ctx) {
  const { page, base } = ctx;
  const router = express.Router();
  router.use(express.json());
  router.use('/assets', express.static(path.join(__dirname, 'public')));

  const scenarios = await loadScenarios();
  const agentsDir = path.join(__dirname, 'agents');
  const agentTypes = await loadAgentTypes(agentsDir);

  // Live run sessions, keyed by a client-generated id. Ephemeral by design.
  const sessions = new Map();

  const crumb = [{ href: base, label: 'Foundry' }];
  const shell = (title, body, breadcrumb = crumb) =>
    page({ title, active: 'foundry', breadcrumb, body });

  const broadcast = (s, type, data) => {
    const line = `data: ${JSON.stringify({ type, data })}\n\n`;
    for (const res of s.clients) res.write(line);
  };

  // ---- Library ----
  router.get('/', (req, res) => {
    const cards = Object.values(scenarios).map((m) => {
      const d = m.definition;
      const names = Object.keys(m.configs || {}).join(', ');
      return html`<div class="card">
        <div class="row spread"><h2>${d.name}</h2><span class="badge">${d.grid.w}×${d.grid.h}</span></div>
        <div class="desc">${d.description}</div>
        <div class="meta">configs: ${names}</div>
        <div class="row" style="margin-top:14px"><a class="btn primary" href="${base}/${d.id}">Open observatory</a></div>
      </div>`;
    });
    const body = html`
      <header class="eng-head"><div><h1>🏗️ Pixel Foundry</h1>
        <p class="dim">Pick a scenario, choose a single agent or a crew, and watch them assemble the goal from scattered pieces.</p></div></header>
      ${cards.length ? html`<div class="grid">${cards}</div>` : html`<div class="empty">No scenarios found.</div>`}`;
    res.send(shell('Pixel Foundry', body));
  });

  // ---- Observatory page for one scenario ----
  router.get('/:scenario', (req, res) => {
    const mod = scenarios[req.params.scenario];
    if (!mod) return res.send(shell('Missing', html`<div class="empty">No scenario "${req.params.scenario}".</div>`));
    const d = mod.definition;

    const payload = {
      base,
      scenario: d.id,
      grid: d.grid,
      goal: { title: d.name, text: d.description },
      tools: toolCatalog,
      agentTypes,
      economy: { budget: 1600, holdCost: 1, moveCost: 1, ...(mod.economy || {}) },
      configs: Object.fromEntries(
        Object.entries(mod.configs).map(([name, workers]) => [
          name,
          workers.map((w) => ({
            id: w.id, name: w.name, role: w.role, agent: w.agent,
            strategy: w.strategy || {}, schema: STRATEGY_SCHEMA[w.agent] || [],
          })),
        ]),
      ),
    };

    const body = html`
      <header class="eng-head"><div><h1>${d.name}</h1><p class="dim">${d.description}</p></div>
        <div class="row"><a class="btn" href="${base}">← Scenarios</a></div></header>
      ${raw(STYLE)}
      <div id="foundry" class="foundry">
        <div class="card foundry-controls">
          <div class="fc-row">
            <strong>Start from preset</strong>
            <label class="eng-check"><input type="radio" name="config" value="solo" checked/> Solo agent</label>
            <label class="eng-check"><input type="radio" name="config" value="crew"/> Crew (with subagents)</label>
            <button id="btn-add" class="btn" style="margin-left:auto">+ Add agent</button>
          </div>
          <div id="roster-warn" class="fc-warn"></div>
          <div id="workers" class="fc-workers"></div>
          <div class="fc-row">
            <strong>Pace</strong>
            <input id="throttle" type="range" min="0" max="1200" step="50" value="350"/>
            <span id="throttle-val" class="dim">350 ms/tick</span>
            <strong style="margin-left:12px">Token budget</strong>
            <input id="budget" type="range" min="400" max="4000" step="100" value="1600"/>
            <span id="budget-val" class="dim">1600</span>
          </div>
          <div class="fc-row fc-buttons">
            <button id="btn-start" class="btn primary">▶ Start</button>
            <button id="btn-pause" class="btn" disabled>⏸ Pause</button>
            <button id="btn-step" class="btn" disabled>⏭ Step</button>
            <button id="btn-replay" class="btn" disabled>↻ Replay</button>
          </div>
          <div class="fc-row fc-status">
            <span id="status" class="badge stopped">idle</span>
            <span class="dim">tick <b id="tick">0</b></span>
            <span class="dim">score <b id="score">0</b>%</span>
            <span class="fc-budget">
              <span class="dim">budget</span>
              <span class="fc-meter"><span id="budget-bar"></span></span>
              <span class="dim"><b id="budget-left">0</b>/<span id="budget-total">0</span></span>
            </span>
          </div>
        </div>
        <details class="foundry-loop"><summary>How a run works — the loop &amp; what each agent runs</summary>
          <div id="loop-explainer"></div>
        </details>
        <div class="foundry-main">
          <div id="stage" class="foundry-stage"></div>
          <div class="foundry-logwrap">
            <div class="foundry-loghead">Decision log <span class="dim">— first-person, per tick</span></div>
            <div id="log" class="foundry-log"></div>
          </div>
        </div>
      </div>
      ${raw(`<script id="foundry-data" type="application/json">${JSON.stringify(payload)}</script>`)}
      <script src="${base}/assets/foundry.js"></script>`;
    res.send(shell(d.name, body, [...crumb, { href: `${base}/${d.id}`, label: d.name }]));
  });

  // ---- SSE stream ----
  router.get('/:scenario/stream', (req, res) => {
    const sid = req.query.sid;
    if (!sid) return res.status(400).end();
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write(': connected\n\n');

    let s = sessions.get(sid);
    if (!s) { s = { engine: null, clients: new Set() }; sessions.set(sid, s); }
    s.clients.add(res);
    if (s.engine) {
      res.write(`data: ${JSON.stringify({ type: 'frame', data: s.engine.frame() })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'status', data: { running: s.engine.running } })}\n\n`);
    }

    const ping = setInterval(() => res.write(': ping\n\n'), 15000);
    req.on('close', () => {
      clearInterval(ping);
      s.clients.delete(res);
      if (s.clients.size === 0) {
        if (s.engine) s.engine.stop();
        sessions.delete(sid);
      }
    });
  });

  // ---- Start / restart a run ----
  router.post('/:scenario/start', async (req, res) => {
    const mod = scenarios[req.params.scenario];
    if (!mod) return res.status(404).json({ ok: false, error: 'unknown scenario' });
    const { sid, config = 'solo', throttle = 350, budget = null, roster = null, workers = [] } = req.body || {};
    if (!sid) return res.status(400).json({ ok: false, error: 'missing sid' });

    let s = sessions.get(sid);
    if (!s) { s = { engine: null, clients: new Set() }; sessions.set(sid, s); }
    if (s.engine) s.engine.stop();

    try {
      const engine = await createEngine({
        scenario: mod, configName: config, workerOverrides: workers, roster, throttle, budget, agentsDir,
      });
      engine.onEvent = (type, data) => broadcast(s, type, data);
      s.engine = engine;
      broadcast(s, 'frame', engine.frame());
      engine.start();
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // ---- Run controls ----
  router.post('/:scenario/control', async (req, res) => {
    const { sid, action, value } = req.body || {};
    const s = sessions.get(sid);
    if (!s || !s.engine) return res.json({ ok: false, error: 'no active run' });
    const e = s.engine;
    try {
      if (action === 'pause') e.pause();
      else if (action === 'resume') e.resume();
      else if (action === 'step') e.step();
      else if (action === 'throttle') e.setThrottle(value);
      else if (action === 'replay') { await e.replay(); }
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  return router;
}

const STYLE = `<style>
  .foundry { display: flex; flex-direction: column; gap: 16px; }
  .foundry-controls { display: flex; flex-direction: column; gap: 12px; }
  .fc-row { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
  .fc-workers { display: flex; gap: 12px; flex-wrap: wrap; }
  .fc-worker { border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; min-width: 180px; }
  .fc-worker h4 { margin: 0 0 8px; font-size: 13px; display: flex; align-items: center; gap: 8px; }
  .fc-worker .dot { width: 10px; height: 10px; border-radius: 3px; display: inline-block; }
  .fc-worker label { display: block; font-size: 11px; color: var(--text-dim); margin-top: 6px; }
  .fc-carry-row { margin-top: 8px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .fc-carry-label { font-size: 11px; color: var(--text-dim); }
  .fc-carry { display: inline-flex; gap: 3px; flex-wrap: wrap; align-items: center; min-height: 14px; }
  .fc-carry .chip { width: 12px; height: 12px; border-radius: 3px; }
  .fc-carry .none { font-size: 11px; color: var(--text-dim); }
  .fc-worker .fc-whead { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  .fc-worker .fc-role { width: 100%; margin-top: 2px; }
  .fc-worker .fc-remove { margin-left: auto; background: none; border: none; color: var(--text-dim); cursor: pointer; font-size: 15px; line-height: 1; padding: 0 2px; }
  .fc-worker .fc-remove:hover { color: var(--bad); }
  .fc-warn { color: var(--warn); font-size: 12px; min-height: 0; }
  .fc-warn:empty { display: none; }
  .fc-prompt { margin-top: 10px; border-top: 1px solid var(--border); padding-top: 8px; }
  .fc-prompt summary { font-size: 11px; color: var(--accent); cursor: pointer; }
  .fc-prompt .pr-cap { font-size: 10px; color: var(--text-dim); margin: 6px 0; font-style: italic; }
  .fc-prompt .pr-sec { margin-bottom: 7px; }
  .fc-prompt .pr-t { font-size: 11px; font-weight: 600; color: var(--text); }
  .fc-prompt .pr-b { font-size: 11px; color: var(--text-dim); }
  .foundry-loop { background: var(--bg-elev); border: 1px solid var(--border); border-radius: 10px; padding: 10px 14px; }
  .foundry-loop summary { cursor: pointer; font-size: 13px; }
  .foundry-loop #loop-explainer { font-size: 13px; color: var(--text-dim); margin-top: 8px; }
  .foundry-loop code { background: var(--bg-elev-2); padding: 1px 5px; border-radius: 4px; font-size: 12px; color: var(--text); }
  .foundry-loop ol { margin: 8px 0; padding-left: 20px; }
  .foundry-loop li { margin: 3px 0; }
  .fc-worker input[type=text], .fc-worker select { width: 100%; margin-top: 2px; background: var(--bg-elev-2); color: var(--text); border: 1px solid var(--border); border-radius: 6px; padding: 4px 6px; font: inherit; font-size: 12px; }
  .fc-buttons .btn { font-size: 14px; }
  .foundry-main { display: grid; grid-template-columns: auto 1fr; gap: 16px; align-items: start; }
  .foundry-stage { background: var(--bg-elev); border: 1px solid var(--border); border-radius: 10px; padding: 10px; }
  .foundry-logwrap { display: flex; flex-direction: column; min-width: 0; }
  .foundry-loghead { font-size: 13px; margin-bottom: 6px; }
  .foundry-log { font-family: var(--mono); font-size: 12px; line-height: 1.55; background: var(--bg-elev); border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; height: 360px; overflow-y: auto; }
  .foundry-log .ln { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .foundry-log .ln.bad { opacity: .8; }
  .foundry-log .t { color: var(--text-dim); }
  .foundry-log .nm { font-weight: 600; }
  .foundry-log .dt { color: var(--text-dim); }
  .fc-budget { display: inline-flex; align-items: center; gap: 6px; }
  .fc-meter { width: 90px; height: 8px; background: var(--bg-elev-2); border: 1px solid var(--border); border-radius: 999px; overflow: hidden; }
  .fc-meter #budget-bar { display: block; height: 100%; width: 100%; background: var(--accent); transition: width .15s linear; }
  .fc-meter.low #budget-bar { background: var(--warn); }
  .fc-meter.empty #budget-bar { background: var(--bad); }
  @media (max-width: 820px) { .foundry-main { grid-template-columns: 1fr; } }
</style>`;
