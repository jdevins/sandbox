// Draft 4 of the graphical pitch — Sales Engineer @ defi Solutions.
//
// Simpler graphic language than v3: no rings/levels, just a hub-and-spoke web
// with the person literally at the center. Six concerns radiate out as spokes;
// a handful of edges connect concern to concern directly, each edge grounded
// in a real link from the corpus (not decorative) — the web is the argument
// for "connects across concerns," spokes alone would only show reach, not
// connection.

import { html, toHtml, raw } from '../../../../src/lib/html.js';
import { identity } from '../../data/profile.js';
import { versionToggle, TOGGLE_CSS } from './toggle.js';

export const meta = {
  draft: 4,
  createdAt: '2026-07-15',
  label: 'Draft 4',
};

const CX = 320, CY = 320, R = 210, HUB_R = 46;

const CONCERNS = [
  { label: 'Sales & Demos', tip: 'Trade-show demos, RFP responses, technical liaison to defi’s sales team — 10+ years.' },
  { label: 'Systems & Integration', tip: 'REST/SOAP, .NET, cloud integration — hands-on through platform roadmap ownership.' },
  { label: 'Compliance & Risk', tip: 'KYC/OFAC/AML rules, hands-on across ConsumerInstantID, FraudPoint, RiskView, Point Predictive, Equifax, and PCI-DSS payment integrations.' },
  { label: 'Training & Enablement', tip: 'Curriculum delivery and coaching incoming PMs and analysts.' },
  { label: 'Vendor & Partner Relations', tip: 'RFP/bid responses and current point of contact for Lexis Nexis, RouteOne, and DealerTrack.' },
  { label: 'AI & Automation', tip: 'Built AI-governed systems and shipped AI-driven loan doc validation at defi.' },
];

// Index pairs into CONCERNS — each a real link, not a decorative one.
const WEB_EDGES = [
  [0, 5, 'AI-driven capabilities feed directly into demos and RFP responses.'],
  [0, 4, 'Vendor relationships shape what gets promised in the sales conversation.'],
  [1, 2, 'Integration work is how compliance rules actually get implemented.'],
  [1, 5, 'AI features ship on top of the integration platform, not beside it.'],
  [3, 0, 'Enablement exists to put the sales floor in front of a working demo.'],
  [4, 2, 'The vendor relationship in question is a compliance data provider.'],
];

const pt = (angleDeg, r) => {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: +(CX + r * Math.cos(rad)).toFixed(1), y: +(CY + r * Math.sin(rad)).toFixed(1) };
};
const anchorFor = (angleDeg) => {
  const c = Math.cos((angleDeg * Math.PI) / 180);
  return c > 0.3 ? 'start' : c < -0.3 ? 'end' : 'middle';
};

