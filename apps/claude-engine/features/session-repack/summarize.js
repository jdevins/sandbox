/**
 * Stage 2 — optional LLM summarization. The only part of the feature that spends
 * tokens. Two scopes, one shared shape:
 *   - summarizeDay   → one summary for a whole day, from its sessions (daily prompt)
 *   - summarizeTrend → one summary across many days (trend prompt)
 * Uses the engine's swappable provider, so it's the mock provider (free, offline)
 * unless a live provider is configured.
 */

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
  'Format: a few short paragraphs. Be concise, concrete, and forward-looking.';

// Migration-aware accessor: new day-level summary, falling back to the legacy
// executive report so previously-reported days read as already-summarized.
export const daySummary = (day) => day?.summary || day?.report || null;

function promptForDay(day) {
  const sessions = (day.sessions || []).filter((s) => s.kind === 'interactive');
  const lines = [`Date: ${day.date}`, `Sessions: ${sessions.length}`];
  for (const s of sessions) {
    lines.push(`\n--- ${s.title} ---`);
    if (s.prompts?.length) lines.push(`Asked: ${s.prompts.join(' | ')}`);
    if (s.filesTouched?.length) lines.push(`Files: ${s.filesTouched.slice(0, 12).join(', ')}`);
    if (s.outcome) lines.push(`Outcome: ${s.outcome.slice(0, 300)}`);
  }
  return lines.join('\n');
}

function promptForTrend(days) {
  // days: array of day records, oldest → newest, each with a summary already.
  const lines = [`Period: ${days[0]?.date} → ${days[days.length - 1]?.date}`, `Days: ${days.length}`];
  for (const d of days) {
    const s = daySummary(d);
    if (!s) continue;
    lines.push(`\n=== ${d.date} ===`, s.slice(0, 1200));
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
