// Draft 9 — tone and structure correction after v8. Direct feedback:
//   - Value-seeking framing swapped for capability framing: each capability
//     phrased as a transformation ("From X → Y") plus a gerund-led byline —
//     e.g. "From Demo Concept to Product Roadmap" / "Capturing and
//     converting sales conversations to buildable requirements for product
//     pipeline." That pattern is now the page's primary structural device
//     (the capability-arc grid), not a one-off section.
//   - No employer/date citations leading sentences ("DesertMicro, 2012–2016:
//     ...", "Already here at defi: ..."). Focus is what was done, not where.
//   - "Reads like a journal of blog posts" — broken up structurally: the
//     capability-arc grid, the tag row, and the system-map are three visually
//     distinct devices in sequence, not four stacked h2+paragraph+list blocks.
// Honesty holds: every capability still traces to the corpus; phrasing is
// tone only, nothing new claimed.

import { html, toHtml, raw } from '../../../../src/lib/html.js';
import { identity, roles } from '../../data/profile.js';
import { versionToggle, TOGGLE_CSS } from './toggle.js';

export const meta = { draft: 9, createdAt: '2026-07-15', label: 'Draft 9' };

const defi = roles.find((r) => r.id === 'defi-solutions');
const eco = defi.platformEcosystem;
const demoWins = defi.internalDemoWork.prospects.map((p) => p.name);

const SALES_SUPPORT = ['Demos (in-person, remote)', 'Trade shows', 'RFP responses', 'Intakes (scoping)'];

// The requested pattern, generalized: every capability as a transformation
// arc plus a gerund-led byline. Product Management is one card among equals,
// not a standalone section anymore.
const ARCS = [
  {
    from: 'Demo Concept', to: 'Product Roadmap',
    byline: 'Capturing and converting sales conversations into buildable requirements for the product pipeline.',
  },
  {
    from: 'Scoping Call', to: 'Working Demo',
    byline: 'Translating intake and RFP requirements into demos that hold up under technical follow-up.',
  },
  {
    from: 'Compliance Rule', to: 'Live Integration',
    byline: 'Implementing KYC, AML, and fraud rules as working integrations, not slideware.',
  },
  {
    from: 'Vendor Relationship', to: 'Confident Answer',
    byline: 'Owning vendor connections well enough to know what can actually be promised in the room.',
  },
];

// Range bylines — gerund-led capability phrasing, no employer citations.
const RANGE = [
  { area: 'Compliance & risk', line: 'Implementing KYC, AML, and fraud rules as working integrations.' },
  { area: 'Vendor & partner relations', line: 'Owning vendor relationships well enough to know what’s promisable.' },
  { area: 'Training & enablement', line: 'Building curriculum and coaching teams through adoption.' },
  { area: 'Integration & architecture', line: 'Contributing as a key stakeholder in the platform’s integration roadmap.' },
  { area: 'AI & automation', line: 'Building governed systems, not just running the tools.' },
];

