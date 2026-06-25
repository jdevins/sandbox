import cron from 'node-cron';
import { spawn } from 'node:child_process';
import { readFile, writeFile, readFileSync, writeFileSync, existsSync, watch } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { ROOT } from './app.js';

const SCHEDULES_FILE = path.join(ROOT, 'data', 'schedules.json');
const LOG_FILE = path.join(ROOT, 'data', 'scheduler-log.json');

const tasks = new Map(); // id → { task, job }
let log = {};

const HISTORY_LIMIT = 50; // per job; oldest entries trimmed

// ── Out-of-band guard ───────────────────────────────────────────────────────
// The scheduler UI is the only sanctioned editor of schedules.json. We keep the
// canonical schedule in memory plus a hash of the exact bytes we last wrote; any
// on-disk change whose hash differs (a direct edit, or a scheduled `claude -p`
// run touching its own config) is reverted and logged as drift.
const sha = (s) => createHash('sha256').update(s).digest('hex');
let canonical = [];          // last schedules the scheduler itself wrote/loaded
let lastWrittenHash = sha('[]');
const driftEvents = [];      // external edits we detected + reverted (newest first)
const DRIFT_LIMIT = 20;
let watcher = null;

function readSchedules() {
  try {
    return JSON.parse(readFileSync(SCHEDULES_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function saveSchedules(jobs) {
  const serialized = JSON.stringify(jobs, null, 2);
  writeFileSync(SCHEDULES_FILE, serialized);
  canonical = jobs;
  lastWrittenHash = sha(serialized);
}

// Adopt whatever is on disk as the trusted baseline, then watch for edits.
function initIntegrity() {
  try {
    const raw = readFileSync(SCHEDULES_FILE, 'utf8');
    canonical = JSON.parse(raw);
    lastWrittenHash = sha(raw);
  } catch {
    canonical = [];
    lastWrittenHash = sha('[]');
  }
  if (watcher) return;
  try {
    let debounce = null;
    watcher = watch(SCHEDULES_FILE, () => {
      clearTimeout(debounce);
      debounce = setTimeout(checkDrift, 120);
    });
  } catch (e) {
    console.warn(`[scheduler] Could not watch schedules.json: ${e.message}`);
  }
}

function checkDrift() {
  let raw;
  try { raw = readFileSync(SCHEDULES_FILE, 'utf8'); } catch { return; }
  if (sha(raw) === lastWrittenHash) return; // our own write, or unchanged

  // External, out-of-band edit → revert to the canonical (UI-sourced) copy.
  const detail = summarizeDrift(raw);
  const serialized = JSON.stringify(canonical, null, 2);
  writeFileSync(SCHEDULES_FILE, serialized);
  lastWrittenHash = sha(serialized);
  driftEvents.unshift({ at: new Date().toISOString(), detail });
  driftEvents.length = Math.min(driftEvents.length, DRIFT_LIMIT);
  console.warn(`[scheduler] Reverted out-of-band edit to schedules.json — ${detail}`);
}

// Short, human-readable description of what the external edit tried to change.
function summarizeDrift(raw) {
  let ext;
  try { ext = JSON.parse(raw); } catch { return 'invalid JSON — rejected'; }
  if (!Array.isArray(ext)) return 'not an array — rejected';
  const byId = (arr) => new Map(arr.map((j) => [j.id, j]));
  const a = byId(canonical), b = byId(ext);
  const added = [...b.keys()].filter((k) => !a.has(k));
  const removed = [...a.keys()].filter((k) => !b.has(k));
  const changed = [...a.keys()].filter((k) => b.has(k) && JSON.stringify(a.get(k)) !== JSON.stringify(b.get(k)));
  const parts = [];
  if (added.length) parts.push(`added ${added.join(', ')}`);
  if (removed.length) parts.push(`removed ${removed.join(', ')}`);
  if (changed.length) parts.push(`changed ${changed.join(', ')}`);
  return parts.join('; ') || 'reordered / whitespace only';
}

function loadLog() {
  try {
    log = JSON.parse(readFileSync(LOG_FILE, 'utf8'));
  } catch {
    log = {};
  }
}

function saveLog() {
  writeFile(LOG_FILE, JSON.stringify(log, null, 2), () => {});
}

function runPrompt(job, context) {
  const promptPath = path.join(ROOT, job.prompt);
  if (!existsSync(promptPath)) {
    writeRun(job.id, { status: 'error', output: `Prompt file not found: ${job.prompt}` });
    return;
  }

  let promptText;
  try {
    promptText = readFileSync(promptPath, 'utf8');
  } catch (e) {
    writeRun(job.id, { status: 'error', output: `Could not read prompt: ${e.message}` });
    return;
  }

  // Manual "pickup" runs (triggered from a single backlog item) append a scope
  // note rather than editing the prompt file, so the agent narrows to one item
  // without the schedule's prompt changing for its normal scheduled runs.
  if (context && context.itemId) {
    promptText += `\n\n---\n**Scoped run (manual pickup):** focus only on backlog item ` +
      `\`${context.itemId}\`${context.itemTitle ? ` — "${context.itemTitle}"` : ''}. Ignore all other items.\n`;
  }

  writeRun(job.id, { status: 'running', output: null, startedAt: new Date().toISOString() });

  // claude -p reads the prompt from stdin; piping it in avoids arg-quoting issues.
  // Scheduled runs are headless — no one can approve a permission prompt — so we
  // pre-allow the curl calls our local prompts use (e.g. the groomer's backlog API).
  // Scope it tightly: only curl, nothing else stays gated-then-stalled.
  const child = spawn('claude', ['-p', '--allowedTools', 'Bash(curl:*)'], { cwd: ROOT, shell: true });
  let output = '';
  let error = '';

  child.on('error', (err) => {
    writeRun(job.id, {
      status: 'error',
      output: `Failed to launch claude: ${err.message}`,
      finishedAt: new Date().toISOString(),
    });
  });

  child.stdout.on('data', (d) => (output += d.toString()));
  child.stderr.on('data', (d) => (error += d.toString()));

  child.on('close', (code) => {
    const out = output || error || '(no output)';
    const blocked = code === 0 && looksPermissionBlocked(out);
    writeRun(job.id, {
      status: code === 0 && !blocked ? 'ok' : 'error',
      output: blocked
        ? `⚠ Run blocked on a tool permission prompt — the agent could not get approval headlessly. ` +
          `Add the needed tool to --allowedTools in src/scheduler.js.\n\n${out}`
        : out,
      finishedAt: new Date().toISOString(),
    });
  });

  child.stdin.write(promptText);
  child.stdin.end();
}

// A headless `claude -p` exits 0 even when it gave up because a tool needed
// approval — so a permission block masquerades as a successful run. Sniff the
// output for that signature and treat it as an error instead of silent "ok".
const PERMISSION_BLOCK = /(needs?|requires?).{0,30}(approval|permission)|permission prompt|approve the tool|I'?m blocked/i;
function looksPermissionBlocked(output) {
  return typeof output === 'string' && PERMISSION_BLOCK.test(output);
}

function writeRun(id, fields) {
  const prev = log[id] || {};
  const next = { ...prev, ...fields, lastRun: new Date().toISOString() };

  // Append one minimal history line per completed run (terminal status only,
  // never the intermediate "running" write).
  if (fields.status && fields.status !== 'running') {
    const finishedAt = fields.finishedAt || next.lastRun;
    // ms only when this same run recorded a start (finishedAt present here);
    // early errors (e.g. missing prompt) have no start, so duration is null.
    const ms = fields.finishedAt && next.startedAt
      ? new Date(finishedAt) - new Date(next.startedAt)
      : null;
    const summary = (fields.output || next.output || '').trim().replace(/\s+/g, ' ').slice(0, 80);
    const history = Array.isArray(prev.history) ? prev.history.slice() : [];
    history.push({ ts: finishedAt, status: fields.status, ms, summary });
    next.history = history.slice(-HISTORY_LIMIT);
  }

  log[id] = next;
  saveLog();
}

export function startScheduler() {
  loadLog();
  initIntegrity();
  const jobs = readSchedules();

  for (const job of jobs) {
    if (!job.enabled) continue;
    if (!cron.validate(job.cron)) {
      console.warn(`[scheduler] Invalid cron for job "${job.id}": ${job.cron}`);
      continue;
    }
    const task = cron.schedule(job.cron, () => runPrompt(job));
    tasks.set(job.id, { task, job });
    console.log(`[scheduler] Registered "${job.id}" → ${job.cron}`);
  }
}

export function triggerNow(id, context) {
  const schedules = readSchedules();
  const job = schedules.find((j) => j.id === id);
  if (!job) return { ok: false, error: 'Job not found' };
  runPrompt(job, context);
  return { ok: true };
}

export function getLog() {
  loadLog();
  return log;
}

export function getSchedules() {
  return readSchedules();
}

export function getDrift() {
  return driftEvents;
}

export function updateJob(id, fields) {
  const jobs = readSchedules();
  const idx = jobs.findIndex((j) => j.id === id);
  if (idx === -1) return { ok: false, error: 'Job not found' };
  jobs[idx] = { ...jobs[idx], ...fields };
  saveSchedules(jobs);
  // re-register cron if schedule changed
  if (tasks.has(id)) {
    tasks.get(id).task.stop();
    tasks.delete(id);
  }
  const job = jobs[idx];
  if (job.enabled && cron.validate(job.cron)) {
    const task = cron.schedule(job.cron, () => runPrompt(job));
    tasks.set(id, { task, job });
  }
  return { ok: true, job: jobs[idx] };
}

export function addJob(fields) {
  const jobs = readSchedules();
  const id = fields.id || `job-${Date.now().toString(36)}`;
  if (jobs.find((j) => j.id === id)) return { ok: false, error: 'ID already exists' };
  const job = { id, name: '', cron: '0 * * * *', prompt: `prompts/${id}.md`, enabled: false, description: '', ...fields };
  jobs.push(job);
  saveSchedules(jobs);
  return { ok: true, job };
}

export function deleteJob(id) {
  const jobs = readSchedules();
  const filtered = jobs.filter((j) => j.id !== id);
  if (filtered.length === jobs.length) return { ok: false, error: 'Job not found' };
  saveSchedules(filtered);
  if (tasks.has(id)) {
    tasks.get(id).task.stop();
    tasks.delete(id);
  }
  return { ok: true };
}

export function readPrompt(promptPath) {
  const full = path.join(ROOT, promptPath);
  try { return { ok: true, content: readFileSync(full, 'utf8') }; } catch { return { ok: false, content: '' }; }
}

export function writePrompt(promptPath, content) {
  const full = path.join(ROOT, promptPath);
  try { writeFileSync(full, content); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; }
}
