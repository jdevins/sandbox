// Draft 3 of the graphical pitch — Sales Engineer @ defi Solutions.
//
// Different brief from v1/v2: more graphics, fewer words. The diagram is the
// pitch — a radial map of six concerns (spokes) crossed with three levels of
// operation (rings: hands-on → delivery → strategic). Where a concern's line
// reaches, and how far, is the whole argument for "dynamic range"; evidence
// per node lives in an SVG <title> (hover), not printed as body copy.
//
// Honest by construction: a concern only gets a node at a ring if that level
// is actually evidenced in the corpus. Two concerns stop at ring 2 on purpose
// (Compliance & Risk, Training & Enablement) — no strategic-level claim is
// made where none exists yet.

import { html, toHtml, raw } from '../../../../src/lib/html.js';
import { identity } from '../../data/profile.js';
import { versionToggle, TOGGLE_CSS } from './toggle.js';

export const meta = {
  draft: 3,
  createdAt: '2026-07-15',
  label: 'Draft 3',
};

const CX = 320, CY = 320;
const RING_R = { 1: 90, 2: 160, 3: 230 };
const RING_LABEL = { 1: 'Hands-on', 2: 'Delivery', 3: 'Strategic' };

const CONCERNS = [
  {
    label: 'Sales & Demos', angle: -90, range: [1, 3],
    evidence: {
      1: 'Staged and ran the demo floor — DesertMicro',
      2: 'Led the trade-show program, vendor bid/RFP responses',
      3: 'Technical liaison to sales & executive leadership — defi, current',
    },
  },
  {
    label: 'Systems & Integration', angle: -30, range: [1, 3],
    evidence: {
      1: 'REST/SOAP, .NET, microservices — hands-on build',
      2: 'Estimation & implementation planning',
      3: 'Key stakeholder in the platform integration roadmap',
    },
  },
  {
    label: 'Compliance & Risk', angle: 30, range: [1, 2],
    evidence: {
      1: 'KYC/OFAC/AML rules, GLBA/DPPA/FCRA — hands-on across ConsumerInstantID, FraudPoint, RiskView, Point Predictive, Equifax',
      2: 'PCI-DSS payment integrations delivered',
    },
  },
  {
    label: 'Training & Enablement', angle: 90, range: [1, 2],
    evidence: {
      1: 'Technical Trainer III — curriculum delivery',
      2: 'Coached incoming PMs and analysts',
    },
  },
  {
    label: 'Vendor & Partner Relations', angle: 150, range: [2, 3],
    evidence: {
      2: 'Vendor bid & RFP responses',
      3: 'Point of contact for Lexis Nexis, RouteOne, DealerTrack — defi, current',
    },
  },
  {
    label: 'AI & Automation', angle: 210, range: [1, 3],
    evidence: {
      1: 'Built the governance/orchestration code itself',
      2: 'AI-driven loan doc validation, KBA generation — defi',
      3: 'Standards that let the AI itself propose new rules',
    },
  },
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
  const spokes = CONCERNS.map((c) => {
    const [lo, hi] = c.range;
    const segStart = pt(c.angle, RING_R[lo]);
    const segEnd = pt(c.angle, RING_R[hi]);
    const spokeEnd = pt(c.angle, 250);
    const labelPt = pt(c.angle, 268);
    const nodes = [];
    for (let lvl = lo; lvl <= hi; lvl++) nodes.push({ lvl, p: pt(c.angle, RING_R[lvl]), tip: c.evidence[lvl] });
    return { ...c, segStart, segEnd, spokeEnd, labelPt, nodes, anchor: anchorFor(c.angle) };
  });

  return toHtml(html`<!doctype html><html data-theme="dark"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${identity.name} — Sales Engineer, defi Solutions</title>
<style>
  :root {
    --ink: #0E1319; --panel: #161D26; --text: #EDF0F3; --text-soft: #A7B0BA; --text-faint: #5B6572;
    --teal: #2FA6A0; --teal-dim: rgba(47,166,160,0.22); --line: #232C36;
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
  h1.headline { font-size: clamp(1.7rem, 4.4vw, 2.3rem); font-weight: 500; line-height: 1.2; margin: 0.8rem auto 0; max-width: 34ch; color: var(--text); }

  .diagram-wrap { max-width: 660px; margin: 1.5rem auto 0; }
  svg { width: 100%; height: auto; overflow: visible; }
  .ring { fill: none; stroke: var(--line); stroke-width: 1; }
  .spoke-guide { stroke: var(--line); stroke-width: 1; opacity: 0.6; }
  .spoke-label { fill: var(--text-faint); font-family: 'Cascadia Code', 'SF Mono', Consolas, monospace; font-size: 11px; letter-spacing: 0.03em; text-transform: uppercase; }
  .ring-label { fill: var(--text-faint); font-family: 'Cascadia Code', 'SF Mono', Consolas, monospace; font-size: 9.5px; letter-spacing: 0.04em; text-transform: uppercase; }
  .hub circle { fill: var(--panel); stroke: var(--teal); stroke-width: 1.2; }
  .hub text { fill: var(--text); font-family: 'Cascadia Code', 'SF Mono', Consolas, monospace; font-size: 9px; letter-spacing: 0.06em; text-transform: uppercase; }

  .rc-seg { stroke: var(--teal); stroke-width: 2.4; stroke-linecap: round; fill: none; stroke-dasharray: 1; stroke-dashoffset: 0; }
  .rc-node circle { fill: var(--teal); }
  .rc-node.n1 circle { r: 4.5; }
  .rc-node.n2 circle { r: 6; }
  .rc-node.n3 circle { r: 8; fill: var(--teal); filter: drop-shadow(0 0 4px var(--teal-dim)); }
  .rc-node { opacity: 1; transform-box: fill-box; transform-origin: center; }

  .legend { display: flex; justify-content: center; gap: 1.6rem; margin-top: 1.2rem; font-size: 0.76rem; color: var(--text-faint); }
  .legend .dot { display: inline-block; border-radius: 50%; background: var(--teal); margin-right: 0.4rem; vertical-align: middle; }
  .legend .d1 { width: 7px; height: 7px; } .legend .d2 { width: 9px; height: 9px; } .legend .d3 { width: 11px; height: 11px; }

  .signature { margin-top: 2.4rem; font-size: 0.85rem; color: var(--text-faint); }
  .signature .name { color: var(--text-soft); font-weight: 600; }

  @media (prefers-reduced-motion: no-preference) {
    .rc-seg { animation: segIn 0.7s ease both; }
    .rc-node { animation: nodeIn 0.45s ease both; }
    .rc-node.n1 { animation-delay: 0.15s; }
    .rc-node.n2 { animation-delay: 0.55s; }
    .rc-node.n3 { animation-delay: 0.95s; }
    @keyframes segIn { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
    @keyframes nodeIn { from { opacity: 0; transform: scale(0.2); } to { opacity: 1; transform: scale(1); } }
  }

  ${raw(TOGGLE_CSS)}
</style>
</head><body>

${versionToggle({ base, current: 'v3' })}

<div class="doc">
  <span class="eyebrow">Sales Engineer — defi Solutions</span>
  <h1 class="headline display">Six concerns. Three levels. One connected line through each.</h1>

  <div class="diagram-wrap">
    <svg viewBox="0 0 640 640" role="img" aria-label="Diagram of six professional concerns crossed with three levels of operation — hands-on, delivery, and strategic — showing where each concern reaches.">
      <circle class="ring" cx="${CX}" cy="${CY}" r="90"></circle>
      <circle class="ring" cx="${CX}" cy="${CY}" r="160"></circle>
      <circle class="ring" cx="${CX}" cy="${CY}" r="230"></circle>

      <text class="ring-label" x="${CX - 10}" y="234" text-anchor="end">Hands-on</text>
      <text class="ring-label" x="${CX - 10}" y="164" text-anchor="end">Delivery</text>
      <text class="ring-label" x="${CX - 10}" y="94" text-anchor="end">Strategic</text>

      ${spokes.map((s) => html`<line class="spoke-guide" x1="${CX}" y1="${CY}" x2="${s.spokeEnd.x}" y2="${s.spokeEnd.y}"></line>`)}

      ${spokes.map((s) => html`<line class="rc-seg" pathLength="1" x1="${s.segStart.x}" y1="${s.segStart.y}" x2="${s.segEnd.x}" y2="${s.segEnd.y}"></line>`)}

      ${spokes.map((s) => s.nodes.map((n) => html`<g class="rc-node n${n.lvl}"><circle cx="${n.p.x}" cy="${n.p.y}"><title>${s.label} — ${RING_LABEL[n.lvl]}: ${n.tip}</title></circle></g>`))}

      ${spokes.map((s) => html`<text class="spoke-label" x="${s.labelPt.x}" y="${s.labelPt.y}" text-anchor="${s.anchor}">${s.label}</text>`)}

      <g class="hub"><circle cx="${CX}" cy="${CY}" r="26"></circle><text x="${CX}" y="${CY + 3}" text-anchor="middle">JDS</text></g>
    </svg>
  </div>

  <div class="legend">
    <span><span class="dot d1"></span>Hands-on</span>
    <span><span class="dot d2"></span>Delivery</span>
    <span><span class="dot d3"></span>Strategic</span>
  </div>

  <div class="signature">
    <div class="name">${identity.name}</div>
    <div class="mono">${identity.contact.email} · ${identity.contact.phone}</div>
  </div>
</div>
</body></html>`);
}
