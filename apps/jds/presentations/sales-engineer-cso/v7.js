// Draft 7 — fresh take after the v6 miss. Corrections driving this draft:
//   1. First person. This is Jeremy speaking, never "this candidate."
//   2. Steering intel (board mandate, competitor archetypes, blind spots in
//      pitches/…audienceIntel) shapes EMPHASIS only — none of it is printed.
//      The page speaks to demo depth and outclasses an outsider by being deep
//      and broad, never by naming a mandate or a rival.
//   3. The pitch is about Jeremy — his corpus, his sales-adjacent decade, his
//      range fitting the role — not about a mandate and not a me-vs-them page.
//   4. Substance forward: the platform he carries (system-map graphic), the
//      sales-adjacent history + the named demo-prep wins as his own story.
// Honesty holds (see [[feedback_pitch-content-confidence]]): every system,
// win, and claim traces to the corpus; first-person confidence, no invention.

import { html, toHtml, raw } from '../../../../src/lib/html.js';
import { identity, roles, engagementBreadth } from '../../data/profile.js';
import { versionToggle, TOGGLE_CSS } from './toggle.js';

export const meta = { draft: 7, createdAt: '2026-07-15', label: 'Draft 7' };

const defi = roles.find((r) => r.id === 'defi-solutions');
const desertmicro = roles.find((r) => r.id === 'desertmicro');
const eco = defi.platformEcosystem;
const demoWins = defi.internalDemoWork.prospects.map((p) => p.name);
const totalSystems = eco.groups.reduce((n, g) => n + g.items.length, 0);
const totalDomains = eco.groups.length;

