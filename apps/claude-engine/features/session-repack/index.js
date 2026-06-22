import express from 'express';
import path from 'node:path';
import cron from 'node-cron';
import { html } from '../../lib/html.js';
import { jsonStore } from '../../lib/store.js';
import { buildDayRepack, readSessionRecords, scanGrouped } from './repack.js';
import { summarizeDay } from './summarize.js';

export const meta = {
  name: 'Session Repack',
  description: 'Daily recap of Claude work — zero-cost repack of local transcripts, with optional LLM summaries.',
  icon: '📋',
};

const today = () => new Date().toISOString().slice(0, 10);
const KIND_BADGE = { interactive: 'ok', automated: '', subagent: 'warn' };

export function createFeature(ctx) {
  const { ui, page, provider, base, paths } = ctx;
  const store = jsonStore({ dir: path.join(paths.data, 'repacks') });
  const router = express.Router();

  const crumb = [{ href: base, label: 'Repacks' }];
  const shell = (title, body, breadcrumb = crumb) =>
    page({ title, active: 'session-repack', breadcrumb, body });

  // Stage 1 — regenerate a day's repack, merging in any existing summaries.
  async function runRepack(date = today()) {
    let previous = null;
    try {
      previous = await store.get(date);
    } catch {
      /* first run for this day */
    }
    const day = await buildDayRepack(date, { previous });
    await store.save(day);
    return day;
  }

  // Daily in-process timer (NOT the claude -p scheduler — that would cost tokens).
  // Guarded on globalThis so module re-imports on app restart don't stack timers.
  const GUARD = Symbol.for('session-repack.cron');
  if (!globalThis[GUARD]) {
    globalThis[GUARD] = cron.schedule('55 23 * * *', () => {
      runRepack().catch((e) => console.warn(`[session-repack] daily repack failed: ${e.message}`));
    });
    console.log('[session-repack] daily repack scheduled (23:55, in-process, $0)');
  }

  // ── Library: all repacked days ─────────────────────────────────────────────
  router.get('/', async (req, res) => {
    const days = await store.list();
    const cards = days.map((d) => {
      const real = d.sessions.filter((s) => s.kind === 'interactive');
      const summarized = real.filter((s) => s.summary).length;
      return ui.card({
        title: d.date,
        badge: ui.badge(`${real.length} session${real.length === 1 ? '' : 's'}`),
        desc: real.map((s) => s.title).slice(0, 4).join(' · ') || 'No interactive sessions',
        meta: html`${fmtTokens(d.tokens)} · ${summarized}/${real.length} summarized · ${d.counts.automated || 0} automated`,
        actions: [ui.btn({ href: `${base}/${d.date}`, label: 'Open', primary: true })],
      });
    });
    const body = html`
      ${ui.pageHead({
        title: '📋 Session Repack',
        subtitle: 'Zero-cost daily recap of Claude work. Summaries are opt-in (LLM).',
        actions: html`${ui.btn({ href: `${base}/raw`, label: '🔍 Historical JSONL' })}${ui.btn({ action: 'post', name: `${base}/run`, label: '↻ Repack today', primary: true })}`,
      })}
      <div class="meta">Provider for summaries: <strong>${provider.name}</strong></div>
      ${days.length ? ui.grid(cards) : ui.empty('No repacks yet — run “Repack today”.')}`;
    res.send(shell('Repacks', body));
  });

  router.post('/run', async (req, res) => {
    const day = await runRepack(req.body?.date || today());
    res.redirect(`${base}/${day.date}`);
  });

  // ── Historical JSONL ───────────────────────────────────────────────────────
  // Flat, cross-session feed of raw records, newest first. No day selection.
  // Registered before /:date so the literal "raw" isn't parsed as a date.
  router.get('/raw', async (req, res) => {
    const type = req.query.type || 'all';
    const excludeRaw = req.query.exclude || '';
    const includeRaw = req.query.include || '';
    const excludeTerms = excludeRaw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    const includeTerms = includeRaw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    const { dates, counts } = await scanGrouped({ type });

    const sessionVisible = (s) => {
      const haystack = (s.aiTitle || s.sid).toLowerCase();
      if (includeTerms.length && !includeTerms.some((t) => haystack.includes(t))) return false;
      if (excludeTerms.length && excludeTerms.some((t) => haystack.includes(t))) return false;
      return true;
    };
    const filteredDates = dates
      .map((d) => ({ ...d, sessions: d.sessions.filter(sessionVisible) }))
      .filter((d) => d.sessions.length > 0);

    const qs = (overrides) => {
      const p = new URLSearchParams({ type, exclude: excludeRaw, include: includeRaw, ...overrides });
      return `${base}/raw?${p}`;
    };

    const inputStyle = 'background:var(--bg-elev-2);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px 10px;font-size:13px';

    const totalAll = Object.values(counts).reduce((a, b) => a + b, 0);
    const chip = (label, t, n) =>
      ui.btn({ href: qs({ type: t }), label: `${label} (${n})`, primary: type === t });

    const filterForm = html`<form method="GET" action="${base}/raw" class="row" style="gap:8px;margin-bottom:12px;align-items:center;flex-wrap:wrap">
      <input type="hidden" name="type" value="${type}"/>
      <input type="text" name="include" value="${includeRaw}" placeholder="include: term1, term2, …" style="flex:1;min-width:180px;max-width:320px;${inputStyle}"/>
      <input type="text" name="exclude" value="${excludeRaw}" placeholder="exclude: term1, term2, …" style="flex:1;min-width:180px;max-width:320px;${inputStyle}"/>
      <button class="btn primary" type="submit">Apply</button>
      ${(includeTerms.length || excludeTerms.length) ? html`<a class="btn" href="${qs({ include: '', exclude: '' })}">Clear</a>` : ''}
    </form>`;

    const filters = html`<div class="row" style="flex-wrap:wrap;gap:6px;margin-bottom:8px">
      ${chip('All', 'all', totalAll)}
      ${Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([t, n]) => chip(t, t, n))}
    </div>`;

    const totalSessions = filteredDates.reduce((a, d) => a + d.sessions.length, 0);
    const activeFilters = [
      includeTerms.length ? `including: ${includeTerms.join(', ')}` : '',
      excludeTerms.length ? `excluding: ${excludeTerms.join(', ')}` : '',
    ].filter(Boolean);
    const filterInfo = activeFilters.length
      ? html`<div class="meta" style="margin-bottom:12px">${activeFilters.join(' · ')} · ${totalSessions} session${totalSessions === 1 ? '' : 's'} shown</div>`
      : '';

    const sections = filteredDates.map((d) => {
      const sessionBlocks = d.sessions.map((s) => {
        const title = s.aiTitle || s.sid.slice(0, 8);
        const rows = s.records.map(
          (r) => html`<details style="margin:4px 0;padding:4px 8px;border-left:2px solid var(--border)">
            <summary style="cursor:pointer"><code>${r.type}</code> <span class="dim">${(r.timestamp || '').slice(11, 19) || '—'}</span> — ${recordPreview(r)}</summary>
            <pre class="eng-source" style="white-space:pre-wrap;margin-top:6px">${JSON.stringify(r, null, 2)}</pre>
          </details>`,
        );
        return html`<details class="card" style="margin:8px 0">
          <summary><strong>${title}</strong>
            <span class="badge">${shortProject(s.project)}</span>
            <span class="dim">${s.records.length} record${s.records.length === 1 ? '' : 's'}</span>
          </summary>
          <div style="margin-top:8px">${rows}</div>
        </details>`;
      });
      return html`<h3 class="eng-section" style="margin-top:20px">${d.date}</h3>${sessionBlocks}`;
    });

    const body = html`
      ${ui.pageHead({
        title: '🔍 Historical JSONL',
        subtitle: 'All transcript records grouped by date → session, newest first.',
        actions: ui.btn({ href: base, label: '← Repacks' }),
      })}
      ${filterForm}
      ${filters}
      ${filterInfo}
      ${filteredDates.length ? sections : ui.empty('No sessions match current filters.')}`;
    res.send(shell('Historical JSONL', body, [...crumb, { href: '#', label: 'historical' }]));
  });

  // ── Day detail ─────────────────────────────────────────────────────────────
  router.get('/:date', async (req, res) => {
    let day;
    try {
      day = await store.get(req.params.date);
    } catch {
      return res.send(shell('Missing', ui.empty(`No repack for ${req.params.date} — run “Repack today”.`)));
    }
    const real = day.sessions.filter((s) => s.kind === 'interactive');
    const other = day.sessions.filter((s) => s.kind !== 'interactive');
    const pending = real.filter((s) => !s.summary).length;

    const body = html`
      ${ui.pageHead({
        title: `📋 ${day.date}`,
        subtitle: `${real.length} interactive · ${fmtTokens(day.tokens)} · generated ${day.generatedAt.slice(11, 16)}`,
        actions: html`${ui.btn({ action: 'post', name: `${base}/run`, label: '↻ Re-repack' })}${
          pending
            ? ui.btn({ action: 'post', name: `${base}/${day.date}/summarize`, label: `✨ Summarize ${pending} (LLM)`, primary: true })
            : ''
        }`,
      })}
      ${real.length ? real.map((s) => sessionCard(s, day.date)) : ui.empty('No interactive sessions this day.')}
      ${other.length
        ? html`<h3 class="eng-section">Automated / subagent runs (${other.length})</h3>
            ${ui.table(
              ['Kind', 'Title', 'Time', 'Msgs'],
              other.map((s) => [s.kind, s.title, s.start?.slice(11, 16) || '', String(s.msgCount)]),
            )}`
        : ''}`;
    res.send(shell(day.date, body, [...crumb, { href: `${base}/${day.date}`, label: day.date }]));
  });

  // Raw JSONL viewer — finds the session's transcript file and presents its
  // records as a structured, collapsible list (zero-cost; just reads the file).
  router.get('/:date/:sessionId/raw', async (req, res) => {
    const { date, sessionId } = req.params;
    const filter = req.query.type || 'all';
    const found = await readSessionRecords(sessionId);
    if (!found) {
      return res.send(shell('Missing', ui.empty(`No transcript file found for session ${sessionId}.`)));
    }

    // Title from the day repack if we have it; fall back to the id.
    let title = sessionId.slice(0, 8);
    try {
      const day = await store.get(date);
      title = day.sessions.find((s) => s.sessionId === sessionId)?.title || title;
    } catch {
      /* no repack for that day — fine */
    }

    const counts = found.records.reduce((acc, r) => ((acc[r.type] = (acc[r.type] || 0) + 1), acc), {});
    const shown = filter === 'all' ? found.records : found.records.filter((r) => r.type === filter);

    const chip = (label, type, n) =>
      ui.btn({ href: `${base}/${date}/${sessionId}/raw?type=${type}`, label: `${label} (${n})`, primary: filter === type });
    const filters = html`<div class="row" style="flex-wrap:wrap;gap:6px;margin-bottom:12px">
      ${chip('All', 'all', found.records.length)}
      ${Object.entries(counts).map(([t, n]) => chip(t, t, n))}
    </div>`;

    const rows = shown.map(
      (r) => html`<details class="card" style="margin:6px 0">
        <summary><code>${r.type}</code> <span class="dim">${(r.timestamp || '').slice(11, 19)}</span> — ${recordPreview(r)}</summary>
        <pre class="eng-source" style="white-space:pre-wrap">${JSON.stringify(r, null, 2)}</pre>
      </details>`,
    );

    const body = html`
      ${ui.pageHead({
        title: `🔍 Raw JSONL · ${title}`,
        subtitle: `${found.records.length} records · ${found.file}`,
        actions: ui.btn({ href: `${base}/${date}`, label: '← Day' }),
      })}
      ${filters}
      ${shown.length ? rows : ui.empty('No records of that type.')}`;
    res.send(shell(`Raw · ${title}`, body, [...crumb, { href: `${base}/${date}`, label: date }, { href: '#', label: 'raw' }]));
  });

  // Stage 2 — summarize all unsummarized interactive sessions for a day.
  router.post('/:date/summarize', async (req, res) => {
    await summarizeWrap(req.params.date, 'unsummarized');
    res.redirect(`${base}/${req.params.date}`);
  });

  // Stage 2 — summarize a single session.
  router.post('/:date/summarize/:sessionId', async (req, res) => {
    await summarizeWrap(req.params.date, [req.params.sessionId]);
    res.redirect(`${base}/${req.params.date}`);
  });

  async function summarizeWrap(date, which) {
    let day;
    try {
      day = await store.get(date);
    } catch {
      return;
    }
    await summarizeDay(day, provider, which);
    await store.save(day);
  }

  // ── Components ───────────────────────────────────────────────────────────
  function sessionCard(s, date) {
    const summary = s.summary
      ? html`<div class="eng-panel"><strong>✨ Summary</strong> <span class="dim">· ${s.summaryMeta?.provider || 'llm'}</span><div>${s.summary}</div></div>`
      : '';
    const files = s.filesTouched.length
      ? html`<div class="meta"><strong>Files:</strong> ${s.filesTouched.slice(0, 8).join(', ')}${s.filesTouched.length > 8 ? ` +${s.filesTouched.length - 8}` : ''}</div>`
      : '';
    const cmds = s.commands.length
      ? html`<div class="meta"><strong>Ran:</strong> ${s.commands.slice(0, 6).map((c) => html`<code>${c}</code> `)}</div>`
      : '';
    return ui.card({
      title: s.title,
      badge: html`${s.summary ? ui.badge('summarized', 'ok') : ui.badge('raw')} ${ui.badge(fmtTokens(s.tokens))}`,
      desc: html`<div class="dim">${shortProject(s.project)}${s.branch ? ` · ${s.branch}` : ''} · ${s.start?.slice(11, 16)}–${s.end?.slice(11, 16)} · ${s.msgCount} msgs</div>
        ${summary}
        ${s.prompts.length ? html`<div class="meta"><strong>Asked:</strong> ${s.prompts.slice(0, 3).join(' — ')}</div>` : ''}
        ${files}${cmds}
        ${s.outcome ? html`<div class="meta"><strong>Ended:</strong> ${s.outcome.slice(0, 200)}</div>` : ''}`,
      actions: [
        ui.btn({ action: 'post', name: `${base}/${date}/summarize/${s.sessionId}`, label: s.summary ? '✨ Re-summarize' : '✨ Summarize (LLM)' }),
        ui.btn({ href: `${base}/${date}/${s.sessionId}/raw`, label: '🔍 Raw JSONL' }),
      ],
    });
  }

  return router;
}

// One-line preview for a raw record's collapsed summary row.
function recordPreview(r) {
  const clip = (s) => String(s).replace(/\s+/g, ' ').trim().slice(0, 90);
  if (r.type === 'ai-title') return clip(r.aiTitle);
  if (r.type === 'queue-operation') return clip(r.operation);
  if (r.type === 'system') return clip(r.subtype || r.level || '');
  const c = r.message?.content;
  if (typeof c === 'string') return clip(c);
  if (Array.isArray(c)) {
    const parts = c.map((b) => {
      if (b.type === 'text') return clip(b.text);
      if (b.type === 'tool_use') return `🔧 ${b.name}`;
      if (b.type === 'tool_result') return '↩ tool_result';
      return b.type;
    });
    return clip(parts.join(' · '));
  }
  return '';
}

function fmtTokens(t = { in: 0, out: 0, cache: 0 }) {
  const k = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));
  return `${k(t.in)}↓/${k(t.out)}↑ tok${t.cache ? ` (${k(t.cache)} cache)` : ''}`;
}

function shortProject(p) {
  const parts = String(p).split(/[\\/]/);
  return parts.slice(-2).join('/') || p;
}
