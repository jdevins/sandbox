import express from 'express';
import { html } from '../../lib/html.js';
import { jsonStore } from '../../lib/store.js';
import { createZip } from './lib/zip.js';
import { snapshot, diff, undo } from './lib/snapshot.js';

export const meta = {
  name: 'Skills Registry',
  description: 'Export, run, and test-with-undo any skill — a generic wrapper, not part of the skills themselves.',
  icon: '📦',
};

export function createFeature(ctx) {
  const { ui, page, stores, provider, base, usage, paths } = ctx;
  const store = stores.skills;
  const runs = jsonStore({ dir: `${paths.data}/registry-runs` });
  const router = express.Router();

  const crumb = [{ href: base, label: 'Registry' }];
  const shell = (title, body, breadcrumb = crumb) =>
    page({ title, active: 'skills-registry', breadcrumb, body });
  const panel = (title, inner) => html`<div class="eng-panel"><h3>${title}</h3>${inner}</div>`;

  router.get('/', async (req, res) => {
    const skills = await store.list();
    const cards = skills.map((s) =>
      ui.card({
        title: s.name || s.id,
        badge: html`${ui.badge(s.owner)}${s.broken ? ui.badge('broken', 'errored') : ''}`,
        desc: s.description,
        actions: [
          ui.btn({ href: `${base}/${s.owner}/${s.id}/run`, label: 'Run', primary: true }),
          ui.btn({ href: `${base}/${s.owner}/${s.id}/test`, label: 'Test (undoable)' }),
          ui.btn({ href: `${base}/${s.owner}/${s.id}/export`, label: 'Export ⤓' }),
        ],
      }),
    );
    const body = html`
      ${ui.pageHead({
        title: '📦 Skills Registry',
        subtitle: 'Export skills as portable files, fire them for real, or test them with a safety net.',
      })}
      ${skills.length ? ui.grid(cards) : ui.empty('No skills yet.')}`;
    res.send(shell('Skills Registry', body));
  });

  // ---- Export: zip the skill's source file as-is, no transformation ----
  router.get('/:owner/:id/export', async (req, res) => {
    const { owner, id } = req.params;
    try {
      const source = await store.source(owner, id);
      const zip = createZip([{ name: `${id}.skill.js`, content: Buffer.from(source, 'utf8') }]);
      res.set('Content-Type', 'application/zip');
      res.set('Content-Disposition', `attachment; filename="${id}.zip"`);
      res.send(zip);
    } catch (err) {
      res.status(404).send(`Could not export "${owner}/${id}": ${err.message}`);
    }
  });

  // ---- Run: fires the skill for real, no safety net ----
  router.get('/:owner/:id/run', (req, res) => runView(req, res));
  router.post('/:owner/:id/run', (req, res) => runView(req, res, { fire: true }));

  async function runView(req, res, opts = {}) {
    const { owner, id } = req.params;
    let def, mod;
    try {
      ({ definition: def, module: mod } = await store.get(owner, id));
    } catch (err) {
      return res.send(shell('Missing', ui.empty(`Could not load "${owner}/${id}": ${err.message}`)));
    }

    let resultPanel = '';
    if (opts.fire) {
      const input = coerce(def.inputs, req.body);
      try {
        const out = await usage.track('skill', { id, owner })(() => mod.run(input, { provider }));
        resultPanel = panel('Run result', html`<pre>${JSON.stringify(out, null, 2)}</pre>`);
      } catch (err) {
        resultPanel = panel('Run error', html`<pre class="bad">${err.stack || err.message}</pre>`);
      }
    }

    const form = ui.configForm({
      action: `${base}/${owner}/${id}/run`,
      submit: '▶ Run for real',
      fields: (def.inputs || []).map((f) => ({ ...f, label: f.label || f.name })),
    });

    const body = html`
      ${ui.pageHead({ title: `Run — ${def.name || id}`, subtitle: def.description, actions: ui.btn({ href: base, label: 'Registry' }) })}
      ${resultPanel}
      ${form}`;
    res.send(shell(def.name || id, body, [...crumb, { href: '#', label: def.name || id }]));
  }

  // ---- Test: fires for real, but snapshots the watch dir first so it can be undone ----
  router.get('/:owner/:id/test', (req, res) => testView(req, res));
  router.post('/:owner/:id/test', (req, res) => testView(req, res, { fire: true }));
  router.post('/:owner/:id/undo/:runId', async (req, res) => {
    const { owner, id, runId } = req.params;
    const record = await runs.get(runId).catch(() => null);
    if (!record || record.undone) return res.redirect(`${base}/${owner}/${id}/test`);
    const result = await undo(record.watchDir, record.manifest);
    await runs.save({ ...record, undone: true, undoResult: result });
    res.redirect(`${base}/${owner}/${id}/test?undone=${runId}`);
  });

  async function testView(req, res, opts = {}) {
    const { owner, id } = req.params;
    let def, mod;
    try {
      ({ definition: def, module: mod } = await store.get(owner, id));
    } catch (err) {
      return res.send(shell('Missing', ui.empty(`Could not load "${owner}/${id}": ${err.message}`)));
    }

    let resultPanel = '';

    if (opts.fire) {
      const watchDir = String(req.body.watchDir || '').trim();
      const input = coerce(def.inputs, req.body);
      if (!watchDir) {
        resultPanel = panel('Test error', ui.empty('A watch directory is required so the run can be undone.'));
      } else {
        try {
          const before = await snapshot(watchDir);
          const out = await usage.track('skill', { id, owner })(() => mod.run(input, { provider }));
          const after = await snapshot(watchDir);
          const manifest = diff(before, after);
          const record = await runs.save({ skillOwner: owner, skillId: id, watchDir, manifest, undone: false });
          resultPanel = panel(
            'Test result (undoable)',
            html`<pre>${JSON.stringify(out, null, 2)}</pre>
              <p class="hint">${manifest.created.length} created, ${manifest.modified.length} modified under <code>${watchDir}</code>.</p>
              ${ui.btn({ action: 'submit', name: `${base}/${owner}/${id}/undo/${record.id}`, label: '↩ Undo this run', danger: true })}`,
          );
        } catch (err) {
          resultPanel = panel('Test error', html`<pre class="bad">${err.stack || err.message}</pre>`);
        }
      }
    }

    if (req.query.undone) {
      const record = await runs.get(req.query.undone).catch(() => null);
      if (record) {
        const undoPanel = panel(
          'Undo complete',
          html`<p>Removed: ${record.undoResult.removed.length}. Restored: ${record.undoResult.restored.length}.${
            record.undoResult.skipped.length ? ` Skipped: ${record.undoResult.skipped.length} (see below).` : ''
          }</p>
            ${record.undoResult.skipped.length ? html`<pre>${JSON.stringify(record.undoResult.skipped, null, 2)}</pre>` : ''}`,
        );
        resultPanel = html`${undoPanel}${resultPanel}`;
      }
    }

    const form = ui.configForm({
      action: `${base}/${owner}/${id}/test`,
      submit: '🧪 Test (undoable)',
      fields: [
        {
          name: 'watchDir',
          label: 'Watch directory (for undo)',
          type: 'string',
          required: true,
          help: 'The folder to snapshot before/after the run, so an Undo button can reverse exactly what changed. Usually the same path you pass to the skill itself.',
        },
        ...(def.inputs || []).map((f) => ({ ...f, label: f.label || f.name })),
      ],
    });

    const body = html`
      ${ui.pageHead({ title: `Test — ${def.name || id}`, subtitle: 'Runs for real, but tracks what changed so it can be undone.', actions: ui.btn({ href: base, label: 'Registry' }) })}
      ${resultPanel}
      ${form}`;
    res.send(shell(def.name || id, body, [...crumb, { href: '#', label: def.name || id }]));
  }

  return router;
}

function coerce(inputs = [], body = {}) {
  const out = {};
  for (const f of inputs) {
    const v = body[f.name];
    if (f.type === 'number') out[f.name] = v === '' || v == null ? undefined : Number(v);
    else if (f.type === 'boolean') out[f.name] = v === 'on' || v === 'true' || v === true;
    else out[f.name] = v ?? '';
  }
  return out;
}