// Range lines — his own concerns, each stated as what it brings to the room.
// First person, corpus-grounded; no comparison to anyone.
const RANGE = [
  { area: 'Compliance & risk', line: 'I implement the KYC, AML, and fraud rules — I don’t just cite them.' },
  { area: 'Vendor & partner relations', line: 'I’m the point of contact, so I know what we can actually promise.' },
  { area: 'Training & enablement', line: 'I’ve built the curriculum and coached the team through it.' },
  { area: 'Integration & architecture', line: 'The platform under the demo is, quite literally, my day job.' },
  { area: 'AI & automation', line: 'I build the governed systems — I’m not just running the tools.' },
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

  .doc { max-width:820px; margin:0 auto; padding:6rem 1.5rem 6rem; }
  section { padding:3.4rem 0; border-top:1px solid var(--line); }
  section:first-of-type { border-top:none; padding-top:0; }

  header .eyebrow { display:block; margin-bottom:1.4rem; }
  h1 { font-size:clamp(2.1rem,5.4vw,3.15rem); font-weight:500; line-height:1.13; margin:0 0 1.4rem; letter-spacing:-0.01em; }
  h1 .lift { color:var(--teal); }
  .subhead { max-width:56ch; color:var(--text-soft); font-size:1.12rem; margin:0; }

  .stat-row { display:flex; gap:2.6rem; flex-wrap:wrap; margin-top:2.4rem; }
  .stat .n { font-family:'Cascadia Code',monospace; font-size:1.9rem; color:var(--teal); font-variant-numeric:tabular-nums; line-height:1; }
  .stat .l { font-size:0.76rem; color:var(--text-faint); margin-top:0.45rem; max-width:16ch; }

  h2 { font-size:0.78rem; font-weight:600; letter-spacing:0.12em; text-transform:uppercase; color:var(--text-faint); margin:0 0 1.1rem; }
  .statement { font-size:clamp(1.35rem,3.2vw,1.8rem); font-weight:500; line-height:1.3; margin:0; max-width:30ch; }
  .say { color:var(--text-soft); font-size:1.04rem; max-width:60ch; margin:1.1rem 0 0; }

  /* system-map */
  .map { margin-top:1.8rem; display:flex; flex-direction:column; gap:1.1rem; }
  .grp .glabel { font-family:'Cascadia Code',monospace; font-size:0.68rem; letter-spacing:0.08em; text-transform:uppercase; color:var(--text-faint); margin-bottom:0.5rem; display:flex; align-items:center; gap:0.5rem; }
  .grp .glabel::before { content:''; width:8px; height:8px; border-radius:2px; background:var(--teal); flex:none; }
  .tiles { display:flex; flex-wrap:wrap; gap:0.4rem; }
  .tile { font-size:0.8rem; color:var(--text-soft); background:var(--panel); border:1px solid var(--line); border-radius:5px; padding:0.34rem 0.6rem; }
  .tile.deck { color:var(--text-faint); border-style:dashed; }
  .map-cap { color:var(--text-faint); font-size:0.92rem; margin-top:1.3rem; max-width:58ch; }

  /* proof lists */
  ul.proof { list-style:none; margin:1.4rem 0 0; padding:0; display:flex; flex-direction:column; gap:0.9rem; }
  ul.proof li { padding-left:1.2rem; position:relative; color:var(--text-soft); max-width:64ch; }
  ul.proof li::before { content:''; position:absolute; left:0; top:0.55em; width:6px; height:6px; border-radius:50%; background:var(--teal); }
  ul.proof li strong { color:var(--text); font-weight:600; }
  .wins-line { color:var(--text); font-weight:600; }

  /* range */
  .range { margin-top:1.4rem; display:flex; flex-direction:column; }
  .range .r { display:grid; grid-template-columns:14rem 1fr; gap:1rem; padding:0.85rem 0; border-top:1px solid var(--line); }
  .range .r:first-child { border-top:none; }
  .range .a { color:var(--teal); font-size:0.92rem; font-weight:600; }
  .range .d { color:var(--text-soft); }
  @media (max-width:600px){ .range .r { grid-template-columns:1fr; gap:0.15rem; } }

  .close .statement { margin-bottom:1.3rem; }
  .sig { margin-top:1.8rem; }
  .sig .name { color:var(--text); font-weight:600; }
  .sig .c { color:var(--text-faint); font-size:0.85rem; margin-top:0.2rem; }

  ${raw(TOGGLE_CSS)}
</style>
</head><body>

${versionToggle({ base, current: 'v7' })}

<div class="doc">

  <header>
    <span class="eyebrow">Sales Engineer — defi Solutions</span>
    <h1 class="display">I already speak our platform fluently. Put me in front of the people deciding whether to <span class="lift">buy it.</span></h1>
    <p class="subhead">Four years as defi's Lead Integration Engineer. A decade before that turning complex systems into demos that land. I want to bring both to your sales floor.</p>
    <div class="stat-row mono">
      <div class="stat"><div class="n">${totalSystems}</div><div class="l">integrations I work across today</div></div>
      <div class="stat"><div class="n">${totalDomains}</div><div class="l">domains, from origination to funding</div></div>
      <div class="stat"><div class="n">10+</div><div class="l">years as the technical half of the sell</div></div>
    </div>
  </header>

  <section>
    <h2>The platform I already carry</h2>
    <p class="statement">Every system a demo has to speak to — I work across them now, not after onboarding.</p>
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
    <p class="map-cap">When a prospect asks what happens at the KYC step, or how a loan boards into funding, I answer from the seat where I built it — not from a slide.</p>
  </section>

  <section>
    <h2>Sales-adjacent isn't new for me</h2>
    <p class="statement">I've been the technical half of the sell for more than a decade.</p>
    <ul class="proof">
      <li><strong>${desertmicro.org}, ${desertmicro.start}–${desertmicro.end}:</strong> ran trade-show demos, presales, and RFP responses as the product SME — 70% on the road, in front of clients.</li>
      <li><strong>Already here at defi:</strong> I scoped the integrations and readied the demos behind wins the sales team booked — <span class="wins-line">${demoWins.join(', ')}</span>. The half of the win the room never sees.</li>
    </ul>
  </section>

  <section>
    <h2>Range the room rewards</h2>
    <p class="statement">The question that goes off-script is the one that decides the deal. I've sat in most of the rooms it comes from.</p>
    <div class="range">
      ${RANGE.map((r) => html`<div class="r"><div class="a">${r.area}</div><div class="d">${r.line}</div></div>`)}
    </div>
  </section>

  <section class="close">
    <h2>Let's talk</h2>
    <p class="statement">I'm already inside, already trusted, already doing half this job without the title.</p>
    <p class="say">Give me fifteen minutes and I'll show you what the other half looks like.</p>
    <div class="sig">
      <div class="name">${identity.name}</div>
      <div class="c mono">${identity.contact.email} · ${identity.contact.phone}</div>
    </div>
  </section>

</div>
</body></html>`);
}
