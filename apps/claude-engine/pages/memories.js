import express from 'express';
import { html } from '../lib/html.js';

// Memories page — exposes the engine's memory store (facts about how Claude
// supports the owner). Viewer + add/delete; records are JSON in data/memories/.
export function memoriesRouter(ctx) {
  const { ui, page, base, stores } = ctx;
  const router = express.Router();
  const self = `${base}/memories`;

  router.get('/', async (req, res) => {
    const memories = await stores.memories.list();
    const rows = memories.map((m) => [
      html`<b>${m.name || m.id}</b>`,
      ui.badge(m.type || 'reference'),
      m.body || '',
      ui.btn({ action: 'delete', name: `${self}/${m.id}/delete`, label: 'Delete', danger: true }),
    ]);

    const form = ui.configForm({
      action: self,
      submit: 'Add memory',
      fields: [
        { name: 'name', label: 'Name', required: true, placeholder: 'short title' },
        { name: 'type', label: 'Type', type: 'select', options: ['user', 'feedback', 'project', 'reference'], value: 'reference' },
        { name: 'body', label: 'Fact', type: 'text', required: true, placeholder: 'the fact to remember' },
      ],
    });

    const body = html`
      ${ui.pageHead({ title: 'Memories', subtitle: 'What the engine remembers about the owner & their work.' })}
      ${memories.length ? ui.table(['Name', 'Type', 'Fact', ''], rows) : ui.empty('No memories yet.')}
      <h3 class="eng-section">Add a memory</h3>
      ${form}`;

    res.send(page({ title: 'Memories', active: 'memories', breadcrumb: [{ href: self, label: 'Memories' }], body }));
  });

  router.post('/', async (req, res) => {
    const { name, type, body } = req.body || {};
    if (name && body) await stores.memories.save({ name, type: type || 'reference', body });
    res.redirect(self);
  });

  router.post('/:id/delete', async (req, res) => {
    await stores.memories.remove(req.params.id);
    res.redirect(self);
  });

  return router;
}
