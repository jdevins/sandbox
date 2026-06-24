import express from 'express';
import { html, raw } from '../../lib/html.js';
import { CAPABILITIES, GATES, TOOLS, LOOPS } from './registry.js';

export const meta = {
  name: 'Command Center',
  description: 'Inspect every component an agent system is built from — personas, skills, tools, capabilities, and the hard/soft gates that bind them.',
  icon: '🛰️',
};

export function createFeature(ctx) {
  const { ui, page, stores, base, usage } = ctx;
  const router = express.Router();

  const crumb = [{ href: base, label: 'Command Center' }];
  const shell = (title, body, breadcrumb = crumb) =>
    page({ title, active: 'command-center', breadcrumb, body });

  // ── small render helpers ───────────────────────────────────────────────────
  const tag = (text, bg) => html`<span class="badge" style="background:${bg}">${text}</span>`;
  const hard = tag('hard', '#a32d2d');
  const soft = tag('soft', '#854f0b');
  const gateTag = (kind) => (kind === 'hard' ? hard : soft);
  const inspect = (kind, idOrPath, label = 'Inspect') =>
    ui.btn({ href: `${base}/inspect/${kind}/${idOrPath}`, label });
  const stat = (label, value, sub) => html`<div class="card" style="padding:14px 16px">
    <div class="dim" style="font-size:0.78em">${label}</div>
    <div style="font-size:1.7em;font-weight:600">${value}</div>
    ${sub ? html`<div class="dim" style="font-size:0.75em">${sub}</div>` : ''}</div>`;
  const section = (title, note, table) => html`<h3 class="eng-section">${title}${note ? html` <span class="dim" style="font-weight:400;font-size:0.8em">— ${note}</span>` : ''}</h3>${table}`;

  // Live components from the engine stores + declared registry.
  async function assemble() {
    const agents = await stores.agents.list();
    const skills = await stores.skills.list();
    const usageSummary = await usage.summary();
    const usageFor = (kind, owner, id) => usageSummary.find((u) => u.kind === kind && u.owner === owner && u.id === id);
    return { agents, skills, usageSummary, usageFor };
  }

  // "3· 12:04" — count, then the time of the last run; dim/empty if never used.
  const usageCell = (u) =>
    u
      ? html`${u.count}× ${u.errors ? html` ${ui.badge(`${u.errors} err`, 'errored')}` : ''} <span class="dim">· ${u.lastAt.slice(0, 16).replace('T', ' ')}</span>`
      : html`<span class="dim">never used</span>`;

  // ── overview / catalog ─────────────────────────────────────────────────────
  router.get('/', async (req, res) => {
    const { agents, skills, usageSummary, usageFor } = await assemble();
    const hardCount = GATES.filter((g) => g.kind === 'hard').length;
    const softCount = GATES.length - hardCount;
    const live = req.query.live === '1';

    const stats = html`<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;margin-bottom:18px">
      ${stat('Personas', agents.length, 'agents')}
      ${stat('Skills', skills.length, 'code functions')}
      ${stat('Tools', TOOLS.length, 'bounds vocab')}
      ${stat('Capabilities', CAPABILITIES.length, 'server functions')}
      ${stat('Gates', GATES.length, `${hardCount} hard · ${softCount} soft`)}
      ${stat('Loops', LOOPS.length, 'orchestration')}
      ${stat('Events logged', usageSummary.reduce((n, u) => n + u.count, 0), 'invocations + LLM calls')}
    </div>`;

    const personaTable = ui.table(
      ['Persona', 'Owner', 'Model', 'Skills', 'Bounds', 'Used', ''],
      agents.map((a) => [
        a.broken ? html`${a.id} ${ui.badge('broken', 'errored')}` : (a.name || a.id),
        ui.badge(a.owner),
        a.model || '—',
        (a.skills || []).length ? (a.skills || []).join(', ') : html`<span class="dim">none</span>`,
        (a.bounds || []).length ? (a.bounds || []).join(', ') : html`<span class="dim">none set</span>`,
        usageCell(usageFor('agent', a.owner, a.id)),
        inspect('persona', `${a.owner}/${a.id}`),
      ]),
    );

    const skillTable = ui.table(
      ['Skill', 'Owner', 'Version', 'Inputs', 'Used', ''],
      skills.map((s) => [
        s.broken ? html`${s.id} ${ui.badge('broken', 'errored')}` : (s.name || s.id),
        ui.badge(s.owner),
        s.version || '—',
        String((s.inputs || []).length),
        usageCell(usageFor('skill', s.owner, s.id)),
        inspect('skill', `${s.owner}/${s.id}`),
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

    const recent = (await usage.all()).sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 25);
    const activityTable = recent.length
      ? ui.table(
          ['When', 'Kind', 'Component', 'Triggered by', 'Result'],
          recent.map((e) => [
            e.ts.slice(11, 19),
            ui.badge(e.kind),
            e.owner ? `${e.owner}/${e.id}` : e.id,
            e.calledBy ? html`${e.calledBy.owner}/${e.calledBy.id} <span class="dim">(${e.calledBy.kind})</span>` : html`<span class="dim">—</span>`,
            e.ok === false
              ? ui.badge('error', 'errored')
              : html`${ui.badge('ok', 'running')}${e.ms != null ? html` <span class="dim">${e.ms}ms</span>` : ''}`,
          ]),
        )
      : ui.empty('No activity logged yet — run a skill or agent.');

    const body = html`
      ${live ? raw('<meta http-equiv="refresh" content="5">') : ''}
      ${ui.pageHead({
        title: '🛰️ Command Center',
        subtitle: 'Every component an agent system is built from — and whether each gate is a guarantee (hard) or just a request (soft).',
        actions: ui.btn({ href: `${base}${live ? '' : '?live=1'}`, label: live ? '⏸ Pause' : '▶ Watch live' }),
      })}
      ${stats}
      ${section('Personas', 'who does the work · live from the agent store', personaTable)}
      ${section('Skills', 'reusable code functions · live from the skill store', skillTable)}
      ${section('Capabilities', 'server-side functions agents can call', capTable)}
      ${section('Gates', 'the leash — hard is structural, soft is a request', gateTable)}
      ${section('Tools', 'what an agent’s bounds can grant', toolTable)}
      ${section('Loops', 'iterate mechanisms', LOOPS.length ? '' : ui.empty('No loops yet — the delivery loop is the first.'))}
      ${section('Activity', 'supervisor feed — every invocation, LLM call, and what triggered it', activityTable)}`;
    res.send(shell('Command Center', body));
  });

  // ── inspector ──────────────────────────────────────────────────────────────
  const kv = (rows) => ui.table(['Field', 'Value'], rows);
  const detailPage = (title, badge, body) =>
    shell(title, html`${ui.pageHead({ title, subtitle: badge, actions: ui.btn({ href: base, label: '← Command Center' }) })}${body}`,
      [...crumb, { href: '#', label: title }]);

  // persona/skill live in multi-owner stores, so their inspect path carries an
  // owner segment; capability/gate/tool are single-id declared registries.
  router.get('/inspect/persona/:owner/:id', async (req, res) => {
    try { return res.send(await inspectPersona(req.params.owner, req.params.id)); }
    catch (err) { return res.send(shell('Inspect', ui.empty(`Could not inspect persona/${req.params.owner}/${req.params.id}: ${err.message}`))); }
  });
  router.get('/inspect/skill/:owner/:id', async (req, res) => {
    try { return res.send(await inspectSkill(req.params.owner, req.params.id)); }
    catch (err) { return res.send(shell('Inspect', ui.empty(`Could not inspect skill/${req.params.owner}/${req.params.id}: ${err.message}`))); }
  });
  router.get('/inspect/:kind/:id', async (req, res) => {
    const { kind, id } = req.params;
    try {
      if (kind === 'capability') return res.send(inspectCapability(id));
      if (kind === 'gate') return res.send(inspectGate(id));
      if (kind === 'tool') return res.send(inspectTool(id));
    } catch (err) {
      return res.send(shell('Inspect', ui.empty(`Could not inspect ${kind}/${id}: ${err.message}`)));
    }
    res.send(shell('Inspect', ui.empty(`Unknown component kind "${kind}".`)));
  });

  // Per-item usage detail for the inspector pages — "where is this used, how
  // often" answered for one specific registry item rather than the rollup.
  async function usageSection(kind, owner, id) {
    const events = (await usage.all())
      .filter((e) => e.kind === kind && e.owner === owner && e.id === id)
      .sort((a, b) => b.ts.localeCompare(a.ts));
    if (!events.length) return html`<h3 class="eng-section">Usage</h3>${ui.empty('Never invoked.')}`;
    const errors = events.filter((e) => e.ok === false).length;
    const table = ui.table(
      ['When', 'Triggered by', 'Result', 'Duration'],
      events.slice(0, 15).map((e) => [
        e.ts.slice(0, 16).replace('T', ' '),
        e.calledBy ? html`${e.calledBy.owner}/${e.calledBy.id} <span class="dim">(${e.calledBy.kind})</span>` : html`<span class="dim">direct</span>`,
        e.ok === false ? ui.badge('error', 'errored') : ui.badge('ok', 'running'),
        e.ms != null ? `${e.ms}ms` : '—',
      ]),
    );
    return html`<h3 class="eng-section">Usage — ${events.length} call${events.length === 1 ? '' : 's'}${errors ? html` · ${errors} error${errors === 1 ? '' : 's'}` : ''}</h3>${table}`;
  }

  async function inspectPersona(owner, id) {
    const { definition: d } = await stores.agents.get(owner, id);
    const skillLinks = (d.skills || []).length
      ? (d.skills || []).map((s) => inspect('skill', s, s))
      : html`<span class="dim">none</span>`;
    const boundsRow = (d.bounds || []).length
      ? (d.bounds || []).join(', ')
      : html`<span class="dim">none set — denied by default. The bounds field is the leash; set it in the composer (planned).</span>`;
    const body = html`
      ${kv([
        ['Kind', html`persona · agent`],
        ['Owner', ui.badge(owner)],
        ['Model', d.model || '—'],
        ['Description', d.description || html`<span class="dim">—</span>`],
        ['Skills', skillLinks],
        ['Tools (bounds)', boundsRow],
        ['Capabilities', html`<span class="dim">per-agent capability wiring not declared yet (planned)</span>`],
        ['Emits', 'reply · skill outputs · usage'],
      ])}
      <h3 class="eng-section">Persona (system prompt)</h3>
      <pre class="eng-source">${d.systemPrompt || '(none)'}</pre>
      ${await usageSection('agent', owner, id)}`;
    return detailPage(d.name || id, 'persona · agent', body);
  }

  async function inspectSkill(owner, id) {
    const { definition: d, module: mod } = await stores.skills.get(owner, id);
    let source = '';
    try { source = await stores.skills.source(owner, id); } catch {}
    const inputsTable = (d.inputs || []).length
      ? ui.table(['Name', 'Type', 'Label'], (d.inputs || []).map((i) => [i.name, i.type || 'string', i.label || '']))
      : ui.empty('No inputs.');
    const tests = Array.isArray(mod.tests) ? mod.tests : [];
    const body = html`
      ${kv([
        ['Kind', 'skill · code function'],
        ['Owner', ui.badge(owner)],
        ['Version', d.version || '—'],
        ['Description', d.description || html`<span class="dim">—</span>`],
        ['Tests', tests.length ? `${tests.length} case(s)` : html`<span class="dim">none</span>`],
      ])}
      <h3 class="eng-section">Inputs</h3>${inputsTable}
      ${tests.length ? html`<h3 class="eng-section">Tests</h3><pre class="eng-source">${JSON.stringify(tests, null, 2)}</pre>` : ''}
      <h3 class="eng-section">Source (code-first)</h3><pre class="eng-source">${source}</pre>
      ${await usageSection('skill', owner, id)}`;
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
