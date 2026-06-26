/**
 * Stage 2 — optional LLM summarization. The only part of the feature that spends
 * tokens. Two scopes, one shared shape:
 *   - summarizeDay   → one summary for a whole day, from its sessions (daily prompt)
 *   - summarizeTrend → one summary across many days (trend prompt)
 * Uses the engine's swappable provider, so it's the mock provider (free, offline)
 * unless a live provider is configured.
 */

import { formatDuration } from './repack.js';

// Both prompts below quote raw excerpts from Claude Code session transcripts —
// titles, asked questions, outcomes. Those transcripts routinely contain
// literal tags like <system-reminder> (that's just what Claude Code sessions
// look like). An earlier version of this note told the model how to react
// ("don't flag this") — that phrasing is itself shaped like an injection
// attempt, so the model flagged the note instead of the content. This version
// only labels the data source; it gives no instruction about behavior.
const INERT_CONTENT_NOTE =
  'Below is a log excerpt from past Claude Code sessions, included as reference data.\n\n';

export const DEFAULT_DAILY_SYSTEM =
  'You help an executive understand how a person used Claude during a workday.\n' +
  'Given a list of Claude sessions (titles, questions asked, outcomes), answer ' +
  'these four questions in plain language — no jargon, no tool names, no server details. ' +
  'Focus on the intellectual and strategic work, not technical mechanics.\n\n' +
  '1. What Claude was used for today\n' +
  '2. What the user learned or built understanding of\n' +
  '3. Areas where the work could improve or where Claude was under-leveraged\n' +
  '4. Next opportunities worth exploring\n\n' +
  'Format: four short paragraphs, one per question, labeled 1–4. Be concise and direct.';

export const DEFAULT_TREND_SYSTEM =
  'You analyze how a person used Claude across multiple days.\n' +
  'Given a sequence of daily summaries, identify the throughlines — not a day-by-day ' +
  'recap. Surface: recurring themes and projects, how focus shifted over the period, ' +
  'momentum (what is accelerating or stalling), and patterns worth acting on.\n\n' +
  'Format: a few short paragraphs, plain prose. No markdown formatting — no asterisks, ' +
  'no headers, no bullet lists. Be concise, concrete, and forward-looking.';

/**
 * Structured mode — rung hierarchy, from most to least relevance-worthy.
 * Rung position sets the bar to *qualify*, not a quality score: "client" sits
 * at threshold 0 because client-facing work matters to an exec by default,
 * while "competency" (routine Claude usage) sits at 5 — only a genuinely
 * exceptional day clears it, otherwise it's just navel-gazing about tooling.
 * Final list order is by score, not rung — so a low-score client item still
 * shows (per the always-include rule below) but sorts toward the bottom
 * rather than displacing a stronger item.
 */
export const RUNGS = [
  { id: 'client', label: 'Client / project impact', threshold: 0 },
  { id: 'systems', label: 'Internal systems, tools, processes', threshold: 3 },
  { id: 'local-tools', label: 'Local-scoped systems or tools', threshold: 3 },
  { id: 'claude-mgmt', label: 'Local Claude management', threshold: 4 },
  { id: 'ai-tooling', label: 'AI tools & skillsets', threshold: 4 },
  { id: 'ai-practice', label: 'AI practice topics', threshold: 4 },
  { id: 'core-practice', label: 'Core AI practices', threshold: 5 },
  { id: 'competency', label: 'AI competencies', threshold: 5 },
];
const RUNG_IDS = new Set(RUNGS.map((r) => r.id));

// Minimum number of items the day tries to "sell" individually. A day with
// enough naturally-qualifying signal never needs this — it's the floor for
// quiet days, not a target every day chases.
export const DEFAULT_QUOTA = 2;

export const DEFAULT_SCORE_SYSTEM =
  'You are scoring a list of Claude Code sessions from one workday as candidates for an ' +
  'executive-facing highlight list. For each interactive session, decide whether it contains ' +
  'a genuinely notable signal — not routine tool use (running commands, editing files, generic ' +
  'git/server tasks). Most sessions will have nothing notable; that is expected and correct.\n\n' +
  'Classify each notable signal into exactly one rung:\n' +
  RUNGS.map((r) => `- ${r.id}: ${r.label}`).join('\n') +
  '\n\nRung guide: "client" is direct work helping deliver value to a client or named project. ' +
  '"systems"/"local-tools" are internal tooling or process work. "claude-mgmt"/"ai-tooling"/' +
  '"ai-practice" are building or operating AI infrastructure (agents, schedulers, hooks, skills). ' +
  '"core-practice"/"competency" are about how Claude itself is being used (standards, token ' +
  'discipline, general proficiency) — reserve these for rare, clearly exceptional cases, not ' +
  'everyday usage.\n\n' +
  'For each candidate, "evidence" MUST be a literal substring copied verbatim from the session ' +
  'data below (a file path, command, or quoted phrase) — never paraphrase or invent it. Score ' +
  '1-5 on how genuinely notable the signal is, independent of which rung it falls in (a 5 in ' +
  '"client" and a 5 in "competency" both mean "exceptional for that category" — being rare for ' +
  'the rung is part of what justifies a high score).\n\n' +
  'Respond with ONLY a JSON array, no prose, no markdown fences. Each element: ' +
  '{"sessionId": "...", "rung": "<one of the rung ids above>", "score": 1-5, "evidence": "...", ' +
  '"note": "one short clause on why"}. If nothing qualifies, respond with [].';

