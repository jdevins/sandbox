import express from 'express';
import { html } from '../../lib/html.js';
import { slug } from '../../lib/store.js';
import { agentModuleSource } from './codegen.js';

export const meta = {
  name: 'Agent Composer',
  description: 'Agent library and builder wizard — compose agents from skills.',
  icon: '🤖',
};

export function createFeature(ctx) {
  const { ui, page, stores, provider, base } = ctx;
  const store = stores.agents;
  const skillStore = stores.skills;
  const router = express.Router();

  const crumb = [{ href: base, label: 'Agents' }];
  const shell = (title, body, breadcrumb = crumb) =>
    page({ title, active: 'agent-composer', breadcrumb, body });

  // Execution context handed to an agent module at run time.
  const execCtx = {
    provider,
    skills: {
      run: async (id, input) => {
        const { module } = await skillStore.get(id);
        if (typeof module.run !== 'function') throw new Error(`skill "${id}" has no run()`);
        return module.run(input, { provider });
      },
    },
  };

  // Library
  router.get('/', async (req, res) => {
    const agents = await store.list();
    const cards = agents.map((a) =>
      ui.card({
        title: a.name || a.id,
        badge: a.broken ? ui.badge('broken', 'errored') : ui.badge(a.model || 'model'),
        desc: a.broken ? a.error : a.description,
        meta: html`${(a.skills || []).length} skill(s)`,
        actions: [
          ui.btn({ href: `${base}/${a.id}`, label: 'Open', primary: true }),
          ui.btn({ action: 'delete', name: `${base}/${a.id}/delete`, label: 'Delete', danger: true }),
        ],
      }),
    );
    const body = html`
      ${ui.pageHead({
        title: '🤖 Agent Composer',
        subtitle: 'Compose agents from skills + a system prompt.',
        actions: ui.btn({ href: `${base}/new`, label: '+ New agent', primary: true }),
      })}
      ${agents.length ? ui.grid(cards) : ui.empty('No agents yet — compose one.')}`;
    res.send(shell('Agents', body));
  });

  // Wizard — skills offered as checkboxes from the skills library.
  router.get('/new', async (req, res) => {
    const skills = await skillStore.list();
    const skillPicker = skills.length
      ? html`<div class="eng-field"><label>Skills to compose</label>
          ${skills.map((s) => html`<label class="eng-check"><input type="checkbox" name="skills" value="${s.id}"/> ${s.name || s.id}</label>`)}
          <small class="dim">Each selected skill runs on the task before the LLM call.</small></div>`
      : html`<div class="eng-field"><small class="dim">No skills available yet — build some in the Skill Builder.</small></div>`;

    const form = ui.configForm({
      action: `${base}`,
      submit: 'Create agent',
      fields: [
        { name: 'name', label: 'Name', required: true, placeholder: 'Summarizer' },
        { name: 'description', label: 'Description', type: 'text', rows: 2 },
        {
          name: 'model',
          label: 'Model',
          type: 'select',
          options: ['claude-opus-4-8', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001', 'mock-1'],
          value: 'claude-opus-4-8',
        },
        { name: 'systemPrompt', label: 'System prompt', type: 'text', rows: 4, placeholder: 'You are a helpful assistant that…' },
        { name: 'taskLabel', label: 'Task input label', value: 'Task' },
      ],
      extra: skillPicker,
    });
    res.send(shell('New agent', html`${ui.pageHead({ title: 'New agent' })}${form}`, [...crumb, { href: '#', label: 'New' }]));
  });

  // Create
  router.post('/', async (req, res) => {
    const b = req.body || {};
    const id = slug(b.name);
    if (!id) return res.redirect(`${base}/new`);
    const skills = Array.isArray(b.skills) ? b.skills : b.skills ? [b.skills] : [];
    const source = agentModuleSource({
      id, name: b.name, description: b.description,
      model: b.model, systemPrompt: b.systemPrompt, skills, taskLabel: b.taskLabel,
    });
    await store.save(id, source);
    res.redirect(`${base}/${id}`);
  });

  // View + run
  router.get('/:id', (req, res) => view(req, res));
  router.post('/:id/run', (req, res) => view(req, res, { run: req.body }));
  router.post('/:id/delete', async (req, res) => {
    await store.remove(req.params.id);
    res.redirect(base);
  });

  async function view(req, res, opts = {}) {
    const id = req.params.id;
    let mod, def, source;
    try {
      ({ definition: def, module: mod } = await store.get(id));
      source = await store.source(id);
    } catch (err) {
      return res.send(shell('Missing', ui.empty(`Could not load "${id}": ${err.message}`)));
    }

    let resultPanel = '';
    if (opts.run) {
      try {
        const out = await mod.run({ task: opts.run.task || '' }, execCtx);
        resultPanel = html`<div class="eng-panel"><h3>Reply <span class="dim">· ${out.provider}/${out.model}</span></h3>
          <pre>${out.reply}</pre>
          ${Object.keys(out.skillOutputs || {}).length ? html`<h4>Skill outputs</h4><pre>${JSON.stringify(out.skillOutputs, null, 2)}</pre>` : ''}</div>`;
      } catch (err) {
        resultPanel = html`<div class="eng-panel"><h3>Run error</h3><pre class="bad">${err.stack || err.message}</pre></div>`;
      }
    }

    const runForm = ui.configForm({
      action: `${base}/${id}/run`,
      submit: 'Run agent',
      fields: [{ name: 'task', label: (def.inputs?.[0]?.label) || 'Task', type: 'text', rows: 4, required: true }],
    });

    const body = html`
      ${ui.pageHead({ title: def.name || id, subtitle: def.description, actions: ui.btn({ href: base, label: 'Library' }) })}
      <div class="meta">model: ${def.model} · skills: ${(def.skills || []).join(', ') || 'none'} · provider: ${provider.name}</div>
      ${resultPanel}
      <div class="eng-cols">
        <div><h3 class="eng-section">Run</h3>${runForm}</div>
        <div><h3 class="eng-section">Source (code-first)</h3><pre class="eng-source">${source}</pre></div>
      </div>`;
    res.send(shell(def.name || id, body, [...crumb, { href: `${base}/${id}`, label: def.name || id }]));
  }

  return router;
}
