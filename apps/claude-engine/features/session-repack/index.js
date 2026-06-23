import express from 'express';
import path from 'node:path';
import cron from 'node-cron';
import { html } from '../../lib/html.js';
import { jsonStore } from '../../lib/store.js';
import { buildDayRepack, findAllDates, readSessionRecords, scanGrouped } from './repack.js';
import { summarizeDay, summarizeDayReport, DEFAULT_REPORT_SYSTEM } from './summarize.js';

export const meta = {
  name: 'Session Repack',
  description: 'Daily recap of Claude work — zero-cost repack of local transcripts, with optional LLM summaries.',
  icon: '📋',
  version: '0.2.0',
};

const today = () => new Date().toISOString().slice(0, 10);
const KIND_BADGE = { interactive: 'ok', automated: '', subagent: 'warn' };

export function createFeature(ctx) {
  const { ui, page, provider, base, paths } = ctx;
  const store = jsonStore({ dir: path.join(paths.data, 'repacks') });
  const router = express.Router();

  async function getConfig() {
    try { return await store.get('config'); } catch { return {}; }
  }
  async function saveConfig(data) {
    await store.save({ id: 'config', ...data });
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
  const GUARD = Symbol.for('session-repack.cron');
  if (!globalThis[GUARD]) {
    globalThis[GUARD] = cron.schedule('55 23 * * *', () => {
      runRepack().catch((e) => console.warn(`[session-repack] daily repack failed: ${e.message}`));
    });
    console.log('[session-repack] daily repack scheduled (23:55, in-process, $0)');
  }

  // Singleton backfill job state — guarded so restarts don't orphan a running job.
  const BF_KEY = Symbol.for('session-repack.backfill');
  if (!globalThis[BF_KEY]) globalThis[BF_KEY] = { running: false, total: 0, done: 0, errors: [], current: null, startedAt: null, finishedAt: null };
  const bf = () => globalThis[BF_KEY];

  // Singleton summarize job state.
  const SUM_KEY = Symbol.for('session-repack.summarize');
  if (!globalThis[SUM_KEY]) globalThis[SUM_KEY] = { running: false, total: 0, done: 0, errors: [], current: null, startedAt: null, finishedAt: null };
  const sumState = () => globalThis[SUM_KEY];

  async function runSummarize(byDate, force) {
    const state = sumState();
    if (state.running) return;
    const total = [...byDate.values()].reduce((n, ids) => n + ids.length, 0);
    Object.assign(state, { running: true, total, done: 0, errors: [], current: null, startedAt: new Date().toISOString(), finishedAt: null });
    for (const [date, sessionIds] of byDate) {
      let day;
      try { day = await store.get(date); } catch { state.done += sessionIds.length; continue; }
      const toSummarize = force
        ? sessionIds
        : sessionIds.filter((id) => { const s = day.sessions.find((s) => s.sessionId === id); return s && !s.summary; });
      for (const id of toSummarize) {
        const s = day.sessions.find((s) => s.sessionId === id);
        state.current = s?.title || id.slice(0, 8);
        try {
          await summarizeDay(day, provider, [id]);
          await store.save(day);
        } catch (e) {
          state.errors.push(`${date}/${id.slice(0, 8)}: ${e.message}`);
        }
        state.done++;
      }
    }
    Object.assign(state, { running: false, current: null, finishedAt: new Date().toISOString() });
  }

  async function runBackfill() {
    const state = bf();
    if (state.running) return;
    const existing = new Set(
      (await store.list()).filter((d) => Array.isArray(d.sessions)).map((d) => d.date),
    );
    const allDates = await findAllDates();
    const pending = allDates.filter((d) => !existing.has(d)).reverse(); // newest first
    Object.assign(state, { running: true, total: pending.length, done: 0, errors: [], current: null, startedAt: new Date().toISOString(), finishedAt: null });
    for (const date of pending) {
      state.current = date;
      try {
        const previous = existing.has(date) ? await store.get(date).catch(() => null) : null;
        const day = await buildDayRepack(date, { previous });
        await store.save(day);
      } catch (e) {
        state.errors.push(`${date}: ${e.message}`);
      }
      state.done++;
    }
    Object.assign(state, { running: false, current: null, finishedAt: new Date().toISOString() });
  }

  // ── Library: all repacked days ─────────────────────────────────────────────
  router.get('/', async (req, res) => {
    const days = (await store.list()).filter((d) => Array.isArray(d.sessions));
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
    const done = parseInt(req.query.summarized || '0', 10);
    const flash = done
      ? html`<div class=”badge ok” style=”margin-bottom:12px;display:inline-block”>✓ Summarized ${done} session${done === 1 ? '' : 's'}.</div>`
      : '';
    const body = html`
      ${ui.pageHead({
        title: '📋 Session Repack',
        subtitle: 'Zero-cost daily recap of Claude work. Summaries are opt-in (LLM).',
        actions: html`${ui.btn({ href: `${base}/raw`, label: '🔍 Historical JSONL' })}${ui.btn({ href: `${base}/summarize`, label: '✨ Summarize sessions' })}${ui.btn({ action: 'post', name: `${base}/backfill`, label: '📥 Backfill history' })}${ui.btn({ action: 'post', name: `${base}/run`, label: '↻ Repack today', primary: true })}`,
      })}
      ${flash}
      <div class=”meta”>Provider for summaries: <strong>${provider.name}</strong></div>
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

  // ── Backfill ───────────────────────────────────────────────────────────────
  router.post('/backfill', async (req, res) => {
    const state = bf();
    if (!state.running) {
      runBackfill().catch((e) => {
        const s = bf();
        s.running = false;
        s.errors = [...(s.errors || []), `Fatal: ${e.message}`];
        s.finishedAt = new Date().toISOString();
      });
    }
    res.redirect(`${base}/backfill/status`);
  });

  router.get('/backfill/status', (req, res) => {
    const s = bf();
    const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
    const errs = s.errors?.length ?? 0;
    const subtitle = s.running
      ? `${s.done} of ${s.total} days processed — ${s.current || '…'}`
      : s.finishedAt
        ? `${s.done} days added · ${errs} error${errs === 1 ? '' : 's'} · finished ${s.finishedAt.slice(11, 19)}`
        : 'Press "Backfill history" on the repacks page to start.';

    const body = html`
      ${s.running ? raw('<meta http-equiv="refresh" content="2">') : ''}
      ${ui.pageHead({
        title: s.running ? `📥 Backfill running… (${pct}%)` : '📥 Backfill complete',
        subtitle,
        actions: s.running ? '' : ui.btn({ href: base, label: '← Repacks', primary: true }),
      })}
      ${s.total ? html`<progress value="${s.done}" max="${s.total}" style="width:100%;height:6px;margin-bottom:16px"></progress>` : ''}
      ${errs
        ? html`<div class="card"><strong>Errors</strong><ul style="margin:8px 0 0">${s.errors.map((e) => html`<li>${e}</li>`)}</ul></div>`
        : ''}`;
    res.send(shell(s.running ? 'Backfill…' : 'Backfill done', body, crumb));
  });

  // ── Cross-day summarize page ───────────────────────────────────────────────
  router.get('/summarize', async (req, res) => {
    const winDays = req.query.days === 'all' ? null : parseInt(req.query.days || '14', 10);
    let afterDate = null;
    if (winDays) {
      const d = new Date();
      d.setDate(d.getDate() - winDays);
      afterDate = d.toISOString().slice(0, 10);
    }

    const allDays = (await store.list()).filter((d) => Array.isArray(d.sessions));
    const filtered = (afterDate ? allDays.filter((d) => d.date >= afterDate) : allDays)
      .sort((a, b) => b.date.localeCompare(a.date));

    const totalInteractive = filtered.reduce((n, d) => n + d.sessions.filter((s) => s.kind === 'interactive').length, 0);
    const totalUnsummarized = filtered.reduce((n, d) => n + d.sessions.filter((s) => s.kind === 'interactive' && !s.summary).length, 0);

    const done = parseInt(req.query.done || '0', 10);
    const flash = done
      ? html`<div class="badge ok" style="margin-bottom:12px;display:inline-block">✓ Summarized ${done} session${done === 1 ? '' : 's'}.</div>`
      : '';

    const windowChip = (label, d) =>
      ui.btn({ href: `${base}/summarize?days=${d}`, label, primary: String(winDays || 'all') === String(d) });
    const windowNav = html`<div class="row" style="flex-wrap:wrap;gap:6px;margin-bottom:16px">
      <span class="dim" style="line-height:28px;font-size:12px">Window:</span>
      ${windowChip('7d', '7')} ${windowChip('14d', '14')} ${windowChip('30d', '30')} ${windowChip('All', 'all')}
    </div>`;

    const sessionGroups = filtered.map((d) => {
      const real = d.sessions.filter((s) => s.kind === 'interactive');
      if (!real.length) return '';
      const rows = real.map((s) => {
        const summarized = !!s.summary;
        const preview = summarized ? s.summary.slice(0, 110) + (s.summary.length > 110 ? '…' : '') : '';
        return html`<label class="row session-row" style="padding:8px 10px;border-radius:4px;cursor:pointer;align-items:flex-start;flex-wrap:nowrap" data-summarized="${summarized ? '1' : '0'}">
          <input type="checkbox" name="sessions" value="${d.date}:${s.sessionId}" style="margin-top:3px;flex-shrink:0" ${summarized ? '' : 'checked'}>
          <div style="flex:1;min-width:0">
            <div class="row">
              <span>${s.title}</span>
              ${summarized ? ui.badge('summarized', 'ok') : ui.badge('raw')}
              <span class="dim" style="font-size:12px">${s.start?.slice(11, 16) || ''}</span>
            </div>
            ${preview ? html`<div class="dim" style="font-size:12px;margin-top:2px">${preview}</div>` : ''}
          </div>
        </label>`;
      });
      return html`<div style="margin-bottom:14px">
        <div style="font-weight:600;margin-bottom:4px;font-size:13px;color:var(--text-dim)">${d.date}</div>
        <div class="card" style="padding:4px 0">${rows}</div>
      </div>`;
    });

    const body = html`
      ${ui.pageHead({
        title: '✨ Summarize Sessions',
        subtitle: `${totalInteractive} interactive · ${totalUnsummarized} unsummarized`,
        actions: ui.btn({ href: base, label: '← Repacks' }),
      })}
      ${flash}
      ${windowNav}
      <form method="POST" action="${base}/summarize/batch">
        <input type="hidden" name="days" value="${winDays || 'all'}">
        <div class="row" style="gap:8px;margin-bottom:14px;align-items:center;flex-wrap:wrap">
          <button type="button" onclick="selectUnsummarized()" class="btn">Check unsummarized</button>
          <button type="button" onclick="selectAll()" class="btn">Check all</button>
          <button type="button" onclick="deselectAll()" class="btn">Uncheck all</button>
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin-left:auto">
            <input type="checkbox" name="force" value="on"> Force re-summarize
          </label>
          <button type="submit" class="btn llm" id="submit-btn">✨ Summarize selected</button>
        </div>
        ${filtered.length ? sessionGroups : ui.empty('No repacked days in this window — run "Repack today" first.')}
      </form>
      <script>
        function updateBtn() {
          const n = document.querySelectorAll('input[name=sessions]:checked').length;
          document.getElementById('submit-btn').textContent = n
            ? 'Summarize selected (' + n + ')'
            : 'Summarize selected';
        }
        document.querySelectorAll('input[name=sessions]').forEach(cb => cb.addEventListener('change', updateBtn));
        function selectUnsummarized() {
          document.querySelectorAll('.session-row').forEach(r => {
            r.querySelector('input').checked = r.dataset.summarized === '0';
          });
          updateBtn();
        }
        function selectAll() {
          document.querySelectorAll('input[name=sessions]').forEach(cb => cb.checked = true);
          updateBtn();
        }
        function deselectAll() {
          document.querySelectorAll('input[name=sessions]').forEach(cb => cb.checked = false);
          updateBtn();
        }
        updateBtn();
      </script>`;
    res.send(shell('Summarize Sessions', body, [...crumb, { href: '#', label: 'summarize' }]));
  });

  router.post('/summarize/batch', async (req, res) => {
    let selected = req.body.sessions || [];
    if (!Array.isArray(selected)) selected = [selected];
    const force = req.body.force === 'on';
    const backDays = req.body.days || '14';

    const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
    const byDate = new Map();
    for (const entry of selected) {
      const colon = entry.indexOf(':');
      if (colon < 0) continue;
      const date = entry.slice(0, colon);
      if (!DATE_RE.test(date)) continue;
      const sessionId = entry.slice(colon + 1);
      if (!byDate.has(date)) byDate.set(date, []);
      byDate.get(date).push(sessionId);
    }

    if (!sumState().running) {
      runSummarize(byDate, force).catch((e) => {
        const s = sumState();
        s.running = false;
        s.errors = [...(s.errors || []), `Fatal: ${e.message}`];
        s.finishedAt = new Date().toISOString();
      });
    }
    res.redirect(`${base}/summarize/status?back=${encodeURIComponent(`${base}/summarize?days=${backDays}`)}`);
  });

  router.get('/summarize/status', (req, res) => {
    const s = sumState();
    const back = req.query.back || `${base}/summarize`;
    const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
    const errs = s.errors?.length ?? 0;
    const subtitle = s.running
      ? `${s.done} of ${s.total} sessions — ${s.current || '…'}`
      : s.finishedAt
        ? `${s.done} summarized · ${errs} error${errs === 1 ? '' : 's'} · finished ${s.finishedAt.slice(11, 19)}`
        : 'Not started.';

    const body = html`
      ${s.running ? raw('<meta http-equiv="refresh" content="2">') : ''}
      ${ui.pageHead({
        title: s.running ? `✨ Summarizing… (${pct}%)` : '✨ Summarization complete',
        subtitle,
        actions: s.running ? '' : ui.btn({ href: back, label: '← Back', primary: true }),
      })}
      ${s.total ? html`<progress value="${s.done}" max="${s.total}" style="width:100%;height:6px;margin-bottom:16px"></progress>` : ''}
      ${s.running ? html`<div class="dim" style="font-size:13px">Summarizing: ${s.current || '…'}</div>` : ''}
      ${errs ? html`<div class="card" style="margin-top:12px"><strong>Errors</strong><ul style="margin:8px 0 0">${s.errors.map((e) => html`<li>${e}</li>`)}</ul></div>` : ''}`;
    res.send(shell(s.running ? 'Summarizing…' : 'Done', body, crumb));
  });

  // ── Report prompt editor ───────────────────────────────────────────────────
  router.get('/prompt', async (req, res) => {
    const config = await getConfig();
    const current = config.reportPrompt || DEFAULT_REPORT_SYSTEM;
    const back = req.query.back || base;
    const body = html`
      ${ui.pageHead({
        title: '✏️ Edit Report Prompt',
        subtitle: 'System prompt used when generating executive day reports.',
        actions: ui.btn({ href: back, label: '← Back' }),
      })}
      ${ui.configForm({
        action: `${base}/prompt`,
        fields: [{ name: 'prompt', label: 'System Prompt', type: 'code', rows: 14, value: current }],
        extra: html`<input type="hidden" name="back" value="${back}"><a class="btn" href="${back}">Cancel</a>`,
        submit: 'Save',
      })}`;
    res.send(shell('Edit Report Prompt', body, [...crumb, { href: '#', label: 'prompt' }]));
  });

  router.post('/prompt', async (req, res) => {
    const prompt = (req.body?.prompt || '').trim();
    if (prompt) await saveConfig({ reportPrompt: prompt });
    res.redirect(req.body?.back || base);
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
    const promptEditHref = `${base}/prompt?back=${encodeURIComponent(`${base}/${day.date}`)}`;

    const reportSection = day.report
      ? html`<div class="card" style="margin-bottom:16px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
            <strong>📊 Executive Report</strong>
            <span class="dim">· ${day.reportMeta?.provider || 'llm'} · ${day.reportAt?.slice(0, 10) || ''}</span>
          </div>
          <div style="white-space:pre-wrap;line-height:1.7;font-size:14px">${day.report}</div>
        </div>`
      : '';

    const body = html`
      ${ui.pageHead({
        title: `📋 ${day.date}`,
        subtitle: `${real.length} interactive · ${fmtTokens(day.tokens)} · generated ${day.generatedAt.slice(11, 16)}`,
        actions: html`
          ${ui.btn({ action: 'post', name: `${base}/run`, label: '↻ Re-repack' })}
          ${pending ? ui.btn({ action: 'post', name: `${base}/${day.date}/summarize`, label: `✨ Summarize ${pending}`, llm: true }) : ''}
          ${ui.btn({ action: 'post', name: `${base}/${day.date}/report`, label: day.report ? '📊 Re-generate Report' : '📊 Generate Report', llm: true })}
          <a class="btn" href="${promptEditHref}" title="Edit report prompt" style="padding:0 10px">✏️</a>
        `,
      })}
      ${reportSection}
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
    const { date } = req.params;
    if (!sumState().running) {
      try {
        const day = await store.get(date);
        const ids = day.sessions.filter((s) => s.kind === 'interactive' && !s.summary).map((s) => s.sessionId);
        if (ids.length) {
          runSummarize(new Map([[date, ids]]), false).catch((e) => {
            const s = sumState(); s.running = false; s.errors = [...(s.errors || []), `Fatal: ${e.message}`]; s.finishedAt = new Date().toISOString();
          });
        }
      } catch { /* no repack for date */ }
    }
    res.redirect(`${base}/summarize/status?back=${encodeURIComponent(`${base}/${date}`)}`);
  });

  // Stage 2 — summarize a single session.
  router.post('/:date/summarize/:sessionId', async (req, res) => {
    const { date, sessionId } = req.params;
    if (!sumState().running) {
      runSummarize(new Map([[date, [sessionId]]]), false).catch((e) => {
        const s = sumState(); s.running = false; s.errors = [...(s.errors || []), `Fatal: ${e.message}`]; s.finishedAt = new Date().toISOString();
      });
    }
    res.redirect(`${base}/summarize/status?back=${encodeURIComponent(`${base}/${date}`)}`);
  });

  // Stage 2 — generate executive day report (single LLM call, background).
  router.post('/:date/report', async (req, res) => {
    const { date } = req.params;
    res.redirect(`${base}/summarize/status?back=${encodeURIComponent(`${base}/${date}`)}`);
    // Fire after redirect is sent — report is one call so we reuse sumState for display.
    if (!sumState().running) {
      Object.assign(sumState(), { running: true, total: 1, done: 0, errors: [], current: 'executive report', startedAt: new Date().toISOString(), finishedAt: null });
      try {
        const day = await store.get(date);
        const config = await getConfig();
        await summarizeDayReport(day, provider, config.reportPrompt || DEFAULT_REPORT_SYSTEM);
        await store.save(day);
      } catch (e) {
        sumState().errors.push(e.message);
      }
      Object.assign(sumState(), { running: false, done: 1, current: null, finishedAt: new Date().toISOString() });
    }
  });

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
        ui.btn({ action: 'post', name: `${base}/${date}/summarize/${s.sessionId}`, label: s.summary ? '✨ Re-summarize' : '✨ Summarize', llm: true }),
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
