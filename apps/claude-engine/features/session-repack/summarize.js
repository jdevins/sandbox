/**
 * Stage 2 — optional LLM summarization. Runs only when invoked from the UI, on
 * one / some / all not-yet-summarized sessions. This is the *only* part of the
 * feature that spends tokens. Uses the engine's swappable provider, so it is the
 * mock provider (free, offline) unless a live provider is configured.
 */

const SYSTEM =
  'You write one-line status entries for a daily engineering report. ' +
  'Given a repacked Claude Code session (prompts, files touched, commands, outcome), ' +
  'reply with a single sentence: what the user accomplished and whether it landed. ' +
  'No preamble, no markdown, under 30 words.';

function promptFor(session) {
  const lines = [
    `Title: ${session.title}`,
    `Project: ${session.project}${session.branch ? ` (${session.branch})` : ''}`,
    `Asks: ${session.prompts.join(' | ')}`,
  ];
  if (session.filesTouched.length) lines.push(`Files touched: ${session.filesTouched.join(', ')}`);
  if (session.commands.length) lines.push(`Commands: ${session.commands.slice(0, 10).join(' ; ')}`);
  if (session.outcome) lines.push(`Closing message: ${session.outcome}`);
  return lines.join('\n');
}

/** Summarize a single session in place. Returns the mutated session. */
export async function summarizeSession(session, provider) {
  const { text, usage, provider: name, model } = await provider.complete({
    system: SYSTEM,
    prompt: promptFor(session),
  });
  session.summary = (text || '').trim();
  session.summarizedAt = new Date().toISOString();
  session.summaryMeta = { provider: name, model, usage };
  return session;
}

/**
 * Summarize selected sessions in a day record. `which` is an array of
 * sessionIds, or 'unsummarized' for every session lacking a summary.
 * Skips automated/subagent runs unless explicitly named.
 */
export async function summarizeDay(day, provider, which = 'unsummarized') {
  const wanted = (s) => {
    if (Array.isArray(which)) return which.includes(s.sessionId);
    return !s.summary && s.kind === 'interactive';
  };
  let count = 0;
  for (const s of day.sessions) {
    if (!wanted(s)) continue;
    await summarizeSession(s, provider);
    count++;
  }
  return { count };
}
