import { html } from '../../../lib/html.js';

// Lesson kit: progressive-disclosure layers. Every lesson is built from three
// depth tiers so a scanner gets the headline and can drill in on demand:
//   core   — always visible; the idea in one screen.
//   deeper — collapsible; mechanism, factors, worked examples.
//   expert — collapsible; enforcement, edge cases, the sharp bits.
// Lessons are NOT chained to one scenario — each tier pulls whatever live
// artifact (Groomer, Builder, Foundry crew) illustrates the point best.

export const core = (content) => html`<div class="lesson-core">${content}</div>`;
export const deeper = (title, content, open = false) => layer('deeper', title || 'Go deeper', content, open);
export const expert = (title, content, open = false) => layer('expert', title || 'Expert', content, open);

function layer(level, title, content, open) {
  return html`<details class="lesson-layer ${level}" ${open ? 'open' : ''}>
    <summary><span class="badge depth">${level}</span> ${title}</summary>
    <div class="lesson-body">${content}</div>
  </details>`;
}

// Included once per rendered page (index or lesson).
export const lessonStyles = html`<style>
  .lesson-core { font-size:0.96em; line-height:1.5; }
  .lesson-core > h2:first-child { margin-top:0; }
  .lesson-layer { margin:12px 0; border:1px solid var(--border,#333); border-left-width:3px;
    border-radius:6px; background:var(--bg2,#1a1a1a); }
  .lesson-layer > summary { cursor:pointer; padding:11px 13px; font-weight:600; list-style:none;
    display:flex; align-items:center; gap:9px; }
  .lesson-layer > summary::-webkit-details-marker { display:none; }
  .lesson-layer > summary::after { content:'▸'; color:var(--muted); margin-left:auto; }
  .lesson-layer[open] > summary::after { content:'▾'; }
  .lesson-layer .lesson-body { padding:2px 15px 14px; }
  .lesson-layer.deeper { border-left-color:#3a6ea5; }
  .lesson-layer.expert { border-left-color:var(--accent,#7c6af7); }
  .badge.depth { font-size:0.66em; text-transform:uppercase; letter-spacing:0.06em; }
  .lesson-layer.deeper .badge.depth { background:#3a6ea5; }
  .lesson-layer.expert .badge.depth { background:var(--accent,#7c6af7); }
  .ladder-num { color:var(--muted); font-variant-numeric:tabular-nums; margin-right:6px; }
</style>`;
