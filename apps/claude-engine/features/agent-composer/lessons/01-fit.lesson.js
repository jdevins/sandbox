import { html } from '../../../lib/html.js';
import { core, deeper, expert } from './kit.js';

export const meta = {
  id: '01-fit',
  order: 1,
  title: 'Problem → Agent Fit',
  difficulty: 'foundational',
  depth: 'core → deeper → expert',
  summary: 'How to stare at a problem and decide what agents — if any — it needs.',
};

export function body(ctx) {
  const { ui, base } = ctx;

  const factors = ui.table(
    ['Factor', 'The question', 'What it sways'],
    [
      [html`<strong>Determinism</strong>`, 'Could a plain function do this reliably?',
        html`Fixed inputs→outputs → write a <em>function</em>. Agents earn the name only when judgment varies per case.`],
      [html`<strong>Read vs write</strong>`, 'Does it change the world or just observe it?',
        html`The biggest safety lever. Read-only → an <em>annotator</em>. Writes/deletes/ships → a separate, bounded <em>worker</em>.`],
      [html`<strong>Reversibility</strong>`, 'How hard is a mistake to undo?',
        html`One-way doors (migrations, public APIs, deletes, money) → narrow tools + a human gate before it acts.`],
      [html`<strong>Frequency × cost</strong>`, 'How often, how expensive per run?',
        html`Cheap+frequent → schedule loose. Expensive+rare → gate it. Drives cadence and model choice.`],
      [html`<strong>Coordination</strong>`, 'Does it need others to hand off?',
        html`One agent until proven otherwise. Orchestrate only on real hand-offs (see the Foundry crew).`],
    ],
  );

  return html`
    ${core(html`
      <h2>Does it even need an agent?</h2>
      <p class="dim">Most "make an agent" requests are three smaller things wearing one coat:</p>
      <ul>
        <li><strong>A function</strong> — deterministic transform. Just write it.</li>
        <li><strong>A scheduled prompt</strong> — same instruction on a cadence (this repo runs <code>claude -p</code> against a prompt file). Powerful, but it's a prompt, not an identity.</li>
        <li><strong>A true agent</strong> — an open-ended goal where judgment varies, it picks tools/steps, and it can explain itself.</li>
      </ul>
      <p><strong>The two moves that solve most fits:</strong> collapse read-only lenses that never disagree into <em>one</em> agent wearing several hats; carve anything that writes into its <em>own</em> gated agent.</p>`)}

    ${deeper('The factors that sway the decision', factors)}

    ${deeper('Finding the agents in a problem — 5 moves', html`
      <ol>
        <li><strong>List the verbs.</strong> e.g. <em>estimate, flag risks, challenge, build.</em></li>
        <li><strong>Tag each verb:</strong> reads or writes? blast radius? cadence?</li>
        <li><strong>Group by shape.</strong> Same tags = one agent, often the same agent in different "hats."</li>
        <li><strong>Split on the write boundary.</strong> Writers/irreversible work get their own tighter-leashed agent.</li>
        <li><strong>Add an orchestrator last</strong> — only if agents must hand work to each other.</li>
      </ol>`)}

    ${deeper('Worked example (one of many): the backlog', html`
      <p>Ask: estimate items, source one-way doors, challenge usefulness, build the winners — sounds like 4–5 agents. Run the moves:</p>
      <ul>
        <li><em>estimate / flag / challenge</em> are all read-only, cheap, frequent → collapse to one <strong>Groomer</strong> with three hats.</li>
        <li><em>build</em> is write, expensive, irreversible → stands alone as the gated <strong>Builder</strong>.</li>
        <li>No hand-off — the human approval gate is the seam. Result: <strong>two agents, not five.</strong></li>
      </ul>
      <p class="dim">Apply the same moves to a different problem and you get a different shape — the Foundry's build task yields a <em>crew</em> (foreman→fetcher→builder→inspector). The method is fixed; the scenario isn't.</p>`)}

    ${expert('What goes in the agent file', html`
      ${ui.table(
        ['Part', 'Holds', 'Fit principle'],
        [
          [html`<code>definition</code>`, 'id, role, model, allowed skills/tools, inputs', html`The agent's <strong>bounds</strong>. Shortest tool list that still works = safest.`],
          [html`<code>run()</code> / <code>decide()</code>`, 'the policy: one decision per call', html`Return <code>{ action, rationale }</code>. Keep state out — pass via <code>ctx</code> so restart rebuilds clean.`],
          [html`<code>rationale</code>`, 'why it chose this', html`Always emit it. An agent you can't audit can't run unattended.`],
          [html`<code>tests</code>`, 'pinned input → expected behavior', html`Pin the policy so a prompt tweak can't silently drift.`],
        ],
      )}`)}

    ${expert('Smells that mean you got the fit wrong', html`
      <ul>
        <li>One mega-agent with a 10-step prompt → split on the write boundary.</li>
        <li>Several agents that read the same thing and never disagree → collapse to one with multiple lenses.</li>
        <li>An agent that writes irreversibly on a schedule with no human in the loop → add the gate.</li>
        <li>You can't name what an agent is <em>not</em> allowed to do → its bounds are undefined.</li>
      </ul>
      <p>Next rung builds on that last line. ${ui.btn({ href: `${base}/learn/02-bounds`, label: 'Bounds & tools →' })}</p>`)}`;
}
