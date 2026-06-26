import express from 'express';
import path from 'node:path';
import cron from 'node-cron';
import { html, raw } from '../../lib/html.js';
import { jsonStore } from '../../lib/store.js';
import { buildDayRepack, findAllDates, formatDuration, localDate, readSessionRecords, scanGrouped } from './repack.js';
import {
  summarizeDay,
  summarizeDayStructured,
  summarizeTrend,
  daySummary,
  DEFAULT_DAILY_SYSTEM,
  DEFAULT_TREND_SYSTEM,
  DEFAULT_SCORE_SYSTEM,
  DEFAULT_RENDER_SYSTEM,
  RUNGS,
} from './summarize.js';

export const meta = {
  name: 'Session Repack',
  description: 'Daily recap of Claude work — zero-cost repack of local transcripts, with optional LLM summaries.',
  icon: '📋',
  version: '0.4.1',
};

const today = () => localDate();
const KIND_BADGE = { interactive: 'ok', automated: '', subagent: 'warn' };
const LOCAL_ICON = '💻';
const IMPORT_ICON = '📥';

export function createFeature(ctx) {
  const { ui, page, provider, base, paths } = ctx;
  const store = jsonStore({ dir: path.join(paths.data, 'repacks') });
  const trendStore = jsonStore({ dir: path.join(paths.data, 'trends') });
  // Config (prompt edits) lives outside data/repacks: that dir is gitignored
  // because the day repacks it holds are regenerable local-transcript output,
  // but the prompts the user authors there are not regenerable and must be checked in.
  const configStore = jsonStore({ dir: path.join(paths.data, 'repack-config') });
  // Days received from another machine's Export. Kept separate from `store` so
  // a local re-repack/re-summarize never touches imported data, and imported
  // sessions are excluded from local summarization by construction (they're
  // simply not in `day.sessions`). Merged with local data only at render time.
  const importStore = jsonStore({ dir: path.join(paths.data, 'repack-imports') });
  const router = express.Router();

  async function getConfig() {
    try { return await configStore.get('config'); } catch { return {}; }
  }
  async function saveConfig(data) {
    const prev = await getConfig();
    await configStore.save({ id: 'config', ...prev, ...data });
  }

  // Mode is per-machine config (each machine has its own configStore), so
  // home and work can independently A/B test simple vs structured scoring
  // without any shared toggle or env var.
  async function summarizeDayByMode(day, config) {
    if (config.mode === 'structured') return summarizeDayStructured(day, provider, config);
    return summarizeDay(day, provider, config.dailyPrompt);
  }

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
  // Skipped under the test runner: node-cron's heartbeat timer never unrefs, so
  // it would pin the event loop open and the test process would never exit.
  const GUARD = Symbol.for('session-repack.cron');
  if (!globalThis[GUARD] && process.env.NODE_ENV !== 'test') {
    globalThis[GUARD] = cron.schedule('55 23 * * *', () => {
      runRepack().catch((e) => console.warn(`[session-repack] daily repack failed: ${e.message}`));
    });
    console.log('[session-repack] daily repack scheduled (23:55, in-process, $0)');
  }

  // Singleton repack-all job state — guarded so restarts don't orphan a running job.
  const RA_KEY = Symbol.for('session-repack.repack-all');
  if (!globalThis[RA_KEY]) globalThis[RA_KEY] = { running: false, total: 0, done: 0, errors: [], current: null, startedAt: null, finishedAt: null };
  const ra = () => globalThis[RA_KEY];

  // Singleton summarize/trend job state (one background job at a time).
  const SUM_KEY = Symbol.for('session-repack.summarize');
  if (!globalThis[SUM_KEY]) globalThis[SUM_KEY] = { running: false, label: '', total: 0, done: 0, errors: [], current: null, startedAt: null, finishedAt: null };
  const sumState = () => globalThis[SUM_KEY];

  // Generic background-job wrapper — guards against concurrent runs and always
  // clears `running`. Returns false if a job is already in flight.
  function runJob(label, total, fn) {
    const state = sumState();
    if (state.running) return false;
    Object.assign(state, { running: true, label, total, done: 0, errors: [], current: null, startedAt: new Date().toISOString(), finishedAt: null });
    Promise.resolve()
      .then(() => fn(state))
      .catch((e) => state.errors.push(`Fatal: ${e.message}`))
      .finally(() => Object.assign(state, { running: false, current: null, finishedAt: new Date().toISOString() }));
    return true;
  }

  // Daily summaries for a set of dates. Skips days that already have a summary
  // unless `force`.
  function summarizeDaysJob(dates, force) {
    return runJob('Summarizing days', dates.length, async (state) => {
      const config = await getConfig();
      for (const date of dates) {
        state.current = date;
        try {
          const day = await store.get(date);
          if (force || !daySummary(day)) {
            await summarizeDayByMode(day, config);
            await store.save(day);
          }
        } catch (e) {
          state.errors.push(`${date}: ${e.message}`);
        }
        state.done++;
      }
    });
  }

  // Trend over a date range: first ensure each day in range is summarized
  // (respecting `force`), then summarize the trend across those days.
  function trendJob(kind, start, end, force) {
    return runJob('Summarizing trend', 1, async (state) => {
      const config = await getConfig();
      const days = (await store.list())
        .filter((d) => Array.isArray(d.sessions) && d.date >= start && d.date <= end)
        .sort((a, b) => a.date.localeCompare(b.date));
      state.total = days.length + 1;
      for (const day of days) {
        state.current = day.date;
        try {
          if (force || !daySummary(day)) {
            await summarizeDayByMode(day, config);
            await store.save(day);
          }
        } catch (e) {
          state.errors.push(`${day.date}: ${e.message}`);
        }
        state.done++;
      }
      state.current = 'trend';
      const withSummary = days.filter((d) => daySummary(d));
      if (withSummary.length) {
        const trend = await summarizeTrend(withSummary, provider, config.trendPrompt, { kind, start, end });
        await trendStore.save(trend);
      } else {
        state.errors.push('No summarized days in range — nothing to trend.');
      }
      state.done++;
    });
  }

  // Repack every date with any transcript activity — missing dates (old
  // Backfill's job) and already-repacked dates alike. Safe to run repeatedly:
  // buildDayRepack always carries forward summary/mergedSummary/submitted/
  // exported from the existing record, so re-running never loses Stage 2 work.
  async function runRepackAll() {
    const state = ra();
    if (state.running) return;
    const allDates = await findAllDates();
    const pending = [...allDates].reverse(); // newest first
    Object.assign(state, { running: true, total: pending.length, done: 0, errors: [], current: null, startedAt: new Date().toISOString(), finishedAt: null });
    for (const date of pending) {
      state.current = date;
      try {
        const previous = await store.get(date).catch(() => null);
        const day = await buildDayRepack(date, { previous });
        await store.save(day);
      } catch (e) {
        state.errors.push(`${date}: ${e.message}`);
      }
      state.done++;
    }
    Object.assign(state, { running: false, current: null, finishedAt: new Date().toISOString() });
  }

  // ── Library: all repacked days, grouped by week ────────────────────────────
  router.get('/', async (req, res) => {
    const localDays = (await store.list()).filter((d) => Array.isArray(d.sessions));
    const imports = await importStore.list().catch(() => []);
    const importsByDate = new Map();
    for (const i of imports) {
      if (!importsByDate.has(i.date)) importsByDate.set(i.date, []);
      importsByDate.get(i.date).push(i);
    }

    // Days that only exist as an import (never repacked on this machine) are
    // invisible if we only iterate the local store — synthesize a placeholder
    // so they still show up, clearly marked as import-only, instead of silently
    // disappearing or getting folded into a "local" card that misrepresents them.
    const knownDates = new Set(localDays.map((d) => d.date));
    const importOnlyDays = [...importsByDate.keys()]
      .filter((date) => !knownDates.has(date))
      .map((date) => ({ id: date, date, sessions: [], counts: {}, tokens: { in: 0, out: 0, cache: 0 }, importOnly: true }));

    const allDays = [...localDays, ...importOnlyDays].sort((a, b) => b.date.localeCompare(a.date));
    const pendingExport = localDays.filter((d) => !d.exported).length;

    const statusFilter = req.query.status || 'all'; // all | submitted | pending
    const sourceFilter = req.query.source || 'all'; // all | local | imported
    const qs = (overrides) => `${base}?${new URLSearchParams({ status: statusFilter, source: sourceFilter, ...overrides })}`;

    let days = statusFilter === 'all'
      ? allDays
      : allDays.filter((d) => (statusFilter === 'submitted' ? d.submitted : !d.submitted));
    if (sourceFilter === 'local') days = days.filter((d) => d.sessions.length > 0);
    else if (sourceFilter === 'imported') days = days.filter((d) => importsByDate.has(d.date));

    const trends = await trendStore.list().catch(() => []);
    const weekTrend = new Map(trends.filter((t) => t.kind === 'week').map((t) => [t.start, t]));

    const byWeek = new Map();
    for (const d of days) {
      const wk = weekStart(d.date);
      if (!byWeek.has(wk)) byWeek.set(wk, []);
      byWeek.get(wk).push(d);
    }

    const currentWk = weekStart(today());
    const sections = [...byWeek.entries()].map(([wk, wDays]) => {
      const isCurrentWeek = wk === currentWk;
      const cards = wDays.map((d) => {
        const dayImports = importsByDate.get(d.date) || [];
        const hasLocal = d.sessions.length > 0;
        const real = d.sessions.filter((s) => s.kind === 'interactive');
        const summary = daySummary(d);
        const sourceBadge = !hasLocal && dayImports.length
          ? ui.badge(`${IMPORT_ICON} import-only`, 'warn')
          : dayImports.length
            ? ui.badge(`${IMPORT_ICON} +imported`)
            : '';
        return ui.card({
          title: d.date,
          // Summarized day → green check; otherwise the session count.
          badge: html`${summary
            ? ui.badge('summarized', 'ok')
            : ui.badge(`${real.length} session${real.length === 1 ? '' : 's'}`)}${sourceBadge}${d.submitted ? ` ${ui.badge('submitted', 'ok')}` : ''}`,
          // Summary replaces the repack info once present.
          desc: summary
            ? html`<div class="summary-text">${clip(stripMd(summary), 280)}</div>`
            : hasLocal
              ? (real.map((s) => s.title).slice(0, 4).join(' · ') || 'No interactive sessions')
              : `No local activity — ${dayImports.length} import${dayImports.length === 1 ? '' : 's'} from ${[...new Set(dayImports.map((i) => i.label))].join(', ')}`,
          meta: summary ? '' : html`${fmtTokens(d.tokens)} · ${d.counts.automated || 0} automated`,
          actions: [
            ui.btn({ href: `${base}/${d.date}`, label: 'Open', primary: true }),
            ...(hasLocal ? [ui.btn({
              action: 'post',
              name: `${base}/${d.date}/summarize${summary ? '?force=1' : ''}`,
              label: summary ? '↻' : '✨',
              title: summary ? 'Re-summarize' : 'Summarize',
              llm: true,
              status: `${base}/job/status.json`,
            })] : []),
          ],
        });
      });
      const totalSessions = wDays.reduce((n, d) => n + d.sessions.filter((s) => s.kind === 'interactive').length, 0);
      const trend = weekTrend.get(wk);
      const trendBtn = ui.btn({
        action: 'post',
        name: `${base}/trend/week/${wk}${trend ? '?force=1' : ''}`,
        label: trend ? '↻ Re-run week trend' : '📈 Week trend',
        llm: true,
        status: `${base}/job/status.json`,
      });
      const trendDeleteBtn = trend
        ? ui.btn({ action: 'delete', name: `${base}/trend/${encodeURIComponent(trend.id)}/delete?back=${encodeURIComponent(base)}`, label: '🗑', title: 'Delete week trend', danger: true })
        : '';
      const trendPanel = trend
        ? html`<div class="eng-panel" style="margin-bottom:12px"><strong>📈 Week trend</strong> <span class="dim">· ${trend.meta?.provider || 'llm'}</span><div class="summary-text" style="margin-top:6px">${stripMd(trend.summary)}</div></div>`
        : '';
      return html`<details class="collapsible" style="margin-bottom:14px" ${isCurrentWeek ? 'open' : ''}>
        <summary>${weekLabel(wk)} <span class="coll-count">(${wDays.length} day${wDays.length === 1 ? '' : 's'} · ${totalSessions} session${totalSessions === 1 ? '' : 's'})</span>${trend ? html` ${ui.badge('trend', 'ok')}` : ''}</summary>
        <div class="coll-body">
          <div class="row" style="margin-bottom:12px">${trendBtn}${trendDeleteBtn}</div>
          ${trendPanel}
          ${ui.grid(cards)}
        </div>
      </details>`;
    });

    // Bulk action bar — a real form so the Re-summarize checkbox rides along to
    // whichever button is pressed (formaction routes it). Everything but
    // Export/Import lives behind the header overflow menu.
    const actions = html`
      ${ui.btn({ action: 'post', name: `${base}/export`, label: `📤 Export new (${pendingExport})`, primary: true })}
      ${ui.btn({ href: `${base}/import`, label: '📥 Import' })}
      ${ui.menu(html`
        <form method="POST">
          <label class="eng-check" style="font-size:12px;margin:0"><input type="checkbox" name="force" value="1"/> Force re-run</label>
          <button class="btn llm" type="submit" formaction="${base}/${today()}/summarize" data-llm-status="${base}/job/status.json">✨ Summarize today</button>
          <button class="btn llm" type="submit" formaction="${base}/trend/week/${currentWk}" data-llm-status="${base}/job/status.json">📈 Week trend</button>
        </form>
        ${ui.btn({ action: 'post', name: `${base}/run`, label: '↻ Repack today' })}
        ${ui.btn({ action: 'post', name: `${base}/export?all=1`, label: '📤 Export all' })}
        ${ui.btn({ href: `${base}/trends`, label: '📈 Trends' })}
        ${ui.btn({ href: `${base}/raw`, label: '🔍 Historical JSONL' })}
        ${ui.btn({ href: `${base}/prompt`, label: '✏️ Prompts' })}
        ${ui.btn({ action: 'post', name: `${base}/repack-all`, label: '🔁 Repack all' })}
      `)}`;

    const statusChip = (label, val) => ui.btn({ href: qs({ status: val }), label, primary: statusFilter === val });
    const statusFilters = html`<div class="row" style="gap:6px;margin-bottom:8px">
      ${statusChip('All', 'all')} ${statusChip('Submitted', 'submitted')} ${statusChip('Pending', 'pending')}
    </div>`;

    const sourceChip = (label, val) => ui.btn({ href: qs({ source: val }), label, primary: sourceFilter === val });
    const sourceFilters = html`<div class="row" style="gap:6px;margin-bottom:12px">
      <span class="dim" style="line-height:28px;font-size:12px">Source:</span>
      ${sourceChip('All', 'all')} ${sourceChip(`${LOCAL_ICON} Local`, 'local')} ${sourceChip(`${IMPORT_ICON} Imported`, 'imported')}
    </div>`;

    const notice = req.query.notice === 'nothing-to-export'
      ? html`<div class="badge" style="margin-bottom:12px;display:inline-block">Nothing new to export — every local day is already exported.</div>`
      : '';

    const body = html`
      ${ui.pageHead({
        title: '📋 Session Repack',
        subtitle: 'Zero-cost daily recap of Claude work. Summaries are opt-in (LLM).',
        actions,
      })}
      <div class="meta">Provider for summaries: <strong>${provider.name}</strong></div>
      ${notice}
      ${statusFilters}
      ${sourceFilters}
      ${sections.length ? sections : ui.empty('No repacks yet — run “Repack today”.')}`;
    res.send(shell('Repacks', body));
  });

  router.post('/run', async (req, res) => {
    const day = await runRepack(today());
    res.redirect(`${base}/${day.date}`);
  });

  // ── Export / Import ─────────────────────────────────────────────────────────
  // Cross-machine sharing is explicit, not git: bundle local days that haven't
  // been exported yet, download the file, email/copy it to the other machine,
  // paste it into Import there. Marking `exported` is what makes repeated runs
  // only ever ship what's new.
  router.post('/export', async (req, res) => {
    const all = !!(req.body?.all || req.query?.all);
    const config = await getConfig();
    const label = config.sourceLabel || 'unlabeled';
    const candidates = (await store.list()).filter((d) => Array.isArray(d.sessions) && (all || !d.exported));
    if (!candidates.length) return res.redirect(`${base}?notice=nothing-to-export`);

    const exportedAt = new Date().toISOString();
    const bundle = { exportedAt, label, days: candidates };
    for (const day of candidates) {
      day.exported = true;
      day.exportedAt = exportedAt;
      await store.save(day);
    }
    const filename = `repack-export-${label}-${exportedAt.slice(0, 10)}.json`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.type('application/json').send(JSON.stringify(bundle, null, 2));
  });

  router.get('/import', async (req, res) => {
    const imports = (await importStore.list().catch(() => []))
      .sort((a, b) => (b.importedAt || '').localeCompare(a.importedAt || ''));

    const notice = req.query.imported !== undefined
      ? html`<div class="badge" style="margin-bottom:12px;display:inline-block;border-color:var(--ok)">✓ Imported ${req.query.imported} day(s)${Number(req.query.skipped) ? `, skipped ${req.query.skipped} duplicate(s)` : ''}.</div>`
      : '';
    const errBanner = req.query.error
      ? html`<div class="badge" style="margin-bottom:12px;display:inline-block;border-color:var(--bad)">⚠ Could not read that as an export bundle.</div>`
      : '';

    const body = html`
      ${ui.pageHead({
        title: '📥 Import',
        subtitle: 'Paste the contents of an exported file from another machine.',
        actions: ui.btn({ href: base, label: '← Repacks' }),
      })}
      ${notice}${errBanner}
      ${ui.configForm({
        action: `${base}/import`,
        fields: [{ name: 'payload', label: 'Exported JSON', type: 'text', rows: 10, placeholder: 'Paste exported JSON here…' }],
        submit: 'Import',
      })}
      <h3 class="eng-section">Imported so far (${imports.length})</h3>
      ${imports.length
        ? ui.table(
            ['Date', 'From', 'Imported'],
            imports.map((i) => [i.date, i.label, (i.importedAt || '').slice(0, 16).replace('T', ' ')]),
          )
        : ui.empty('Nothing imported yet.')}`;
    res.send(shell('Import', body, [...crumb, { href: '#', label: 'import' }]));
  });

  router.post('/import', async (req, res) => {
    let bundle;
    try {
      bundle = JSON.parse(req.body?.payload || '');
    } catch {
      return res.redirect(`${base}/import?error=1`);
    }
    if (!bundle || !Array.isArray(bundle.days) || !bundle.label) {
      return res.redirect(`${base}/import?error=1`);
    }

    let imported = 0;
    let skipped = 0;
    for (const day of bundle.days) {
      if (!day?.date) continue;
      const id = `${day.date}-${bundle.label}`;
      const existing = await importStore.get(id).catch(() => null);
      // Same source + same export run already imported — no-op.
      if (existing && existing.exportedAt === bundle.exportedAt) {
        skipped++;
        continue;
      }
      await importStore.save({
        id,
        date: day.date,
        label: bundle.label,
        exportedAt: bundle.exportedAt,
        importedAt: new Date().toISOString(),
        repack: day,
      });
      imported++;
    }
    res.redirect(`${base}/import?imported=${imported}&skipped=${skipped}`);
  });

  // ── Historical JSONL ───────────────────────────────────────────────────────
  // Flat, cross-session feed of raw records, newest first. No day selection.
  // Registered before /:date so the literal "raw" isn't parsed as a date.
  router.get('/raw', async (req, res) => {
    const type = req.query.type || 'all';
    const excludeRaw = req.query.exclude || '';
    const includeRaw = req.query.include || '';
    const days = req.query.days === 'all' ? null : parseInt(req.query.days || '14', 10);
    const excludeTerms = excludeRaw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    const includeTerms = includeRaw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

    let afterDate = null;
    if (days) {
      const d = new Date();
      d.setDate(d.getDate() - days);
      afterDate = d.toISOString().slice(0, 10);
    }
    const { dates, counts } = await scanGrouped({ type, afterDate });

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
      const p = new URLSearchParams({ type, exclude: excludeRaw, include: includeRaw, days: days || 'all', ...overrides });
      return `${base}/raw?${p}`;
    };

    const inputStyle = 'background:var(--bg-elev-2);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px 10px;font-size:13px';

    const totalAll = Object.values(counts).reduce((a, b) => a + b, 0);
    const chip = (label, t, n) =>
      ui.btn({ href: qs({ type: t }), label: `${label} (${n})`, primary: type === t });

    const windowChip = (label, d) =>
      ui.btn({ href: qs({ days: d }), label, primary: String(days || 'all') === String(d) });
    const windowNav = html`<div class="row" style="flex-wrap:wrap;gap:6px;margin-bottom:12px">
      <span class="dim" style="line-height:28px;font-size:12px">Window:</span>
      ${windowChip('7d', '7')} ${windowChip('14d', '14')} ${windowChip('30d', '30')} ${windowChip('All', 'all')}
    </div>`;

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

    const windowInfo = afterDate
      ? `Showing sessions with activity since ${afterDate}.`
      : 'Showing all sessions (no date filter).';

    const body = html`
      ${ui.pageHead({
        title: '🔍 Historical JSONL',
        subtitle: 'Transcript records grouped by date → session, newest first.',
        actions: ui.btn({ href: base, label: '← Repacks' }),
      })}
      ${windowNav}
      ${filterForm}
      ${filters}
      ${filterInfo || html`<div class="meta" style="margin-bottom:12px">${windowInfo} ${totalSessions} session${totalSessions === 1 ? '' : 's'}.</div>`}
      ${filteredDates.length ? sections : ui.empty('No sessions match current filters.')}`;
    res.send(shell('Historical JSONL', body, [...crumb, { href: '#', label: 'historical' }]));
  });

  // ── Repack all ─────────────────────────────────────────────────────────────
  router.post('/repack-all', async (req, res) => {
    const state = ra();
    if (!state.running) {
      runRepackAll().catch((e) => {
        const s = ra();
        s.running = false;
        s.errors = [...(s.errors || []), `Fatal: ${e.message}`];
        s.finishedAt = new Date().toISOString();
      });
    }
    res.redirect(`${base}/repack-all/status`);
  });

  router.get('/repack-all/status', (req, res) => {
    const s = ra();
    const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
    const errs = s.errors?.length ?? 0;
    const subtitle = s.running
      ? `${s.done} of ${s.total} days processed — ${s.current || '…'}`
      : s.finishedAt
        ? `${s.done} days repacked · ${errs} error${errs === 1 ? '' : 's'} · finished ${s.finishedAt.slice(11, 19)}`
        : 'Press "Repack all" on the repacks page to start.';

    const body = html`
      ${s.running ? raw('<meta http-equiv="refresh" content="2">') : ''}
      ${ui.pageHead({
        title: s.running ? `🔁 Repacking all… (${pct}%)` : '🔁 Repack all complete',
        subtitle,
        actions: s.running ? '' : ui.btn({ href: base, label: '← Repacks', primary: true }),
      })}
      ${s.total ? html`<progress value="${s.done}" max="${s.total}" style="width:100%;height:6px;margin-bottom:16px"></progress>` : ''}
      ${errs
        ? html`<div class="card"><strong>Errors</strong><ul style="margin:8px 0 0">${s.errors.map((e) => html`<li>${e}</li>`)}</ul></div>`
        : ''}`;
    res.send(shell(s.running ? 'Repacking…' : 'Repack all done', body, crumb));
  });

  // ── Trend: week (one-click) and custom range ───────────────────────────────
  router.post('/trend/week/:wk', (req, res) => {
    const start = req.params.wk;
    const end = addDays(start, 6);
    const force = !!(req.body?.force || req.query?.force);
    trendJob('week', start, end, force);
    res.redirect(`${base}/job/status?back=${encodeURIComponent(base)}`);
  });

  router.post('/trend/range', (req, res) => {
    const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
    const start = req.body?.start;
    const end = req.body?.end;
    const back = `${base}/trends`;
    if (!DATE_RE.test(start || '') || !DATE_RE.test(end || '') || start > end) {
      return res.redirect(`${back}?error=range`);
    }
    const force = !!(req.body?.force || req.query?.force);
    trendJob('range', start, end, force);
    res.redirect(`${base}/job/status?back=${encodeURIComponent(back)}`);
  });

  // Re-run a saved custom-range trend (params in path so the empty-body POST
  // button can carry them). Always forces.
  router.post('/trend/rerun/:start/:end', (req, res) => {
    const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
    const { start, end } = req.params;
    if (!DATE_RE.test(start) || !DATE_RE.test(end) || start > end) {
      return res.redirect(`${base}/trends?error=range`);
    }
    trendJob('range', start, end, true);
    res.redirect(`${base}/job/status?back=${encodeURIComponent(`${base}/trends`)}`);
  });

  router.post('/trend/:id/delete', async (req, res) => {
    await trendStore.remove(req.params.id);
    res.redirect(req.query.back || `${base}/trends`);
  });

  // ── Trends page: saved trends + custom-range runner ────────────────────────
  router.get('/trends', async (req, res) => {
    const trends = (await trendStore.list().catch(() => []))
      .sort((a, b) => (b.end || '').localeCompare(a.end || ''));

    const cards = trends.map((t) =>
      ui.card({
        title: t.kind === 'week' ? `Week of ${t.start}` : `${t.start} → ${t.end}`,
        badge: ui.badge(t.kind, t.kind === 'week' ? 'ok' : ''),
        desc: html`<div class="summary-text">${clip(stripMd(t.summary), 320)}</div>`,
        meta: html`${t.days?.length || 0} days · ${t.meta?.provider || 'llm'} · ${t.generatedAt?.slice(0, 10) || ''}`,
        actions: [
          ui.btn({
            action: 'post',
            name: t.kind === 'week'
              ? `${base}/trend/week/${t.start}?force=1`
              : `${base}/trend/rerun/${t.start}/${t.end}?force=1`,
            label: '↻ Re-run',
            llm: true,
            status: `${base}/job/status.json`,
          }),
          ui.btn({
            action: 'delete',
            name: `${base}/trend/${encodeURIComponent(t.id)}/delete?back=${encodeURIComponent(`${base}/trends`)}`,
            label: '🗑 Delete',
            danger: true,
          }),
        ],
      }),
    );

    const runner = html`<form method="POST" action="${base}/trend/range" class="card" style="margin-bottom:18px">
      <div class="row" style="gap:10px;align-items:flex-end;flex-wrap:wrap">
        <label style="display:flex;flex-direction:column;gap:4px;font-size:12px" class="dim">From
          <input type="date" name="start" required style="background:var(--bg-elev-2);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px 10px"/></label>
        <label style="display:flex;flex-direction:column;gap:4px;font-size:12px" class="dim">To
          <input type="date" name="end" required style="background:var(--bg-elev-2);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px 10px"/></label>
        <label class="eng-check" style="font-size:12px"><input type="checkbox" name="force" value="1"/> Re-summarize</label>
        <button type="submit" class="btn llm" data-llm-status="${base}/job/status.json">📈 Summarize range</button>
      </div>
    </form>`;

    const errBanner = req.query.error === 'range'
      ? html`<div class="badge" style="margin-bottom:12px;display:inline-block;border-color:var(--bad)">⚠ Pick a valid From/To range (From ≤ To).</div>`
      : '';

    const body = html`
      ${ui.pageHead({
        title: '📈 Trends',
        subtitle: 'Summaries across multiple days. Week trends also appear in the library headers.',
        actions: ui.btn({ href: base, label: '← Repacks' }),
      })}
      ${errBanner}
      ${runner}
      ${cards.length ? ui.grid(cards) : ui.empty('No trends yet — run a week or a custom range.')}`;
    res.send(shell('Trends', body, [...crumb, { href: '#', label: 'trends' }]));
  });

  // ── Job status (summarize / trend) ─────────────────────────────────────────
  // JSON variant — polled by the client to render progress inline on the page
  // that started the job, instead of navigating to /job/status.
  router.get('/job/status.json', (req, res) => {
    const s = sumState();
    res.json({ running: s.running, label: s.label, total: s.total, done: s.done, current: s.current, errors: s.errors });
  });

  router.get('/job/status', (req, res) => {
    const s = sumState();
    const back = req.query.back || base;
    const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
    const errs = s.errors?.length ?? 0;
    const label = s.label || 'Working';
    const subtitle = s.running
      ? `${s.done} of ${s.total} — ${s.current || '…'}`
      : s.finishedAt
        ? `${s.done} done · ${errs} error${errs === 1 ? '' : 's'} · finished ${s.finishedAt.slice(11, 19)}`
        : 'Not started.';

    const body = html`
      ${s.running ? raw('<meta http-equiv="refresh" content="2">') : ''}
      ${ui.pageHead({
        title: s.running ? `✨ ${label}… (${pct}%)` : '✨ Complete',
        subtitle,
        actions: s.running ? '' : ui.btn({ href: back, label: '← Back', primary: true }),
      })}
      ${s.total ? html`<progress value="${s.done}" max="${s.total}" style="width:100%;height:6px;margin-bottom:16px"></progress>` : ''}
      ${s.running ? html`<div class="dim" style="font-size:13px">${label}: ${s.current || '…'}</div>` : ''}
      ${errs ? html`<div class="card" style="margin-top:12px"><strong>Errors</strong><ul style="margin:8px 0 0">${s.errors.map((e) => html`<li>${e}</li>`)}</ul></div>` : ''}`;
    res.send(shell(s.running ? label : 'Done', body, crumb));
  });

  // ── Summary prompt editor (daily + trend) ──────────────────────────────────
  // Mode lives per-machine in this same config, so home and work can each pick
  // independently — switching it is its own small POST (not folded into the
  // big form) so the page can re-render the right field set on reload rather
  // than needing client JS to show/hide sections.
  router.post('/prompt/mode', async (req, res) => {
    const mode = req.body?.mode === 'structured' ? 'structured' : 'simple';
    await saveConfig({ mode });
    res.redirect(req.body?.back || `${base}/prompt`);
  });

  router.get('/prompt', async (req, res) => {
    const config = await getConfig();
    // Migrate the legacy single reportPrompt into dailyPrompt for editing.
    const daily = config.dailyPrompt || config.reportPrompt || DEFAULT_DAILY_SYSTEM;
    const trend = config.trendPrompt || DEFAULT_TREND_SYSTEM;
    const back = req.query.back || base;
    const mode = config.mode === 'structured' ? 'structured' : 'simple';

    const modeSwitch = html`<form method="POST" action="${base}/prompt/mode" class="row" style="gap:6px;margin-bottom:14px">
      <input type="hidden" name="back" value="${back}">
      <input type="hidden" name="mode" value="${mode === 'simple' ? 'structured' : 'simple'}">
      <span class="dim" style="line-height:28px;font-size:12px">Mode:</span>
      ${ui.badge(mode === 'simple' ? 'Simple (current)' : 'Simple', mode === 'simple' ? 'ok' : '')}
      ${ui.badge(mode === 'structured' ? 'Structured (current)' : 'Structured', mode === 'structured' ? 'ok' : '')}
      <button class="btn" type="submit">Switch to ${mode === 'simple' ? 'Structured' : 'Simple'}</button>
    </form>`;

    const simpleFields = [
      { name: 'dailyPrompt', label: 'Daily summary prompt', type: 'text', rows: 12, value: daily, help: 'Single-pass: extraction, ranking, and tone all in one prompt.' },
    ];

    const structuredFields = [
      {
        name: 'alwaysIncludeClientRung',
        type: 'boolean',
        label: 'Client / project rung',
        value: config.alwaysIncludeClientRung !== false,
        checkboxLabel: 'Always include on the list (sorts by score, but never excluded)',
      },
      ...RUNGS.filter((r) => r.id !== 'client').map((r) => ({
        name: `rungThreshold_${r.id}`,
        type: 'number',
        label: `${r.label} — min score to qualify`,
        value: config.rungThresholds?.[r.id] ?? r.threshold,
        help: '1-5. Higher = only the rarest, most exceptional signal at this rung makes the list.',
      })),
      { name: 'renderPrompt', label: 'Hitlist voice/tone prompt', type: 'text', rows: 10, value: config.renderPrompt || DEFAULT_RENDER_SYSTEM, help: 'Formatting and voice only — scoring/evidence rules are fixed in code, not editable here.' },
    ];

    const body = html`
      ${ui.pageHead({
        title: '✏️ Edit Summary Prompts',
        subtitle: 'System prompts for the daily summary and the cross-day trend.',
        actions: ui.btn({ href: back, label: '← Back' }),
      })}
      ${modeSwitch}
      ${ui.configForm({
        action: `${base}/prompt`,
        fields: [
          { name: 'mode', type: 'string', value: mode, label: '' }, // carried through so POST knows which shape was submitted
          ...(mode === 'structured' ? structuredFields : simpleFields),
          { name: 'trendPrompt', label: 'Trend prompt', type: 'text', rows: 10, value: trend, help: 'Summarizes themes across a week or custom range.' },
          { name: 'sourceLabel', label: 'Source label (this machine)', type: 'string', value: config.sourceLabel || '', placeholder: 'home, work, …', help: 'Tags this machine’s Exports so an Import on another machine can tell sources apart.' },
        ],
        extra: html`<input type="hidden" name="back" value="${back}"><a class="btn" href="${back}">Cancel</a>`,
        submit: 'Save',
      })}`;
    res.send(shell('Edit Summary Prompts', body, [...crumb, { href: '#', label: 'prompts' }]));
  });

  router.post('/prompt', async (req, res) => {
    const mode = req.body?.mode === 'structured' ? 'structured' : 'simple';
    const dailyPrompt = (req.body?.dailyPrompt || '').trim();
    const trendPrompt = (req.body?.trendPrompt || '').trim();
    const renderPrompt = (req.body?.renderPrompt || '').trim();
    const sourceLabel = (req.body?.sourceLabel || '').trim();
    const patch = { mode };
    if (mode === 'structured') {
      patch.alwaysIncludeClientRung = !!req.body?.alwaysIncludeClientRung;
      patch.rungThresholds = {};
      for (const r of RUNGS) {
        if (r.id === 'client') continue;
        const v = Number(req.body?.[`rungThreshold_${r.id}`]);
        patch.rungThresholds[r.id] = Number.isFinite(v) ? v : r.threshold;
      }
      if (renderPrompt) patch.renderPrompt = renderPrompt;
    }
    if (dailyPrompt) patch.dailyPrompt = dailyPrompt;
    if (trendPrompt) patch.trendPrompt = trendPrompt;
    patch.sourceLabel = sourceLabel; // allowed to clear
    if (Object.keys(patch).length) await saveConfig(patch);
    res.redirect(req.body?.back || base);
  });

  // ── Day detail ─────────────────────────────────────────────────────────────
  router.get('/:date', async (req, res) => {
    const { date } = req.params;
    let day;
    try {
      day = await store.get(date);
    } catch {
      day = null;
    }
    const imports = (await importStore.list().catch(() => [])).filter((i) => i.date === date);
    // A day with no local repack but at least one import still gets a page —
    // it just has nothing in the Local group. Only a date with neither is missing.
    if (!day && !imports.length) {
      return res.send(shell('Missing', ui.empty(`No repack for ${date} — run “Repack today”.`)));
    }
    if (!day) day = { id: date, date, sessions: [], generatedAt: null, tokens: undefined };

    // Local and imported sessions are kept in separate groups end-to-end — never
    // merged into one undifferentiated list — so a day with imports but no local
    // activity can never read as if those sessions were local.
    const sourceFilter = req.query.source || 'all'; // all | local | imported
    const showLocal = sourceFilter !== 'imported';
    const showImported = sourceFilter !== 'local';
    const localSessions = day.sessions.map((s) => ({ ...s, source: 'local' }));
    const importedSessions = imports.flatMap((imp) =>
      (imp.repack?.sessions || []).map((s) => ({ ...s, source: 'imported', sourceLabel: imp.label })),
    );
    const localReal = localSessions.filter((s) => s.kind === 'interactive');
    const localOther = localSessions.filter((s) => s.kind !== 'interactive');
    const importedReal = importedSessions.filter((s) => s.kind === 'interactive');
    const importedOther = importedSessions.filter((s) => s.kind !== 'interactive');
    const totalReal = localReal.length + importedReal.length;

    const summary = daySummary(day);
    const promptEditHref = `${base}/prompt?back=${encodeURIComponent(`${base}/${date}`)}`;

    const sourceChip = (label, val) => ui.btn({ href: `${base}/${date}?source=${val}`, label, primary: sourceFilter === val });
    const sourceFilters = imports.length
      ? html`<div class="row" style="gap:6px;margin-bottom:12px">${sourceChip('All', 'all')} ${sourceChip(`${LOCAL_ICON} Local`, 'local')} ${sourceChip(`${IMPORT_ICON} Imported`, 'imported')}</div>`
      : '';

    const importCards = imports.map((imp) => {
      const impSummary = daySummary(imp.repack);
      return html`<div class="card" style="margin-bottom:12px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <strong>${IMPORT_ICON} Imported · ${imp.label}</strong>
          <span class="dim">· ${(imp.importedAt || '').slice(0, 10)}</span>
        </div>
        ${impSummary ? html`<div class="summary-text">${stripMd(impSummary)}</div>` : ui.empty('No summary in this import.')}
      </div>`;
    });

    const summarySection = html`
      <div class="card" style="margin-bottom:16px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
          <strong>${LOCAL_ICON} Local summary</strong>
          ${localSessions.length === 0 ? ui.badge('no local activity', 'warn') : ''}
          <span class="dim">· ${day.summaryMeta?.provider || day.reportMeta?.provider || 'llm'} · ${(day.summaryAt || day.reportAt || '').slice(0, 10)}</span>
        </div>
        ${summary ? html`<div class="summary-text lg">${stripMd(summary)}</div>` : ui.empty('Not summarized yet — use Summarize below.')}
      </div>
      ${importCards}
      ${imports.length
        ? html`<div class="row" style="gap:8px;margin-bottom:16px;align-items:center">
            ${ui.btn({ href: `${base}/${date}/merge`, label: day.submitted ? '🔀 Edit merged summary' : '🔀 Merge summaries', primary: !day.submitted })}
            ${day.submitted ? ui.badge('submitted', 'ok') : ''}
          </div>`
        : ''}`;

    const otherTable = (rows, label) => rows.length
      ? html`<h3 class="eng-section">${label} (${rows.length})</h3>
          ${ui.table(
            ['Kind', 'Title', 'Time', 'Msgs'],
            rows.map((s) => [s.kind, s.title, s.start?.slice(11, 16) || '', String(s.msgCount)]),
          )}`
      : '';

    const body = html`
      ${ui.pageHead({
        title: `📋 ${date}`,
        subtitle: `${totalReal} interactive · ${fmtTokens(day.tokens)}` +
          (day.firstChatAt ? ` · ${day.firstChatAt.slice(11, 16)}–${day.lastChatAt.slice(11, 16)} (${formatDuration(day.activeMs)} active)` : '') +
          (day.generatedAt ? ` · generated ${day.generatedAt.slice(11, 16)}` : ''),
        actions: html`
          ${localSessions.length || !imports.length ? ui.btn({
            action: 'post',
            name: `${base}/${date}/summarize${summary ? '?force=1' : ''}`,
            label: summary ? '↻' : '✨',
            title: summary ? 'Re-summarize' : 'Summarize',
            llm: true,
            status: `${base}/job/status.json`,
          }) : ''}
          ${ui.menu(html`
            ${ui.btn({ href: promptEditHref, label: '✏️ Edit prompts' })}
          `)}
        `,
      })}
      ${summarySection}
      ${sourceFilters}
      ${showLocal ? html`<h3 class="eng-section">${LOCAL_ICON} Local sessions (${localReal.length})</h3>
        ${localReal.length ? localReal.map((s) => sessionRow(s, date)) : ui.empty('No local sessions this day.')}` : ''}
      ${showImported ? html`<h3 class="eng-section">${IMPORT_ICON} Imported sessions (${importedReal.length})</h3>
        ${importedReal.length ? importedReal.map((s) => sessionRow(s, date)) : ui.empty('No imported sessions this day.')}` : ''}
      ${showLocal ? otherTable(localOther, `${LOCAL_ICON} Local automated / subagent runs`) : ''}
      ${showImported ? otherTable(importedOther, `${IMPORT_ICON} Imported automated / subagent runs`) : ''}`;
    res.send(shell(date, body, [...crumb, { href: `${base}/${date}`, label: date }]));
  });

  // ── Merge: blend the local summary with imported summaries by hand ─────────
  router.get('/:date/merge', async (req, res) => {
    const { date } = req.params;
    let day;
    try {
      day = await store.get(date);
    } catch {
      day = { date, sessions: [] };
    }
    const imports = (await importStore.list().catch(() => [])).filter((i) => i.date === date);
    const config = await getConfig();
    const ownLabel = config.sourceLabel || 'local';

    const scaffold = [
      `Local (${ownLabel}):\n${daySummary(day) || '(no local summary)'}`,
      ...imports.map((i) => `Imported (${i.label}):\n${daySummary(i.repack) || '(no summary)'}`),
    ].join('\n\n');
    const value = day.mergedSummary || scaffold;

    const body = html`
      ${ui.pageHead({
        title: `🔀 Merge · ${date}`,
        subtitle: day.submitted ? `Submitted ${(day.submittedAt || '').slice(0, 16).replace('T', ' ')}` : 'Not yet submitted.',
        actions: ui.btn({ href: `${base}/${date}`, label: '← Day' }),
      })}
      ${ui.configForm({
        action: `${base}/${date}/merge`,
        fields: [{ name: 'mergedSummary', label: 'Merged summary', type: 'text', rows: 16, value }],
        submit: day.submitted ? 'Save (update)' : 'Save & submit',
      })}`;
    res.send(shell('Merge', body, [...crumb, { href: `${base}/${date}`, label: date }, { href: '#', label: 'merge' }]));
  });

  router.post('/:date/merge', async (req, res) => {
    const { date } = req.params;
    let day;
    try {
      day = await store.get(date);
    } catch {
      day = { id: date, date, sessions: [] };
    }
    day.mergedSummary = (req.body?.mergedSummary || '').trim();
    day.submitted = true;
    day.submittedAt = new Date().toISOString();
    await store.save(day);
    res.redirect(`${base}/${date}`);
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

  // Summarize a single day (skips if already summarized unless ?force=1).
  router.post('/:date/summarize', (req, res) => {
    const { date } = req.params;
    const force = !!(req.body?.force || req.query?.force);
    summarizeDaysJob([date], force);
    res.redirect(`${base}/job/status?back=${encodeURIComponent(`${base}/${date}`)}`);
  });

  // ── Components ───────────────────────────────────────────────────────────
  // Session list row for the day-detail page. Repack info only (no per-session
  // summary — that's now a single day-level summary) plus a Raw JSONL drill-down.
  function sessionRow(s, date) {
    const files = s.filesTouched.length
      ? html`<div class="meta"><strong>Files:</strong> ${s.filesTouched.slice(0, 8).join(', ')}${s.filesTouched.length > 8 ? ` +${s.filesTouched.length - 8}` : ''}</div>`
      : '';
    const cmds = s.commands.length
      ? html`<div class="meta"><strong>Ran:</strong> ${s.commands.slice(0, 6).map((c) => html`<code>${c}</code> `)}</div>`
      : '';
    return ui.card({
      title: s.title,
      badge: html`${ui.badge(fmtTokens(s.tokens))}${s.source === 'imported' ? ui.badge(`${IMPORT_ICON} ${s.sourceLabel}`) : ui.badge(LOCAL_ICON)}`,
      desc: html`<div class="dim">${shortProject(s.project)}${s.branch ? ` · ${s.branch}` : ''} · ${s.start?.slice(11, 16)}–${s.end?.slice(11, 16)} · ${s.msgCount} msgs</div>
        ${s.prompts.length ? html`<div class="meta"><strong>Asked:</strong> ${s.prompts.slice(0, 3).join(' — ')}</div>` : ''}
        ${files}${cmds}
        ${s.outcome ? html`<div class="meta"><strong>Ended:</strong> ${s.outcome.slice(0, 200)}</div>` : ''}`,
      actions: [
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

// Collapse whitespace-free truncation for card previews.
function clip(s, n = 120) {
  const str = String(s ?? '').trim();
  return str.length > n ? str.slice(0, n).trimEnd() + '…' : str;
}

// Strip markdown emphasis/headers the model sometimes emits even when told not
// to — this app never renders markdown, so leftover **/_/# markers show up as
// literal punctuation in .summary-text blocks instead of formatting.
function stripMd(s) {
  return String(s ?? '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/__(.+?)__/g, '$1');
}

// Add `n` days to a YYYY-MM-DD string (UTC), returning YYYY-MM-DD.
function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function fmtTokens(t = { in: 0, out: 0, cache: 0 }) {
  const k = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));
  return `${k(t.in)}↓/${k(t.out)}↑ tok${t.cache ? ` (${k(t.cache)} cache)` : ''}`;
}

function shortProject(p) {
  const parts = String(p).split(/[\\/]/);
  return parts.slice(-2).join('/') || p;
}

function weekStart(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - (day === 0 ? 6 : day - 1));
  return d.toISOString().slice(0, 10);
}

function weekLabel(startStr) {
  const start = new Date(startStr + 'T00:00:00Z');
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return `${fmt(start)} – ${fmt(end)}`;
}
