import express from 'express';
import { html } from '../../lib/html.js';
import { CAPABILITIES, GATES, TOOLS, LOOPS } from './registry.js';

export const meta = {
  name: 'Command Center',
  description: 'Inspect every component an agent system is built from — personas, skills, tools, capabilities, and the hard/soft gates that bind them.',
  icon: '🛰️',
};

export function createFeature(ctx) {
  const { ui, page, stores, base } = ctx;
  const router = express.Router();

  const crumb = [{ href: base, label: 'Command Center' }];
  const shell = (title, body, breadcrumb = crumb) =>
    page({ title, active: 'command-center', breadcrumb, body });

  // ── small render helpers ───────────────────────────────────────────────────
  const tag = (text, bg) => html`<span class="badge" style="background:${bg}">${text}</span>`;
  const hard = tag('hard', '#a32d2d');
  const soft = tag('soft', '#854f0b');
  const gateTag = (kind) => (kind === 'hard' ? hard : soft);
  const inspect = (kind, id, label = 'Inspect') => ui.btn({ href: `${base}/inspect/${kind}/${id}`, label });
  const stat = (label, value, sub) => html`<div class="card" style="padding:14px 16px">
    <div class="dim" style="font-size:0.78em">${label}</div>
    <div style="font-size:1.7em;font-weight:600">${value}</div>
    ${sub ? html`<div class="dim" style="font-size:0.75em">${sub}</div>` : ''}</div>`;
  const section = (title, note, table) => html`<h3 class="eng-section">${title}${note ? html` <span class="dim" style="font-weight:400;font-size:0.8em">— ${note}</span>` : ''}</h3>${table}`;

  // Live components from the engine stores + declared registry.
  async function assemble() {
    const agents = await stores.agents.list();
    const skills = await stores.skills.list();
    return { agents, skills };
  }

  // ── overview / catalog ─────────────────────────────────────────────────────
  router.get('/', async (req, res) => {
    const { agents, skills } = await assemble();
    const hardCount = GATES.filter((g) => g.kind === 'hard').length;
    const softCount = GATES.length - hardCount;

    const stats = html`<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;margin-bottom:18px">
      ${stat('Personas', agents.length, 'agents')}
      ${stat('Skills', skills.length, 'code functions')}
      ${stat('Tools', TOOLS.length, 'bounds vocab')}
      ${stat('Capabilities', CAPABILITIES.length, 'server functions')}
      ${stat('Gates', GATES.length, `${hardCount} hard · ${softCount} soft`)}
      ${stat('Loops', LOOPS.length, 'orchestration')}
    </div>`;

    const personaTable = ui.table(
      ['Persona', 'Model', 'Skills', 'Bounds', ''],
      agents.map((a) => [
        a.broken ? html`${a.id} ${ui.badge('broken', 'errored')}` : (a.name || a.id),
        a.model || '—',
        (a.skills || []).length ? (a.skills || []).join(', ') : html`<span class="dim">none</span>`,
        (a.bounds || []).length ? (a.bounds || []).join(', ') : html`<span class="dim">none set</span>`,
        inspect('persona', a.id),
      ]),
    );

    const skillTable = ui.table(
      ['Skill', 'Version', 'Inputs', ''],
      skills.map((s) => [
        s.broken ? html`${s.id} ${ui.badge('broken', 'errored')}` : (s.name || s.id),
        s.version || '—',
        String((s.inputs || []).length),
        inspect('skill', s.id),
      ]),
    );

    const capTable = ui.table(
      ['Endpoint', 'App', 'Gate', ''],
      CAPABILITIES.map((c) => [
        html`<code>${c.method} ${c.path}</code>${c.read ? html` ${tag('read-only', '#0f6e56')}` : ''}`,
        c.app,
        c.gate ? html`${c.gate}` : html`<span class="dim">none</span>`,
        inspect('capability', c.id),
      ]),
    );

    const gates = [...GATES].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'hard' ? -1 : 1));
    const gateTable = ui.table(
      ['Gate', 'Type', 'Enforces', ''],
      gates.map((g) => [g.id, gateTag(g.kind), g.enforces, inspect('gate', g.id)]),
    );

    const toolTable = ui.table(
      ['Tool', 'Risk', 'Default', ''],
      TOOLS.map((t) => [
        t.label,
        t.risk,
        t.denyByDefault ? tag('deny', '#a32d2d') : tag('allow', '#0f6e56'),
        inspect('tool', t.id),
      ]),
    );

    const body = html`
      ${ui.pageHead({
        title: '🛰️ Command Center',
        subtitle: 'Every component an agent system is built from — and whether each gate is a guarantee (hard) or just a request (soft).',
      })}
      ${stats}
      ${section('Personas', 'who does the work · live from the agent store', personaTable)}
      ${section('Skills', 'reusable code functions · live from the skill store', skillTable)}
      ${section('Capabilities', 'server-side functions agents can call', capTable)}
      ${section('Gates', 'the leash — hard is structural, soft is a request', gateTable)}
      ${section('Tools', 'what an agent’s bounds can grant', toolTable)}
      ${section('Loops', 'iterate mechanisms', LOOPS.length ? '' : ui.empty('No loops yet — the delivery loop is the first.'))}`;
    res.send(shell('Command Center', body));
  });

  // ── inspector ──────────────────────────────────────────────────────────────
  const kv = (rows) => ui.table(['Field', 'Value'], rows);
  const detailPage = (title, badge, body) =>
    shell(title, html`${ui.pageHead({ title, subtitle: badge, actions: ui.btn({ href: base, label: '← Command Center' }) })}${body}`,
      [...crumb, { href: '#', label: title }]);

  router.get('/inspect/:kind/:id', async (req, res) => {
    const { kind, id } = req.params;
    try {
      if (kind === 'persona') return res.send(await inspectPersona(id));
      if (kind === 'skill') return res.send(await inspectSkill(id));
      if (kind === 'capability') return res.send(inspectCapability(id));
      if (kind === 'gate') return res.send(inspectGate(id));
      if (kind === 'tool') return res.send(inspectTool(id));
    } catch (err) {
      return res.send(shell('Inspect', ui.empty(`Could not inspect ${kind}/${id}: ${err.message}`)));
    }
    res.send(shell('Inspect', ui.empty(`Unknown component kind "${kind}".`)));
  });

  async function inspectPersona(id) {
    const { definition: d } = await stores.agents.get(id);
    const skillLinks = (d.skills || []).length
      ? (d.skills || []).map((s) => inspect('skill', s, s))
      : html`<span class="dim">none</span>`;
    const boundsRow = (d.bounds || []).length
      ? (d.bounds || []).join(', ')
      : html`<span class="dim">none set — denied by default. The bounds field is the leash; set it in the composer (planned).</span>`;
    const body = html`
      ${kv([
        ['Kind', html`persona · agent`],
        ['Model', d.model || '—'],
        ['Description', d.description || html`<span class="dim">—</span>`],
        ['Skills', skillLinks],
        ['Tools (bounds)', boundsRow],
        ['Capabilities', html`<span class="dim">per-agent capability wiring not declared yet (planned)</span>`],
        ['Emits', 'reply · skill outputs · usage'],
      ])}
      <h3 class="eng-section">Persona (system prompt)</h3>
      <pre class="eng-source">${d.systemPrompt || '(none)'}</pre>`;
    return detailPage(d.name || id, 'persona · agent', body);
  }

  async function inspectSkill(id) {
    const { definition: d, module: mod } = await stores.skills.get(id);
    let source = '';
    try { source = await stores.skills.source(id); } catch {}
    const inputsTable = (d.inputs || []).length
      ? ui.table(['Name', 'Type', 'Label'], (d.inputs || []).map((i) => [i.name, i.type || 'string', i.label || '']))
      : ui.empty('No inputs.');
    const tests = Array.isArray(mod.tests) ? mod.tests : [];
    const body = html`
      ${kv([
        ['Kind', 'skill · code function'],
        ['Version', d.version || '—'],
        ['Description', d.description || html`<span class="dim">—</span>`],
        ['Tests', tests.length ? `${tests.length} case(s)` : html`<span class="dim">none</span>`],
      ])}
      <h3 class="eng-section">Inputs</h3>${inputsTable}
      ${tests.length ? html`<h3 class="eng-section">Tests</h3><pre class="eng-source">${JSON.stringify(tests, null, 2)}</pre>` : ''}
      <h3 class="eng-section">Source (code-first)</h3><pre class="eng-source">${source}</pre>`;
    return detailPage(d.name || id, 'skill · code function', body);
  }

  function inspectCapability(id) {
    const c = CAPABILITIES.find((x) => x.id === id);
    if (!c) return shell('Inspect', ui.empty(`No capability "${id}".`));
    const gate = c.gate && GATES.find((g) => g.id === c.gate);
    const body = kv([
      ['Kind', 'capability · server-side function'],
      ['App', c.app],
      ['Endpoint', html`<code>${c.method} ${c.path}</code>`],
      ['Access', c.read ? tag('read-only', '#0f6e56') : tag('mutates', '#854f0b')],
      ['Gate', gate ? html`${inspect('gate', gate.id, gate.id)} ${gateTag(gate.kind)}` : html`<span class="dim">none</span>`],
      ['Description', c.description],
    ]);
    return detailPage(c.id, 'capability · server function', body);
  }

  function inspectGate(id) {
    const g = GATES.find((x) => x.id === id);
    if (!g) return shell('Inspect', ui.empty(`No gate "${id}".`));
    const users = CAPABILITIES.filter((c) => c.gate === id);
    const body = html`
      ${kv([
        ['Kind', html`gate · ${gateTag(g.kind)} ${g.kind === 'hard' ? 'structural guarantee' : 'request / judgement'}`],
        ['Enforces', g.enforces],
        ['How', g.how],
        ['Where', html`<code>${g.where}</code>`],
        ['Guards', users.length ? users.map((c) => html`${inspect('capability', c.id, c.id)} `) : html`<span class="dim">—</span>`],
      ])}
      <div class="card" style="margin-top:14px">
        <p class="dim" style="margin:0">${g.kind === 'hard'
          ? 'Hard gate: the structure itself prevents the disallowed action. A prompt cannot talk past it.'
          : 'Soft gate: this is asked for, not enforced. If it matters, back it with a hard gate — when prose and structure conflict, structure wins.'}</p>
      </div>`;
    return detailPage(g.id, `gate · ${g.kind}`, body);
  }

  function inspectTool(id) {
    const t = TOOLS.find((x) => x.id === id);
    if (!t) return shell('Inspect', ui.empty(`No tool "${id}".`));
    const body = kv([
      ['Kind', 'tool · grantable capability'],
      ['Risk', t.risk],
      ['Default', t.denyByDefault ? html`${tag('deny', '#a32d2d')} off unless a verb on the job demands it` : tag('allow', '#0f6e56')],
      ['Description', t.description],
    ]);
    return detailPage(t.label, 'tool · bounds', body);
  }

  return router;
}
