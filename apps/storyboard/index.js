import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ghostStamp } from '../../src/lib/release.js';
import { listDefinitions, getKind } from './lib/kinds/index.js';
import {
  GRID, listBoards, getBoard, createBoard, deleteBoard,
  listCards, createCard, updateCard, deleteCard,
  listEdges, createEdge, deleteEdge,
} from './lib/store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOADED_AT = Date.now();
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const meta = {
  name: 'Storyboard',
  description: 'Free-form collaboration canvas: drag cards, connect them, hand them off to other apps.',
  version: '0.1.3',
};

// All card actions — even instant ones — go through one async/pollable
// dispatch so a future LLM-backed action (persona consult) doesn't need a
// second, slower-path contract. The log is module-scope/ephemeral by design.
const actionLog = new Map();
const ACTION_HANDLERS = {
  delete: (boardId, card) => {
    deleteCard(boardId, card.id);
    return { deleted: true };
  },
};

function runAction(boardId, card, action) {
  const jobId = `job_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const handler = ACTION_HANDLERS[action];
  if (!handler) {
    actionLog.set(jobId, { status: 'error', output: `Unknown action "${action}"` });
    return jobId;
  }
  actionLog.set(jobId, { status: 'running', output: null });
  setImmediate(() => {
    try {
      const result = handler(boardId, card);
      actionLog.set(jobId, { status: 'ok', output: result });
    } catch (err) {
      actionLog.set(jobId, { status: 'error', output: err.message });
    }
  });
  return jobId;
}

export function createApp({ name }) {
  const router = express.Router();
  const base = `/apps/${name}`;

  // ── Board picker ────────────────────────────────────────────────────────
  router.get('/', (req, res) => {
    const boards = listBoards();
    const cards = boards
      .map((b) => `
        <div class="card">
          <h2><a href="${base}/boards/${esc(b.id)}">${esc(b.name)}</a></h2>
          <div class="meta">created ${new Date(b.createdAt).toLocaleString()}</div>
          <div class="card-actions">
            <form method="post" action="${base}/boards/${esc(b.id)}/delete">
              <button class="btn" type="submit">Delete</button>
            </form>
          </div>
        </div>`)
      .join('');

    res.type('html').send(`<!doctype html><html data-theme="dark"><head>
      <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Storyboard</title><link rel="stylesheet" href="/static/css/dark.css">
    </head><body><div class="wrap">
      <header class="site"><h1>🗺️ Storyboard</h1><a class="muted" href="/">← Dashboard</a></header>
      <div class="card" style="margin-bottom:16px">
        <form method="post" action="${base}/boards">
          <div class="row">
            <input class="btn" name="name" placeholder="New board name" required style="flex:1">
            <button class="btn primary" type="submit">Create board</button>
          </div>
        </form>
      </div>
      ${boards.length === 0 ? '<div class="empty">No boards yet.</div>' : `<div class="row" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px">${cards}</div>`}
    </div>
    ${ghostStamp({ version: meta.version, loadedAt: LOADED_AT })}</body></html>`);
  });

  router.post('/boards', (req, res) => {
    const board = createBoard({ name: req.body?.name });
    res.redirect(`${base}/boards/${board.id}`);
  });

  router.post('/boards/:id/delete', (req, res) => {
    deleteBoard(req.params.id);
    res.redirect(base);
  });

  // ── Canvas page ─────────────────────────────────────────────────────────
  router.get('/boards/:id', (req, res) => {
    const board = getBoard(req.params.id);
    if (!board) return res.status(404).type('html').send('<p>Board not found.</p>');

    res.type('html').send(`<!doctype html><html data-theme="dark"><head>
      <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>${esc(board.name)} · Storyboard</title><link rel="stylesheet" href="/static/css/dark.css">
      <style>
        .sb-toolbar { display:flex; justify-content:space-between; align-items:center; padding:10px 16px; border-bottom:1px solid var(--border); }
        .sb-canvas { position:relative; width:100%; height:calc(100vh - 56px); overflow:auto;
          background-image: radial-gradient(var(--border) 1px, transparent 1px); background-size: ${GRID}px ${GRID}px; }
        .sb-card { position:absolute; background:var(--bg-elev); border:1px solid var(--border); border-radius:8px; overflow:hidden; display:flex; flex-direction:column; }
        .sb-card.linking { border-color: var(--accent); }
        .sb-card-head { display:flex; justify-content:space-between; align-items:center; padding:4px 8px; border-bottom:1px solid var(--border); font-size:11px; color:var(--text-dim); cursor:grab; flex:none; }
        .sb-card-body { flex:1; overflow:auto; font-size:13px; }
        .sb-card-body iframe { width:100%; height:100%; border:0; }
        .sb-code { font-family:var(--mono); font-size:12px; white-space:pre; overflow:auto; margin:0; padding:8px; }
        .sb-card-body p, .sb-card-body h3, .sb-card-body h4, .sb-card-body ul { margin:0 0 8px; padding:0 8px; }
        .sb-card-body p:first-child, .sb-card-body h3:first-child { margin-top:8px; }
        .sb-dots { font-size:11px; padding:0 4px; }
        .sb-radial { position:absolute; display:none; width:100px; height:100px; }
        .sb-radial button { position:absolute; width:36px; height:36px; border-radius:50%; padding:0; font-size:10px; line-height:1; }
        #sb-edges { position:absolute; top:0; left:0; pointer-events:none; }

        .sb-popover { position:absolute; display:none; background:var(--bg-elev); border:1px solid var(--border);
          border-radius:8px; padding:6px; flex-direction:column; gap:2px; z-index:20; min-width:160px; }
        .sb-popover button { text-align:left; }

        dialog#sb-add-dialog { position:fixed; top:0; right:0; left:auto; margin:0; height:100vh; max-height:100vh;
          width:420px; max-width:90vw; background:var(--bg-elev); color:var(--text); border:0; border-left:1px solid var(--border);
          border-radius:0; padding:0; display:flex; flex-direction:column; }
        dialog#sb-add-dialog::backdrop { background:rgba(0,0,0,0.4); }
        .sb-flyout-head { padding:16px 18px; border-bottom:1px solid var(--border); flex:none; }
        .sb-flyout-body { flex:1; overflow:auto; padding:0 18px; }
        .sb-flyout-foot { padding:14px 18px; border-top:1px solid var(--border); flex:none; }
        .sb-kind-list { display:flex; flex-direction:column; gap:6px; margin:14px 0; }
        .sb-kind-tile { text-align:left; padding:10px 12px; border:1px solid var(--border); border-radius:8px;
          background:var(--bg-elev-2); cursor:pointer; color:var(--text); display:flex; flex-direction:column; gap:2px; }
        .sb-kind-tile:hover { border-color:var(--accent); }
        .sb-kind-tile.selected { border-color:var(--accent); background:var(--accent-dim); }
        .sb-kind-tile .k-id { font-weight:600; font-size:13px; }
        .sb-kind-tile .k-desc { font-size:11px; color:var(--text-dim); line-height:1.4; }
        .sb-detail-section { margin-top:18px; }
        .sb-detail-section h4 { font-size:11px; text-transform:uppercase; letter-spacing:.03em; color:var(--text-dim); margin:0 0 8px; }
        .sb-field { margin-bottom:10px; }
        .sb-field label { display:block; font-size:12px; color:var(--text-dim); margin-bottom:4px; }
        .sb-field input, .sb-field textarea { width:100%; background:var(--bg-elev-2); color:var(--text);
          border:1px solid var(--border); border-radius:6px; padding:6px 8px; font-family:inherit; box-sizing:border-box; }
        .sb-field textarea { min-height:70px; font-family:var(--mono); font-size:12px; }
        .sb-dialog-error { color:var(--bad); font-size:12px; margin-top:8px; }
      </style>
    </head><body>
      <div class="sb-toolbar">
        <div><strong>${esc(board.name)}</strong> <a class="muted" href="${base}">← boards</a></div>
        <div class="row" style="position:relative">
          <span class="muted" id="sb-link-hint" style="display:none;font-size:12px">Click a card to link to…</span>
          <button class="btn" id="sb-board-menu-btn">⋯ board</button>
          <div class="sb-popover" id="sb-board-menu">
            <button type="button" class="btn" data-action="add-card">+ Add card</button>
          </div>
        </div>
      </div>
      <div class="sb-canvas" id="sb-canvas">
        <svg id="sb-edges"></svg>
        <div class="sb-radial" id="sb-radial">
          <button data-action="link" style="left:32px;top:0" title="Link to another card">Link</button>
          <button data-action="delete" style="left:64px;top:32px" title="Delete card">Del</button>
        </div>
      </div>

      <dialog id="sb-add-dialog">
        <div class="sb-flyout-head">
          <h3 style="margin:0 0 4px">Add card</h3>
          <p class="muted" style="font-size:12px;margin:0">Pick a kind, then fill it in.</p>
        </div>
        <div class="sb-flyout-body">
          <div class="sb-kind-list" id="sb-kind-grid"></div>
          <div id="sb-kind-detail"></div>
        </div>
        <div class="sb-flyout-foot">
          <div class="sb-dialog-error" id="sb-add-error" hidden></div>
          <div class="row" style="justify-content:flex-end;gap:8px">
            <button type="button" class="btn" id="sb-add-cancel">Cancel</button>
            <button type="button" class="btn primary" id="sb-add-create" disabled>Create</button>
          </div>
        </div>
      </dialog>

      <script>
        const BASE = ${JSON.stringify(base)};
        const BOARD_ID = ${JSON.stringify(board.id)};
        const GRID = ${GRID};
      </script>
      <script src="${base}/assets/canvas.js?v=${LOADED_AT}"></script>
      ${ghostStamp({ version: meta.version, loadedAt: LOADED_AT })}
    </body></html>`);
  });

  router.use('/assets', express.static(path.join(__dirname, 'public')));

  // ── Agent-facing contract ───────────────────────────────────────────────
  router.get('/api/contract', (req, res) => {
    res.json({ grid: GRID, kinds: listDefinitions(), coreActions: ['delete', 'link'] });
  });

  // ── Boards API ──────────────────────────────────────────────────────────
  router.get('/api/boards', (req, res) => res.json(listBoards()));
  router.post('/api/boards', (req, res) => res.json(createBoard({ name: req.body?.name })));

  // ── Cards API ────────────────────────────────────────────────────────────
  router.get('/api/boards/:id/cards', (req, res) => res.json(listCards(req.params.id)));

  router.post('/api/boards/:id/cards', (req, res) => {
    const { kind, x, y, w, h, payload } = req.body || {};
    if (!getKind(kind)) return res.status(400).json({ error: `Unknown kind "${kind}"` });
    res.status(201).json(createCard(req.params.id, { kind, x, y, w, h, payload }));
  });

  router.patch('/api/boards/:id/cards/:cardId', (req, res) => {
    const card = updateCard(req.params.id, req.params.cardId, req.body || {});
    if (!card) return res.status(404).json({ error: 'Not found' });
    res.json(card);
  });

  router.get('/api/boards/:id/cards/:cardId/render', (req, res) => {
    const card = listCards(req.params.id).find((c) => c.id === req.params.cardId);
    if (!card) return res.status(404).json({ error: 'Not found' });
    const kind = getKind(card.kind);
    if (!kind) return res.status(400).json({ error: `Unknown kind "${card.kind}"` });
    res.json({ renderMode: kind.definition.renderMode, html: kind.render(card.payload) });
  });

  router.post('/api/render-preview', (req, res) => {
    const { kind: kindId, payload } = req.body || {};
    const kind = getKind(kindId);
    if (!kind) return res.status(400).json({ error: `Unknown kind "${kindId}"` });
    res.json({ renderMode: kind.definition.renderMode, html: kind.render(payload) });
  });

  // ── Generic, async/pollable action dispatch ────────────────────────────
  router.post('/api/boards/:id/cards/:cardId/actions/:action', (req, res) => {
    const card = listCards(req.params.id).find((c) => c.id === req.params.cardId);
    if (!card) return res.status(404).json({ error: 'Not found' });
    const jobId = runAction(req.params.id, card, req.params.action);
    res.status(202).json({ jobId });
  });

  router.get('/api/boards/:id/actions/:jobId', (req, res) => {
    const entry = actionLog.get(req.params.jobId);
    if (!entry) return res.status(404).json({ error: 'Not found' });
    res.json(entry);
  });

  // ── Edges API ────────────────────────────────────────────────────────────
  router.get('/api/boards/:id/edges', (req, res) => res.json(listEdges(req.params.id)));

  router.post('/api/boards/:id/edges', (req, res) => {
    const { from, to, kind } = req.body || {};
    res.status(201).json(createEdge(req.params.id, { from, to, kind }));
  });

  router.delete('/api/boards/:id/edges/:edgeId', (req, res) => {
    deleteEdge(req.params.id, req.params.edgeId);
    res.status(204).end();
  });

  return router;
}

export function health() {
  const boards = listBoards();
  const totalCards = boards.reduce((sum, b) => sum + listCards(b.id).length, 0);
  return { ok: true, detail: `${boards.length} boards · ${totalCards} cards` };
}
