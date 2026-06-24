import express from 'express';
import { getSchedules, getLog, getDrift, triggerNow, updateJob, addJob, deleteJob, readPrompt, writePrompt } from '../../src/scheduler.js';
import cron from 'node-cron';
import { ghostStamp } from '../../src/lib/release.js';

// Module-load epoch — resets on process restart and on a dashboard Restart.
const LOADED_AT = Date.now();

export const meta = {
  name: 'Scheduler',
  description: 'Manage and trigger scheduled agent jobs.',
  version: '1.2.1',
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const pad = (x) => String(x).padStart(2, '0');

// Maps the "Every N unit" canonical crons the frequency builder produces back
// into { n, unit, time? }; anything else returns null → form opens in Advanced.
// Days carry a time-of-day (minute hour */N * *).
function parseInterval(expr) {
  let m;
  if ((m = /^\*\/(\d+) \* \* \* \*$/.exec(expr))) return { n: +m[1], unit: 'minutes' };
  if ((m = /^0 \*\/(\d+) \* \* \*$/.exec(expr))) return { n: +m[1], unit: 'hours' };
  if ((m = /^(\d+) (\d+) (?:\*|\*\/(\d+)) \* \*$/.exec(expr))) return { n: m[3] ? +m[3] : 1, unit: 'days', time: `${pad(+m[2])}:${pad(+m[1])}` };
  return null;
}

function describeCron(expr) {
  if (!cron.validate(expr)) return '⚠ Invalid cron expression';
  const b = parseInterval(expr);
  if (b) return b.unit === 'days' ? `every ${b.n} day(s) at ${b.time}` : `every ${b.n} ${b.unit}`;
  const [min, hour, dom, month, dow] = expr.split(' ');
  const parts = [];
  if (min === '0' && hour !== '*') parts.push(`at ${hour.padStart(2,'0')}:00`);
  else if (min !== '*' && min !== '0') parts.push(`at :${min.padStart(2,'0')}`);
  if (dow !== '*') {
    const range = dow.includes('-') ? dow.split('-').map(d => DAYS[+d]).join('–') : null;
    const list = dow.includes(',') ? dow.split(',').map(d => DAYS[+d]).join(', ') : null;
    parts.push(range || list || DAYS[+dow] || `dow ${dow}`);
  }
  if (dom !== '*') parts.push(`on the ${dom}${dom==='1'?'st':dom==='2'?'nd':dom==='3'?'rd':'th'}`);
  if (month !== '*') parts.push(`in ${MONTHS[(+month)-1] || month}`);
  return parts.length ? parts.join(', ') : 'custom schedule';
}

function statusBadge(status) {
  const color = status === 'ok' ? 'var(--green,#4caf50)' : status === 'running' ? 'var(--yellow,#ff9800)' : status === 'error' ? 'var(--red,#f44336)' : '#555';
  return `<span class="badge" style="background:${color}">${esc(status ?? 'never')}</span>`;
}

const fmtMs = (ms) => ms == null ? '—' : ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;

const STYLE = `
  table { width:100%; border-collapse:collapse; }
  th, td { padding:7px 10px; text-align:left; border-bottom:1px solid var(--border,#333); vertical-align:middle; }
  th { color:var(--muted); font-weight:normal; font-size:0.8em; text-transform:uppercase; letter-spacing:0.04em; }
  tbody tr:last-child td { border-bottom:none; }
  .sub { font-size:0.74em; color:var(--muted); margin-top:2px; }
  .icon { text-decoration:none; font-size:1.05em; opacity:0.7; }
  .icon:hover { opacity:1; }
  textarea { width:100%; box-sizing:border-box; background:var(--bg2,#1a1a1a); color:var(--fg,#eee);
    border:1px solid var(--border,#333); border-radius:4px; padding:10px; font-family:monospace;
    font-size:0.85em; resize:vertical; }
  input[type=text], select, input[type=number] { background:var(--bg2,#1a1a1a); color:var(--fg,#eee);
    border:1px solid var(--border,#333); border-radius:4px; padding:6px 8px; box-sizing:border-box; }
  input[type=checkbox] { accent-color:var(--accent,#7c6af7); }
  input[type=number] { width:72px; }
  .field { margin-bottom:14px; }
  .field > label { display:block; font-size:0.8em; color:var(--muted); margin-bottom:5px; }
  .field input[type=text] { width:100%; }
  .hint { font-size:0.75em; color:var(--muted); margin-top:5px; }
  .danger { color:var(--red,#f44336); }
  .adv { display:inline-flex; gap:6px; align-items:center; font-size:0.8em; color:var(--muted);
    margin-top:10px; cursor:pointer; user-select:none; }
  .builder { display:flex; gap:8px; align-items:center; }
  .builder .lab { font-size:0.85em; color:var(--muted); }
`;

export function createApp({ name }) {
  const router = express.Router();
  const base = `/apps/${name}`;

  // One list row per job — kept small so the table stays modular.
  const jobRow = (job, entry) => {
    const valid = cron.validate(job.cron);
    return `<tr>
      <td>
        <a href="${base}/job/${esc(job.id)}">${esc(job.name || job.id)}</a>
        <div class="sub"><code>${esc(job.id)}</code></div>
      </td>
      <td>
        <code>${esc(job.cron)}</code>
        <div class="sub ${valid ? '' : 'danger'}">${esc(describeCron(job.cron))}</div>
      </td>
      <td>${job.enabled
        ? '<span class="badge" style="background:#4caf50">on</span>'
        : '<span class="badge" style="background:#555">off</span>'}</td>
      <td>${statusBadge(entry.status)}
        <div class="sub">${entry.lastRun ? esc(new Date(entry.lastRun).toLocaleString()) : 'never run'}</div>
      </td>
      <td style="white-space:nowrap;text-align:right">
        <a class="icon" href="${base}/job/${esc(job.id)}#prompt" title="Open prompt (${esc(job.prompt)})">📄</a>
        <form method="post" action="${base}/trigger" style="display:inline;margin:0 4px">
          <input type="hidden" name="id" value="${esc(job.id)}">
          <button class="btn primary" style="padding:2px 10px;font-size:0.8em">Run</button>
        </form>
        <a href="${base}/job/${esc(job.id)}" class="btn" style="padding:2px 10px;font-size:0.8em">Edit</a>
      </td>
    </tr>`;
  };

  // ── List ──────────────────────────────────────────────────────────────────
  router.get('/', (req, res) => {
    const schedules = getSchedules();
    const log = getLog();
    const anyRunning = schedules.some((j) => (log[j.id] || {}).status === 'running');
    const rows = schedules.map((job) => jobRow(job, log[job.id] || {})).join('');

    const drift = getDrift();
    const driftBanner = drift.length === 0 ? '' : `
      <div class="card" style="margin-bottom:14px;border-color:var(--yellow,#ff9800)">
        <strong style="color:var(--yellow,#ff9800)">⚠ Reverted ${drift.length} out-of-band edit(s) to schedules.json</strong>
        <div class="sub" style="margin-top:6px">This config is edited only through the selectors below; direct/agent edits are undone automatically.</div>
        <ul style="margin:8px 0 0;padding-left:18px">
          ${drift.slice(0, 5).map((d) => `<li class="sub">${esc(new Date(d.at).toLocaleString())} — ${esc(d.detail)}</li>`).join('')}
        </ul>
      </div>`;

    res.type('html').send(`<!doctype html><html data-theme="dark"><head>
      <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      ${anyRunning ? '<meta http-equiv="refresh" content="3">' : ''}
      <title>Scheduler</title><link rel="stylesheet" href="/static/css/dark.css"><style>${STYLE}</style>
    </head><body><div class="wrap">
      <header class="site"><h1>⏱ Scheduler${anyRunning ? ' <span class="badge" style="background:var(--yellow,#ff9800)">running…</span>' : ''}</h1><a class="muted" href="/">← Dashboard</a></header>
      ${driftBanner}
      <div class="card">
        ${schedules.length === 0
          ? '<div class="empty">No jobs yet. Add one below.</div>'
          : `<table><thead><tr>
              <th>Job</th><th>Schedule</th><th>On</th><th>Last status</th><th></th>
             </tr></thead><tbody>${rows}</tbody></table>`}
      </div>

      <div class="card" style="margin-top:14px">
        <form method="post" action="${base}/add" style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">
          <div style="flex:1;min-width:140px"><label class="sub" style="display:block;margin-bottom:4px">New job ID</label>
            <input type="text" name="id" placeholder="my-job" style="width:100%"></div>
          <div style="flex:2;min-width:180px"><label class="sub" style="display:block;margin-bottom:4px">Name</label>
            <input type="text" name="name" placeholder="My Job" style="width:100%"></div>
          <button class="btn primary" type="submit">+ Add</button>
        </form>
      </div>

      <p class="sub" style="margin-top:8px">Source: <code>data/schedules.json</code> · Prompts: <code>prompts/</code></p>
    </div>${ghostStamp({ version: meta.version, loadedAt: LOADED_AT })}</body></html>`);
  });

  // ── Job detail / edit ─────────────────────────────────────────────────────
  router.get('/job/:id', (req, res) => {
    const schedules = getSchedules();
    const job = schedules.find((j) => j.id === req.params.id);
    if (!job) return res.status(404).send('Job not found');
    const entry = (getLog())[job.id] || {};
    const { content: promptContent } = readPrompt(job.prompt);

    const iv = parseInterval(job.cron);
    const advanced = !iv;
    const ivN = iv ? iv.n : 15;
    const ivUnit = iv ? iv.unit : 'minutes';
    const ivTime = iv && iv.time ? iv.time : '08:00';
    const unitOpt = (u) => `<option value="${u}" ${ivUnit === u ? 'selected' : ''}>${u}</option>`;

    const history = Array.isArray(entry.history) ? entry.history.slice().reverse() : [];
    const historyRows = history.map((h) => `<tr>
        <td style="white-space:nowrap;font-size:0.8em;color:var(--muted)">${h.ts ? esc(new Date(h.ts).toLocaleString()) : '—'}</td>
        <td>${statusBadge(h.status)}</td>
        <td style="font-size:0.8em;color:var(--muted)">${fmtMs(h.ms)}</td>
        <td style="font-size:0.8em;color:var(--muted)">${esc(h.summary || '')}</td>
      </tr>`).join('');

    res.type('html').send(`<!doctype html><html data-theme="dark"><head>
      <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      ${entry.status === 'running' ? '<meta http-equiv="refresh" content="3">' : ''}
      <title>${esc(job.id)} — Scheduler</title><link rel="stylesheet" href="/static/css/dark.css"><style>${STYLE}</style>
    </head><body><div class="wrap">
      <header class="site">
        <h1>⏱ ${esc(job.name || job.id)}</h1>
        <a class="muted" href="${base}/">← Jobs</a>
      </header>

      <div class="row" style="gap:16px;align-items:flex-start;flex-wrap:wrap">

        <!-- Settings -->
        <form method="post" action="${base}/job/${esc(job.id)}/save" style="flex:1;min-width:300px">
          <div class="card">
            <h3 style="margin-top:0">Settings</h3>
            <input type="hidden" name="id" value="${esc(job.id)}">
            <div class="field"><label>Name</label>
              <input type="text" name="name" value="${esc(job.name)}"></div>
            <div class="field"><label>Description</label>
              <input type="text" name="description" value="${esc(job.description)}"></div>

            <div class="field"><label>Interval</label>
              <div id="builderRow" class="builder">
                <span class="lab">Every</span>
                <input type="number" id="bN" min="1" value="${ivN}">
                <select id="bUnit">${unitOpt('minutes')}${unitOpt('hours')}${unitOpt('days')}</select>
                <span id="bTimeWrap" class="lab" ${ivUnit === 'days' ? '' : 'hidden'}>at
                  <input type="time" id="bTime" value="${ivTime}" style="margin-left:4px"></span>
              </div>
              <label class="adv"><input type="checkbox" id="advToggle" ${advanced ? 'checked' : ''}> Advanced (raw cron)</label>
              <div id="advBox" ${advanced ? '' : 'hidden'} style="margin-top:6px">
                <input type="text" name="cron" id="cronInput" value="${esc(job.cron)}" style="width:100%;font-family:monospace">
                <div id="cronDesc" class="hint"></div>
              </div>
            </div>

            <div class="field"><label>Prompt file path</label>
              <input type="text" name="prompt" value="${esc(job.prompt)}" style="width:100%;font-family:monospace">
              <div class="hint">Relative to project root</div></div>
            <div class="field" style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
              <input type="checkbox" name="enabled" id="enabled" value="1" ${job.enabled ? 'checked' : ''}>
              <label for="enabled" style="display:inline;font-size:0.9em;color:var(--fg)">Enabled</label></div>
            <div class="row" style="gap:8px">
              <button class="btn primary" type="submit">Save settings</button>
              <button class="btn" type="submit" formaction="${base}/trigger" formnovalidate
                name="redirect" value="${base}/job/${esc(job.id)}">Run now</button>
            </div>
          </div>
        </form>

        <!-- Last run output -->
        <div class="card" style="flex:1;min-width:300px">
          <h3 style="margin-top:0">Last run ${statusBadge(entry.status)}</h3>
          ${entry.lastRun ? `<p class="sub" style="margin:0 0 8px">${esc(new Date(entry.lastRun).toLocaleString())}</p>` : ''}
          ${entry.output
            ? `<pre style="background:var(--bg2,#1a1a1a);padding:10px;border-radius:4px;font-size:0.8em;white-space:pre-wrap;overflow:auto;max-height:240px">${esc(entry.output)}</pre>`
            : '<div class="empty">No output yet.</div>'}
        </div>
      </div>

      <!-- Run history -->
      <div class="card" style="margin-top:16px">
        <h3 style="margin-top:0">Run history <span class="badge" style="background:#555">${history.length}</span></h3>
        ${history.length === 0
          ? '<div class="empty">No runs yet.</div>'
          : `<table><thead><tr><th>Time</th><th>Status</th><th>Duration</th><th>Summary</th></tr></thead><tbody>${historyRows}</tbody></table>`}
      </div>

      <!-- Prompt editor -->
      <div class="card" id="prompt" style="margin-top:16px">
        <h3 style="margin-top:0">Prompt <code style="font-size:0.8em">${esc(job.prompt)}</code></h3>
        <form method="post" action="${base}/job/${esc(job.id)}/prompt">
          <textarea name="content" rows="18">${esc(promptContent)}</textarea>
          <div style="margin-top:8px">
            <button class="btn primary" type="submit">Save prompt</button>
          </div>
        </form>
      </div>

      <!-- Danger zone -->
      <div class="card" style="margin-top:16px;border-color:var(--red,#f44336)">
        <h3 style="margin-top:0;color:var(--red,#f44336)">Danger zone</h3>
        <form method="post" action="${base}/job/${esc(job.id)}/delete"
          onsubmit="return confirm('Delete job ${esc(job.id)}?')">
          <button class="btn" style="border-color:var(--red,#f44336);color:var(--red,#f44336)" type="submit">Delete job</button>
        </form>
      </div>

    <script>
      const bN = document.getElementById('bN');
      const bUnit = document.getElementById('bUnit');
      const bTime = document.getElementById('bTime');
      const bTimeWrap = document.getElementById('bTimeWrap');
      const cronInput = document.getElementById('cronInput');
      const advToggle = document.getElementById('advToggle');
      const advBox = document.getElementById('advBox');
      const cronDesc = document.getElementById('cronDesc');
      const builderRow = document.getElementById('builderRow');

      const pad = (x) => String(x).padStart(2, '0');
      function buildCron(n, unit, time) {
        n = Math.max(1, parseInt(n, 10) || 1);
        if (unit === 'minutes') return '*/' + n + ' * * * *';
        if (unit === 'hours')   return '0 */' + n + ' * * *';
        const [h, m] = (time || '08:00').split(':');
        const dom = n === 1 ? '*' : '*/' + n;          // conventional daily form
        return (parseInt(m, 10) || 0) + ' ' + (parseInt(h, 10) || 0) + ' ' + dom + ' * *';
      }
      function parse(expr) {
        let m;
        if (m = /^\\*\\/(\\d+) \\* \\* \\* \\*$/.exec(expr)) return { n:+m[1], unit:'minutes' };
        if (m = /^0 \\*\\/(\\d+) \\* \\* \\*$/.exec(expr))   return { n:+m[1], unit:'hours' };
        if (m = /^(\\d+) (\\d+) (?:\\*|\\*\\/(\\d+)) \\* \\*$/.exec(expr)) return { n:m[3]?+m[3]:1, unit:'days', time:pad(+m[2])+':'+pad(+m[1]) };
        return null;
      }
      function describe() {
        const v = cronInput.value.trim();
        const parts = v.split(/\\s+/);
        if (parts.length !== 5) { cronDesc.textContent = '⚠ Need 5 fields (min hour dom month dow)'; cronDesc.className = 'hint danger'; return; }
        const b = parse(v);
        cronDesc.textContent = b ? (b.unit === 'days' ? 'every ' + b.n + ' day(s) at ' + b.time : 'every ' + b.n + ' ' + b.unit) : 'custom schedule';
        cronDesc.className = 'hint';
      }
      function syncFromBuilder() {
        bTimeWrap.hidden = bUnit.value !== 'days';
        cronInput.value = buildCron(bN.value, bUnit.value, bTime ? bTime.value : '08:00');
        describe();
      }
      function setAdv(on) {
        advBox.hidden = !on;
        bN.disabled = on; bUnit.disabled = on; if (bTime) bTime.disabled = on;
        builderRow.style.opacity = on ? '0.45' : '1';
        if (!on) syncFromBuilder();   // builder is authoritative when Advanced is off
      }
      bN.addEventListener('input', syncFromBuilder);
      bUnit.addEventListener('change', syncFromBuilder);
      if (bTime) bTime.addEventListener('input', syncFromBuilder);
      cronInput.addEventListener('input', describe);
      advToggle.addEventListener('change', () => setAdv(advToggle.checked));
      setAdv(advToggle.checked);
    </script>
    </div>${ghostStamp({ version: meta.version, loadedAt: LOADED_AT })}</body></html>`);
  });

  // ── Save settings ─────────────────────────────────────────────────────────
  router.post('/job/:id/save', (req, res) => {
    const { name: jobName, description, cron: cronExpr, prompt, enabled } = req.body || {};
    updateJob(req.params.id, {
      name: jobName || '',
      description: description || '',
      cron: cronExpr || '0 * * * *',
      prompt: prompt || `prompts/${req.params.id}.md`,
      enabled: enabled === '1',
    });
    res.redirect(`${base}/job/${req.params.id}`);
  });

  // ── Save prompt ───────────────────────────────────────────────────────────
  router.post('/job/:id/prompt', (req, res) => {
    const job = getSchedules().find((j) => j.id === req.params.id);
    if (job) writePrompt(job.prompt, req.body?.content || '');
    res.redirect(`${base}/job/${req.params.id}#prompt`);
  });

  // ── Delete ────────────────────────────────────────────────────────────────
  router.post('/job/:id/delete', (req, res) => {
    deleteJob(req.params.id);
    res.redirect(`${base}/`);
  });

  // ── Trigger ───────────────────────────────────────────────────────────────
  router.post('/trigger', (req, res) => {
    const { id, redirect: redir } = req.body || {};
    triggerNow(id);
    res.redirect(redir || `${base}/`);
  });

  // ── Add ───────────────────────────────────────────────────────────────────
  router.post('/add', (req, res) => {
    const { id, name: jobName } = req.body || {};
    const r = addJob({ id: (id || '').trim() || undefined, name: jobName || '' });
    res.redirect(r.ok ? `${base}/job/${r.job.id}` : `${base}/`);
  });

  // ── API ───────────────────────────────────────────────────────────────────
  router.get('/api/jobs', (req, res) => {
    const log = getLog();
    res.json(getSchedules().map((j) => ({ ...j, log: log[j.id] || null })));
  });

  return router;
}

export function health() {
  const schedules = getSchedules();
  const enabled = schedules.filter((j) => j.enabled).length;
  return { ok: true, detail: `${enabled} of ${schedules.length} jobs enabled` };
}
