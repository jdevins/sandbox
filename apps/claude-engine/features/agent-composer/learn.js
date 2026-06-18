import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { html } from '../../lib/html.js';
import { lessonStyles } from './lessons/kit.js';

// Agent Training: a curriculum of auto-discovered lessons. Depth is exposed
// progressively (Core → Deeper → Expert inside each lesson; foundational →
// advanced across the ladder) without locking the learner into one scenario.
// Drop a `<order>-<id>.lesson.js` file in lessons/ to add a rung.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LESSONS_DIR = path.join(__dirname, 'lessons');

// Mirrors the engine's feature discovery, scoped to lesson files. Imported with
// a cache-buster so edits show up without a process restart (dev --watch).
async function discoverLessons() {
  let dirents = [];
  try {
    dirents = await fs.readdir(LESSONS_DIR, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const d of dirents) {
    if (!d.isFile() || !d.name.endsWith('.lesson.js')) continue;
    const url = pathToFileURL(path.join(LESSONS_DIR, d.name)).href + `?v=${Date.now()}`;
    try {
      const mod = await import(url);
      if (typeof mod.body !== 'function') continue;
      out.push({ id: d.name.replace(/\.lesson\.js$/, ''), order: 999, ...mod.meta, body: mod.body });
    } catch (err) {
      out.push({ id: d.name.replace(/\.lesson\.js$/, ''), title: d.name, order: 999, broken: true, error: err.message });
    }
  }
  return out.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

const num = (n) => String(n ?? 0).padStart(2, '0');

export async function learnIndex(ctx) {
  const { ui, page, base } = ctx;
  const lessons = await discoverLessons();

  const cards = lessons.map((l) =>
    ui.card({
      title: html`<span class="ladder-num">${num(l.order)}</span>${l.title}`,
      badge: l.broken ? ui.badge('broken', 'errored') : ui.badge(l.difficulty || 'lesson'),
      desc: l.broken ? l.error : l.summary,
      meta: l.broken ? '' : html`depth: ${l.depth || 'core → deeper → expert'}`,
      actions: l.broken ? '' : ui.btn({ href: `${base}/learn/${l.id}`, label: 'Open', primary: true }),
    }),
  );

  const body = html`
    ${lessonStyles}
    ${ui.pageHead({
      title: '🎓 Agent Training',
      subtitle: 'A ladder of lessons. Each unfolds Core → Deeper → Expert; open them in any order.',
      actions: ui.btn({ href: base, label: 'Library' }),
    })}
    <div class="card" style="margin-bottom:14px">
      <p class="dim" style="margin:0">Progression is <strong>soft</strong> — rungs are ordered by depth but all open.
      Each lesson reveals detail in layers and draws on whichever live agent (Groomer, Builder, Foundry crew)
      fits the point — no single scenario.</p>
    </div>
    ${lessons.length ? ui.grid(cards) : ui.empty('No lessons found.')}`;

  return page({ title: 'Agent Training', active: 'agent-composer', breadcrumb: [{ href: base, label: 'Agents' }, { href: '#', label: 'Learn' }], body });
}

export async function lessonPage(ctx, id) {
  const { ui, page, base } = ctx;
  const lessons = await discoverLessons();
  const idx = lessons.findIndex((l) => l.id === id);

  if (idx < 0) {
    return page({
      title: 'Lesson not found',
      active: 'agent-composer',
      breadcrumb: [{ href: base, label: 'Agents' }, { href: `${base}/learn`, label: 'Learn' }],
      body: ui.empty(`No lesson "${id}". `) + ui.btn({ href: `${base}/learn`, label: 'All lessons' }),
    });
  }

  const l = lessons[idx];
  const prev = lessons[idx - 1];
  const next = lessons[idx + 1];

  const body = html`
    ${lessonStyles}
    ${ui.pageHead({
      title: html`<span class="ladder-num">${num(l.order)}</span>${l.title}`,
      subtitle: l.summary,
      actions: ui.btn({ href: `${base}/learn`, label: 'All lessons' }),
    })}
    ${l.broken ? ui.empty(l.error) : l.body(ctx)}
    <div class="row spread" style="margin-top:20px">
      ${prev ? ui.btn({ href: `${base}/learn/${prev.id}`, label: `← ${prev.title}` }) : html`<span></span>`}
      ${next ? ui.btn({ href: `${base}/learn/${next.id}`, label: `${next.title} →`, primary: true }) : html`<span></span>`}
    </div>`;

  return page({
    title: l.title,
    active: 'agent-composer',
    breadcrumb: [{ href: base, label: 'Agents' }, { href: `${base}/learn`, label: 'Learn' }, { href: '#', label: l.title }],
    body,
  });
}