export const DEFAULT_RENDER_SYSTEM =
  'You write a short executive-facing hitlist from pre-screened, pre-scored signals — the ' +
  'screening already happened, your only job is voice and format.\n\n' +
  'For each item, write one line: a one-or-two word category, then 1-2 sentences max. Each item ' +
  'gives you "evidence" (a literal fact — a file, command, or quoted phrase) and "note" (the ' +
  'scorer\'s shorthand for why it matters) — use both as the raw material, but write the sentence ' +
  'yourself in your own voice; do not just restate the note verbatim. Stay grounded in what ' +
  'evidence and note actually describe — do not invent detail beyond them.\n\n' +
  'Effort scales with category: for "Client / project impact" and "Internal systems, tools, ' +
  'processes" items, spend the sentence on the value delivered — how this helped, who benefits. ' +
  'For everything else, stay matter-of-fact about what was done; do not manufacture strategic ' +
  'framing for routine tooling work just because it is on the list.\n\n' +
  'Do not name personal servers, machines, or codebases; refer to "a local tool" or "an internal ' +
  'system". Do not editorialize about how impressive this is — let it speak for itself. No ' +
  '"try-hard" framing, no calling routine work groundbreaking.\n\n' +
  'Format: plain text, one item per line, ordered as given. No markdown, no headers.';

