import express from 'express';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from '../../src/app.js';
import { ghostStamp } from '../../src/lib/release.js';
import { getSchedules, triggerNow, getLog } from '../../src/scheduler.js';

// Module-load epoch — resets on process restart and on a dashboard Restart
// (both re-import this file). Drives the bottom-right freshness stamp.
const LOADED_AT = Date.now();

export const meta = {
  name: 'Backlog',
  description: 'Shared backlog. Items are stored in data/backlog.json.',
  version: '2.4.0',
};

const FILE = path.join(ROOT, 'data', 'backlog.json');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Pipeline statuses — this is the full state machine; agents managing backlog
// state must treat this list (and STATUS_DEFINITIONS below) as authoritative.
//   ready-to-groom → groomed (agent annotated) → ready (human approved)
//                  → in-progress (builder claimed) → done | blocked
//   on-hold        → paused by a human; not actively worked until moved out
//   blocked        → stuck (agent couldn't correlate it, or build failed) —
//                    editing the description resets it to ready-to-groom
const STATUSES = ['ready-to-groom', 'on-hold', 'groomed', 'ready', 'in-progress', 'done', 'blocked'];

// Authoritative status definitions, served to agents via GET /api/status-definitions
// so any agent managing backlog state (groomer, builder, summarizer) has a single
// source of truth instead of inferring meaning from the string.
const STATUS_DEFINITIONS = {
  'ready-to-groom': 'New item awaiting agent triage/annotation.',
  groomed: 'An agent has annotated the item with enough detail to evaluate.',
  ready: 'Human has approved the item for build.',
  'in-progress': 'A builder agent has claimed the item and is working it.',
  done: 'Work is complete.',
  blocked: "Stuck — either an agent couldn't correlate it to known work, or a build attempt failed. Editing the description resets it to ready-to-groom.",
  'on-hold': 'Paused by a human; intentionally not in the active pipeline.',
};

function normalize(i) {
  return {
    estimate: null,
    approvedForBuild: false,
    claim: null,
    ...i,
    // Legacy statuses from before the status set was reduced
    status: i.status === 'pending' ? 'on-hold' : i.status === 'groomer-blocked' ? 'blocked' : (i.status || 'ready-to-groom'),
    annotations: Array.isArray(i.annotations) ? i.annotations : [],
  };
}

function read() {
  try {
    return JSON.parse(readFileSync(FILE, 'utf8')).map(normalize);
  } catch {
    return [];
  }
}

function write(items) {
  writeFileSync(FILE, JSON.stringify(items, null, 2));
}

const STATUS_COLORS = {
  'ready-to-groom': '#2e7d4f',
  'on-hold': '#888',
  groomed: '#3a6ea5',
  ready: 'var(--accent, #7c6af7)',
  'in-progress': 'var(--yellow, #ff9800)',
  done: 'var(--green, #4caf50)',
  blocked: '#8b4513',
};

function statusBadge(s) {
  return `<span class="badge" style="background:${STATUS_COLORS[s] || '#888'}">${esc(s)}</span>`;
}

function annotationsSection(item) {
  if (!item.annotations.length) return '';
  const rows = item.annotations
    .map((a) => `<div style="font-size:0.85em;border-left:2px solid var(--border);padding-left:8px;margin:6px 0;overflow-wrap:anywhere">
        <span class="badge">${esc(a.agent)} · ${esc(a.kind)}</span>
        <div style="margin-top:2px">${esc(a.body)}</div></div>`)
    .join('');
  return `<details class="collapsible" style="margin-top:10px;padding:10px 14px">
      <summary>Annotations <span class="coll-count">${item.annotations.length}</span></summary>
      <div class="coll-body">${rows}</div>
    </details>`;
}

function gateCell(item, name) {
  const claimLine = item.claim
    ? `<div style="font-size:0.75em;color:var(--muted);margin-top:3px">🔒 ${esc(item.claim.by)}</div>`
    : '';
  let control = '—';
  if (item.approvedForBuild) {
    control = `<span class="badge" style="background:var(--green,#4caf50)">approved</span>
      <form method="post" action="/apps/${name}/approve" style="display:inline;margin-left:4px">
        <input type="hidden" name="id" value="${esc(item.id)}"><input type="hidden" name="value" value="0">
        <button class="btn" style="padding:1px 6px;font-size:0.75em">Revoke</button></form>`;
  } else if (item.status === 'groomed' || item.status === 'ready') {
    control = `<form method="post" action="/apps/${name}/approve" style="display:inline">
        <input type="hidden" name="id" value="${esc(item.id)}"><input type="hidden" name="value" value="1">
        <button class="btn primary" style="padding:1px 8px;font-size:0.75em">Approve for build</button></form>`;
  }
  return control + claimLine;
}

