import express from 'express';
import { html } from '../../lib/html.js';
import { slug } from '../../lib/store.js';
import { parseInputs, skillModuleSource } from './codegen.js';

export const meta = {
  name: 'Skill Builder',
  description: 'Skills library, code-first builder wizard, and evaluation runner.',
  icon: '🛠️',
};

export function createFeature(ctx) {
  const { ui, page, stores, provider, base, usage } = ctx;
  const store = stores.skills;
  const router = express.Router();

  const crumb = [{ href: base, label: 'Skills' }];
  const shell = (title, body, breadcrumb = crumb) =>
    page({ title, active: 'skill-builder', breadcrumb, body });

  // Library
  router.get('/', async (req, res) => {
    const skills = await store.list();
    const cards = skills.map((s) =>
      ui.card({
        title: s.name || s.id,
        badge: html`${ui.badge(s.owner)}${s.broken ? ui.badge('broken', 'errored') : ui.badge(`v${s.version || '?'}`)}`,
        desc: s.broken ? s.error : s.description,
        meta: html`${(s.inputs || []).length} input(s)`,
        actions: [
          ui.btn({ href: `${base}/${s.owner}/${s.id}`, label: 'Open', primary: true }),
          ui.btn({ action: 'delete', name: `${base}/${s.owner}/${s.id}/delete`, label: 'Delete', danger: true }),
        ],
      }),
    );
    const body = html`
      ${ui.pageHead({
        title: '🛠️ Skill Builder',
        subtitle: 'Author repeatable skills as code, then evaluate them.',
        actions: ui.btn({ href: `${base}/new`, label: '+ New skill', primary: true }),
      })}
      ${skills.length ? ui.grid(cards) : ui.empty('No skills yet — create one.')}`;
    res.send(shell('Skills', body));
  });

  // Wizard
  router.get('/new', (req, res) => {
    const form = ui.configForm({
      action: `${base}`,
      submit: 'Create skill',
      fields: [
        { name: 'name', label: 'Name', required: true, placeholder: 'Word Count' },
        { name: 'owner', label: 'Owner app', type: 'select', options: store.owners, value: 'claude-engine', help: 'Which app crafts/runs this skill. The engine leases the right to manage it; the owner keeps the running copy.' },
        { name: 'description', label: 'Description', type: 'text', rows: 2, placeholder: 'What it does' },
        { name: 'version', label: 'Version', value: '1.0.0' },
        {
          name: 'inputs',
          label: 'Inputs',
          type: 'text',
          rows: 3,
          value: 'text, string, Text to process',
          help: 'One per line: name, type, label. Types: string · text · number · boolean.',
        },
        {
          name: 'runBody',
          label: 'run(input, ctx) body',
          type: 'code',
          rows: 8,
          value: 'const text = String(input.text || "");\nreturn { words: text.split(/\\s+/).filter(Boolean).length };',
          help: 'JavaScript. Return any value. ctx.provider is available for LLM calls.',
        },
        {
          name: 'tests',
          label: 'Tests (JSON)',
          type: 'code',
          rows: 5,
          value: '[\n  { "name": "counts words", "input": { "text": "a b c" }, "expect": { "words": 3 } }\n]',
          help: 'Array of { name, input, expect }. Used by the evaluation runner.',
        },
      ],
    });
    res.send(shell('New skill', html`${ui.pageHead({ title: 'New skill' })}${form}`, [...crumb, { href: '#', label: 'New' }]));
  });

  // Create
  router.post('/', async (req, res) => {
    const { name, owner, description, version, inputs, runBody, tests } = req.body || {};
    const id = slug(name);
    const ownerId = store.owners.includes(owner) ? owner : 'claude-engine';
    if (!id) return res.redirect(`${base}/new`);
    let parsedTests = [];
    try { parsedTests = JSON.parse(tests || '[]'); } catch { /* keep empty */ }
    const source = skillModuleSource({
      id, name, description, version,
      inputs: parseInputs(inputs),
      runBody, tests: parsedTests,
    });
    await store.save(ownerId, id, source);
    res.redirect(`${base}/${ownerId}/${id}`);
  });

  // View + run + eval (result rendered inline)
  router.get('/:owner/:id', (req, res) => view(req, res));
  router.post('/:owner/:id/run', (req, res) => view(req, res, { run: req.body }));
  router.post('/:owner/:id/eval', (req, res) => view(req, res, { evaluate: true }));

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
      const input = coerce(def.inputs, opts.run);
      const taggedProvider = usage.withCaller(provider, { kind: 'skill', id, owner });
      try {
        const out = await usage.track('skill', { id, owner })(() => mod.run(input, { provider: taggedProvider }));
        resultPanel = panel('Run result', html`<pre>${JSON.stringify(out, null, 2)}</pre>`);
      } catch (err) {
        resultPanel = panel('Run error', html`<pre class="bad">${err.stack || err.message}</pre>`);
      }
    } else if (opts.evaluate) {
      resultPanel = await runEval(mod, { id, owner });
    }

    const runForm = ui.configForm({
      action: `${base}/${owner}/${id}/run`,
      submit: 'Run',
      fields: (def.inputs || []).map((f) => ({ ...f, label: f.label || f.name })),
      extra: html`<input type="hidden" name="_run" value="1" />`,
    });

    const body = html`
      ${ui.pageHead({
        title: def.name || id,
        subtitle: def.description,
        actions: [
          ui.badge(owner),
          ui.btn({ action: 'submit', name: `${base}/${owner}/${id}/eval`, label: '▶ Run tests' }),
          ui.btn({ href: base, label: 'Library' }),
        ],
      })}
      ${resultPanel}
      <div class="eng-cols">
        <div>
          <h3 class="eng-section">Configure & run</h3>
          ${(def.inputs || []).length ? runForm : ui.empty('No inputs.')}
        </div>
        <div>
          <h3 class="eng-section">Source (code-first)</h3>
          <pre class="eng-source">${source}</pre>
        </div>
      </div>`;
    res.send(shell(def.name || id, body, [...crumb, { href: `${base}/${owner}/${id}`, label: def.name || id }]));
  }

  async function runEval(mod, { id, owner }) {
    const tests = Array.isArray(mod.tests) ? mod.tests : [];
    if (!tests.length) return panel('Evaluation', ui.empty('No tests defined.'));
    const taggedProvider = usage.withCaller(provider, { kind: 'skill', id, owner });
    const rows = [];
    let pass = 0;
    for (const t of tests) {
      try {
        const got = await usage.track('skill', { id, owner })(() => mod.run(t.input || {}, { provider: taggedProvider }));
        const ok = deepEqual(got, t.expect);
        if (ok) pass++;
        rows.push([t.name || '(test)', ui.badge(ok ? 'pass' : 'fail', ok ? 'running' : 'errored'), html`<code>${JSON.stringify(got)}</code>`]);
      } catch (err) {
        rows.push([t.name || '(test)', ui.badge('error', 'errored'), html`<code>${err.message}</code>`]);
      }
    }
    return panel(`Evaluation — ${pass}/${tests.length} passed`, ui.table(['Test', 'Result', 'Output'], rows));
  }

  const panel = (title, inner) => html`<div class="eng-panel"><h3>${title}</h3>${inner}</div>`;
  return router;
}

// Coerce form strings into typed input per the schema.
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

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}
