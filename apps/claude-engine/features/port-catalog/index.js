import express from 'express';
import path from 'node:path';
import { html } from '../../lib/html.js';
import { jsonStore, slug } from '../../lib/store.js';
import { seeds } from './seeds.js';

export const meta = {
  name: 'Port Catalog',
  description:
    'Catalog of portable deliveries — standalone prompts that rebuild capabilities on another machine. Stored verbatim, regenerated on demand.',
  icon: '📦',
};

const STATUS_BADGE = { ready: 'ok', planned: 'warn', draft: '' };
const STATUS_OPTS = ['ready', 'planned', 'draft'];

export async function createFeature(ctx) {
  const { ui, page, base, paths } = ctx;
  const store = jsonStore({ dir: path.join(paths.data, 'port-catalog') });
  const router = express.Router();

  // Seed the canonical deliveries once, on an empty store.
  const existing = await store.list();
  if (existing.length === 0) {
    for (const s of seeds) await store.save({ ...s, updatedAt: new Date().toISOString() });
  }

  const crumb = [{ href: base, label: 'Port Catalog' }];
  const shell = (title, body, breadcrumb = crumb) =>
    page({ title, active: 'port-catalog', breadcrumb, body });

  const depsList = (v) =>
    Array.isArray(v) ? v : String(v || '').split(',').map((s) => s.trim()).filter(Boolean);

  // ── Library ────────────────────────────────────────────────────────────────
  router.get('/', async (req, res) => {
    const entries = await store.list();
    const byId = new Map(entries.map((e) => [e.id, e]));
    const cards = entries.map((e) => {
      const deps = depsList(e.dependsOn);
      const unmet = deps.filter((d) => byId.get(d)?.status !== 'ready');
      return ui.card({
        title: e.title || e.id,
        badge: ui.badge(e.status || 'draft', STATUS_BADGE[e.status] ?? ''),
        desc: e.notes || '',
        meta: html`<code>${e.id}</code>${deps.length
          ? html` · needs ${deps.map((d) => ui.badge(d, byId.get(d)?.status === 'ready' ? 'ok' : 'warn'))}`
          : ' · no dependencies'}${unmet.length ? html` <span class="dim">(${unmet.length} unmet)</span>` : ''}`,
        actions: [
          ui.btn({ href: `${base}/${e.id}`, label: 'Open', primary: true }),
          ui.btn({ href: `${base}/${e.id}/edit`, label: 'Edit' }),
        ],
      });
    });
    const body = html`
      ${ui.pageHead({
        title: '📦 Port Catalog',
        subtitle: 'Portable deliveries — standalone prompts to rebuild capabilities elsewhere. Stored verbatim; regenerate on demand.',
        actions: ui.btn({ href: `${base}/new`, label: '+ New delivery', primary: true }),
      })}
      ${entries.length ? ui.grid(cards) : ui.empty('No deliveries yet — add one.')}`;
    res.send(shell('Port Catalog', body));
  });

  // ── New / Edit form ──────────────────────────────────────────────────────
  router.get('/new', (req, res) => {
    res.send(shell('New delivery', formView(base, ui, {}, 'New delivery')));
  });

  router.get('/:id/edit', async (req, res) => {
    let entry;
    try {
      entry = await store.get(req.params.id);
    } catch {
      return res.send(shell('Missing', ui.empty(`No delivery "${req.params.id}".`)));
    }
    res.send(
      shell(`Edit · ${entry.title}`, formView(base, ui, entry, `Edit · ${entry.title}`), [
        ...crumb,
        { href: `${base}/${entry.id}`, label: entry.id },
        { href: '#', label: 'edit' },
      ]),
    );
  });

  router.post('/save', async (req, res) => {
    const b = req.body || {};
    const title = (b.title || '').trim();
    if (!title) return res.send(shell('Error', ui.empty('Title is required.')));
    const id = (b.id || '').trim() || slug(title);

    // Preserve createdAt on edit.
    let createdAt;
    try {
      createdAt = (await store.get(id)).createdAt;
    } catch {
      /* new entry */
    }

    await store.save({
      id,
      title,
      dependsOn: depsList(b.dependsOn),
      status: STATUS_OPTS.includes(b.status) ? b.status : 'draft',
      notes: b.notes || '',
      prompt: b.prompt || '',
      ...(createdAt ? { createdAt } : {}),
      updatedAt: new Date().toISOString(),
    });
    res.redirect(`${base}/${id}`);
  });

  // ── Raw prompt (the regeneration pipe) ─────────────────────────────────────
  // text/plain so you can `curl .../prompt.txt | claude -p` on the target machine.
  router.get('/:id/prompt.txt', async (req, res) => {
    let entry;
    try {
      entry = await store.get(req.params.id);
    } catch {
      return res.status(404).type('text/plain').send(`No delivery "${req.params.id}".`);
    }
    res.type('text/plain').send(entry.prompt || '');
  });

  router.post('/:id/delete', async (req, res) => {
    await store.remove(req.params.id);
    res.redirect(base);
  });

  // ── Detail ─────────────────────────────────────────────────────────────────
  router.get('/:id', async (req, res) => {
    let entry;
    try {
      entry = await store.get(req.params.id);
    } catch {
      return res.send(shell('Missing', ui.empty(`No delivery "${req.params.id}".`)));
    }
    const deps = depsList(entry.dependsOn);
    const rawUrl = `${base}/${entry.id}/prompt.txt`;
    const pipe = `curl -s "<server>${rawUrl}" | claude -p`;

    const body = html`
      ${ui.pageHead({
        title: html`📦 ${entry.title}`,
        subtitle: html`<code>${entry.id}</code> · ${ui.badge(entry.status || 'draft', STATUS_BADGE[entry.status] ?? '')}${
          deps.length ? html` · needs ${deps.map((d) => html`<code>${d}</code> `)}` : ''
        }${entry.updatedAt ? html` · updated ${entry.updatedAt.slice(0, 16).replace('T', ' ')}` : ''}`,
        actions: html`${ui.btn({ href: `${base}/${entry.id}/edit`, label: 'Edit' })}${ui.btn({
          action: 'delete',
          name: `${base}/${entry.id}/delete`,
          label: 'Delete',
          danger: true,
        })}${ui.btn({ href: base, label: '← Catalog' })}`,
      })}
      ${entry.notes ? html`<div class="card"><div class="desc">${entry.notes}</div></div>` : ''}

      <div class="card">
        <div class="row spread">
          <h2>Regenerate</h2>
          <button class="btn primary" onclick="navigator.clipboard.writeText(document.getElementById('promptText').textContent);this.textContent='✓ Copied'">📋 Copy prompt</button>
        </div>
        <div class="meta">Paste into a fresh Claude Code session on the target machine, or pipe the raw prompt:</div>
        <pre class="eng-source" style="white-space:pre-wrap"><code>${pipe}</code></pre>
        <div class="meta"><a href="${rawUrl}">Raw prompt (text/plain) ↗</a></div>
        <pre class="eng-source" id="promptText" style="white-space:pre-wrap;margin-top:10px">${entry.prompt || '(no prompt stored yet)'}</pre>
      </div>`;
    res.send(shell(entry.title, body, [...crumb, { href: `${base}/${entry.id}`, label: entry.id }]));
  });

  return router;
}

