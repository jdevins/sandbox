import { html } from '../lib/html.js';

// App dashboard (overview): launch features + at-a-glance view of the vital
// components (skills, agents, memories) that show how Claude supports the owner.
export async function overviewPage(ctx, req, res) {
  const { ui, page, base, stores, features, provider } = ctx;

  const [skills, agents, memories] = await Promise.all([
    stores.skills.list(),
    stores.agents.list(),
    stores.memories.list(),
  ]);

  const featureCards = ui.grid(
    features.map((f) =>
      ui.card({
        title: html`${f.icon || '🧩'} ${f.name}`,
        badge: f.error ? ui.badge('error', 'errored') : ui.badge('ready', 'running'),
        desc: f.error || f.description,
        actions: ui.btn({ href: `${base}/features/${f.id}`, label: 'Launch ↗', primary: true }),
      }),
    ),
  );

  const stat = (n, label, href) =>
    html`<a class="eng-stat" href="${href}"><span class="num">${n}</span><span class="lab">${label}</span></a>`;

  const body = html`
    ${ui.pageHead({ title: 'Claude Engine', subtitle: meta_subtitle(provider) })}
    <div class="eng-stats">
      ${stat(skills.length, 'Skills', `${base}/features/skill-builder`)}
      ${stat(agents.length, 'Agents', `${base}/features/agent-composer`)}
      ${stat(memories.length, 'Memories', `${base}/memories`)}
    </div>
    <h3 class="eng-section">Features</h3>
    ${features.length ? featureCards : ui.empty('No features found under features/.')}
  `;

  res.send(page({ title: 'Overview', active: 'overview', body }));
}

const meta_subtitle = (provider) =>
  `Code-first authoring & ops · LLM provider: ${provider.name} (${provider.model})`;
