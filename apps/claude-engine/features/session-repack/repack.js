import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

/**
 * Stage 1 — "Claude Session Repack". A pure, zero-cost scanner over the local
 * Claude Code transcripts. It only *reads* fields already written to disk during
 * normal sessions and reformats them — it never calls an LLM. (Stage 2,
 * summarize.js, is the opt-in part that does.)
 *
 * Transcripts live at ~/.claude/projects/<encoded-cwd>/<sessionId>.jsonl, one
 * JSONL record per line. We care about record types: user, assistant, ai-title.
 */

const TOOL_FILE_WRITERS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

// First user line of an automated agent run looks like "# Something Agent …".
const AGENT_HEADER = /^#\s.*\bagent\b/i;

export function projectsDir(env = process.env) {
  return env.CLAUDE_PROJECTS_DIR || path.join(os.homedir(), '.claude', 'projects');
}

const dayOf = (ts) => (ts || '').slice(0, 10);

// Normalize a message's content into an array of blocks.
function blocks(message) {
  const c = message?.content;
  if (typeof c === 'string') return [{ type: 'text', text: c }];
  return Array.isArray(c) ? c : [];
}

// Human-authored text from a user record (skips tool results + injected context).
function userText(record) {
  if (record.isSidechain) return null;
  const texts = blocks(record.message)
    .filter((b) => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text.trim())
    .filter((t) => t && !t.startsWith('<')); // drop <system-reminder>, <command-*> etc.
  return texts.length ? texts.join('\n') : null;
}

async function parseFile(file) {
  let raw;
  try {
    raw = await fs.readFile(file, 'utf8');
  } catch {
    return null;
  }
  const records = [];
  for (const line of raw.split('\n')) {
    const s = line.trim();
    if (!s) continue;
    try {
      records.push(JSON.parse(s));
    } catch {
      /* skip malformed line */
    }
  }
  return records;
}

/**
 * Build one session's repack from its parsed records, scoped to `date`.
 * Returns null if the session had no activity on that date.
 */
function repackSession(sessionId, records, date) {
  const onDay = records.filter((r) => r.timestamp && dayOf(r.timestamp) === date);
  if (!onDay.length) return null;

  const stamps = onDay.map((r) => r.timestamp).sort();
  const firstUser = records.find((r) => r.type === 'user' && userText(r));
  const aiTitle = records.find((r) => r.type === 'ai-title')?.aiTitle;
  const meta = firstUser || records.find((r) => r.cwd) || {};

  const prompts = [];
  const filesTouched = new Set();
  const commands = [];
  const tokens = { in: 0, out: 0, cache: 0 };
  let outcome = '';
  let sidechain = false;

  for (const r of records) {
    if (r.isSidechain) sidechain = true;
    if (r.type === 'user') {
      const t = userText(r);
      if (t && prompts.length < 12) prompts.push(t.replace(/\s+/g, ' ').slice(0, 200));
    } else if (r.type === 'assistant') {
      for (const b of blocks(r.message)) {
        if (b.type === 'text' && b.text.trim()) outcome = b.text.trim();
        if (b.type === 'tool_use') {
          if (TOOL_FILE_WRITERS.has(b.name) && b.input?.file_path) filesTouched.add(b.input.file_path);
          if (b.name === 'Bash' && b.input?.command && commands.length < 30) {
            commands.push(String(b.input.command).split('\n')[0].slice(0, 120));
          }
        }
      }
      const u = r.message?.usage;
      if (u) {
        tokens.in += u.input_tokens || 0;
        tokens.out += u.output_tokens || 0;
        tokens.cache += (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
      }
    }
  }

  const firstPromptLine = (prompts[0] || '').split('\n')[0];
  let kind = 'interactive';
  if (AGENT_HEADER.test(firstPromptLine)) kind = 'automated';
  else if (sidechain && !firstUser) kind = 'subagent';

  return {
    sessionId,
    title: aiTitle || firstPromptLine.slice(0, 80) || sessionId.slice(0, 8),
    project: meta.cwd || '(unknown)',
    branch: meta.gitBranch || '',
    kind,
    start: stamps[0],
    end: stamps[stamps.length - 1],
    msgCount: onDay.filter((r) => r.type === 'user' || r.type === 'assistant').length,
    tokens,
    prompts,
    filesTouched: [...filesTouched],
    commands,
    outcome: outcome.replace(/\s+/g, ' ').slice(0, 400),
    summary: null,
    summarizedAt: null,
  };
}

/**
 * Scan every project folder for sessions active on `date` (YYYY-MM-DD) and
 * return their repacks. Pure + zero-cost.
 */
export async function scanDay(date, env = process.env) {
  const root = projectsDir(env);
  let folders;
  try {
    folders = await fs.readdir(root);
  } catch {
    return [];
  }
  const sessions = [];
  for (const folder of folders) {
    const dir = path.join(root, folder);
    let files;
    try {
      files = (await fs.readdir(dir)).filter((n) => n.endsWith('.jsonl'));
    } catch {
      continue;
    }
    for (const name of files) {
      const records = await parseFile(path.join(dir, name));
      if (!records) continue;
      const session = repackSession(name.replace(/\.jsonl$/, ''), records, date);
      if (session) sessions.push(session);
    }
  }
  // Most recently active first.
  return sessions.sort((a, b) => (b.end || '').localeCompare(a.end || ''));
}

/**
 * Build a full day record. Merges any existing per-session summaries (matched by
 * sessionId) so re-running Stage 1 never discards Stage 2 work.
 */
export async function buildDayRepack(date, { previous } = {}, env = process.env) {
  const sessions = await scanDay(date, env);
  if (previous?.sessions?.length) {
    const prior = new Map(previous.sessions.map((s) => [s.sessionId, s]));
    for (const s of sessions) {
      const old = prior.get(s.sessionId);
      if (old?.summary) {
        s.summary = old.summary;
        s.summarizedAt = old.summarizedAt;
      }
    }
  }
  const counts = sessions.reduce((acc, s) => ((acc[s.kind] = (acc[s.kind] || 0) + 1), acc), {});
  const tokens = sessions.reduce(
    (acc, s) => ({ in: acc.in + s.tokens.in, out: acc.out + s.tokens.out, cache: acc.cache + s.tokens.cache }),
    { in: 0, out: 0, cache: 0 },
  );
  return { id: date, date, generatedAt: new Date().toISOString(), counts, tokens, sessions };
}
