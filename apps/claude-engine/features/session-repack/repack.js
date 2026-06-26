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

// Sentinel prepended to prompt files that the scheduler runs.
const AUTOMATED_SENTINEL = '[automated]';
// Fallback heuristic for sessions that predate the sentinel convention.
const AGENT_HEADER = /^#\s.*\bagent\b/i;

// Dev-loop mechanics (git, test runners, file listing, log digging) are noise
// for "what did this session demonstrate" — capturing them anyway and
// trusting the LLM to discount them on every call wastes both prompt space
// and the model's attention. Drop them at the source instead.
const NOISE_COMMAND_RE = /^(git\s|npm\s+(test|run|start|install|ci)\b|node\s+--(check|test)\b|ls\b|find\s|grep\s|curl\s|cat\s|wc\s|echo\s|cd\s)/i;

// Mechanical, zero-inference rung hints derived straight from file paths —
// these map to specific rungs without asking the model to infer anything.
const SIGNAL_PATTERNS = [
  { id: 'skill-module', re: /data[\\/]skills[\\/]/ },
  { id: 'agent-module', re: /data[\\/]agents[\\/]/ },
  { id: 'standards-doc', re: /(^|[\\/])standards[\\/]/ },
  { id: 'feature-module', re: /features[\\/][^\\/]+[\\/]index\.js$/ },
  { id: 'test-file', re: /\.test\.js$/ },
];

export function projectsDir(env = process.env) {
  return env.CLAUDE_PROJECTS_DIR || path.join(os.homedir(), '.claude', 'projects');
}

// Local-calendar-day date string (YYYY-MM-DD) — NOT UTC. Sessions and the
// daily cron are scoped to the user's actual workday; slicing the UTC
// timestamp directly rolls the date over mid-evening for timezones west of
// UTC (e.g. US Eastern rolls at 8pm local), splitting one workday in two.
export const localDate = (d = new Date()) => {
  const shifted = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 10);
};

const dayOf = (ts) => (ts ? localDate(new Date(ts)) : '');

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
 * Scan all transcripts and return records grouped by date → session.
 * Each session is bucketed by its first timestamped record's date.
 * Dateless metadata records (ai-title, mode, etc.) inherit the session's date.
 * Dates newest-first; sessions within a date newest-last-activity-first.
 * Pure + zero-cost.
 */
export async function scanGrouped({ type = 'all', afterDate = null, env = process.env } = {}) {
  const root = projectsDir(env);
  let folders;
  try {
    folders = await fs.readdir(root);
  } catch {
    return { dates: [], counts: {} };
  }

  const sessions = new Map();
  const counts = {};

  for (const folder of folders) {
    const dir = path.join(root, folder);
    let files;
    try {
      files = (await fs.readdir(dir)).filter((n) => n.endsWith('.jsonl'));
    } catch {
      continue;
    }
    for (const name of files) {
      if (afterDate) {
        try {
          const { mtime } = await fs.stat(path.join(dir, name));
          if (localDate(mtime) < afterDate) continue;
        } catch {
          /* if stat fails, read it anyway */
        }
      }
      const raw = await parseFile(path.join(dir, name));
      if (!raw) continue;
      const sid = name.replace(/\.jsonl$/, '');
      const stamps = raw.map((r) => r.timestamp).filter(Boolean).sort();
      const firstDate = stamps[0] ? localDate(new Date(stamps[0])) : 'unknown';
      const lastDate = stamps[stamps.length - 1] ? localDate(new Date(stamps[stamps.length - 1])) : firstDate;
      const aiTitle = raw.find((r) => r.type === 'ai-title')?.aiTitle;
      const cwd = raw.find((r) => r.cwd)?.cwd || folder;
      for (const r of raw) counts[r.type] = (counts[r.type] || 0) + 1;
      sessions.set(sid, { sid, project: cwd, firstDate, lastDate, aiTitle, records: raw });
    }
  }

  const dateMap = new Map();
  for (const s of sessions.values()) {
    if (!dateMap.has(s.firstDate)) dateMap.set(s.firstDate, []);
    dateMap.get(s.firstDate).push(s);
  }

  const dates = [...dateMap.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, sess]) => ({
      date,
      sessions: sess
        .sort((a, b) => b.lastDate.localeCompare(a.lastDate))
        .map((s) => ({
          ...s,
          records: type === 'all' ? s.records : s.records.filter((r) => r.type === type),
        }))
        .filter((s) => s.records.length > 0),
    }))
    .filter((d) => d.sessions.length > 0);

  return { dates, counts };
}

