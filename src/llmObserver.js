/**
 * Shared observability seam for every Claude call in the sandbox — the
 * scheduler's cron jobs, claude-engine's provider, storyboard's board chat,
 * and any future app. One function (`runClaude`) spawns the CLI in
 * stream-json mode so tool calls and token usage are visible turn-by-turn,
 * not just as a final blob of text.
 *
 * Every event is mirrored two ways:
 *   - onto an in-process EventEmitter bus, for the observability dashboard's
 *     live SSE tail (always on — cost is a few listeners, not a mode to toggle)
 *   - appended to data/runs/YYYY-MM-DD.jsonl, for history after the fact
 *     (gitignored: machine-local operational log, not repo state)
 *
 * Text deltas are bus-only (not persisted) to keep the JSONL small — history
 * gets the final aggregated text at run_end; only a live tail sees the stream.
 */

import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { appendFile, mkdir, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { ROOT } from './app.js';

const RUNS_DIR = path.join(ROOT, 'data', 'runs');
const TEXT_LIMIT = 8000; // persisted final-text cap, keeps the daily log bounded
const INPUT_LIMIT = 2000;

const bus = new EventEmitter();
bus.setMaxListeners(100);

const active = new Map(); // runId -> live run snapshot, for the dashboard's "running now" list

function dayFile(iso) {
  return path.join(RUNS_DIR, `${iso.slice(0, 10)}.jsonl`);
}

async function persist(event) {
  try {
    await mkdir(RUNS_DIR, { recursive: true });
    await appendFile(dayFile(event.ts), JSON.stringify(event) + '\n', 'utf8');
  } catch (e) {
    console.warn(`[llmObserver] persist failed: ${e.message}`);
  }
}

function emit(event, { persistToDisk = true } = {}) {
  bus.emit('event', event);
  if (event.type === 'run_start') {
    active.set(event.runId, { ...event, textLen: 0, toolCalls: 0 });
  } else if (event.type === 'tool_call') {
    const r = active.get(event.runId);
    if (r) r.toolCalls += 1;
  } else if (event.type === 'text') {
    const r = active.get(event.runId);
    if (r) r.textLen += event.delta.length;
  } else if (event.type === 'run_end') {
    active.delete(event.runId);
  }
  if (persistToDisk) persist(event);
}

/** Subscribe to the live event bus. Returns an unsubscribe function. */
export function subscribe(cb) {
  bus.on('event', cb);
  return () => bus.off('event', cb);
}

/** Runs currently in flight (for the dashboard's "running now" panel). */
export function getActiveRuns() {
  return [...active.values()];
}

/** Available YYYY-MM-DD log dates, newest first. */
export async function listLogDates() {
  try {
    const files = await readdir(RUNS_DIR);
    return files.filter((f) => f.endsWith('.jsonl')).map((f) => f.slice(0, -6)).sort().reverse();
  } catch {
    return [];
  }
}

/** Reconstructs runs (grouped by runId) from one day's JSONL. */
export async function getRunsForDate(dateStr) {
  let raw;
  try {
    raw = await readFile(path.join(RUNS_DIR, `${dateStr}.jsonl`), 'utf8');
  } catch {
    return [];
  }
  const byRun = new Map();
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    let e;
    try { e = JSON.parse(line); } catch { continue; }
    const r = byRun.get(e.runId) || {
      runId: e.runId, app: e.app, feature: e.feature, agent: e.agent, model: e.model,
      status: 'running', toolCalls: [], events: 0,
    };
    r.events += 1;
    if (e.type === 'run_start') Object.assign(r, { startedAt: e.ts, prompt: e.prompt });
    if (e.type === 'tool_call') r.toolCalls.push({ ts: e.ts, tool: e.tool, input: e.input });
    if (e.type === 'run_end') Object.assign(r, {
      finishedAt: e.ts, status: e.status, usage: e.usage, costUsd: e.costUsd, text: e.text, ms: e.ms,
    });
    byRun.set(e.runId, r);
  }
  return [...byRun.values()].sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || ''));
}

// A headless `claude -p` can exit 0 while having silently given up on a
// gated tool call — sniff the final text for that signature so it surfaces
// as 'blocked' rather than masquerading as a clean 'ok'.
const PERMISSION_BLOCK = /(needs?|requires?).{0,30}(approval|permission)|permission prompt|approve the tool|I'?m blocked/i;
const looksBlocked = (text) => typeof text === 'string' && PERMISSION_BLOCK.test(text);

