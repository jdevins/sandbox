// Draft 2 of the graphical pitch — Sales Engineer @ defi Solutions.
//
// Written on the assumption the actual Chief Sales Officer reads this page —
// not an internal reviewer. Differences from v1, deliberately:
//   - No Home/Corpus/Fit utility nav on the page itself (that's for us, not
//     the reader) — the small version toggle is a later, separate addition,
//     kept deliberately minimal so it reads as UI chrome, not page content
//   - No meta-commentary narrating design decisions ("AI is a theme, not the
//     frame" is a decision we made, not a sentence a reader needs)
//   - No compensation language in the close — the ask is to talk, not a number
// v1 is untouched; this is a sibling draft, not an edit.

import { html, toHtml, raw } from '../../../../src/lib/html.js';
import { identity, roles, wins, engagementBreadth } from '../../data/profile.js';
import { aiPractice } from '../../data/ai-practice.js';
import { versionToggle, TOGGLE_CSS } from './toggle.js';

export const meta = {
  draft: 2,
  createdAt: '2026-07-15',
  label: 'Draft 2',
};

const roleById = (id) => roles.find((r) => r.id === id);
const winById = (id) => wins.find((w) => w.id === id);
const themeById = (id) => aiPractice.themes.find((t) => t.id === id);

export function render({ base }) {
  const defi = roleById('defi-solutions');
  const desertmicro = roleById('desertmicro');
  const systemInnovators = roleById('system-innovators');
  const kent = winById('kent-inovah-launch');
  const docCategory = engagementBreadth.categories.find((c) => c.category === 'Documentation authored');
  const advisoryCategory = engagementBreadth.categories.find((c) => c.category === 'Strategic advisory');
  const aiThemes = ['governance-by-design', 'critical-evaluation', 'swappable-architecture'].map(themeById);

  return toHtml(html`<!doctype html><html data-theme="dark"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${identity.name} — Sales Engineer, defi Solutions</title>
<style>
  :root {
    --ink: #0E1319; --panel: #161D26; --panel-hi: #1C2530;
    --text: #EDF0F3; --text-soft: #A7B0BA; --text-faint: #5B6572;
    --teal: #2FA6A0; --teal-soft: #1E7A75; --slate: #7FA8AF; --line: #232C36;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    background: var(--ink); color: var(--text);
    font-family: 'Seravek', 'Gill Sans MT', 'Gill Sans', 'Segoe UI', 'Trebuchet MS', sans-serif;
    line-height: 1.6; -webkit-font-smoothing: antialiased;
  }
  .display { font-family: 'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', Georgia, serif; text-wrap: balance; }
  .mono { font-family: 'Cascadia Code', 'SF Mono', Consolas, 'Courier New', monospace; }
  .eyebrow { font-family: 'Cascadia Code', 'SF Mono', Consolas, monospace; font-size: 0.72rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--teal); }

  .doc { max-width: 760px; margin: 0 auto; padding: 5.5rem 1.5rem 6rem; }

  header.hero { padding-bottom: 3rem; border-bottom: 1px solid var(--line); margin-bottom: 3rem; }
  header.hero .eyebrow { display: block; margin-bottom: 1.1rem; }
  h1.headline { font-size: clamp(2rem, 5vw, 2.85rem); font-weight: 500; line-height: 1.15; margin: 0 0 1.1rem; color: var(--text); }
  p.subhead { max-width: 58ch; color: var(--text-soft); font-size: 1.08rem; margin: 0; }

  .stat-strip { display: flex; gap: 2.4rem; flex-wrap: wrap; margin-top: 2.2rem; }
  .stat-strip .stat .n { font-family: 'Cascadia Code', 'SF Mono', Consolas, monospace; font-size: 1.4rem; color: var(--teal); font-variant-numeric: tabular-nums; display: block; }
  .stat-strip .stat .l { font-size: 0.76rem; color: var(--text-faint); margin-top: 0.25rem; }

  section.band { padding: 2.6rem 0; border-bottom: 1px solid var(--line); }
  section.band:last-of-type { border-bottom: none; }
  section.band h2 { font-size: 1.35rem; font-weight: 500; margin: 0 0 1.1rem; color: var(--text); }
  section.band .lede { color: var(--text-soft); max-width: 62ch; margin: 0 0 1.3rem; }

  .quote-line { border-left: 2px solid var(--teal); padding: 0.2rem 0 0.2rem 1rem; margin: 1.2rem 0; color: var(--text); font-style: italic; }
  .quote-line .src { display: block; font-style: normal; font-size: 0.76rem; color: var(--text-faint); margin-top: 0.4rem; }

  ul.proof { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.85rem; }
  ul.proof li { padding-left: 1.1rem; position: relative; color: var(--text-soft); }
  ul.proof li::before { content: ''; position: absolute; left: 0; top: 0.55em; width: 6px; height: 6px; border-radius: 50%; background: var(--slate); }
  ul.proof li strong { color: var(--text); font-weight: 600; }

  .pill-row { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.6rem; }
  .pill { border: 1px solid var(--line); border-radius: 999px; padding: 0.3rem 0.75rem; font-size: 0.8rem; color: var(--text-soft); background: var(--panel); }

  .range-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.6rem; margin-top: 0.4rem; }
  .range-grid .col .h { font-size: 0.76rem; color: var(--text-faint); letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 0.5rem; }
  @media (max-width: 620px) { .range-grid { grid-template-columns: 1fr; } .stat-strip { gap: 1.4rem; } }

  .ai-themes { display: flex; flex-direction: column; gap: 0.9rem; }
  .ai-themes .item .t { color: var(--text); font-weight: 600; font-size: 0.94rem; }
  .ai-themes .item .e { color: var(--text-soft); font-size: 0.92rem; margin-top: 0.2rem; }

  .close p { color: var(--text-soft); max-width: 56ch; }
  .signature { margin-top: 1.6rem; }
  .signature .name { color: var(--text); font-weight: 600; }
  .signature .contact { color: var(--text-faint); font-size: 0.85rem; margin-top: 0.2rem; }
  ${raw(TOGGLE_CSS)}
</style>
</head><body>

${versionToggle({ base, current: 'v2' })}

<div class="doc">

  <header class="hero">
    <span class="eyebrow">Sales Engineer — defi Solutions</span>
    <h1 class="headline display">The technical arm of your sales team is already on staff.</h1>
    <p class="subhead">Four years as defi's Lead Integration Engineer. A decade before that as the SME who ran the trade-show floor, the live demo, and the RFP response — just under different titles.</p>

    <div class="stat-strip mono">
      <div class="stat"><span class="n">4</span><span class="l">years at defi, current</span></div>
      <div class="stat"><span class="n">10+</span><span class="l">years integration &amp; delivery</span></div>
      <div class="stat"><span class="n">$1.5–2.5M</span><span class="l">annual bookings led</span></div>
      <div class="stat"><span class="n">2×</span><span class="l">independent sources on RFP work</span></div>
    </div>
  </header>

  <section class="band">
    <h2>Already inside</h2>
    <p class="lede">This isn't an outside hire pitching a resume — it's the engineer who already knows defi's actual lending platform, asking to point that knowledge at the sales floor.</p>
    <div class="quote-line">
      “${defi.highlights[0]}”
      <span class="src">— current role description, Lead Integration Engineer</span>
    </div>
    <ul class="proof">
      <li><strong>SME</strong> for KYC, OFAC, AML, and fraud due diligence — the compliance surface every lender conversation eventually hits.</li>
      <li><strong>Point of contact</strong> for Lexis Nexis vendor relations — ConsumerInstantID, FraudPoint, RiskView, and the rest of the fraud/identity stack prospects ask about by name.</li>
      <li><strong>SME</strong> for document management, eSign, and AI-based classification — the newer capabilities that need a confident demo, not a script.</li>
      <li><strong>Hands-on</strong> across what a demo actually shows — the Carleton lending workflow suite, RouteOne, DealerTrack — not just the systems behind the curtain.</li>
    </ul>
  </section>

  <section class="band">
    <h2>Proof this isn't new</h2>
    <p class="lede">Before defi, four years doing this exact job under a different title.</p>
    <ul class="proof">
      <li><strong>${desertmicro.org}, ${desertmicro.start}–${desertmicro.end}:</strong> SME for sales trade shows and product demos — presales demonstrations, vendor bid and RFP responses, 70% travel.</li>
      <li><strong>City of Kent launch:</strong> ${kent.summary}</li>
      <li><strong>${systemInnovators.org}:</strong> $1.5M–$2.5M in annual professional services bookings led, across concurrent enterprise finance and integration engagements.</li>
    </ul>
  </section>

  <section class="band">
    <h2>Range beyond the title</h2>
    <p class="lede">Not tied to one employer — the breadth that makes a demo credible when the question goes off-script.</p>
    <div class="range-grid">
      <div class="col">
        <div class="h">Documentation authored</div>
        <div class="pill-row">${docCategory.items.slice(0, 5).map((i) => html`<span class="pill">${i}</span>`)}</div>
      </div>
      <div class="col">
        <div class="h">Strategic advisory</div>
        <div class="pill-row">${advisoryCategory.items.slice(0, 5).map((i) => html`<span class="pill">${i}</span>`)}</div>
      </div>
    </div>
  </section>

  <section class="band">
    <h2>Where this goes next</h2>
    <p class="lede">The same habit runs through all of it: don't just use a tool, understand it well enough to govern it.</p>
    <div class="ai-themes">
      ${aiThemes.map((t) => html`<div class="item"><div class="t">${t.label}</div><div class="e">${t.evidence}</div></div>`)}
    </div>
  </section>

  <section class="band close" style="border-bottom:none">
    <h2>Let's talk</h2>
    <p>This is the seat where four years of technical credibility with defi's product finally points outward. I'd like to talk about what that looks like.</p>
    <div class="signature">
      <div class="name">${identity.name}</div>
      <div class="contact mono">${identity.contact.email} · ${identity.contact.phone}</div>
    </div>
  </section>

</div>
</body></html>`);
}
