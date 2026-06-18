// Pixel Foundry client — a thin renderer over the server-side tick engine.
// It owns an editable roster (compose any roles, any count), opens an SSE
// stream, posts control actions, and redraws the stage + log from frames.
// No simulation runs here.

(() => {
  const data = JSON.parse(document.getElementById('foundry-data').textContent);
  const { base, scenario, grid, configs, agentTypes, goal, tools, economy } = data;
  const sid = Math.random().toString(36).slice(2);

  const PALETTE = ['#4f9cf9', '#3fb950', '#a371f7', '#d29922', '#f778ba', '#56d4dd', '#e8693a', '#7ee787'];
  const roleColor = { builder: '#4f9cf9', fetcher: '#3fb950', foreman: '#a371f7', inspector: '#d29922' };
  const PIECE_COLORS = { raw: '#d29922' };
  const pieceColor = (type) => PIECE_COLORS[type] || '#9aa7b4';
  const CELL = 26;

  const $ = (id) => document.getElementById(id);
  const stage = $('stage');
  const logEl = $('log');
  const statusEl = $('status');
  const tickEl = $('tick');
  const scoreEl = $('score');
  const workersEl = $('workers');
  let running = false;
  let colorById = {};
  let addCount = 0;

  const clone = (o) => JSON.parse(JSON.stringify(o));
  const typeById = (id) => agentTypes.find((t) => t.id === id) || agentTypes[0];

  // ---- editable roster model ----
  let roster = clone(configs.solo || []);

  function selectedPreset() {
    const r = document.querySelector('input[name="config"]:checked');
    return r ? r.value : 'solo';
  }

  function field(w, f) {
    const cur = w.strategy[f.key];
    if (f.type === 'range') {
      return `<label>${f.label}: <span class="rv" data-rv="${w.id}.${f.key}">${cur}</span>
        <input type="range" data-wid="${w.id}" data-key="${f.key}" data-type="range"
          min="${f.min}" max="${f.max}" step="${f.step || 1}" value="${cur}"/></label>`;
    }
    const opts = f.options.map((o) => `<option value="${o}"${o === cur ? ' selected' : ''}>${o}</option>`).join('');
    return `<label>${f.label}<select data-wid="${w.id}" data-key="${f.key}">${opts}</select></label>`;
  }

  function renderRoster() {
    workersEl.innerHTML = roster
      .map((w, i) => {
        const color = PALETTE[i % PALETTE.length];
        const schema = typeById(w.agent).schema || [];
        const fields = schema.map((f) => field(w, f)).join('');
        const carrier = schema.some((f) => f.key === 'capacity');
        const roleOpts = agentTypes
          .map((t) => `<option value="${t.id}"${t.id === w.agent ? ' selected' : ''}>${t.name}</option>`)
          .join('');
        const carry = carrier
          ? `<div class="fc-carry-row">
              <span class="fc-carry-label">backpack <span data-load="${w.id}">0/${w.strategy.capacity}</span></span>
              <span class="fc-carry" data-carry="${w.id}"><span class="none">empty</span></span>
            </div>`
          : '';
        return `<div class="fc-worker" data-card="${w.id}">
          <div class="fc-whead">
            <span class="dot" style="background:${color}"></span>
            <input type="text" data-wid="${w.id}" data-name="1" value="${w.name}" style="flex:1"/>
            <button class="fc-remove" data-wid="${w.id}" title="remove agent" aria-label="remove agent">×</button>
          </div>
          <select class="fc-role" data-wid="${w.id}">${roleOpts}</select>
          ${fields}
          ${carry}
          <details class="fc-prompt"><summary>View operating prompt</summary><div data-prompt="${w.id}"></div></details>
        </div>`;
      })
      .join('');
    roster.forEach((w) => refreshPrompt(w.id));
    checkRoster();
  }

  function checkRoster() {
    const canBuild = roster.some((w) => {
      const schema = typeById(w.agent).schema || [];
      return schema.some((f) => f.key === 'capacity'); // only carriers place pieces
    });
    const warn = $('roster-warn');
    if (!roster.length) warn.textContent = 'No agents — add at least one to run.';
    else if (!canBuild) warn.textContent = '⚠ No builder or fetcher in the roster — no one can carry or place pieces, so nothing will get built.';
    else warn.textContent = '';
  }

  // ---- generated best-practice prompt (read-only, from current settings) ----
  function buildPrompt(w) {
    const s = w.strategy || {};
    const schema = typeById(w.agent).schema || [];
    const carrier = schema.some((f) => f.key === 'capacity');
    const toolsByRole = {
      builder: ['move', 'pickup', 'place'],
      fetcher: ['move', 'pickup', 'place'],
      foreman: ['assign', 'observe'],
      inspector: ['inspect'],
    };
    const identity = {
      builder: `You are ${w.name}, a self-sufficient builder. You fetch pieces, carry them, and place them on target cells yourself — start to finish.`,
      fetcher: `You are ${w.name}, a fetcher on a crew. You gather pieces and deliver them, preferring the cell your foreman assigns you.`,
      foreman: `You are ${w.name}, the foreman (orchestrator). You never carry or place — you watch the board and assign open cells to free fetchers.`,
      inspector: `You are ${w.name}, the inspector (evaluator). You build nothing; you check progress against the goal and declare the build complete.`,
    };
    const used = toolsByRole[w.agent] || [];
    const toolLines = used.map((t) => `• ${t} — ${(tools.find((x) => x.name === t) || {}).description || ''}`).join('\n');
    const policy = {
      builder: 'Use pickup only while standing on a loose piece; use place only on an empty target cell you stand on.',
      fetcher: 'Use pickup only while standing on a piece; deliver to your assigned cell if it is still open, else the nearest open cell.',
      foreman: 'Give each free fetcher the open cell nearest it; clear an assignment once its cell is filled.',
      inspector: 'Each tick, compare filled cells to the total and report.',
    }[w.agent] || '';
    const strat = {
      builder: `Grab the ${s.pick} loose piece. Fill cells ${s.fill} first.`,
      fetcher: `Grab the ${s.pick} loose piece. Prefer your assigned cell, fall back to nearest.`,
      foreman: `Assignment policy: ${s.assign} (${s.assign === 'round-robin' ? 'hand out cells in worker order' : 'match each fetcher to its closest open cell'}).`,
      inspector: 'Count filled vs total cells; end the run when complete.',
    }[w.agent] || '';
    const deliverText = {
      nearest: 'deliver as soon as a target is at least as close as the next piece (just-in-time)',
      half: 'gather to half capacity, then deliver',
      full: 'gather until the backpack is full, then deliver',
    };
    const loadout = carrier
      ? `Backpack holds up to ${s.capacity} pieces — this is your context window. Plan: ${deliverText[s.deliver] || s.deliver}. Every held piece costs ${economy.holdCost} token/tick and every step ${economy.moveCost}; the shared budget (${economy.budget}) is finite, so don't hold more than you need.`
      : 'No backpack — you neither carry pieces nor pay holding cost.';
    const done = w.agent === 'inspector'
      ? 'When every target cell is filled, call inspect(done) to end the run.'
      : 'Stop when the letter is complete (the inspector confirms) or the budget is spent.';
    const failure = {
      builder: 'If no open cells remain while carrying, hold and wait. If no loose pieces remain, wait for the board to change.',
      fetcher: 'If your assigned cell was already filled, drop the plan and deliver to the nearest open cell. If holding with no orders, wait.',
      foreman: 'If every fetcher is tasked, supervise (observe) and reassign as cells fill.',
      inspector: 'While incomplete, keep reporting progress.',
    }[w.agent] || '';

    return [
      ['1 · Role & identity', identity[w.agent] || `You are ${w.name}.`],
      ['2 · Objective', `${goal.title}. ${goal.text} You succeed when every target cell is filled.`],
      ['3 · Tools & when to use them', `${toolLines}\n\nPolicy: ${policy}`],
      ['4 · Strategy', strat],
      ['5 · Loadout & budget', loadout],
      ['6 · Definition of done', done],
      ['7 · On failure / uncertainty', failure],
      ['Runtime · the loop', 'Each tick you receive a perception (your position, loose pieces, target cells, teammates, the shared blackboard, the budget, and the tool catalog) and return exactly one action: { tool, args, rationale }.'],
    ];
  }

  function refreshPrompt(id) {
    const w = roster.find((x) => x.id === id);
    const el = document.querySelector(`[data-prompt="${id}"]`);
    if (!w || !el) return;
    el.innerHTML =
      `<div class="pr-cap">Generated from current settings. Offline, the structured choices below drive behavior; the prose describes them. (Prose fully bites only in a token-spending Claude run.)</div>` +
      buildPrompt(w)
        .map(([t, b]) => `<div class="pr-sec"><div class="pr-t">${t}</div><div class="pr-b">${escapeHtml(b).replace(/\n/g, '<br>')}</div></div>`)
        .join('');
  }

  function renderLoop() {
    const t = tools.map((x) => `<code>${x.name}</code>`).join(' ');
    $('loop-explainer').innerHTML = `
      <p>The engine runs <b>server-side</b>. Each <b>tick</b>, for every agent in roster order:</p>
      <ol>
        <li><b>Perceive</b> — the agent is handed its position, the loose pieces, the target cells (filled or not), its teammates, the shared blackboard, the remaining budget, and the tool catalog.</li>
        <li><b>Decide</b> — its strategy returns exactly one action: <code>{ tool, args, rationale }</code>.</li>
        <li><b>Act</b> — the engine applies that tool, logs the rationale, and updates the world.</li>
      </ol>
      <p>After all agents act: held pieces and moves are charged to the budget; score = % of cells filled. The run ends at 100%, when the budget hits 0, or if it stalls. Tools in this scenario: ${t}.</p>`;
  }

  function gatherRoster() {
    return roster.map((w) => ({ id: w.id, agent: w.agent, role: w.role, name: w.name, strategy: w.strategy }));
  }

  // ---- networking ----
  function connect() {
    const es = new EventSource(`${base}/${scenario}/stream?sid=${sid}`);
    es.onmessage = (e) => handle(JSON.parse(e.data));
  }

  async function post(path, body) {
    await fetch(`${base}/${scenario}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  function start() {
    if (!roster.length) { checkRoster(); return; }
    logEl.innerHTML = '';
    post('start', {
      sid,
      throttle: Number($('throttle').value),
      budget: Number($('budget').value),
      roster: gatherRoster(),
    });
  }

  const control = (action, value) => post('control', { sid, action, value });

  // ---- event handling ----
  function handle(msg) {
    if (msg.type === 'frame') draw(msg.data);
    else if (msg.type === 'log') appendLog(msg.data);
    else if (msg.type === 'status') setRunning(msg.data.running);
    else if (msg.type === 'done') done(msg.data);
  }

  function setRunning(r) {
    running = r;
    $('btn-pause').disabled = false;
    $('btn-step').disabled = false;
    $('btn-replay').disabled = false;
    $('btn-pause').textContent = r ? '⏸ Pause' : '▶ Resume';
    statusEl.textContent = r ? 'running' : 'paused';
    statusEl.className = 'badge ' + (r ? 'running' : 'stopped');
  }

  function done(d) {
    running = false;
    $('btn-pause').textContent = '▶ Resume';
    $('btn-pause').disabled = true;
    $('btn-step').disabled = true;
    let label = `done · ${d.score}%`;
    let kind = 'running';
    if (d.overBudget) { label = `out of budget · ${d.score}%`; kind = 'errored'; }
    else if (d.stalled) { label = `stalled · ${d.score}%`; kind = 'errored'; }
    statusEl.textContent = label;
    statusEl.className = 'badge ' + kind;
  }

  function appendLog(d) {
    const ln = document.createElement('div');
    ln.className = 'ln' + (d.ok ? '' : ' bad');
    const color = roleColor[d.agent.role] || '#9aa7b4';
    ln.innerHTML =
      `<span class="t">t${d.tick}</span> ` +
      `<span class="nm" style="color:${color}">${escapeHtml(d.agent.name)}</span> ` +
      `${escapeHtml(d.rationale)} ` +
      `<span class="dt">· ${escapeHtml(d.detail || '')}</span>`;
    logEl.insertBefore(ln, logEl.firstChild);
    while (logEl.childElementCount > 250) logEl.removeChild(logEl.lastChild);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  }

  // ---- rendering ----
  function setBudget(total, remaining) {
    const pct = total ? Math.max(0, Math.round((remaining / total) * 100)) : 0;
    $('budget-bar').style.width = `${pct}%`;
    $('budget-left').textContent = remaining;
    $('budget-total').textContent = total;
    const meter = document.querySelector('.fc-meter');
    meter.className = 'fc-meter' + (remaining <= 0 ? ' empty' : pct < 25 ? ' low' : '');
  }

  function draw(frame) {
    tickEl.textContent = frame.tick;
    scoreEl.textContent = frame.score;
    if (frame.budget) setBudget(frame.budget.total, frame.budget.remaining);
    colorById = {};
    frame.workers.forEach((w, i) => { colorById[w.id] = PALETTE[i % PALETTE.length]; });

    frame.workers.forEach((w) => {
      const load = document.querySelector(`[data-load="${w.id}"]`);
      if (load) load.textContent = `${w.load}/${w.capacity}`;
      const carry = document.querySelector(`[data-carry="${w.id}"]`);
      if (carry) {
        carry.innerHTML = (w.carrying && w.carrying.length)
          ? w.carrying.map((c) => `<span class="chip" style="background:${pieceColor(c.color)}" title="piece #${c.id}"></span>`).join('')
          : '<span class="none">empty</span>';
      }
    });

    const W = frame.grid.w * CELL;
    const H = frame.grid.h * CELL;
    let svg = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`;
    svg += `<rect x="0" y="0" width="${W}" height="${H}" fill="#0e1116"/>`;
    for (let x = 0; x <= frame.grid.w; x++)
      svg += `<line x1="${x * CELL}" y1="0" x2="${x * CELL}" y2="${H}" stroke="#1c2230" stroke-width="1"/>`;
    for (let y = 0; y <= frame.grid.h; y++)
      svg += `<line x1="0" y1="${y * CELL}" x2="${W}" y2="${y * CELL}" stroke="#1c2230" stroke-width="1"/>`;

    frame.targets.forEach((t) => {
      if (!t.filled)
        svg += `<rect x="${t.x * CELL + 3}" y="${t.y * CELL + 3}" width="${CELL - 6}" height="${CELL - 6}" rx="3" fill="none" stroke="#4f9cf9" stroke-opacity="0.5" stroke-dasharray="3 3"/>`;
    });
    frame.pieces.filter((p) => p.placed).forEach((p) => {
      const c = colorById[p.placedBy] || '#3fb950';
      svg += `<rect x="${p.x * CELL + 2}" y="${p.y * CELL + 2}" width="${CELL - 4}" height="${CELL - 4}" rx="3" fill="${c}"/>`;
    });
    frame.pieces.filter((p) => !p.placed && !p.carried).forEach((p) => {
      svg += `<rect x="${p.x * CELL + 7}" y="${p.y * CELL + 7}" width="${CELL - 14}" height="${CELL - 14}" rx="2" fill="#d29922"/>`;
    });
    frame.workers.forEach((w) => {
      const cx = w.x * CELL + CELL / 2;
      const cy = w.y * CELL + CELL / 2;
      const c = colorById[w.id] || '#4f9cf9';
      if (w.load)
        svg += `<circle cx="${cx}" cy="${cy}" r="11" fill="none" stroke="${c}" stroke-width="2"/>`;
      svg += `<circle cx="${cx}" cy="${cy}" r="8" fill="${c}"/>`;
      svg += `<text x="${cx}" y="${cy + 3}" text-anchor="middle" font-size="9" fill="#0e1116" font-family="sans-serif">${(w.name[0] || '?').toUpperCase()}</text>`;
      if (w.load)
        svg += `<circle cx="${cx + 9}" cy="${cy - 9}" r="6" fill="#161b22" stroke="${c}"/>` +
          `<text x="${cx + 9}" y="${cy - 6}" text-anchor="middle" font-size="8" fill="${c}" font-family="sans-serif">${w.load}</text>`;
    });
    svg += '</svg>';
    stage.innerHTML = svg;
  }

  // ---- wire up (event delegation over the roster) ----
  workersEl.addEventListener('input', (e) => {
    const el = e.target;
    const wid = el.dataset.wid;
    if (!wid) return;
    const w = roster.find((x) => x.id === wid);
    if (!w) return;
    if (el.dataset.name) { w.name = el.value; refreshPrompt(wid); return; }
    if (el.dataset.key) {
      w.strategy[el.dataset.key] = el.dataset.type === 'range' ? Number(el.value) : el.value;
      if (el.dataset.type === 'range') {
        const rv = document.querySelector(`[data-rv="${wid}.${el.dataset.key}"]`);
        if (rv) rv.textContent = el.value;
        if (el.dataset.key === 'capacity') {
          const load = document.querySelector(`[data-load="${wid}"]`);
          if (load) load.textContent = `0/${el.value}`;
        }
      }
      refreshPrompt(wid);
    }
  });

  workersEl.addEventListener('change', (e) => {
    const el = e.target;
    const wid = el.dataset.wid;
    if (!wid) return;
    const w = roster.find((x) => x.id === wid);
    if (!w) return;
    if (el.classList.contains('fc-role')) {
      const t = typeById(el.value);
      w.agent = t.id;
      w.role = t.role;
      w.strategy = clone(t.strategy);
      renderRoster();
    } else if (el.dataset.key) {
      w.strategy[el.dataset.key] = el.value;
      refreshPrompt(wid);
    }
  });

  workersEl.addEventListener('click', (e) => {
    const rm = e.target.closest('.fc-remove');
    if (!rm) return;
    roster = roster.filter((x) => x.id !== rm.dataset.wid);
    renderRoster();
  });

  document.querySelectorAll('input[name="config"]').forEach((r) =>
    r.addEventListener('change', () => { roster = clone(configs[selectedPreset()] || []); renderRoster(); }),
  );

  $('btn-add').addEventListener('click', () => {
    const t = typeById('builder');
    addCount++;
    roster.push({ id: `add-${addCount}`, agent: t.id, role: t.role, name: `Worker ${roster.length + 1}`, strategy: clone(t.strategy) });
    renderRoster();
  });

  $('throttle').addEventListener('input', (e) => {
    $('throttle-val').textContent = `${e.target.value} ms/tick`;
    control('throttle', Number(e.target.value));
  });
  $('budget').addEventListener('input', (e) => {
    const v = Number(e.target.value);
    $('budget-val').textContent = v;
    setBudget(v, v);
  });
  $('btn-start').addEventListener('click', start);
  $('btn-pause').addEventListener('click', () => control(running ? 'pause' : 'resume'));
  $('btn-step').addEventListener('click', () => control('step'));
  $('btn-replay').addEventListener('click', () => control('replay'));

  // ---- init ----
  renderRoster();
  renderLoop();
  connect();

  if (economy && economy.budget) {
    $('budget').value = economy.budget;
    $('budget-val').textContent = economy.budget;
    setBudget(economy.budget, economy.budget);
  }
  draw({ tick: 0, score: 0, grid, pieces: [], targets: [], workers: [] });
})();
