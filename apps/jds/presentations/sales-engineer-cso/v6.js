// Draft 6 — the executive take. Fresh brief:
//   - Present for executive-level impact: few words, big statements, two
//     visuals doing the argumentative work instead of prose.
//   - Aimed squarely at the actual reader (a hands-off CSO with a board
//     mandate to solidify the demo environments), against real competition
//     archetypes. See ../../data/pitches/sales-engineer-cso.js audienceIntel.
//   - Two power moves the CSO doesn't yet know: (1) the named internal demo
//     wins Jeremy already prepped (Navy Federal, Landmark, M&T Bank, PenFed),
//     (2) a coverage matrix that makes the hiring decision legible — and
//     concedes, honestly, the two rows Jeremy doesn't own.
// Honesty rule holds (see [[feedback_pitch-content-confidence]]): confident,
// not invented; the matrix's conceded rows are the proof of that.

import { html, toHtml, raw } from '../../../../src/lib/html.js';
import { identity, roles } from '../../data/profile.js';
import { versionToggle, TOGGLE_CSS } from './toggle.js';

export const meta = { draft: 6, createdAt: '2026-07-15', label: 'Draft 6' };

const defi = roles.find((r) => r.id === 'defi-solutions');
const demoWins = defi.internalDemoWork.prospects.map((p) => p.name);

// Coverage matrix — the executive decision, made legible. Rows ordered by
// mandate-relevance (top = what "solidify the demo environment" actually
// needs). Levels: 2 full, 1 partial, 0 none. Jeremy's column is broad; each
// archetype is spiky. The last two rows are conceded on purpose.
const COLS = [
  { key: 'se', label: 'Seasoned SE' },
  { key: 'rel', label: 'Connected hire' },
  { key: 'auto', label: 'Auto specialist' },
  { key: 'jds', label: 'This candidate', me: true },
];
const ROWS = [
  { need: "Knows defi's platform cold", se: 0, rel: 0, auto: 0, jds: 2 },
  { need: 'Demo-environment readiness', se: 1, rel: 0, auto: 0, jds: 2, mandate: true },
  { need: 'Trusted across the org', se: 0, rel: 1, auto: 0, jds: 2 },
  { need: 'Range beyond one vertical', se: 1, rel: 0, auto: 0, jds: 2 },
  { need: 'Deep auto-lending depth', se: 1, rel: 1, auto: 2, jds: 1 },
  { need: 'A marquee relationship', se: 0, rel: 2, auto: 0, jds: 0 },
];

// Matrix geometry
const VW = 720, LABEL_W = 250, GRID_TOP = 66, GRID_BOTTOM = 452;
const colCount = COLS.length;
const colW = (VW - LABEL_W) / colCount;
const colCenter = (i) => LABEL_W + colW * (i + 0.5);
const rowH = (GRID_BOTTOM - GRID_TOP) / ROWS.length;
const rowCenter = (j) => GRID_TOP + rowH * (j + 0.5);

function cell(level, cx, cy, me) {
  const fill = me ? 'var(--teal)' : 'var(--slate)';
  if (level === 2) return html`<circle cx="${cx}" cy="${cy}" r="14" fill="${fill}"></circle>`;
  if (level === 1) return html`<circle cx="${cx}" cy="${cy}" r="13" fill="none" stroke="${fill}" stroke-width="2.5"></circle>`;
  return html`<circle cx="${cx}" cy="${cy}" r="3" fill="var(--line)"></circle>`;
}

function matrixSvg() {
  const jdsIdx = COLS.findIndex((c) => c.me);
  const hlX = LABEL_W + colW * jdsIdx;
  return html`<svg viewBox="0 0 ${VW} 470" role="img" aria-label="Coverage matrix comparing three hiring archetypes against this candidate across six capabilities the role needs. This candidate covers the four top-priority rows outright; auto-lending depth and a marquee relationship are conceded to specialist and connected hires respectively.">
    <rect x="${hlX}" y="40" width="${colW}" height="424" rx="8" fill="var(--teal-dim)"></rect>
    ${COLS.map((c, i) => html`<text class="mx-col ${c.me ? 'me' : ''}" x="${colCenter(i)}" y="30" text-anchor="middle">${c.label}</text>`)}
    ${ROWS.map((r, j) => {
      const cy = rowCenter(j);
      return html`
        ${j > 0 ? html`<line class="mx-sep" x1="10" y1="${GRID_TOP + rowH * j}" x2="${VW - 10}" y2="${GRID_TOP + rowH * j}"></line>` : ''}
        <text class="mx-row ${r.mandate ? 'mandate' : ''}" x="${LABEL_W - 18}" y="${cy + 4}" text-anchor="end">${r.need}${r.mandate ? html` <tspan class="tag">◂ board mandate</tspan>` : ''}</text>
        ${COLS.map((c, i) => cell(r[c.key], colCenter(i), cy, c.me))}`;
    })}
  </svg>`;
}