export function render({ base }) {
  const nodes = CONCERNS.map((c, i) => {
    const angle = -90 + (360 / CONCERNS.length) * i;
    return { ...c, angle, p: pt(angle, R), labelPt: pt(angle, R + 28), anchor: anchorFor(angle) };
  });
  const edges = WEB_EDGES.map(([a, b, tip]) => ({ a: nodes[a], b: nodes[b], tip }));

  return toHtml(html`<!doctype html><html data-theme="dark"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${identity.name} — Sales Engineer, defi Solutions</title>
<style>
  :root {
    --ink: #0E1319; --panel: #161D26; --text: #EDF0F3; --text-soft: #A7B0BA; --text-faint: #5B6572;
    --teal: #2FA6A0; --teal-dim: rgba(47,166,160,0.35); --web: #3D5A63; --line: #232C36;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    background: var(--ink); color: var(--text);
    font-family: 'Seravek', 'Gill Sans MT', 'Gill Sans', 'Segoe UI', 'Trebuchet MS', sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .display { font-family: 'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', Georgia, serif; text-wrap: balance; }
  .mono { font-family: 'Cascadia Code', 'SF Mono', Consolas, 'Courier New', monospace; }
  .eyebrow { font-family: 'Cascadia Code', 'SF Mono', Consolas, monospace; font-size: 0.72rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--teal); }

  .doc { max-width: 780px; margin: 0 auto; padding: 4rem 1.5rem 3rem; text-align: center; }
  h1.headline { font-size: clamp(1.7rem, 4.4vw, 2.3rem); font-weight: 500; line-height: 1.2; margin: 0.8rem auto 0; max-width: 32ch; color: var(--text); }

  .diagram-wrap { max-width: 660px; margin: 1.5rem auto 0; }
  svg { width: 100%; height: auto; overflow: visible; }

  .web-edge { stroke: var(--web); stroke-width: 1.2; fill: none; stroke-dasharray: 1; stroke-dashoffset: 0; }
  .spoke { stroke: var(--teal); stroke-width: 1.6; fill: none; opacity: 0.75; stroke-dasharray: 1; stroke-dashoffset: 0; }
  .node circle { fill: var(--teal); r: 7; }
  .node:hover circle { filter: drop-shadow(0 0 6px var(--teal-dim)); }
  .node-label { fill: var(--text-soft); font-family: 'Cascadia Code', 'SF Mono', Consolas, monospace; font-size: 11px; letter-spacing: 0.03em; text-transform: uppercase; }
  .hub circle { fill: var(--panel); stroke: var(--teal); stroke-width: 1.4; }
  .hub text { fill: var(--text); font-family: 'Iowan Old Style', 'Palatino Linotype', Georgia, serif; font-size: 20px; }

  .node, .spoke, .web-edge { opacity: 1; transform-box: fill-box; transform-origin: center; }

  .signature { margin-top: 2.2rem; font-size: 0.85rem; color: var(--text-faint); }
  .signature .name { color: var(--text-soft); font-weight: 600; }

  @media (prefers-reduced-motion: no-preference) {
    .spoke { animation: drawIn 0.6s ease both; }
    .node { animation: nodeIn 0.4s ease both; animation-delay: 0.5s; }
    .web-edge { animation: drawIn 0.7s ease both; animation-delay: 1s; opacity: 0.7; }
    @keyframes drawIn { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
    @keyframes nodeIn { from { opacity: 0; transform: scale(0.2); } to { opacity: 1; transform: scale(1); } }
  }

  ${raw(TOGGLE_CSS)}
</style>
</head><body>

${versionToggle({ base, current: 'v4' })}

<div class="doc">
  <span class="eyebrow">Sales Engineer — defi Solutions</span>
  <h1 class="headline display">Not six lanes. One person, connected to all of them.</h1>

  <div class="diagram-wrap">
    <svg viewBox="0 0 640 640" role="img" aria-label="Web diagram: Jeremy at the center, connected by spokes to six professional concerns, with direct connections between related concerns.">
      ${nodes.map((n) => html`<line class="spoke" pathLength="1" x1="${CX}" y1="${CY}" x2="${n.p.x}" y2="${n.p.y}"></line>`)}
      ${edges.map((e) => html`<line class="web-edge" pathLength="1" x1="${e.a.p.x}" y1="${e.a.p.y}" x2="${e.b.p.x}" y2="${e.b.p.y}"><title>${e.a.label} ↔ ${e.b.label}: ${e.tip}</title></line>`)}

      <g class="hub"><circle cx="${CX}" cy="${CY}" r="${HUB_R}"></circle><text x="${CX}" y="${CY + 7}" text-anchor="middle">JS</text></g>

      ${nodes.map((n) => html`<g class="node"><circle cx="${n.p.x}" cy="${n.p.y}"><title>${n.label}: ${n.tip}</title></circle></g>`)}
      ${nodes.map((n) => html`<text class="node-label" x="${n.labelPt.x}" y="${n.labelPt.y}" text-anchor="${n.anchor}">${n.label}</text>`)}
    </svg>
  </div>

  <div class="signature">
    <div class="name">${identity.name}</div>
    <div class="mono">${identity.contact.email} · ${identity.contact.phone}</div>
  </div>
</div>
</body></html>`);
}