// Edit-in-place: the title/description fields ARE the editor — no separate
// read-only display plus a duplicate edit form. Submits on blur if changed.
const AUTOSUBMIT = `onblur="if(this.value!==this.defaultValue)this.form.requestSubmit()"`;

function entryHeader(item, name) {
  return `<form method="post" action="/apps/${name}/edit" style="flex:1;min-width:200px">
    <input type="hidden" name="id" value="${esc(item.id)}">
    <input class="inline-field" name="title" value="${esc(item.title)}" placeholder="Title"
      style="font-weight:600;font-size:1em" ${AUTOSUBMIT}>
  </form>`;
}

// Agents available for manual pickup — any scheduler job named backlog-* (the
// schedule is the single source of truth; adding a new backlog-prefixed job
// makes it selectable here automatically).
function backlogAgents() {
  return getSchedules().filter((j) => j.id.startsWith('backlog-'));
}

function pickupDialog(item, name, agents) {
  const dialogId = `pickup-${item.id}`;
  const options = agents.map((j, idx) => `
    <label style="display:block;padding:8px;border:1px solid var(--border);border-radius:6px;margin-bottom:6px;cursor:pointer">
      <input type="radio" name="agent" value="${esc(j.id)}" ${idx === 0 ? 'checked' : ''} style="margin-right:8px">
      <strong>${esc(j.name || j.id)}</strong>
      <div style="font-size:0.8em;color:var(--text-dim);margin-top:2px;margin-left:20px">${esc(j.description || '')}</div>
    </label>`).join('');

  return `<dialog id="${dialogId}" style="background:var(--bg-elev);color:var(--text);border:1px solid var(--border);border-radius:8px;padding:18px;max-width:420px;width:90%">
    <form method="post" action="/apps/${name}/pickup" class="pickup-form" data-status-url="/apps/${name}/api/pickup-status">
      <input type="hidden" name="id" value="${esc(item.id)}">
      <h3 style="margin:0 0 4px">Pick up "${esc(item.title)}"</h3>
      <p class="muted" style="font-size:0.8em;margin:0 0 12px">Choose an agent to run, scoped to this item. This calls the LLM — it takes a while.</p>
      ${options || '<div class="empty">No backlog agents configured.</div>'}
      <div class="row" style="justify-content:flex-end;gap:8px;margin-top:14px">
        <button type="button" class="btn" onclick="document.getElementById('${dialogId}').close()">Cancel</button>
        <button type="submit" class="btn llm"${agents.length ? '' : ' disabled'}>🤖 Pick up</button>
      </div>
    </form>
  </dialog>`;
}

// Visible while a pickup run is in flight or just finished for this item —
// the only signal the user gets that an LLM call is happening (no silent waits).
function pickupStatus(item) {
  return `<div id="pickup-status-${esc(item.id)}" class="pickup-status" hidden></div>`;
}

function descriptionSection(item, name) {
  return `<form method="post" action="/apps/${name}/edit" style="margin-top:8px">
    <input type="hidden" name="id" value="${esc(item.id)}">
    <textarea class="inline-field" name="description" rows="2" placeholder="Add a description…"
      style="font-size:0.9em;color:var(--muted)" ${AUTOSUBMIT}>${esc(item.description || '')}</textarea>
  </form>`;
}