/**
 * Stat all JSONL files and return every distinct date (YYYY-MM-DD) that has
 * at least one session, using file mtime as a fast proxy. O(n) stats, no reads.
 */
export async function findAllDates(env = process.env) {
  const root = projectsDir(env);
  let folders;
  try { folders = await fs.readdir(root); } catch { return []; }

  const dateSet = new Set();
  for (const folder of folders) {
    const dir = path.join(root, folder);
    let files;
    try { files = (await fs.readdir(dir)).filter((n) => n.endsWith('.jsonl')); } catch { continue; }
    for (const name of files) {
      try {
        const { mtime } = await fs.stat(path.join(dir, name));
        dateSet.add(localDate(mtime));
      } catch { /* skip */ }
    }
  }
  return [...dateSet].sort();
}

/** Locate a session's transcript file by id across all project folders. */
export async function findSessionFile(sessionId, env = process.env) {
  const root = projectsDir(env);
  let folders;
  try {
    folders = await fs.readdir(root);
  } catch {
    return null;
  }
  for (const folder of folders) {
    const file = path.join(root, folder, `${sessionId}.jsonl`);
    try {
      await fs.access(file);
      return file;
    } catch {
      /* not in this folder */
    }
  }
  return null;
}

/** Read + parse all raw records for a session. Returns { file, records } or null. */
export async function readSessionRecords(sessionId, env = process.env) {
  const file = await findSessionFile(sessionId, env);
  if (!file) return null;
  const records = await parseFile(file);
  return { file, records: records || [] };
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
  const textBlocks = []; // every non-empty assistant text block, not just the last
  const toolUseCounts = {};
  let editCount = 0;
  const tokens = { in: 0, out: 0, cache: 0 };
  let sidechain = false;

  for (const r of records) {
    if (r.isSidechain) sidechain = true;
    if (r.type === 'user') {
      const t = userText(r)?.replace(/\s+/g, ' ').trim();
      // Skip bare acknowledgments ("yes", "resume", "continue") — they cost a
      // slot in the cap without adding signal, crowding out substantive asks.
      if (t && t.length >= 15 && prompts.length < 20) prompts.push(t.slice(0, 350));
    } else if (r.type === 'assistant') {
      for (const b of blocks(r.message)) {
        if (b.type === 'text' && b.text.trim()) textBlocks.push(b.text.trim());
        if (b.type === 'tool_use') {
          toolUseCounts[b.name] = (toolUseCounts[b.name] || 0) + 1;
          if (TOOL_FILE_WRITERS.has(b.name)) {
            editCount++;
            if (b.input?.file_path) filesTouched.add(b.input.file_path);
          }
          if (b.name === 'Bash' && b.input?.command && commands.length < 30) {
            const line = String(b.input.command).split('\n')[0].slice(0, 120);
            if (!NOISE_COMMAND_RE.test(line.trim())) commands.push(line);
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

  // The single last assistant message is often just a closer ("Pushed.") —
  // the substance is usually in whichever blocks said the most. Take the few
  // longest (by index, not content, so duplicate text can't double-count),
  // restore original order, join and cap.
  const topIndexes = textBlocks
    .map((t, i) => [i, t.length])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([i]) => i)
    .sort((a, b) => a - b);
  const outcome = topIndexes
    .map((i) => textBlocks[i])
    .join(' … ')
    .replace(/\s+/g, ' ')
    .slice(0, 600);

  const filePaths = [...filesTouched];
  const signals = [...new Set(SIGNAL_PATTERNS.filter((p) => filePaths.some((f) => p.re.test(f))).map((p) => p.id))];

  const firstPrompt = prompts[0] || '';
  const firstPromptLine = firstPrompt.split('\n')[0];
  let kind = 'interactive';
  if (firstPromptLine.trim() === AUTOMATED_SENTINEL || AGENT_HEADER.test(firstPromptLine)) kind = 'automated';
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
    filesTouched: filePaths,
    commands,
    outcome,
    toolUseCounts,
    editCount,
    signals,
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

// Human-readable "Xh Ym" (or "Ym" under an hour) for a millisecond duration.
export function formatDuration(ms) {
  if (!ms || ms < 0) return '0m';
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

/**
 * Build a full day record. Carries forward the day-level summary (and legacy
 * report) from any existing record so re-running Stage 1 never discards the
 * opt-in Stage 2 work.
 */
export async function buildDayRepack(date, { previous } = {}, env = process.env) {
  const sessions = await scanDay(date, env);
  const counts = sessions.reduce((acc, s) => ((acc[s.kind] = (acc[s.kind] || 0) + 1), acc), {});
  const tokens = sessions.reduce(
    (acc, s) => ({ in: acc.in + s.tokens.in, out: acc.out + s.tokens.out, cache: acc.cache + s.tokens.cache }),
    { in: 0, out: 0, cache: 0 },
  );

  // First/last chat and active duration are scoped to interactive sessions —
  // a scheduled automated job at 11pm shouldn't make the day look like it ran
  // until 11pm. "Active" sums each session's own (end - start), not the
  // wall-clock span between first and last, so idle gaps between sessions
  // don't count as active time.
  const real = sessions.filter((s) => s.kind === 'interactive');
  const starts = real.map((s) => s.start).filter(Boolean).sort();
  const ends = real.map((s) => s.end).filter(Boolean).sort();
  const firstChatAt = starts[0] || null;
  const lastChatAt = ends[ends.length - 1] || null;
  // Merge overlapping session intervals before summing — concurrent sessions
  // (e.g. two Claude Code windows open at once) would otherwise double-count
  // the overlapping time, inflating "active" past the day's actual span.
  const intervals = real
    .filter((s) => s.start && s.end)
    .map((s) => [new Date(s.start).getTime(), new Date(s.end).getTime()])
    .sort((a, b) => a[0] - b[0]);
  let activeMs = 0;
  let cur = null;
  for (const [start, end] of intervals) {
    if (!cur) { cur = [start, end]; continue; }
    if (start <= cur[1]) cur[1] = Math.max(cur[1], end); // overlaps/touches — extend
    else { activeMs += cur[1] - cur[0]; cur = [start, end]; }
  }
  if (cur) activeMs += cur[1] - cur[0];

  const day = { id: date, date, generatedAt: new Date().toISOString(), counts, tokens, firstChatAt, lastChatAt, activeMs, sessions };
  // Preserve a previously-generated day summary (new field, or legacy report).
  if (previous?.summary) {
    day.summary = previous.summary;
    day.summaryAt = previous.summaryAt;
    day.summaryMeta = previous.summaryMeta;
  } else if (previous?.report) {
    // Legacy: fold an old executive report forward as the day summary.
    day.summary = previous.report;
    day.summaryAt = previous.reportAt;
    day.summaryMeta = previous.reportMeta;
  }
  // Stage 2 fields the local-summary path never touches but which previously
  // weren't carried forward either — every re-repack (incl. the 23:55 cron and
  // "Repack all") was silently wiping the user's merge/submit work and
  // resetting already-exported days back to unexported. Carry them all
  // forward, matching the contract this function already claims elsewhere.
  if (previous?.mergedSummary) day.mergedSummary = previous.mergedSummary;
  if (previous?.submitted) {
    day.submitted = previous.submitted;
    day.submittedAt = previous.submittedAt;
  }
  if (previous?.exported) {
    day.exported = previous.exported;
    day.exportedAt = previous.exportedAt;
  }
  return day;
}
