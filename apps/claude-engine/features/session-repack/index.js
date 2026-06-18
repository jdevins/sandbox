import express from 'express';
import path from 'node:path';
import cron from 'node-cron';
import { html } from '../../lib/html.js';
import { jsonStore } from '../../lib/store.js';
import { buildDayRepack } from './repack.js';
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
        actions: ui.btn({ action: 'post', name: `${base}/run`, label: '↻ Repack today', primary: true }),
      })}
      <div class="meta">Provider for summaries: <strong>${provider.name}</strong></div>
      ${days.length ? ui.grid(cards) : ui.empty('No repacks yet — run “Repack today”.')}`;
    res.send(shell('Repacks', body));
  });

  router.post('/run', async (req, res) => {
    const day = await runRepack(req.body?.date || today());
    res.redirect(`${base}/${day.date}`);
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
      ],
    });
  }

  return router;
}

function fmtTokens(t = { in: 0, out: 0, cache: 0 }) {
  const k = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));
  return `${k(t.in)}↓/${k(t.out)}↑ tok${t.cache ? ` (${k(t.cache)} cache)` : ''}`;
}

function shortProject(p) {
  const parts = String(p).split(/[\\/]/);
  return parts.slice(-2).join('/') || p;
}
