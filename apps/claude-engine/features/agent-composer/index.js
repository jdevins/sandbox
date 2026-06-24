import express from 'express';
import { html } from '../../lib/html.js';
import { slug } from '../../lib/store.js';
import { agentModuleSource } from './codegen.js';
import { learnIndex, lessonPage } from './learn.js';

export const meta = {
  name: 'Agent Composer',
  description: 'Agent library and builder wizard — compose agents from skills.',
  icon: '🤖',
};

export function createFeature(ctx) {
  const { ui, page, stores, provider, base, usage } = ctx;
  const store = stores.agents;
  const skillStore = stores.skills;
  const router = express.Router();

  const crumb = [{ href: base, label: 'Agents' }];
  const shell = (title, body, breadcrumb = crumb) =>
    page({ title, active: 'agent-composer', breadcrumb, body });

  // Execution context handed to an agent module at run time. Skill refs are
  // "owner/id" so a composed agent can pull skills leased from any app.
  // `calledBy` on the inner skill.run is what correlates a workflow: it logs
  // not just "skill X ran" but "skill X ran because agent Y composed it."
  function makeExecCtx(agentTag) {
    return {
      provider: usage.withCaller(provider, agentTag),
      skills: {
        run: async (ref, input) => {
          const [owner, id] = String(ref).split('/');
          const { module } = await skillStore.get(owner, id);
          if (typeof module.run !== 'function') throw new Error(`skill "${ref}" has no run()`);
          const taggedProvider = usage.withCaller(provider, { kind: 'skill', id, owner, calledBy: agentTag });
          return usage.track('skill', { id, owner, calledBy: agentTag })(() => module.run(input, { provider: taggedProvider }));
        },
      },
    };
  }

  // Library
  router.get('/', async (req, res) => {
    const agents = await store.list();
    const cards = agents.map((a) =>
      ui.card({
        title: a.name || a.id,
        badge: html`${ui.badge(a.owner)}${a.broken ? ui.badge('broken', 'errored') : ui.badge(a.model || 'model')}`,
        desc: a.broken ? a.error : a.description,
        meta: html`${(a.skills || []).length} skill(s)`,
        actions: [
          ui.btn({ href: `${base}/${a.owner}/${a.id}`, label: 'Open', primary: true }),
          ui.btn({ action: 'delete', name: `${base}/${a.owner}/${a.id}/delete`, label: 'Delete', danger: true }),
        ],
      }),
    );
    const body = html`
      ${ui.pageHead({
        title: '🤖 Agent Composer',
        subtitle: 'Compose agents from skills + a system prompt.',
        actions: html`${ui.btn({ href: `${base}/learn`, label: '🎓 Problem → Agent Fit' })}${ui.btn({ href: `${base}/new`, label: '+ New agent', primary: true })}`,
      })}
      ${agents.length ? ui.grid(cards) : ui.empty('No agents yet — compose one.')}`;
    res.send(shell('Agents', body));
  });

  // Wizard — skills offered as checkboxes from the skills library, across owners.
  router.get('/new', async (req, res) => {
    const skills = await skillStore.list();
    const skillPicker = skills.length
      ? html`<div class="eng-field"><label>Skills to compose</label>
          ${skills.map((s) => html`<label class="eng-check"><input type="checkbox" name="skills" value="${s.owner}/${s.id}"/> ${ui.badge(s.owner)} ${s.name || s.id}</label>`)}
          <small class="dim">Each selected skill runs on the task before the LLM call.</small></div>`
      : html`<div class="eng-field"><small class="dim">No skills available yet — build some in the Skill Builder.</small></div>`;

    const form = ui.configForm({
      action: `${base}`,
      submit: 'Create agent',
      fields: [
        { name: 'name', label: 'Name', required: true, placeholder: 'Summarizer' },
        { name: 'owner', label: 'Owner app', type: 'select', options: store.owners, value: 'claude-engine', help: 'Which app crafts/runs this agent.' },
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

  // Agent Training — curriculum index + individual lessons. Declared before the
  // /:id route so "learn" isn't swallowed as an agent id.
  router.get('/learn', async (req, res) => res.send(await learnIndex(ctx)));

  // Bounds demo — an ephemeral in-memory item mirroring the backlog's real
  // guards, so a lesson can demonstrate structural bounds live without touching
  // real backlog data. State resets on process restart (sandbox-ephemeral).
  const freshDemo = () => ({
    id: 'demo', title: 'Demo backlog item', status: 'pending',
    approvedForBuild: false, claim: null, estimate: null, annotations: [],
  });
  let demo = freshDemo();
  const ANNOTATE_ALLOWED = ['agent', 'kind', 'body', 'estimate'];

  router.get('/learn/demo/state', (req, res) => res.json(demo));
  router.post('/learn/demo/reset', (req, res) => { demo = freshDemo(); res.json({ ok: true, item: demo }); });

  // ANNOTATOR bound: append-only. Forbidden fields have no code path to apply —
  // they come back in `ignored`, which is the whole lesson.
  router.post('/learn/demo/annotate', (req, res) => {
    const b = req.body || {};
    const ignored = Object.keys(b).filter((k) => !ANNOTATE_ALLOWED.includes(k));
    const applied = ['annotation'];
    demo.annotations.push({ agent: b.agent || 'groomer', kind: b.kind || 'note', body: String(b.body ?? ''), createdAt: new Date().toISOString() });
    if (b.kind === 'estimate' && b.estimate) { demo.estimate = String(b.estimate).slice(0, 40); applied.push('estimate'); }
    if (demo.status === 'pending') { demo.status = 'groomed'; applied.push('status→groomed'); }
    res.json({ ok: true, applied, ignored, item: demo });
  });

  // Human gate.
  router.post('/learn/demo/approve', (req, res) => {
    const value = (req.body || {}).value;
    if (value === '0') { demo.approvedForBuild = false; if (demo.status === 'ready') demo.status = 'groomed'; }
    else if (demo.status === 'groomed' || demo.status === 'ready') { demo.approvedForBuild = true; demo.status = 'ready'; }
    res.json({ ok: true, item: demo });
  });

  // WORKER bound: atomic claim, only on ready + approved; 409 otherwise.
  router.post('/learn/demo/claim', (req, res) => {
    const by = (req.body || {}).by || 'builder';
    if (!(demo.status === 'ready' && demo.approvedForBuild)) return res.status(409).json({ ok: false, error: 'not ready + approved for build', item: demo });
    if (demo.claim) return res.status(409).json({ ok: false, error: `already claimed by ${demo.claim.by}`, item: demo });
    demo.claim = { by, at: new Date().toISOString() };
    demo.status = 'in-progress';
    res.json({ ok: true, item: demo });
  });

  // WORKER bound: only the claimer may finish; 403 otherwise.
  router.post('/learn/demo/complete', (req, res) => {
    const b = req.body || {};
    if (!demo.claim || demo.claim.by !== b.by) return res.status(403).json({ ok: false, error: 'only the claimer may complete this item', item: demo });
    demo.status = b.status === 'blocked' ? 'blocked' : 'done';
    if (demo.status === 'done') demo.claim = null;
    res.json({ ok: true, item: demo });
  });

  router.get('/learn/:id', async (req, res) => res.send(await lessonPage(ctx, req.params.id)));

  // Create
  router.post('/', async (req, res) => {
    const b = req.body || {};
    const id = slug(b.name);
    const owner = store.owners.includes(b.owner) ? b.owner : 'claude-engine';
    if (!id) return res.redirect(`${base}/new`);
    const skills = Array.isArray(b.skills) ? b.skills : b.skills ? [b.skills] : [];
    const source = agentModuleSource({
      id, name: b.name, description: b.description,
      model: b.model, systemPrompt: b.systemPrompt, skills, taskLabel: b.taskLabel,
    });
    await store.save(owner, id, source);
    res.redirect(`${base}/${owner}/${id}`);
  });

  // View + run
  router.get('/:owner/:id', (req, res) => view(req, res));
  router.post('/:owner/:id/run', (req, res) => view(req, res, { run: req.body }));
  router.post('/:owner/:id/delete', async (req, res) => {
    await store.remove(req.params.owner, req.params.id);
    res.redirect(base);
  });

  async function view(req, res, opts = {}) {
    const { owner, id } = req.params;
    let mod, def, source;
    try {
      ({ definition: def, module: mod } = await store.get(owner, id));
      source = await store.source(owner, id);
    } catch (err) {
      return res.send(shell('Missing', ui.empty(`Could not load "${owner}/${id}": ${err.message}`)));
    }

    let resultPanel = '';
    if (opts.run) {
      const agentTag = { kind: 'agent', id, owner };
      try {
        const out = await usage.track('agent', agentTag)(() => mod.run({ task: opts.run.task || '' }, makeExecCtx(agentTag)));
        resultPanel = html`<div class="eng-panel"><h3>Reply <span class="dim">· ${out.provider}/${out.model}</span></h3>
          <pre>${out.reply}</pre>
          ${Object.keys(out.skillOutputs || {}).length ? html`<h4>Skill outputs</h4><pre>${JSON.stringify(out.skillOutputs, null, 2)}</pre>` : ''}</div>`;
      } catch (err) {
        resultPanel = html`<div class="eng-panel"><h3>Run error</h3><pre class="bad">${err.stack || err.message}</pre></div>`;
      }
    }

    const runForm = ui.configForm({
      action: `${base}/${owner}/${id}/run`,
      submit: 'Run agent',
      fields: [{ name: 'task', label: (def.inputs?.[0]?.label) || 'Task', type: 'text', rows: 4, required: true }],
    });

    const body = html`
      ${ui.pageHead({ title: def.name || id, subtitle: def.description, actions: html`${ui.badge(owner)}${ui.btn({ href: base, label: 'Library' })}` })}
      <div class="meta">model: ${def.model} · skills: ${(def.skills || []).join(', ') || 'none'} · provider: ${provider.name}</div>
      ${resultPanel}
      <div class="eng-cols">
        <div><h3 class="eng-section">Run</h3>${runForm}</div>
        <div><h3 class="eng-section">Source (code-first)</h3><pre class="eng-source">${source}</pre></div>
      </div>`;
    res.send(shell(def.name || id, body, [...crumb, { href: `${base}/${owner}/${id}`, label: def.name || id }]));
  }

  return router;
}
