import express from 'express';
import { subscribe, getActiveRuns, listLogDates, getRunsForDate } from '../../src/llmObserver.js';
import { ghostStamp } from '../../src/lib/release.js';

// Module-load epoch — resets on process restart and on a dashboard Restart.
const LOADED_AT = Date.now();

export const meta = {
  name: 'Observability',
  description: 'Live tail + history for every Claude call made across the sandbox (scheduler jobs, engine agents/skills, storyboard chat, …).',
  version: '1.0.0',
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => new Date().toISOString().slice(0, 10);

const STYLE = `
  .obs-grid { display:grid; grid-template-columns: 220px 1fr 320px; gap:14px; align-items:start; }
  @media (max-width: 900px) { .obs-grid { grid-template-columns: 1fr; } }
  .obs-tree { font-size:0.85em; }
  .obs-tree .node { padding:3px 6px; border-radius:4px; cursor:pointer; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .obs-tree .node:hover { background:var(--bg2,#1a1a1a); }
  .obs-tree .node.active { background:var(--accent,#7c6af7); color:#fff; }
  .obs-tree .app { font-weight:600; margin-top:8px; }
  .obs-tree .feature { padding-left:14px; }
  .obs-tree .agent { padding-left:28px; color:var(--muted); }
  .obs-tree .count { float:right; opacity:0.6; }
  .run-row { border-bottom:1px solid var(--border,#333); padding:8px 0; }
  .run-row:last-child { border-bottom:none; }
  .run-top { display:flex; justify-content:space-between; gap:8px; font-size:0.88em; cursor:pointer; }
  .run-tags { color:var(--muted); font-size:0.8em; margin-top:2px; }
  .run-body { display:none; margin-top:8px; font-size:0.8em; }
  .run-row.open .run-body { display:block; }
  .run-body pre { background:var(--bg2,#1a1a1a); padding:8px; border-radius:4px; white-space:pre-wrap; max-height:200px; overflow:auto; margin:6px 0; }
  .tool-line { font-family:monospace; font-size:0.85em; color:var(--muted); padding:2px 0; }
  .badge-status { display:inline-block; padding:1px 8px; border-radius:10px; font-size:0.75em; color:#fff; }
  .feed { font-family:monospace; font-size:0.78em; line-height:1.7; max-height:520px; overflow:auto; }
  .feed .ts { color:var(--muted); margin-right:6px; }
  .feed .tool { color:#7cc4ff; }
  .feed .text { color:var(--muted); }
  .feed .end-ok { color:#4caf50; }
  .feed .end-error { color:#f44336; }
  .feed .end-blocked { color:#ff9800; }
  select, input[type=date] { background:var(--bg2,#1a1a1a); color:var(--fg,#eee); border:1px solid var(--border,#333); border-radius:4px; padding:5px 8px; }
`;

function statusColor(status) {
  return status === 'ok' ? '#4caf50' : status === 'running' ? '#ff9800' : status === 'blocked' ? '#ff9800' : status === 'error' ? '#f44336' : '#555';
}

export function createApp({ name }) {
  const router = express.Router();
  const base = `/apps/${name}`;

  router.get('/', (req, res) => {
    res.type('html').send(`<!doctype html><html data-theme="dark"><head>
      <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Observability</title><link rel="stylesheet" href="/static/css/dark.css"><style>${STYLE}</style>
    </head><body><div class="wrap">
      <header class="site"><h1>👁 Observability</h1><a class="muted" href="/">← Dashboard</a></header>
      <p class="sub" style="margin-top:-8px">Every Claude call across the sandbox — grouped by app → feature → agent. History is per-day JSONL under <code>data/runs/</code> (gitignored).</p>

      <div class="obs-grid">
        <!-- Groupings -->
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <strong style="font-size:0.85em">Filter</strong>
            <a href="#" id="clearFilter" class="muted" style="font-size:0.78em">clear</a>
          </div>
          <div class="obs-tree" id="tree"><div class="empty">Loading…</div></div>
        </div>

        <!-- Runs -->
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:8px">
            <strong id="runsTitle" style="font-size:0.9em">Runs</strong>
            <div style="display:flex;gap:8px;align-items:center">
              <span id="liveBadge" class="badge-status" style="background:#4caf50;display:none">● live</span>
              <select id="dateSelect"></select>
            </div>
          </div>
          <div id="runList"><div class="empty">No runs yet.</div></div>
        </div>

        <!-- Live feed -->
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <strong style="font-size:0.85em">Live feed</strong>
            <span id="sseStatus" class="sub" style="font-size:0.75em">connecting…</span>
          </div>
          <div class="feed" id="feed"></div>
        </div>
      </div>
    </div>${ghostStamp({ version: meta.version, loadedAt: LOADED_AT })}
    <script>
      const BASE = ${JSON.stringify(base)};
      let filter = null; // { app, feature, agent } — any subset
      let runsByDate = new Map(); // date -> runs[]
      let active = [];
      let selectedDate = ${JSON.stringify(today())};

      const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
      const fmtMs = (ms) => ms == null ? '—' : ms < 1000 ? ms + 'ms' : (ms/1000).toFixed(1) + 's';
      const statusColor = (s) => s === 'ok' ? '#4caf50' : s === 'running' ? '#ff9800' : s === 'blocked' ? '#ff9800' : s === 'error' ? '#f44336' : '#555';
      const matches = (r) => !filter || ((!filter.app || r.app === filter.app) && (!filter.feature || r.feature === filter.feature) && (!filter.agent || r.agent === filter.agent));

      async function loadDates() {
        const dates = await fetch(BASE + '/api/dates').then(r => r.json());
        const sel = document.getElementById('dateSelect');
        const opts = [${JSON.stringify(today())}, ...dates.filter(d => d !== ${JSON.stringify(today())})];
        sel.innerHTML = opts.map(d => '<option value="' + d + '"' + (d === selectedDate ? ' selected' : '') + '>' + (d === ${JSON.stringify(today())} ? d + ' (today)' : d) + '</option>').join('');
        sel.onchange = () => { selectedDate = sel.value; loadRuns(); };
      }

      async function loadRuns() {
        const runs = await fetch(BASE + '/api/runs?date=' + selectedDate).then(r => r.json());
        runsByDate.set(selectedDate, runs);
        render();
      }

      async function loadActive() {
        active = await fetch(BASE + '/api/active').then(r => r.json());
        render();
      }

      function buildTree(runs) {
        const tree = new Map(); // app -> feature -> Set(agent)
        for (const r of [...active, ...runs]) {
          if (!r.app) continue;
          if (!tree.has(r.app)) tree.set(r.app, new Map());
          const feats = tree.get(r.app);
          const fkey = r.feature || '(none)';
          if (!feats.has(fkey)) feats.set(fkey, new Set());
          feats.get(fkey).add(r.agent || '(none)');
        }
        return tree;
      }

      function renderTree(runs) {
        const tree = buildTree(runs);
        const el = document.getElementById('tree');
        if (tree.size === 0) { el.innerHTML = '<div class="empty">No calls seen yet.</div>'; return; }
        let html = '';
        for (const [app, feats] of tree) {
          const appActive = filter && filter.app === app && !filter.feature ? ' active' : '';
          html += '<div class="node app' + appActive + '" data-app="' + esc(app) + '">' + esc(app) + '</div>';
          for (const [feature, agents] of feats) {
            const featActive = filter && filter.app === app && filter.feature === feature && !filter.agent ? ' active' : '';
            html += '<div class="node feature' + featActive + '" data-app="' + esc(app) + '" data-feature="' + esc(feature) + '">' + esc(feature) + '</div>';
            for (const agent of agents) {
              const agentActive = filter && filter.app === app && filter.feature === feature && filter.agent === agent ? ' active' : '';
              html += '<div class="node agent' + agentActive + '" data-app="' + esc(app) + '" data-feature="' + esc(feature) + '" data-agent="' + esc(agent) + '">' + esc(agent) + '</div>';
            }
          }
        }
        el.innerHTML = html;
        el.querySelectorAll('.node').forEach(n => n.onclick = () => {
          filter = { app: n.dataset.app, feature: n.dataset.feature, agent: n.dataset.agent };
          render();
        });
      }

      function runRowHtml(r, isActive) {
        const status = isActive ? 'running' : r.status;
        const tags = [r.app, r.feature, r.agent].filter(Boolean).join(' → ');
        const usage = r.usage ? (r.usage.input_tokens || 0) + ' in / ' + (r.usage.output_tokens || 0) + ' out' : '';
        const cost = r.costUsd != null ? '$' + Number(r.costUsd).toFixed(4) : '';
        const preview = (r.text || '').slice(0, 240);
        const toolLines = (r.toolCalls || []).map(t => '<div class="tool-line">🔧 ' + esc(t.tool) + ' ' + esc(t.input || '') + '</div>').join('') || '<div class="sub">No tool calls.</div>';
        return '<div class="run-row" data-runid="' + esc(r.runId) + '">' +
          '<div class="run-top" onclick="this.parentElement.classList.toggle(\\'open\\')">' +
            '<span>' + esc(r.agent || r.feature || r.app || '(run)') + '</span>' +
            '<span><span class="badge-status" style="background:' + statusColor(status) + '">' + esc(status) + '</span> ' + fmtMs(r.ms) + '</span>' +
          '</div>' +
          '<div class="run-tags">' + esc(tags) + (usage ? ' · ' + usage : '') + (cost ? ' · ' + cost : '') + '</div>' +
          '<div class="run-body">' + toolLines + (preview ? '<pre>' + esc(preview) + (r.text && r.text.length > 240 ? '…' : '') + '</pre>' : '') + '</div>' +
        '</div>';
      }

      function render() {
        renderTree(runsByDate.get(selectedDate) || []);
        const runs = (runsByDate.get(selectedDate) || []).filter(matches);
        const activeFiltered = active.filter(matches);
        document.getElementById('liveBadge').style.display = activeFiltered.length ? 'inline-block' : 'none';
        document.getElementById('runsTitle').textContent = 'Runs' + (filter ? ' — ' + [filter.app, filter.feature, filter.agent].filter(Boolean).join(' → ') : '');
        const html = activeFiltered.map(r => runRowHtml(r, true)).join('') + runs.map(r => runRowHtml(r, false)).join('');
        document.getElementById('runList').innerHTML = html || '<div class="empty">No runs for this filter/date.</div>';
      }

      document.getElementById('clearFilter').onclick = (e) => { e.preventDefault(); filter = null; render(); };

      function feedLine(cls, html) {
        const feed = document.getElementById('feed');
        const atBottom = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 40;
        const div = document.createElement('div');
        div.className = cls;
        div.innerHTML = html;
        feed.appendChild(div);
        while (feed.childNodes.length > 300) feed.removeChild(feed.firstChild);
        if (atBottom) feed.scrollTop = feed.scrollHeight;
      }

      function tagStr(e) { return [e.app, e.feature, e.agent].filter(Boolean).join('/'); }

      function connectStream() {
        const es = new EventSource(BASE + '/stream');
        es.onopen = () => document.getElementById('sseStatus').textContent = 'connected';
        es.onerror = () => document.getElementById('sseStatus').textContent = 'reconnecting…';
        es.onmessage = (msg) => {
          const e = JSON.parse(msg.data);
          if (filter && !matches(e)) return;
          const time = e.ts ? e.ts.slice(11, 19) : '';
          if (e.type === 'run_start') {
            feedLine('start', '<span class="ts">' + time + '</span>▶ ' + esc(tagStr(e)));
            loadActive();
          } else if (e.type === 'tool_call') {
            feedLine('tool', '<span class="ts">' + time + '</span>🔧 ' + esc(tagStr(e)) + ' ' + esc(e.tool));
            loadActive();
          } else if (e.type === 'tool_result') {
            feedLine('tool', '<span class="ts">' + time + '</span>↳ ' + (e.ok ? 'ok' : 'error'));
          } else if (e.type === 'run_end') {
            feedLine('end-' + e.status, '<span class="ts">' + time + '</span>■ ' + esc(tagStr(e)) + ' — ' + esc(e.status) + ' (' + fmtMs(e.ms) + ')');
            loadActive();
            if (selectedDate === ${JSON.stringify(today())}) loadRuns();
          }
        };
      }

      loadDates();
      loadRuns();
      loadActive();
      connectStream();
      setInterval(loadActive, 5000);
    </script>
    </body></html>`);
  });

  // ── Live event stream (SSE) — always on, no dedicated "live mode" toggle.
  // Cost is a couple of listeners on the shared bus; cheap enough to leave
  // running whenever this app's dashboard tab is open.
  router.get('/stream', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write('\n');
    const unsubscribe = subscribe((event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    });
    const keepalive = setInterval(() => res.write(': ping\n\n'), 20000);
    req.on('close', () => {
      clearInterval(keepalive);
      unsubscribe();
    });
  });

  router.get('/api/active', (req, res) => {
    res.json(getActiveRuns());
  });

  router.get('/api/dates', async (req, res) => {
    res.json(await listLogDates());
  });

  router.get('/api/runs', async (req, res) => {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date || '') ? req.query.date : today();
    res.json(await getRunsForDate(date));
  });

  return router;
}

export function health() {
  const active = getActiveRuns();
  return { ok: true, detail: `${active.length} run(s) in flight` };
}