export function render({ base }) {
  return toHtml(html`<!doctype html><html data-theme="dark"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${identity.name} — Sales Engineer, defi Solutions</title>
<style>
  :root {
    --ink:#0E1319; --panel:#161D26; --panel-hi:#1C2530; --text:#EDF0F3; --text-soft:#A7B0BA; --text-faint:#5B6572;
    --teal:#2FA6A0; --teal-dim:rgba(47,166,160,0.10); --teal-soft:#1E7A75; --slate:#7FA8AF; --line:#232C36;
  }
  * { box-sizing:border-box; }
  html,body { margin:0; padding:0; }
  body { background:var(--ink); color:var(--text); font-family:'Seravek','Gill Sans MT','Gill Sans','Segoe UI',sans-serif; line-height:1.55; -webkit-font-smoothing:antialiased; }
  .display { font-family:'Iowan Old Style','Palatino Linotype','Book Antiqua',Georgia,serif; text-wrap:balance; }
  .mono { font-family:'Cascadia Code','SF Mono',Consolas,monospace; }
  .eyebrow { font-family:'Cascadia Code','SF Mono',Consolas,monospace; font-size:0.72rem; letter-spacing:0.16em; text-transform:uppercase; color:var(--teal); }

  .doc { max-width:840px; margin:0 auto; padding:6rem 1.5rem 6rem; }
  section { padding:3.2rem 0; border-top:1px solid var(--line); }
  section:first-of-type { border-top:none; padding-top:0; }

  header .eyebrow { display:block; margin-bottom:1.4rem; }
  h1 { font-size:clamp(2.1rem,5.4vw,3.1rem); font-weight:500; line-height:1.13; margin:0 0 1.4rem; letter-spacing:-0.01em; }
  h1 .lift { color:var(--teal); }
  .subhead { max-width:56ch; color:var(--text-soft); font-size:1.12rem; margin:0; }

  .quote { padding:2.4rem 0; border-top:1px solid var(--line); text-align:center; }
  .quote blockquote { margin:0; font-family:'Iowan Old Style','Palatino Linotype','Book Antiqua',Georgia,serif; font-size:clamp(1.5rem,4vw,2.1rem); font-style:italic; color:var(--teal); line-height:1.3; }

  h2 { font-size:0.72rem; font-weight:600; letter-spacing:0.14em; text-transform:uppercase; color:var(--text-faint); margin:0 0 1.1rem; }

  /* tag row — sales support */
  .tag-row { display:flex; flex-wrap:wrap; gap:0.6rem; }
  .tag { font-size:0.86rem; color:var(--text); background:var(--panel-hi); border:1px solid var(--teal-soft); border-radius:999px; padding:0.4rem 0.9rem; }
  .readiness { margin-top:1.2rem; font-size:0.84rem; color:var(--text-faint); }
  .readiness b { color:var(--text-soft); font-weight:600; }

  /* capability-arc grid — the structural centerpiece */
  .arc-grid { display:grid; grid-template-columns:1fr 1fr; gap:1rem; }
  .arc-card { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:1.5rem 1.4rem; }
  .arc-card .arc { font-family:'Iowan Old Style','Palatino Linotype',Georgia,serif; font-size:1.18rem; color:var(--text); line-height:1.3; margin-bottom:0.7rem; }
  .arc-card .arc .arrow { color:var(--teal); padding:0 0.3rem; }
  .arc-card .by { color:var(--text-soft); font-size:0.9rem; line-height:1.5; }
  @media (max-width:620px){ .arc-grid { grid-template-columns:1fr; } }

  /* system-map */
  .map { display:flex; flex-direction:column; gap:1rem; }
  .grp .glabel { font-family:'Cascadia Code',monospace; font-size:0.66rem; letter-spacing:0.08em; text-transform:uppercase; color:var(--text-faint); margin-bottom:0.5rem; display:flex; align-items:center; gap:0.5rem; }
  .grp .glabel::before { content:''; width:8px; height:8px; border-radius:2px; background:var(--teal); flex:none; }
  .tiles { display:flex; flex-wrap:wrap; gap:0.4rem; }
  .tile { font-size:0.8rem; color:var(--text-soft); background:var(--panel); border:1px solid var(--line); border-radius:5px; padding:0.34rem 0.6rem; }
  .tile.deck { color:var(--text-faint); border-style:dashed; }
  .map-cap { color:var(--text-faint); font-size:0.9rem; margin-top:1.1rem; max-width:58ch; }

  /* range */
  .range .r { display:grid; grid-template-columns:13rem 1fr; gap:1rem; padding:0.8rem 0; border-top:1px solid var(--line); }
  .range .r:first-child { border-top:none; }
  .range .a { color:var(--teal); font-size:0.9rem; font-weight:600; }
  .range .d { color:var(--text-soft); }
  @media (max-width:600px){ .range .r { grid-template-columns:1fr; gap:0.15rem; } }

  .close p.statement { font-size:clamp(1.35rem,3.2vw,1.7rem); font-weight:500; line-height:1.3; margin:0 0 1rem; max-width:34ch; }
  .close p.say { color:var(--text-soft); font-size:1.02rem; max-width:56ch; margin:0; }
  .sig { margin-top:1.7rem; }
  .sig .name { color:var(--text); font-weight:600; }
  .sig .c { color:var(--text-faint); font-size:0.85rem; margin-top:0.2rem; }

  ${raw(TOGGLE_CSS)}
</style>
</head><body>

${versionToggle({ base, current: 'v9' })}

<div class="doc">

  <header>
    <span class="eyebrow">Sales Engineer — defi Solutions</span>
    <h1 class="display">I already speak our platform fluently. Put me in front of the people deciding whether to <span class="lift">buy it.</span></h1>
    <p class="subhead">A decade turning complex systems and sales conversations into demos, requirements, and product direction that ship.</p>
  </header>

  <div class="quote">
    <blockquote>“The platform under the demo is my day job.”</blockquote>
  </div>

  <section>
    <h2>10+ years supporting sales</h2>
    <div class="tag-row">${SALES_SUPPORT.map((t) => html`<span class="tag">${t}</span>`)}</div>
    <div class="readiness"><b>Recent readiness:</b> ${demoWins.join(' · ')}</div>
  </section>

  <section>
    <h2>Capabilities, as transformations</h2>
    <div class="arc-grid">
      ${ARCS.map((a) => html`<div class="arc-card">
        <div class="arc">${a.from}<span class="arrow">→</span>${a.to}</div>
        <div class="by">${a.byline}</div>
      </div>`)}
    </div>
  </section>

  <section>
    <h2>The platform I already carry</h2>
    <div class="map">
      ${eco.groups.map((g) => html`<div class="grp">
        <div class="glabel">${g.group}</div>
        <div class="tiles">${g.items.map((i) => html`<span class="tile">${i}</span>`)}</div>
      </div>`)}
      <div class="grp">
        <div class="glabel">Arriving</div>
        <div class="tiles">${eco.pending.map((p) => html`<span class="tile deck">${p.item}</span>`)}</div>
      </div>
    </div>
    <p class="map-cap">When a prospect asks what happens at the KYC step, or how a loan boards into funding, the answer comes from the seat where it was built — not from a slide.</p>
  </section>

  <section>
    <h2>Range the room rewards</h2>
    <div class="range">
      ${RANGE.map((r) => html`<div class="r"><div class="a">${r.area}</div><div class="d">${r.line}</div></div>`)}
    </div>
  </section>

  <section class="close">
    <h2>Let's talk</h2>
    <p class="statement">Already inside. Already trusted. Already doing half this job without the title.</p>
    <p class="say">Fifteen minutes shows you the other half.</p>
    <div class="sig">
      <div class="name">${identity.name}</div>
      <div class="c mono">${identity.contact.email} · ${identity.contact.phone}</div>
    </div>
  </section>

</div>
</body></html>`);
}
