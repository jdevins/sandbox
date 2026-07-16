// Shared version-toggle markup for every draft page. Kept as one function so
// the anchor logic (active state, href shape) can't drift between drafts —
// each presentation still owns its own CSS for how the toggle looks.
import { html } from '../../../../src/lib/html.js';
import { VERSIONS } from './versions.js';

export function versionToggle({ base, current }) {
  return html`<div class="version-toggle mono">
    ${VERSIONS.map((v) => html`<a class="${v === current ? 'active' : ''}" href="${base}/pitch/sales-engineer-cso/${v}">${v}</a>`)}
  </div>`;
}

// Shared CSS block — same visual language across drafts, low-key by design
// (small, corner-anchored) so it reads as a UI affordance, not page content.
export const TOGGLE_CSS = `
  .version-toggle { position: fixed; top: 1rem; right: 1.5rem; display: flex; gap: 0.5rem; z-index: 10; }
  .version-toggle a { color: var(--text-faint); text-decoration: none; font-size: 0.78rem; padding: 0.2rem 0.45rem; border-radius: 4px; }
  .version-toggle a:hover { color: var(--text-soft); background: var(--panel); }
  .version-toggle a.active { color: var(--teal); font-weight: 600; }
`;
