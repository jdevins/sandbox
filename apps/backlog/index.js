import express from 'express';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from '../../src/app.js';

export const meta = {
  name: 'Backlog',
  description: 'Shared backlog. Items are stored in data/backlog.json.',
  version: '2.1.0',
};

const FILE = path.join(ROOT, 'data', 'backlog.json');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Pipeline statuses:
//   ready-to-groom  → groomed (agent annotated) → ready (human approved)
//                   → in-progress (builder claimed) → done | blocked
//   groomer-blocked → stays until human edits description, which resets to ready-to-groom
const STATUSES = ['ready-to-groom', 'groomer-blocked', 'pending', 'groomed', 'ready', 'in-progress', 'done', 'blocked'];

function normalize(i) {
  return {
    estimate: null,
    approvedForBuild: false,
    claim: null,
    ...i,
    // Legacy items with status 'pending' are treated as ready-to-groom
    status: i.status === 'pending' ? 'ready-to-groom' : (i.status || 'ready-to-groom'),
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
  'groomer-blocked': '#8b4513',
  pending: '#888',
  groomed: '#3a6ea5',
  ready: 'var(--accent, #7c6af7)',
  'in-progress': 'var(--yellow, #ff9800)',
  done: 'var(--green, #4caf50)',
  blocked: 'var(--red, #f44336)',
};

function statusBadge(s) {
  return `<span class="badge" style="background:${STATUS_COLORS[s] || '#888'}">${esc(s)}</span>`;
}

function annotationsBlock(item) {
  if (!item.annotations.length) return '';
  const rows = item.annotations
    .map((a) => `<div style="font-size:0.8em;border-left:2px solid var(--border,#333);padding-left:8px;margin:3px 0">
        <span class="badge" style="background:#555">${esc(a.agent)} · ${esc(a.kind)}</span>
        ${esc(a.body)}</div>`)
    .join('');
  return `<details style="margin-top:4px">
      <summary style="cursor:pointer;color:var(--muted);font-size:0.8em">${item.annotations.length} annotation(s)</summary>
      <div style="margin-top:4px">${rows}</div>
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

function editForm(item, name) {
  const isReadyToGroom = item.status === 'ready-to-groom';
  return `<details style="margin-top:6px">
    <summary style="cursor:pointer;color:var(--muted);font-size:0.75em">edit</summary>
    <form method="post" action="/apps/${name}/edit" style="margin-top:6px;display:flex;flex-direction:column;gap:6px">
      <input type="hidden" name="id" value="${esc(item.id)}">
      <input class="btn" name="title" value="${esc(item.title)}" placeholder="Title" style="font-size:0.85em">
      <textarea class="btn" name="description" rows="3" placeholder="Description" style="font-size:0.85em;resize:vertical">${esc(item.description || '')}</textarea>
      <label style="font-size:0.8em;display:flex;align-items:center;gap:6px;cursor:pointer">
        <input type="checkbox" name="readyToGroom" value="1"${isReadyToGroom ? ' checked' : ''}>
        ready to groom
      </label>
      <button class="btn primary" type="submit" style="padding:2px 10px;font-size:0.8em;align-self:flex-start">Save</button>
    </form>
  </details>`;
}

export function createApp({ name }) {
  const router = express.Router();

  router.get('/', (req, res) => {
    const items = read();
    const filter = req.query.status || 'all';

    const visible = filter === 'all' ? items : items.filter((i) => i.status === filter);

    const filterLinks = ['all', ...STATUSES].map((s) =>
      `<a href="?status=${s}" class="btn${filter === s ? ' primary' : ''}" style="padding:3px 10px;font-size:0.8em">${s}</a>`
    ).join(' ');

    const rows = visible.map((item) => `
      <tr>
        <td style="color:var(--muted);font-size:0.8em">${esc(item.id)}</td>
        <td>
          <strong>${esc(item.title)}</strong>
          ${item.description ? `<br><span style="color:var(--muted);font-size:0.85em">${esc(item.description)}</span>` : ''}
          ${editForm(item, name)}
        </td>
        <td>${esc(item.type || '—')}</td>
        <td>${statusBadge(item.status)}</td>
        <td style="font-size:0.8em;color:var(--muted)">${esc(item.estimate || '—')}</td>
        <td style="font-size:0.8em">${gateCell(item, name)}</td>
        <td style="font-size:0.8em;color:var(--muted)">${esc(item.addedBy || '—')}</td>
        <td style="font-size:0.8em;color:var(--muted)">${item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '—'}</td>
        <td>
          <form method="post" action="/apps/${name}/status" style="display:flex;gap:4px;align-items:center">
            <input type="hidden" name="id" value="${esc(item.id)}">
            <select name="status" class="btn" style="padding:2px 6px;font-size:0.8em">
              ${STATUSES.map((s) => `<option${item.status === s ? ' selected' : ''}>${s}</option>`).join('')}
            </select>
            <button class="btn" style="padding:2px 8px;font-size:0.8em">Set</button>
          </form>
        </td>
      </tr>
      ${item.annotations.length ? `<tr>
        <td></td>
        <td colspan="8" style="padding-top:0;padding-bottom:10px">${annotationsBlock(item)}</td>
      </tr>` : ''}`).join('');

    res.type('html').send(`<!doctype html><html data-theme="dark"><head>
      <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Backlog</title><link rel="stylesheet" href="/static/css/dark.css">
      <style>
        table { width:100%; border-collapse:collapse; }
        th, td { padding:8px 10px; text-align:left; border-bottom:1px solid var(--border,#333); vertical-align:top; }
        th { color:var(--muted); font-weight:normal; font-size:0.85em; }
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

      <div class="card">
        ${visible.length === 0
          ? '<div class="empty">No items.</div>'
          : `<table><thead><tr>
              <th>ID</th><th>Item</th><th>Type</th><th>Status</th><th>Estimate</th><th>Build gate</th><th>By</th><th>Added</th><th></th>
             </tr></thead><tbody>${rows}</tbody></table>`}
      </div>

      <p class="muted" style="font-size:0.78em;margin-top:10px">
        Pipeline: <strong>ready-to-groom</strong> → groomed (agent) → <strong>ready</strong> (you approve) → in-progress (builder claims) → done.
        <strong>groomer-blocked</strong>: agent couldn't correlate the item — edit description to reset to ready-to-groom.
      </p>
    </div></body></html>`);
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

  // Edit title/description. Saving description clears groomer-blocked → ready-to-groom.
  router.post('/edit', (req, res) => {
    const { id, title, description, readyToGroom } = req.body || {};
    const items = read();
    const item = items.find((i) => i.id === id);
    if (item) {
      if (title) item.title = String(title).slice(0, 120);
      item.description = description ? String(description).slice(0, 500) : '';
      // Toggle: if checkbox checked → ready-to-groom; unchecked → leave status alone unless blocked
      if (readyToGroom === '1') {
        item.status = 'ready-to-groom';
      } else if (item.status === 'ready-to-groom') {
        item.status = 'groomed'; // uncheck on a ready-to-groom item marks it as already groomed
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

  // ── Agent API ──────────────────────────────────────────────────────────────
  router.get('/api/items', (req, res) => res.json(read()));

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

  // GROOMER role: set groomer-blocked when the item can't be correlated.
  router.post('/api/items/:id/groom-block', (req, res) => {
    const { agent, reason } = req.body || {};
    const items = read();
    const item = items.find((i) => i.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    item.status = 'groomer-blocked';
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
  const blocked = items.filter((i) => i.status === 'groomer-blocked').length;
  const ready = items.filter((i) => i.status === 'ready' && i.approvedForBuild).length;
  return { ok: true, detail: `${items.length} items · ${readyToGroom} ready-to-groom · ${blocked} groomer-blocked · ${ready} ready to build` };
}