export function createApp({ name }) {
  const router = express.Router();

  router.get('/', (req, res) => {
    const items = read();
    const filter = req.query.status || 'all';
    const agents = backlogAgents();

    const visible = filter === 'all' ? items : items.filter((i) => i.status === filter);

    const filterLinks = ['all', ...STATUSES].map((s) =>
      `<a href="?status=${s}" class="btn${filter === s ? ' primary' : ''}" style="padding:3px 10px;font-size:0.8em">${s}</a>`
    ).join(' ');

    const entries = visible.map((item) => `
      <div class="card backlog-item" style="margin-bottom:12px">
        <div class="row spread" style="align-items:flex-start;flex-wrap:wrap;gap:10px">
          ${entryHeader(item, name)}
          <div class="row" style="gap:6px;flex-wrap:wrap;align-items:center">
            ${statusBadge(item.status)}
            <span class="badge">${esc(item.type || '—')}</span>
            <button type="button" class="btn" style="padding:1px 8px;font-size:0.8em"
              onclick="document.getElementById('pickup-${esc(item.id)}').showModal()">📥 Pickup</button>
          </div>
        </div>

        ${pickupStatus(item)}
        ${descriptionSection(item, name)}

        <div class="row" style="font-size:0.78em;color:var(--muted);margin-top:8px;gap:14px;flex-wrap:wrap">
          <span>#${esc(item.id)}</span>
          <span>est ${esc(item.estimate || '—')}</span>
          <span>by ${esc(item.addedBy || '—')}</span>
          <span>added ${item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '—'}</span>
        </div>

        ${annotationsSection(item)}
        ${pickupDialog(item, name, agents)}

        <div class="row spread" style="margin-top:12px;flex-wrap:wrap;gap:10px;align-items:center">
          <div style="font-size:0.85em">${gateCell(item, name)}</div>
          <form method="post" action="/apps/${name}/status" class="row" style="gap:4px">
            <input type="hidden" name="id" value="${esc(item.id)}">
            <select name="status" class="btn" style="padding:2px 6px;font-size:0.8em">
              ${STATUSES.map((s) => `<option${item.status === s ? ' selected' : ''}>${s}</option>`).join('')}
            </select>
            <button class="btn" style="padding:2px 8px;font-size:0.8em">Set</button>
          </form>
        </div>
      </div>`).join('');

    res.type('html').send(`<!doctype html><html data-theme="dark"><head>
      <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Backlog</title><link rel="stylesheet" href="/static/css/dark.css">
      <style>
        .pickup-status { margin-top:8px; padding:6px 10px; border-radius:6px; font-size:0.82em; display:flex; align-items:center; gap:8px; }
        .pickup-status.running { background:var(--llm-dim); border:1px solid var(--llm); }
        .pickup-status.done { background:var(--bg-elev-2); border:1px solid var(--green,#4caf50); }
        .pickup-status.error { background:var(--bg-elev-2); border:1px solid var(--red,#f44336); }
        .pickup-spinner { width:11px; height:11px; border-radius:50%; flex:none;
          border:2px solid var(--llm); border-top-color:transparent; animation:pickup-spin .7s linear infinite; }
        @keyframes pickup-spin { to { transform:rotate(360deg); } }
      </style>
    </head><body><div class="wrap">
      <header class="site"><h1>📋 Backlog</h1><a class="muted" href="/">← Dashboard</a></header>

      <div class="card" style="margin-bottom:16px">
        <form method="post" action="/apps/${name}/add">
          <div class="row" style="flex-wrap:wrap;gap:8px">
            <input class="btn" name="title" placeholder="Title" required style="flex:2;min-width:200px">
            <input class="btn" name="description" placeholder="Description (optional)" style="flex:3;min-width:200px">
            <select name="type" class="btn" style="min-width:100px">
              <option value="feature">feature</option>
              <option value="bug">bug</option>
              <option value="chore">chore</option>
              <option value="idea">idea</option>
            </select>
            <input class="btn" name="addedBy" placeholder="Added by" style="min-width:100px">
            <button class="btn primary" type="submit">Add</button>
          </div>
        </form>
      </div>

      <div class="row" style="margin-bottom:12px;gap:6px;flex-wrap:wrap">${filterLinks}</div>

      ${visible.length === 0 ? '<div class="empty">No items.</div>' : entries}

      <p class="muted" style="font-size:0.78em;margin-top:10px">
        Pipeline: <strong>ready-to-groom</strong> → groomed (agent) → <strong>ready</strong> (you approve) → in-progress (builder claims) → done.
        <strong>blocked</strong>: stuck — agent couldn't correlate it, or a build attempt failed. Editing the description resets it to ready-to-groom.
        <strong>on-hold</strong>: paused by a human, outside the active pipeline.
        Full definitions: <a href="/apps/${name}/api/status-definitions">/api/status-definitions</a>.
      </p>
    </div>
    <script>
      document.addEventListener('submit', (e) => {
        const form = e.target;
        if (!form.classList.contains('pickup-form')) return;
        e.preventDefault();

        const itemId = form.querySelector('input[name=id]').value;
        const checked = form.querySelector('input[name=agent]:checked');
        const agentLabel = checked ? checked.closest('label').querySelector('strong').textContent : 'Agent';
        const statusUrl = form.dataset.statusUrl + '?item=' + encodeURIComponent(itemId);
        const statusEl = document.getElementById('pickup-status-' + itemId);
        const submitBtn = form.querySelector('button[type=submit]');
        const dialog = form.closest('dialog');

        submitBtn.disabled = true;
        submitBtn.textContent = '⏳ Starting…';
        statusEl.hidden = false;
        statusEl.className = 'pickup-status running';
        statusEl.innerHTML = '<span class="pickup-spinner"></span><span>🤖 ' + agentLabel + ' is working on this item…</span>';

        fetch(form.action, { method: 'POST', body: new URLSearchParams(new FormData(form)) })
          .then(() => { if (dialog) dialog.close(); poll(); })
          .catch(() => {
            statusEl.className = 'pickup-status error';
            statusEl.textContent = '⚠ Failed to start the run.';
            submitBtn.disabled = false;
            submitBtn.textContent = '🤖 Pick up';
          });

        function poll() {
          fetch(statusUrl).then((r) => r.json()).then((s) => {
            if (s.running) {
              statusEl.innerHTML = '<span class="pickup-spinner"></span><span>🤖 ' + (s.jobName || agentLabel) + ' is working on this item…</span>';
              setTimeout(poll, 1500);
            } else if (s.status) {
              const ok = s.status === 'ok';
              statusEl.className = 'pickup-status ' + (ok ? 'done' : 'error');
              statusEl.textContent = (ok ? '✓ ' : '⚠ ') + (s.output || '').slice(0, 240);
              submitBtn.disabled = false;
              submitBtn.textContent = '🤖 Pick up';
              setTimeout(() => location.reload(), ok ? 1800 : 3500);
            } else {
              statusEl.className = 'pickup-status error';
              statusEl.textContent = '⚠ No run recorded for this item.';
              submitBtn.disabled = false;
              submitBtn.textContent = '🤖 Pick up';
            }
          }).catch(() => setTimeout(poll, 2000));
        }
      });
    </script>
    ${ghostStamp({ version: meta.version, loadedAt: LOADED_AT })}</body></html>`);
  });

  router.post('/add', (req, res) => {
    const { title, description, type, addedBy } = req.body || {};
    if (!title) return res.redirect(`/apps/${name}/`);
    const items = read();
    items.unshift(normalize({
      id: Date.now().toString(36),
      title: String(title).slice(0, 120),
      description: description ? String(description).slice(0, 500) : '',
      type: type || 'feature',
      status: 'ready-to-groom',
      addedBy: addedBy || '',
      estimate: null,
      createdAt: new Date().toISOString(),
    }));
    write(items);
    res.redirect(`/apps/${name}/`);
  });

  // Edit-in-place: title and description each submit independently (one field
  // changed on blur), so only touch the field that was actually sent.
  // Editing the description clears a blocked status back to ready-to-groom.
  router.post('/edit', (req, res) => {
    const { id, title, description } = req.body || {};
    const items = read();
    const item = items.find((i) => i.id === id);
    if (item) {
      if (title !== undefined) item.title = String(title).slice(0, 120);
      if (description !== undefined) {
        item.description = String(description).slice(0, 500);
        if (item.status === 'blocked') item.status = 'ready-to-groom';
      }
    }
    write(items);
    res.redirect(`/apps/${name}/`);
  });

  router.post('/status', (req, res) => {
    const { id, status } = req.body || {};
    const items = read();
    const item = items.find((i) => i.id === id);
    if (item && STATUSES.includes(status)) item.status = status;
    write(items);
    res.redirect(`/apps/${name}/`);
  });

  router.post('/approve', (req, res) => {
    const { id, value } = req.body || {};
    const items = read();
    const item = items.find((i) => i.id === id);
    if (item) {
      if (value === '1') {
        if (item.status === 'groomed' || item.status === 'ready') {
          item.approvedForBuild = true;
          item.status = 'ready';
        }
      } else {
        item.approvedForBuild = false;
        if (item.status === 'ready') item.status = 'groomed';
      }
    }
    write(items);
    res.redirect(`/apps/${name}/`);
  });

  // Manual pickup — runs the chosen backlog-* scheduler job once, scoped to
  // this item via a runtime note (see triggerNow/runPrompt in src/scheduler.js).
  router.post('/pickup', (req, res) => {
    const { id, agent } = req.body || {};
    const items = read();
    const item = items.find((i) => i.id === id);
    const job = backlogAgents().find((j) => j.id === agent);
    if (item && job) triggerNow(job.id, { itemId: item.id, itemTitle: item.title });
    res.redirect(`/apps/${name}/`);
  });

  // Polled by the pickup status indicator (client script above) so a manual
  // run is never a silent wait — finds whichever backlog-* job's log entry is
  // currently scoped to this item (see context in src/scheduler.js).
  router.get('/api/pickup-status', (req, res) => {
    const itemId = req.query.item;
    const log = getLog();
    for (const job of backlogAgents()) {
      const entry = log[job.id];
      if (entry && entry.context && entry.context.itemId === itemId) {
        return res.json({
          running: entry.status === 'running',
          status: entry.status,
          job: job.id,
          jobName: job.name || job.id,
          output: entry.output,
        });
      }
    }
    res.json({ running: false });
  });

  // ── Agent API ──────────────────────────────────────────────────────────────
  router.get('/api/items', (req, res) => res.json(read()));

  // Authoritative status meanings — agents managing backlog state should read
  // this instead of inferring meaning from the status string.
  router.get('/api/status-definitions', (req, res) => res.json({ statuses: STATUSES, definitions: STATUS_DEFINITIONS }));

  // ANNOTATOR role (Groomer): append-only feedback. Advances ready-to-groom → groomed.
  router.post('/api/items/:id/annotate', (req, res) => {
    const { agent, kind, body, estimate } = req.body || {};
    const items = read();
    const item = items.find((i) => i.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    item.annotations.push({
      agent: agent || 'agent',
      kind: kind || 'note',
      body: String(body ?? ''),
      createdAt: new Date().toISOString(),
    });
    if (kind === 'estimate' && estimate) item.estimate = String(estimate).slice(0, 40);
    if (item.status === 'ready-to-groom') item.status = 'groomed';
    write(items);
    res.json(item);
  });

  // GROOMER role: set blocked when the item can't be correlated.
  router.post('/api/items/:id/groom-block', (req, res) => {
    const { agent, reason } = req.body || {};
    const items = read();
    const item = items.find((i) => i.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    item.status = 'blocked';
    item.annotations.push({
      agent: agent || 'groomer',
      kind: 'blocked',
      body: String(reason ?? 'Could not correlate to any known feature or codebase area.'),
      createdAt: new Date().toISOString(),
    });
    write(items);
    res.json(item);
  });

  router.post('/api/items/:id/claim', (req, res) => {
    const { by } = req.body || {};
    const items = read();
    const item = items.find((i) => i.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    if (!(item.status === 'ready' && item.approvedForBuild)) {
      return res.status(409).json({ error: 'Item is not ready + approved for build' });
    }
    if (item.claim) return res.status(409).json({ error: `Already claimed by ${item.claim.by}` });
    item.claim = { by: by || 'builder', at: new Date().toISOString() };
    item.status = 'in-progress';
    write(items);
    res.json(item);
  });

  router.post('/api/items/:id/complete', (req, res) => {
    const { by, status, result } = req.body || {};
    const items = read();
    const item = items.find((i) => i.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    if (!item.claim || item.claim.by !== by) {
      return res.status(403).json({ error: 'Only the claimer may complete this item' });
    }
    const next = status === 'blocked' ? 'blocked' : 'done';
    item.status = next;
    if (result) {
      item.annotations.push({ agent: by, kind: 'result', body: String(result), createdAt: new Date().toISOString() });
    }
    if (next === 'done') item.claim = null;
    write(items);
    res.json(item);
  });

  return router;
}

export function health() {
  const items = read();
  const readyToGroom = items.filter((i) => i.status === 'ready-to-groom').length;
  const blocked = items.filter((i) => i.status === 'blocked').length;
  const ready = items.filter((i) => i.status === 'ready' && i.approvedForBuild).length;
  return { ok: true, detail: `${items.length} items · ${readyToGroom} ready-to-groom · ${blocked} blocked · ${ready} ready to build` };
}