function formView(base, ui, entry, title) {
  const deps = Array.isArray(entry.dependsOn) ? entry.dependsOn.join(', ') : entry.dependsOn || '';
  return html`
    ${ui.pageHead({ title, actions: ui.btn({ href: base, label: '← Catalog' }) })}
    ${ui.configForm({
      action: `${base}/save`,
      submit: entry.id ? 'Save changes' : 'Create delivery',
      extra: entry.id ? html`<input type="hidden" name="id" value="${entry.id}"/>` : '',
      fields: [
        { name: 'title', label: 'Title', type: 'string', required: true, value: entry.title || '', placeholder: 'Short delivery name' },
        { name: 'dependsOn', label: 'Depends on', type: 'string', value: deps, placeholder: 'comma-separated delivery ids', help: 'Other deliveries that must be in place first (e.g. claude-client).' },
        { name: 'status', label: 'Status', type: 'select', value: entry.status || 'draft', options: STATUS_OPTS, help: 'ready = prompt is final · planned = placeholder · draft = in progress' },
        { name: 'notes', label: 'Notes', type: 'text', rows: 3, value: entry.notes || '', placeholder: 'What this delivers and why' },
        { name: 'prompt', label: 'Prompt (stored verbatim)', type: 'code', rows: 22, value: entry.prompt || '', placeholder: 'The full standalone prompt to run on the target machine…' },
      ],
    })}`;
}
