/**
 * PostToolUse hook (Edit|Write|MultiEdit) — surfaces standards DURING code
 * generation, not at commit time. The git pre-commit hook (check-version.js,
 * check-smart-quotes.js) only catches problems after the work is already
 * staged; by then the generating turn is over. This runs mid-session, right
 * after each edit, so violations can be fixed in the same turn.
 *
 * Deliberately informational (always exits 0): a regex can verify the
 * smart-quote rule, but most active standards are architectural judgment
 * calls no script can verify — those are surfaced as a reminder, not a gate.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { byCategory } from '../standards/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const USAGE_LOG = path.join(ROOT, 'apps', 'claude-engine', 'data', 'usage.jsonl');

const SMART = '[“”‘’]';
const ATTR_DELIM = new RegExp('=' + SMART);

// Which standards categories matter for which part of the tree.
const CATEGORY_BY_PREFIX = [
  [path.join(ROOT, 'apps'), ['ui', 'code', 'architecture']],
  [path.join(ROOT, 'src'), ['code', 'architecture']],
  [path.join(ROOT, 'test'), ['process']],
];

function categoriesFor(file) {
  for (const [prefix, categories] of CATEGORY_BY_PREFIX) {
    if (file.startsWith(prefix + path.sep)) return categories;
  }
  return null;
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

async function appendUsage(event) {
  await fs.promises.mkdir(path.dirname(USAGE_LOG), { recursive: true });
  await fs.promises.appendFile(USAGE_LOG, JSON.stringify({ ts: new Date().toISOString(), ...event }) + '\n', 'utf8');
}

async function main() {
  let input;
  try {
    input = JSON.parse(await readStdin());
  } catch {
    return; // no/invalid stdin — nothing to check
  }

  const file = input?.tool_input?.file_path;
  if (!file) return;

  const categories = categoriesFor(path.resolve(file));
  if (!categories) return; // outside apps/src/test — not in scope

  let content = '';
  try {
    content = await fs.promises.readFile(file, 'utf8');
  } catch {
    return; // file gone or unreadable — nothing to check
  }

  const violations = [];
  content.split('\n').forEach((line, i) => {
    if (ATTR_DELIM.test(line)) {
      const msg = `${file}:${i + 1} — smart quote used as an HTML attribute delimiter`;
      violations.push(msg);
      process.stderr.write(
        `[standards] ERROR (ui-no-smart-quote-attrs): ${msg}. Use a straight " or ' there. (Smart quotes in display text are fine.)\n`,
      );
      process.stderr.write(`    ${line.trim()}\n`);
    }
  });

  // Reminder of the active error-level rules for the touched area — consulted
  // now, while generating, instead of only at commit or when someone
  // remembers to run the check-standards skill.
  const relevant = categories.flatMap((c) => byCategory[c] || []).filter((r) => r.status === 'active' && r.level === 'error');
  if (relevant.length) {
    process.stdout.write(`[standards] active rules for ${path.relative(ROOT, file)} (${categories.join(', ')}):\n`);
    for (const r of relevant) process.stdout.write(`  - ${r.id}: ${r.description}\n`);
  }

  await appendUsage({
    kind: 'standards-check',
    file: path.relative(ROOT, file).replace(/\\/g, '/'),
    errors: violations,
    ok: violations.length === 0,
  });
}

main().catch(() => {}); // never block the edit — informational only