// Fail-safe JSON extraction for the score stage — a malformed or non-JSON
// reply must never be reinterpreted as prose and passed downstream; treat it
// as "no candidates" so render-stage poisoning fails closed, not open.
function parseCandidates(text) {
  const match = String(text || '').match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Last 2 path segments only — full absolute paths are mostly repo-root
// boilerplate that costs tokens without adding signal. Trimmed here (the
// LLM-facing serialization) only; repack.js keeps full paths in storage for
// the UI and raw-transcript viewer.
const shortPath = (p) => String(p).split(/[\\/]/).slice(-2).join('/');

// Per-session evidence blob — same text both shown to the scorer and checked
// against its "evidence" field, so a citation either traces to real repack
// data or the candidate is dropped. This is the anti-hallucination gate.
function sessionBlock(s) {
  const lines = [`id: ${s.sessionId}`, `title: ${detag(s.title)}`];
  if (s.prompts?.length) lines.push(`asked: ${detag(s.prompts.join(' | '))}`);
  if (s.filesTouched?.length) lines.push(`files: ${detag(s.filesTouched.map(shortPath).join(', '))}`);
  if (s.commands?.length) lines.push(`ran: ${detag(s.commands.join(' | '))}`);
  if (s.outcome) lines.push(`outcome: ${detag(s.outcome)}`);
  if (s.toolUseCounts && Object.keys(s.toolUseCounts).length) {
    lines.push(`tools: ${detag(Object.entries(s.toolUseCounts).map(([n, c]) => `${n}×${c}`).join(', '))}`);
  }
  if (s.signals?.length) lines.push(`signals: ${detag(s.signals.join(', '))}`);
  return lines.join('\n');
}

function promptForScore(day) {
  const sessions = (day.sessions || []).filter((s) => s.kind === 'interactive');
  const blocks = sessions.map((s) => sessionBlock(s));
  return [`Date: ${day.date}`, `Sessions: ${sessions.length}`, ...blocks.map((b) => `\n---\n${b}`)].join('\n');
}

// Validate + filter raw model candidates against the actual session data:
// rung must be real, score must be a 1-5 integer, evidence must literally
// appear in that session's own blob (not just somewhere in the day). Anything
// that fails is dropped silently rather than passed through degraded.
function validateCandidates(raw, day) {
  const blocksById = new Map(
    (day.sessions || []).filter((s) => s.kind === 'interactive').map((s) => [s.sessionId, sessionBlock(s)]),
  );
  const out = [];
  for (const c of raw) {
    if (!c || typeof c !== 'object') continue;
    const block = blocksById.get(c.sessionId);
    if (!block) continue;
    if (!RUNG_IDS.has(c.rung)) continue;
    const score = Math.round(Number(c.score));
    if (!(score >= 1 && score <= 5)) continue;
    const evidence = detag(String(c.evidence || ''));
    if (!evidence || !block.includes(evidence)) continue;
    // note is grounding-exempt (it's the scorer's color commentary, not a
    // checkable fact) but it's what gives the render stage something to
    // actually write from — evidence alone is often just a bare file path,
    // which starves render into producing nothing rather than inventing.
    const note = detag(String(c.note || '')).slice(0, 200);
    out.push({ sessionId: c.sessionId, rung: c.rung, score, evidence, note });
  }
  return out;
}

// Effective qualifying bar for a rung, honoring config overrides and the
// client-rung escape hatch (default on: client impact always makes the list).
function effectiveThreshold(rungId, config = {}) {
  if (rungId === 'client' && config.alwaysIncludeClientRung !== false) return 0;
  const override = config.rungThresholds?.[rungId];
  if (Number.isFinite(override)) return override;
  return RUNGS.find((r) => r.id === rungId)?.threshold ?? 5;
}

/**
 * Heap model: rung thresholds are the magnet that naturally pulls out
 * high-value items. If that alone clears quota, stop — a high-signal day
 * doesn't need padding. If it falls short, dip into the rest of the heap
 * (next-best score, threshold ignored) only far enough to reach quota —
 * everything past that stays in the "remaining heap" and gets a flat,
 * zero-effort treatment rather than being individually sold.
 */
function selectWithQuota(validated, day, config) {
  const quota = Number.isFinite(config.dailyQuota) ? config.dailyQuota : DEFAULT_QUOTA;
  const naturallyQualifying = validated
    .filter((c) => c.score >= effectiveThreshold(c.rung, config))
    .sort((a, b) => b.score - a.score);

  let selected = naturallyQualifying;
  if (naturallyQualifying.length < quota) {
    const chosenIds = new Set(naturallyQualifying.map((c) => c.sessionId));
    const leftover = validated
      .filter((c) => !chosenIds.has(c.sessionId))
      .sort((a, b) => b.score - a.score);
    selected = [...naturallyQualifying, ...leftover.slice(0, quota - naturallyQualifying.length)];
  }

  const selectedIds = new Set(selected.map((c) => c.sessionId));
  const remainingSessions = (day.sessions || []).filter(
    (s) => s.kind === 'interactive' && !selectedIds.has(s.sessionId),
  );
  return { selected, remainingSessions };
}

function promptForRender(candidates) {
  const byId = new Map(RUNGS.map((r) => [r.id, r.label]));
  if (!candidates.length) return '(no qualifying candidates)';
  return candidates
    .map((c, i) => `${i + 1}. category: ${byId.get(c.rung)}\n   evidence: ${c.evidence}\n   note: ${c.note || '(none)'}`)
    .join('\n');
}

// Zero-cost, zero-judgment closer for whatever didn't get individually sold —
// built straight from repack data, no LLM call. This is the literal "flat
// rate" for the rest of the heap: same line shape every day, no effort spent
// making it sound like more than it is.
function remainingHeapLine(remainingSessions) {
  if (!remainingSessions.length) return '';
  const titles = remainingSessions.slice(0, 6).map((s) => s.title).join(', ');
  const extra = remainingSessions.length > 6 ? ` +${remainingSessions.length - 6} more` : '';
  return `Also: ${remainingSessions.length} other session${remainingSessions.length === 1 ? '' : 's'} — ${titles}${extra}.`;
}

/**
 * Structured-mode day summary: score candidates (LLM, JSON), validate them
 * against real session data, filter to qualifying rungs, then render only the
 * survivors in the target voice. Two LLM calls (skipped on the render side if
 * nothing qualifies — also saves tokens on a quiet day, not just nicer copy).
 */
export async function summarizeDayStructured(day, provider, config = {}) {
  const scoreSystem = INERT_CONTENT_NOTE + (config.scorePrompt || DEFAULT_SCORE_SYSTEM);
  const scoreReply = await provider.complete({ system: scoreSystem, prompt: promptForScore(day) });
  const raw = parseCandidates(scoreReply.text);
  const validated = validateCandidates(raw, day);
  const { selected, remainingSessions } = selectWithQuota(validated, day, config);

  let soldText = '';
  let renderUsage = null;
  let renderMeta = { provider: scoreReply.provider, model: scoreReply.model };
  if (selected.length) {
    const renderSystem = INERT_CONTENT_NOTE + (config.renderPrompt || DEFAULT_RENDER_SYSTEM);
    const renderReply = await provider.complete({ system: renderSystem, prompt: promptForRender(selected) });
    soldText = (renderReply.text || '').trim();
    renderUsage = renderReply.usage;
    renderMeta = { provider: renderReply.provider, model: renderReply.model };
  }
  const heapLine = remainingHeapLine(remainingSessions);

  day.summary = [soldText, heapLine].filter(Boolean).join('\n') || 'No sessions today.';
  day.summaryAt = new Date().toISOString();
  day.summaryMeta = {
    ...renderMeta,
    usage: renderUsage,
    scoreUsage: scoreReply.usage,
    candidates: validated, // kept for transparency — lets you audit what was scored vs what rendered
    selectedIds: selected.map((c) => c.sessionId),
  };
  delete day.report;
  delete day.reportAt;
  delete day.reportMeta;
  return day;
}

// Migration-aware accessor: new day-level summary, falling back to the legacy
// executive report so previously-reported days read as already-summarized.
export const daySummary = (day) => day?.summary || day?.report || null;

// Quoted session content is people talking *about* Claude Code, which means it
// routinely contains real, literal tag syntax (<system-reminder>, someone
// pasting a fake <system> tag while debugging exactly this). No amount of
// instructing the model how to react survives that — an instruction about
// "don't flag this" is itself injection-shaped. So strip the one thing that
// actually makes text tag-shaped: angle brackets become similar-looking but
// inert characters before any of this reaches a prompt.
const detag = (s) => String(s ?? '').replace(/</g, '‹').replace(/>/g, '›');

// HH:MM from an ISO timestamp — same raw slice convention used everywhere
// else in this feature (day.generatedAt, session start/end), not local time.
const timeOf = (iso) => (iso ? iso.slice(11, 16) : null);

function promptForDay(day) {
  const sessions = (day.sessions || []).filter((s) => s.kind === 'interactive');
  const lines = [`Date: ${day.date}`, `Sessions: ${sessions.length}`];
  if (day.firstChatAt) lines.push(`First chat: ${timeOf(day.firstChatAt)}`);
  if (day.lastChatAt) lines.push(`Last chat: ${timeOf(day.lastChatAt)}`);
  if (day.activeMs) lines.push(`Active chat duration: ${formatDuration(day.activeMs)}`);
  for (const s of sessions) {
    lines.push(`\n--- ${detag(s.title)} ---`);
    if (s.prompts?.length) lines.push(`Asked: ${detag(s.prompts.join(' | '))}`);
    if (s.filesTouched?.length) lines.push(`Files: ${detag(s.filesTouched.slice(0, 12).join(', '))}`);
    if (s.outcome) lines.push(`Outcome: ${detag(s.outcome.slice(0, 300))}`);
  }
  return lines.join('\n');
}

function promptForTrend(days) {
  // days: array of day records, oldest → newest, each with a summary already.
  const lines = [`Period: ${days[0]?.date} → ${days[days.length - 1]?.date}`, `Days: ${days.length}`];
  for (const d of days) {
    const s = daySummary(d);
    if (!s) continue;
    lines.push(`\n=== ${d.date} ===`, detag(s.slice(0, 1200)));
  }
  return lines.join('\n');
}

/** Generate one day-level summary in place. Returns the mutated day. */
export async function summarizeDay(day, provider, systemPrompt) {
  const { text, usage, provider: name, model } = await provider.complete({
    // INERT_CONTENT_NOTE is prepended even for a saved custom prompt — without
    // it, every summarization re-triggers the model's injection-defense reflex
    // on the quoted transcript text, which is just how Claude Code sessions look.
    system: INERT_CONTENT_NOTE + (systemPrompt || DEFAULT_DAILY_SYSTEM),
    prompt: promptForDay(day),
  });
  day.summary = (text || '').trim();
  day.summaryAt = new Date().toISOString();
  day.summaryMeta = { provider: name, model, usage };
  // Legacy report fields are now folded into summary; drop them so there is one
  // source of truth going forward.
  delete day.report;
  delete day.reportAt;
  delete day.reportMeta;
  return day;
}

/**
 * Generate one trend summary over a set of already-summarized days. Returns a
 * trend record (caller persists it). `range` is { kind, start, end }.
 */
export async function summarizeTrend(days, provider, systemPrompt, range) {
  const ordered = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const { text, usage, provider: name, model } = await provider.complete({
    system: INERT_CONTENT_NOTE + (systemPrompt || DEFAULT_TREND_SYSTEM),
    prompt: promptForTrend(ordered),
  });
  const start = range?.start || ordered[0]?.date;
  const end = range?.end || ordered[ordered.length - 1]?.date;
  return {
    id: range?.kind === 'week' ? `week:${start}` : `range:${start}:${end}`,
    kind: range?.kind || 'range',
    start,
    end,
    days: ordered.map((d) => d.date),
    summary: (text || '').trim(),
    generatedAt: new Date().toISOString(),
    meta: { provider: name, model, usage },
  };
}
