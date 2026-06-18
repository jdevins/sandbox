import { html } from '../../../lib/html.js';
import { core, deeper, expert } from './kit.js';

export const meta = {
  id: '02-bounds',
  order: 2,
  title: 'Bounds & Tools',
  difficulty: 'core',
  depth: 'core → deeper → expert',
  summary: "An agent's power is its tool list. The smallest list that still does the job is the safest design.",
};

export function body(ctx) {
  const { ui } = ctx;

  const verbToTool = ui.table(
    ['Verb the agent needs', 'Tool it implies', 'Tool to deny'],
    [
      ['read the backlog', 'HTTP GET / file read', 'any write'],
      ['leave feedback', 'append-only annotate endpoint', 'status/claim/approve writes'],
      ['build an item', 'git branch + edit + PR', 'merge, force-push, deploy'],
      ['carry a block (Foundry)', 'pick-up / drop move', 'inspect / declare-done'],
    ],
  );

  const examples = ui.table(
    ['Agent', 'Verbs', 'Bounds that fall out'],
    [
      [html`<strong>Groomer</strong>`, 'read repo, annotate',
        html`Read-only on the repo; <em>append-only</em> on the backlog. Cannot approve, claim, or finish.`],
      [html`<strong>Builder</strong>`, 'claim one, build, open PR',
        html`Branch + PR only. No merge. One item per run. Acts solely on human-approved items.`],
      [html`<strong>Foundry fetcher</strong>`, 'carry blocks',
        html`Can pick up and drop; <em>cannot</em> inspect or declare the mission done — that's the inspector's bound.`],
    ],
  );

  return html`
    ${core(html`
      <h2>Bounds are the design</h2>
      <p>An agent is exactly as powerful as the tools you hand it. So the core question isn't "what can this agent do?" — it's "<strong>what is it not allowed to do, and what stops it?</strong>"</p>
      <ul>
        <li><strong>Least privilege.</strong> Start from zero tools; add only what a verb on the agent's job demands.</li>
        <li><strong>The <code>definition</code> is a contract.</strong> Its model + allowed skills/tools + inputs <em>are</em> the leash.</li>
        <li><strong>Read vs write is the first cut.</strong> Most safety comes free from keeping an agent read-only.</li>
      </ul>`)}

    ${deeper('Deriving the tool list from the verbs', html`
      <p>You already listed the verbs in lesson 01. Each verb implies the <em>minimum</em> tool — and, just as important, what to withhold:</p>
      ${verbToTool}
      <p class="dim">If a verb doesn't appear in the agent's job, its tool shouldn't appear in the definition.</p>`)}

    ${deeper('Same method, different agents', html`
      <p>Bounds aren't one-size — they fall out of each agent's verbs. Three from this repo:</p>
      ${examples}`)}

    ${expert('Soft bounds vs hard bounds — where the leash actually bites', html`
      <p>A prompt that says <em>"only leave feedback, don't change status"</em> is a <strong>request</strong>. Structure that <em>can't</em> do otherwise is a <strong>guarantee</strong>. The backlog enforces bounds in code, not prose:</p>
      <ul>
        <li><code>POST /annotate</code> appends and can only nudge <code>pending → groomed</code> — it has <em>no path</em> to set a claim or approval.</li>
        <li><code>POST /claim</code> is an atomic check-and-set; only <code>ready</code> + human-approved items are claimable, so a second claimer gets a 409.</li>
        <li><code>POST /complete</code> checks <code>by === claim.by</code> — a non-claimer gets a 403.</li>
      </ul>
      <p>The Groomer prompt restating "append-only" is documentation; the endpoint shape is the enforcement. <strong>When they conflict, the structure wins — so put the real bound there.</strong></p>`)}

    ${expert('Capability leakage (read this before scheduling anything)', html`
      <p>The scheduler runs the Builder as <code>claude -p</code> in the repo root — which has full filesystem + git access. A prompt that says "read-only" does <em>not</em> make it so; the tools are still there.</p>
      <ul>
        <li>If you need a genuinely read-only agent, restrict at the <strong>tool/endpoint layer</strong> (give it an API that can only read), not in the prose.</li>
        <li>Gate irreversible power behind something structural — the human-flipped <code>approvedForBuild</code> flag, a branch-only workflow, a tool allowlist.</li>
      </ul>
      <p><strong>Exit check:</strong> for every agent you run, can you name (1) what it must <em>not</em> do, and (2) the mechanism that <em>stops</em> it? If (2) is "the prompt asks nicely," you haven't bounded it yet.</p>`)}`;
}