export function render({ base }) {
  return toHtml(html`<!doctype html><html data-theme="dark"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${identity.name} — Sales Engineer, defi Solutions</title>
<style>
  :root {
    --ink:#0E1319; --panel:#161D26; --text:#EDF0F3; --text-soft:#A7B0BA; --text-faint:#5B6572;
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
  h1 { font-size:clamp(2.1rem,5.4vw,3.2rem); font-weight:500; line-height:1.12; margin:0 0 1.4rem; letter-spacing:-0.01em; }
  h1 .lift { color:var(--teal); }
  .subhead { max-width:56ch; color:var(--text-soft); font-size:1.12rem; margin:0; }

  h2 { font-size:0.78rem; font-weight:600; letter-spacing:0.12em; text-transform:uppercase; color:var(--text-faint); margin:0 0 1.4rem; }
  .statement { font-size:clamp(1.4rem,3.4vw,1.9rem); font-weight:500; line-height:1.28; margin:0; max-width:24ch; }
  .statement.wide { max-width:34ch; }
  .say { color:var(--text-soft); font-size:1.04rem; max-width:60ch; margin:1.2rem 0 0; }

  .wins { display:grid; grid-template-columns:repeat(4,1fr); gap:0.9rem; margin-top:1.8rem; }
  .win { border:1px solid var(--line); border-radius:8px; padding:1.4rem 1rem; text-align:center; background:var(--panel); }
  .win .n { font-family:'Iowan Old Style','Palatino Linotype',Georgia,serif; font-size:1.15rem; color:var(--text); }
  .win .n small { display:block; font-family:'Cascadia Code',monospace; font-size:0.62rem; letter-spacing:0.1em; text-transform:uppercase; color:var(--teal); margin-top:0.5rem; }
  .wins-cap { color:var(--text-faint); font-size:0.9rem; margin-top:1.1rem; }
  @media (max-width:620px){ .wins { grid-template-columns:repeat(2,1fr); } }

  .matrix-wrap { margin-top:1.8rem; overflow-x:auto; }
  svg { width:100%; min-width:520px; height:auto; overflow:visible; }
  .mx-col { fill:var(--text-faint); font-family:'Cascadia Code',monospace; font-size:11px; letter-spacing:0.02em; }
  .mx-col.me { fill:var(--teal); font-weight:700; }
  .mx-row { fill:var(--text-soft); font-family:'Seravek','Gill Sans MT',sans-serif; font-size:14px; }
  .mx-row.mandate { fill:var(--text); }
  .mx-row .tag { fill:var(--teal); font-family:'Cascadia Code',monospace; font-size:9.5px; letter-spacing:0.06em; text-transform:uppercase; }
  .mx-sep { stroke:var(--line); stroke-width:1; }
  .legend { display:flex; gap:1.6rem; margin-top:1.1rem; font-size:0.78rem; color:var(--text-faint); flex-wrap:wrap; }
  .legend b { color:var(--text-soft); font-weight:600; }
  .takeaway { margin-top:1.6rem; font-size:1.12rem; color:var(--text); max-width:44ch; }
  .takeaway .lift { color:var(--teal); }

  .close .statement { margin-bottom:1.4rem; }
  .sig { margin-top:1.8rem; }
  .sig .name { color:var(--text); font-weight:600; }
  .sig .c { color:var(--text-faint); font-size:0.85rem; margin-top:0.2rem; }

  ${raw(TOGGLE_CSS)}
</style>
</head><body>

${versionToggle({ base, current: 'v6' })}

<div class="doc">

  <header>
    <span class="eyebrow">Sales Engineer — defi Solutions</span>
    <h1 class="display">Solidifying the demo environment isn't a hire you make. It's a person you <span class="lift">already have.</span></h1>
    <p class="subhead">Your board set the mandate. For four years I've been the one readying defi's integrations and demos behind the sales team's wins — without the title.</p>
  </header>

  <section>
    <h2>You've already shipped on my work</h2>
    <p class="statement wide">Behind these wins, I scoped the integrations and made the demo ready to carry the room.</p>
    <div class="wins">
      ${demoWins.map((n) => html`<div class="win"><div class="n">${n}<small>demo readied</small></div></div>`)}
    </div>
    <p class="wins-cap">Integration use cases built, features prepped, readiness confirmed — the invisible half of every one of these that the room never sees.</p>
  </section>

  <section>
    <h2>The market offers three strong candidates</h2>
    <p class="statement">None of them covers the mandate. One column does.</p>
    <div class="matrix-wrap">${matrixSvg()}</div>
    <div class="legend">
      <span><b>●</b> owns it</span>
      <span><b>◯</b> partial</span>
      <span><b>·</b> not really</span>
    </div>
    <p class="takeaway">Every rival is <span class="lift">spiky</span> — strong in the one lane that's easy to hire for. The mandate lives in the four rows up top, and that's <span class="lift">the whole column.</span></p>
  </section>

  <section class="close">
    <h2>Let's talk</h2>
    <p class="statement">You have a mandate to de-risk. I'm already inside, already trusted, already doing the work.</p>
    <p class="say">Fifteen minutes to walk you through the demo environments — and the wins you didn't know had my fingerprints on them.</p>
    <div class="sig">
      <div class="name">${identity.name}</div>
      <div class="c mono">${identity.contact.email} · ${identity.contact.phone}</div>
    </div>
  </section>

</div>
</body></html>`);
}
