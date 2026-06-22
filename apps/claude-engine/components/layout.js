import { html, toHtml } from '../lib/html.js';

const BASE = '/apps/claude-engine';

// App-local page shell. Uses the SHARED theme (dark.css) for visual consistency
// plus the engine's OWN component stylesheet — components are not shared across apps.
export function page({ title, active = '', breadcrumb = [], body }) {
  const nav = [
    { href: `${BASE}/`, label: 'Overview', key: 'overview' },
    { href: `${BASE}/features/skill-builder`, label: 'Skills', key: 'skill-builder' },
    { href: `${BASE}/features/agent-composer`, label: 'Agents', key: 'agent-composer' },
    { href: `${BASE}/features/command-center`, label: 'Command Center', key: 'command-center' },
    { href: `${BASE}/memories`, label: 'Memories', key: 'memories' },
  ];
  const crumbs = [{ href: '/', label: 'Server' }, { href: `${BASE}/`, label: 'Claude Engine' }, ...breadcrumb];

  return toHtml(html`<!doctype html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} · Claude Engine</title>
  <link rel="stylesheet" href="/static/css/dark.css" />
  <link rel="stylesheet" href="${BASE}/assets/engine.css" />
</head>
<body>
  <aside class="eng-side">
    <div class="eng-brand">⚙️ Claude Engine</div>
    <nav>
      ${nav.map(
        (n) => html`<a class="eng-nav ${active === n.key ? 'on' : ''}" href="${n.href}">${n.label}</a>`,
      )}
    </nav>
    <div class="eng-side-foot"><a href="/">← All apps</a></div>
  </aside>
  <main class="eng-main">
    <div class="eng-crumbs">
      ${crumbs.map((c, i) => html`${i ? html`<span class="sep">/</span>` : ''}<a href="${c.href}">${c.label}</a>`)}
    </div>
    ${body}
  </main>
  <div class="toast" id="toast"></div>
  <script src="${BASE}/assets/engine.js"></script>
</body>
</html>`);
}