const truncate = (s, n) => (s && s.length > n ? s.slice(0, n) + '…' : s || '');
const safeJson = (v, n) => { try { return truncate(JSON.stringify(v), n); } catch { return ''; } };

/**
 * The single seam every sandbox app/feature routes its Claude calls through.
 * app/feature/agent identify who's asking (dashboard groups by app → feature
 * → agent); everything else is passed straight to the CLI.
 */
export function runClaude({
  app, feature = null, agent = null, prompt, system, model,
  allowedTools = [], cwd = ROOT, timeoutMs = 10 * 60 * 1000,
}) {
  const runId = randomUUID();
  const startedAt = new Date().toISOString();
  const tags = { runId, app, feature, agent, model: model || null };

  emit({ ...tags, ts: startedAt, type: 'run_start', prompt: truncate(prompt, INPUT_LIMIT), allowedTools });

  const args = ['-p', '--output-format', 'stream-json', '--verbose'];
  if (model) args.push('--model', model);
  if (system) args.push('--system-prompt', system);
  if (allowedTools.length) args.push('--allowedTools', allowedTools.join(','));

  return new Promise((resolve) => {
    const child = spawn('claude', args, { cwd, shell: false });
    let stdoutBuf = '';
    let stderrOut = '';
    let finalText = '';
    let usage = null;
    let costUsd = null;
    let settled = false;

    const timer = setTimeout(() => {
      child.kill();
      finish({ status: 'error', text: 'timeout' });
    }, timeoutMs);

    function finish(fields) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const finishedAt = new Date().toISOString();
      const ms = new Date(finishedAt) - new Date(startedAt);
      const text = fields.text ?? finalText;
      const status = fields.status || (looksBlocked(text) ? 'blocked' : 'ok');
      emit({
        ...tags, ts: finishedAt, type: 'run_end', status,
        text: truncate(text, TEXT_LIMIT), usage: fields.usage ?? usage, costUsd: fields.costUsd ?? costUsd, ms,
      });
      resolve({ runId, status, text, usage: fields.usage ?? usage, costUsd: fields.costUsd ?? costUsd, model: model || null });
    }

    child.on('error', (err) => finish({ status: 'error', text: `Failed to launch claude: ${err.message}` }));

    child.stdout.on('data', (d) => {
      stdoutBuf += d.toString();
      let idx;
      while ((idx = stdoutBuf.indexOf('\n')) !== -1) {
        const line = stdoutBuf.slice(0, idx);
        stdoutBuf = stdoutBuf.slice(idx + 1);
        if (line.trim()) handleEvent(line);
      }
    });
    child.stderr.on('data', (d) => { stderrOut += d.toString(); });

    function handleEvent(line) {
      let evt;
      try { evt = JSON.parse(line); } catch { return; }

      if (evt.type === 'assistant') {
        for (const block of evt.message?.content || []) {
          if (block.type === 'text' && block.text) {
            finalText += block.text;
            emit({ ...tags, ts: new Date().toISOString(), type: 'text', delta: block.text }, { persistToDisk: false });
          } else if (block.type === 'tool_use') {
            emit({ ...tags, ts: new Date().toISOString(), type: 'tool_call', tool: block.name, input: safeJson(block.input, 300) });
          }
        }
      } else if (evt.type === 'user') {
        for (const block of evt.message?.content || []) {
          if (block.type === 'tool_result') {
            const ok = !evt.tool_use_result || evt.tool_use_result.success !== false;
            emit({ ...tags, ts: new Date().toISOString(), type: 'tool_result', ok, summary: safeJson(block.content, 300) });
          }
        }
      } else if (evt.type === 'result') {
        usage = evt.usage || null;
        costUsd = evt.total_cost_usd ?? null;
        if (typeof evt.result === 'string') finalText = evt.result;
        finish({ status: evt.is_error ? 'error' : undefined, text: finalText });
      }
    }

    child.on('close', (code) => {
      // finish() no-ops if the 'result' event already settled this run.
      finish({ status: code === 0 ? undefined : 'error', text: finalText || stderrOut || '(no output)' });
    });

    child.stdin.write(prompt || '');
    child.stdin.end();
  });
}
