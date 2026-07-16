// Draft 10 — "Product Brief": Jeremy presented as a software product that
// happens to be wonderfully suited to a Sales Engineer role. Bespoke design,
// self-contained document. Structure follows the CSO's requested top-to-bottom
// order: hero + encapsulating system diagram, History of Supporting Sales
// (trade shows / on-site / remote demos), Recent Sales Support (current defi
// demo prep + demo-environment ownership), Demo → Roadmap, AI & future state,
// and Our Vendors. Every claim traces to data/profile.js + data/ai-practice.js.
import { html, toHtml, raw } from '../../../../src/lib/html.js';
import { versionToggle, TOGGLE_CSS } from './toggle.js';

export const meta = {
  id: 'v10',
  label: 'v10 · product brief',
};

// --- content, pulled from the corpus (not reframed here beyond selection) ---

const demoModes = [
  {
    key: 'Trade Shows',
    icon: 'booth',
    lines: [
      'Product SME on the trade-show floor — the person who fields the hard technical questions a prospect asks at the booth.',
      'Backed presales demos and vendor bid / RFP responses as the product expert.',
    ],
  },
  {
    key: 'On-Site Demos',
    icon: 'onsite',
    lines: [
      'Travel-heavy onsite delivery (70% on the road) — implementations, launches, and live demonstrations in the room with the customer.',
      'On-site for launch day of a complex enterprise cashiering system, relaying critical issues back to the team in real time.',
    ],
  },
  {
    key: 'Remote Demos',
    icon: 'remote',
    lines: [
      'Onsite and remote sales demonstrations and training workshops.',
      'Launched a company-first cloud-hosted, multi-instance SaaS product and a first-of-its-kind in-field Sales CRM.',
    ],
  },
];

const timeline = [
  { org: "Brink's Home Security", role: 'Technical Trainer III', span: "'05–'08", note: 'Field training, 40% travel' },
  { org: 'DesertMicro', role: 'Sr. BA / SME', span: "'12–'16", note: 'SME for trade shows & demos, 70% travel', star: true },
  { org: 'System Innovators', role: 'Sr. Project Manager', span: "'16–'21", note: 'Onsite launches, RFPs, $1.5M–$2.5M bookings' },
  { org: 'defi Solutions', role: 'Lead Integration Engineer', span: "'22–now", note: 'Demo readiness for the sales team', current: true },
];

const prospects = ['Navy Federal', 'Landmark', 'M&T Bank', 'PenFed'];

const aiThemes = [
  { label: 'Governance by Design', body: 'Built a self-evolving coding-standards system — proposed-to-active lifecycle with pre-commit enforcement — so rework becomes systemic rules, not one-off fixes.' },
  { label: 'Security Judgment on AI', body: 'Caught a recurring prompt-injection pattern hidden in user text and refused to treat it as a real instruction — repeatedly, correctly, across sessions.' },
  { label: 'Swappable AI Architecture', body: 'A provider interface (mock vs. live model) so AI features run deterministically offline and swap to a real model without touching calling code.' },
  { label: 'Critical Evaluation', body: 'Pushed back on an agent design that was cosmetic "theater," demanding proof the core mechanism was real before proceeding.' },
  { label: 'Orchestration Discipline', body: 'Matured a Build-Test-Iterate-Done agent loop with an independent critic gate — checked iteration, not single-pass hope.' },
  { label: 'Agent Pattern Design', body: 'Validated a formal agent contract by building both rule-based and LLM-backed agents against it — including one that ships plain-language recommendations unattended.' },
];

const vendorGroups = [
  { group: 'KYC & Risk', items: ['Lexis Nexis', 'FraudPoint', 'RiskView', 'Emailage', 'Bridger', 'Point Predictive', 'Equifax'] },
  { group: 'Lending Portals', items: ['RouteOne', 'DealerTrack', 'DDS'] },
  { group: 'Guidebooks & Data', items: ['JD Power', 'Black Book', 'Chrome'] },
  { group: 'Docs & Funding', items: ['eOriginal', 'defiDOCS', 'InformedIQ', 'Carleton'] },
];

const specChecklist = [
  { req: 'Live product demos to prospects', met: 'Trade shows, on-site, and remote — the SME in the room' },
  { req: 'Owns the demo / POC environment', met: 'Already preps the features & integrations behind live demos' },
  { req: 'Deep technical + integration fluency', met: 'REST/SOAP, .NET C#, Azure + AWS, KYC/AML, PCI-DSS' },
  { req: 'Translates the field back to product', met: 'Routes demo-surfaced feedback straight into the roadmap' },
  { req: 'Vendor / partner relationship management', met: 'POC for Lexis Nexis; consults on new vendor integrations' },
  { req: 'Ready for AI-led conversations', met: 'Active, evidenced AI-tooling practice — not slideware' },
];

// --- small inline SVG icons for the demo-mode cards ---

function demoIcon(kind) {
  const c = 'stroke:var(--teal-bright);stroke-width:1.6;fill:none;stroke-linecap:round;stroke-linejoin:round';
  if (kind === 'booth') {
    return `<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path style="${c}" d="M4 9l1-4h14l1 4M4 9v10h16V9M4 9h16M9 19v-5h6v5"/></svg>`;
  }
  if (kind === 'onsite') {
    return `<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path style="${c}" d="M12 21s7-5.5 7-11a7 7 0 0 0-14 0c0 5.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5" style="${c}"/></svg>`;
  }
  return `<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path style="${c}" d="M3 5h18v11H3zM3 16l3 3M21 16l-3 3M8 20h8"/><path style="${c}" d="M8 10l2.5 2L15 8"/></svg>`;
}

// --- the encapsulating hero system diagram ---

function heroDiagram() {
  const stages = [
    { x: 30, label: 'FIELD-PROVEN', sub: 'Trade shows · on-site · remote demos' },
    { x: 265, label: 'DEMO-READY', sub: 'Live demo prep for named deals' },
    { x: 500, label: 'DEMO → ROADMAP', sub: 'Field signal into product' },
    { x: 735, label: 'AI-NATIVE', sub: 'Judgment layer on AI' },
  ];
  const boxW = 200, boxH = 66, boxY = 96;
  const node = (s) => `
    <rect x="${s.x}" y="${boxY}" width="${boxW}" height="${boxH}" rx="9"
      fill="url(#nodeGrad)" stroke="var(--teal)" stroke-width="1.2"/>
    <text x="${s.x + boxW / 2}" y="${boxY + 26}" text-anchor="middle"
      fill="var(--teal-bright)" font-size="14" font-weight="700"
      font-family="var(--mono)" letter-spacing="0.5">${s.label}</text>
    <text x="${s.x + boxW / 2}" y="${boxY + 46}" text-anchor="middle"
      fill="var(--text-soft)" font-size="11">${s.sub}</text>`;
  const arrow = (fromX) => {
    const x1 = fromX + boxW + 6, x2 = fromX + boxW + 29, y = boxY + boxH / 2;
    return `<path d="M${x1} ${y} H${x2 - 6}" stroke="var(--teal)" stroke-width="1.6"/>
      <path d="M${x2 - 9} ${y - 4} L${x2} ${y} L${x2 - 9} ${y + 4}" fill="var(--teal)"/>`;
  };
  return `
  <svg viewBox="0 0 965 250" class="hero-svg" role="img"
    aria-label="Pipeline: field-proven sales experience feeds demo readiness, which feeds the product roadmap, all accelerated by an AI layer and riding on a vendor integration layer.">
    <defs>
      <linearGradient id="nodeGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#16302d"/><stop offset="1" stop-color="#0f2320"/>
      </linearGradient>
      <linearGradient id="busGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#123B39"/><stop offset="1" stop-color="#1b514c"/>
      </linearGradient>
    </defs>

    <!-- AI acceleration layer -->
    <path d="M120 78 Q 490 22 845 78" stroke="var(--gold)" stroke-width="1.4"
      fill="none" stroke-dasharray="5 5" opacity="0.85"/>
    <text x="482" y="30" text-anchor="middle" fill="var(--gold)" font-size="11"
      font-family="var(--mono)" letter-spacing="1.5">AI ACCELERATION LAYER</text>

    ${stages.map(node).join('')}
    ${arrow(30)}${arrow(265)}${arrow(500)}

    <!-- vendor integration bus -->
    <rect x="30" y="196" width="905" height="34" rx="8" fill="url(#busGrad)"
      stroke="var(--teal)" stroke-width="0.8"/>
    <text x="482" y="217" text-anchor="middle" fill="var(--text)" font-size="12"
      font-family="var(--mono)" letter-spacing="0.5">VENDOR INTEGRATION LAYER — Lexis Nexis · RouteOne · Equifax · JD Power · eOriginal</text>
    ${stages.map((s) => `<path d="M${s.x + boxW / 2} ${boxY + boxH} V196" stroke="var(--teal-dim)" stroke-width="1" stroke-dasharray="3 3"/>`).join('')}
  </svg>`;
}

// --- demo → roadmap flow graphic ---

function roadmapFlow() {
  const step = (x, title, sub, glyph) => `
    <g>
      <circle cx="${x}" cy="46" r="30" fill="#0f2320" stroke="var(--teal)" stroke-width="1.3"/>
      <text x="${x}" y="52" text-anchor="middle" font-size="22">${glyph}</text>
      <text x="${x}" y="100" text-anchor="middle" fill="var(--text)" font-size="13" font-weight="600">${title}</text>
      <text x="${x}" y="118" text-anchor="middle" fill="var(--text-dim)" font-size="11">${sub}</text>
    </g>`;
  const link = (x1, x2) => `<path d="M${x1} 46 H${x2}" stroke="var(--teal)" stroke-width="1.5"/>
    <path d="M${x2 - 8} 42 L${x2} 46 L${x2 - 8} 50" fill="var(--teal)"/>`;
  return `
  <svg viewBox="0 0 700 135" class="flow-svg" role="img"
    aria-label="A sales conversation becomes captured feedback, which becomes a prioritized backlog item, which becomes shipped product.">
    ${step(70, 'Sales demo', 'the live conversation', '💬')}
    ${link(104, 226)}
    ${step(260, 'Captured signal', 'feedback & concepts', '📌')}
    ${link(294, 416)}
    ${step(450, 'Backlog', 'scoped & prioritized', '🗂️')}
    ${link(484, 606)}
    ${step(640, 'Roadmap', 'shipped product', '🚀')}
  </svg>`;
}

export function render({ base }) {
  const body = html`
    ${versionToggle({ base, current: 'v10' })}

    <main class="doc">

      <!-- ============ HERO ============ -->
      <header class="hero">
        <div class="badge-row">
          <span class="ver">JDS · v2026.7</span>
          <span class="status"><span class="dot"></span>available — build/deploy-ready</span>
        </div>
        <h1>Jeremy D. Stiffler</h1>
        <p class="tagline">A Sales Engineer who has already done the job under other titles —
          the trade shows, the demos, and the integrations behind your recent named deals.</p>
        <div class="chips">
          <span class="chip">Field-proven since 2012</span>
          <span class="chip">Fintech · Gov · SaaS</span>
          <span class="chip">defi Solutions — current</span>
          <span class="chip accent">Demo-environment ready</span>
        </div>
        ${raw(heroDiagram())}
        <p class="hero-caption">One system: field experience feeds live demos, demos feed the roadmap,
          AI accelerates all of it, and it all rides on the vendor stack you already run.</p>
      </header>

      <!-- ============ 1. HISTORY OF SUPPORTING SALES ============ -->
      <section class="mod">
        <div class="mod-head">
          <span class="mod-num">01</span>
          <div>
            <h2>A history of supporting sales</h2>
            <p class="lead">You may not know this yet: <strong>selling isn't new to me.</strong> For over a
              decade I've been the product expert in the room — at the booth, on-site, and on the call.</p>
          </div>
        </div>

        <div class="demo-grid">
          ${demoModes.map((m) => html`
            <article class="demo-card">
              <div class="demo-ico">${raw(demoIcon(m.icon))}</div>
              <h3>${m.key}</h3>
              ${m.lines.map((l) => html`<p>${l}</p>`)}
            </article>`)}
        </div>

        <div class="rail" aria-label="Sales-adjacent career timeline">
          ${timeline.map((t) => html`
            <div class="rail-stop ${t.current ? 'now' : ''} ${t.star ? 'star' : ''}">
              <div class="rail-dot"></div>
              <div class="rail-span">${t.span}</div>
              <div class="rail-org">${t.org}${t.star ? html` <span class="tag">SE precedent</span>` : ''}</div>
              <div class="rail-role">${t.role}</div>
              <div class="rail-note">${t.note}</div>
            </div>`)}
        </div>
      </section>

      <!-- ============ 2. RECENT SALES SUPPORT ============ -->
      <section class="mod">
        <div class="mod-head">
          <span class="mod-num">02</span>
          <div>
            <h2>What I'm doing for sales right now</h2>
            <p class="lead">These are my closest, most current attributions — support work behind the
              team's recent demos.</p>
          </div>
        </div>

        <div class="split">
          <div class="panel">
            <div class="panel-eyebrow">Current contribution — defi Solutions</div>
            <p class="big-quote">"Prepped features and integrations, built integration use cases,
              and ensured demo readiness for the sales team."</p>
            <div class="prospects">
              <span class="prospects-label">Demos I helped prepare for:</span>
              ${prospects.map((p) => html`<span class="pchip">${p}</span>`)}
            </div>
            <p class="fine">Support, not the sale itself — I made the technical story ready to tell.</p>
          </div>

          <aside class="own-callout">
            <div class="own-tag">Natural fit</div>
            <h3>The ideal owner of the demo environment</h3>
            <p>I already build the integration use cases and stand up the readiness behind live demos.
              I know the platform end to end — Originations, Servicing, direct-lending workflows, and the
              vendor stack underneath. Handing me the demo environment isn't onboarding; it's naming what
              I already do.</p>
          </aside>
        </div>
      </section>

      <!-- ============ 3. DEMO → ROADMAP ============ -->
      <section class="mod tight">
        <div class="mod-head">
          <span class="mod-num">03</span>
          <div>
            <h2>Sales conversations become product</h2>
            <p class="lead">The rare half of the job: I don't just run the demo — I carry what I hear in it
              straight back into the roadmap.</p>
          </div>
        </div>
        <div class="flow-wrap">${raw(roadmapFlow())}</div>
        <div class="proof-row">
          <span class="proof">Channels feedback & concepts surfaced in demos directly into product development</span>
          <span class="proof">Serves as Product Manager / BA where needed</span>
          <span class="proof">Led client workshops that shaped feature development</span>
        </div>
      </section>

      <!-- ============ 4. AI & FUTURE STATE ============ -->
      <section class="mod">
        <div class="mod-head">
          <span class="mod-num">04</span>
          <div>
            <h2>Built for where the conversations are going</h2>
            <p class="lead">As more sales conversations steer toward AI, I'm not catching up — I'm already
              building, evaluating, and governing it in my daily work.</p>
          </div>
        </div>

        <blockquote class="thesis">
          AI multiplies options; <span>judgment</span> decides which one survives contact with real
          systems and real consequences.
        </blockquote>

        <div class="ai-grid">
          ${aiThemes.map((t) => html`
            <article class="ai-card">
              <h3>${t.label}</h3>
              <p>${t.body}</p>
            </article>`)}
        </div>
        <p class="fine center">Evidence drawn from summarized, anti-hallucination-gated logs of real work
          sessions — the through-line is making AI in the workflow cheap, governed, and self-correcting.</p>
      </section>

      <!-- ============ 5. OUR VENDORS ============ -->
      <section class="mod">
        <div class="mod-head">
          <span class="mod-num">05</span>
          <div>
            <h2>I already live in your vendor ecosystem</h2>
            <p class="lead">Point of contact for Lexis Nexis vendor relations, and the person who evaluates
              and consults on new and updated vendor partnerships and integrations.</p>
          </div>
        </div>

        <div class="vendor-grid">
          ${vendorGroups.map((g) => html`
            <div class="vendor-col">
              <div class="vendor-group">${g.group}</div>
              <div class="vendor-chips">
                ${g.items.map((v) => html`<span class="vchip ${v === 'Lexis Nexis' ? 'lead' : ''}">${v}</span>`)}
              </div>
            </div>`)}
        </div>
        <p class="fine center">Works hand-in-hand with the vendor partnership team — scoping, testing,
          and maintaining the integrations these partners hang on.</p>
      </section>

      <!-- ============ SPEC FOOTER ============ -->
      <section class="spec">
        <h2 class="spec-title">Spec sheet — requirements met</h2>
        <ul class="spec-list">
          ${specChecklist.map((s) => html`
            <li>
              <span class="check">✓</span>
              <span class="spec-req">${s.req}</span>
              <span class="spec-met">${s.met}</span>
            </li>`)}
        </ul>
        <footer class="foot">
          <div>References available on request.</div>
          <div class="foot-sig">Jeremy D. Stiffler — good luck (to us both).</div>
        </footer>
      </section>

    </main>`;

  return toHtml(html`<!doctype html><html data-theme="dark"><head>
    <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>JDS — Sales Engineer · Product Brief</title>
    <style>${raw(STYLE)}</style>
    <style>${raw(TOGGLE_CSS)}</style>
  </head><body>${body}</body></html>`);
}

const STYLE = `
  :root {
    --bg: #0c1211; --bg-2: #101a18; --panel: #14201e; --panel-2: #16302d;
    --border: #24322f; --border-soft: #1c2826;
    --text: #e8f0ee; --text-soft: #b9c7c4; --text-dim: #8ba09b; --text-faint: #5d716d;
    --teal: #2FA6A0; --teal-dim: #123B39; --teal-bright: #45cabf;
    --gold: #d6a94e;
    --mono: "SF Mono","Cascadia Code",Consolas,ui-monospace,monospace;
    --sans: -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background:
      radial-gradient(1100px 620px at 50% -8%, #16302d 0%, rgba(22,48,45,0) 62%),
      var(--bg);
    color: var(--text); font-family: var(--sans);
    line-height: 1.55; -webkit-font-smoothing: antialiased;
  }
  .doc { max-width: 1000px; margin: 0 auto; padding: 0 22px 90px; }
  h1,h2,h3 { margin: 0; letter-spacing: -0.01em; }

  /* hero */
  .hero { padding: 62px 0 40px; border-bottom: 1px solid var(--border-soft); }
  .badge-row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-bottom: 20px; }
  .ver { font-family: var(--mono); font-size: 12px; color: var(--teal-bright);
    border: 1px solid var(--teal-dim); background: #0f2320; padding: 3px 9px; border-radius: 6px; letter-spacing: 0.5px; }
  .status { font-family: var(--mono); font-size: 12px; color: var(--text-dim); display: inline-flex; align-items: center; gap: 7px; }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--teal-bright); box-shadow: 0 0 0 3px rgba(69,202,191,0.18); }
  .hero h1 { font-size: clamp(34px, 6vw, 58px); font-weight: 800; line-height: 1.02; }
  .tagline { font-size: clamp(16px, 2.3vw, 21px); color: var(--text-soft); max-width: 46ch; margin: 16px 0 22px; }
  .chips { display: flex; flex-wrap: wrap; gap: 9px; margin-bottom: 30px; }
  .chip { font-size: 12.5px; font-family: var(--mono); color: var(--text-soft);
    border: 1px solid var(--border); background: var(--panel); padding: 5px 11px; border-radius: 20px; }
  .chip.accent { color: #0c1211; background: var(--teal-bright); border-color: var(--teal-bright); font-weight: 600; }
  .hero-svg { width: 100%; height: auto; display: block; margin-top: 6px; }
  .hero-caption { font-size: 13.5px; color: var(--text-dim); text-align: center; margin: 14px auto 0; max-width: 60ch; }

  /* module scaffolding */
  .mod { padding: 52px 0; border-bottom: 1px solid var(--border-soft); }
  .mod.tight { padding: 44px 0; }
  .mod-head { display: flex; gap: 18px; align-items: flex-start; margin-bottom: 30px; }
  .mod-num { font-family: var(--mono); font-size: 13px; color: var(--teal); border: 1px solid var(--teal-dim);
    border-radius: 8px; padding: 6px 9px; background: #0f2320; flex: none; margin-top: 4px; }
  .mod-head h2 { font-size: clamp(23px, 3.4vw, 31px); font-weight: 750; }
  .lead { color: var(--text-soft); font-size: 16px; margin: 9px 0 0; max-width: 62ch; }
  .lead strong { color: var(--text); }

  /* demo cards */
  .demo-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
  .demo-card { background: linear-gradient(180deg, var(--panel) 0%, var(--bg-2) 100%);
    border: 1px solid var(--border); border-radius: 12px; padding: 20px; }
  .demo-ico { width: 44px; height: 44px; border-radius: 10px; background: #0f2320; border: 1px solid var(--teal-dim);
    display: flex; align-items: center; justify-content: center; margin-bottom: 14px; }
  .demo-card h3 { font-size: 18px; margin-bottom: 10px; color: var(--teal-bright); }
  .demo-card p { font-size: 13.5px; color: var(--text-soft); margin: 0 0 9px; }
  .demo-card p:last-child { margin-bottom: 0; }

  /* timeline rail */
  .rail { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; margin-top: 30px;
    position: relative; }
  .rail::before { content: ""; position: absolute; top: 6px; left: 4%; right: 4%; height: 2px; background: var(--border); }
  .rail-stop { padding: 0 10px; position: relative; }
  .rail-dot { width: 13px; height: 13px; border-radius: 50%; background: var(--bg); border: 2px solid var(--text-faint);
    position: relative; z-index: 1; margin-bottom: 14px; }
  .rail-stop.star .rail-dot { border-color: var(--teal-bright); background: var(--teal-dim); }
  .rail-stop.now .rail-dot { border-color: var(--teal-bright); background: var(--teal-bright); box-shadow: 0 0 0 4px rgba(69,202,191,0.16); }
  .rail-span { font-family: var(--mono); font-size: 12px; color: var(--teal); }
  .rail-org { font-size: 14px; font-weight: 650; margin-top: 3px; }
  .rail-role { font-size: 12.5px; color: var(--text-dim); }
  .rail-note { font-size: 12px; color: var(--text-soft); margin-top: 6px; }
  .tag { font-family: var(--mono); font-size: 10px; color: #0c1211; background: var(--teal-bright);
    padding: 1px 6px; border-radius: 4px; vertical-align: middle; }

  /* recent support split */
  .split { display: grid; grid-template-columns: 1.35fr 1fr; gap: 18px; }
  .panel { background: linear-gradient(180deg, var(--panel) 0%, var(--bg-2) 100%);
    border: 1px solid var(--border); border-radius: 14px; padding: 26px; }
  .panel-eyebrow { font-family: var(--mono); font-size: 12px; color: var(--teal); letter-spacing: 0.5px; margin-bottom: 14px; }
  .big-quote { font-size: 19px; line-height: 1.5; color: var(--text); font-weight: 550; margin: 0 0 20px;
    border-left: 3px solid var(--teal); padding-left: 16px; }
  .prospects { display: flex; flex-wrap: wrap; align-items: center; gap: 9px; }
  .prospects-label { font-size: 13px; color: var(--text-dim); }
  .pchip { font-family: var(--mono); font-size: 12.5px; color: var(--teal-bright);
    border: 1px solid var(--teal-dim); background: #0f2320; padding: 5px 11px; border-radius: 7px; }
  .fine { font-size: 12.5px; color: var(--text-dim); margin: 16px 0 0; }
  .fine.center { text-align: center; max-width: 66ch; margin: 22px auto 0; }
  .own-callout { background: radial-gradient(120% 120% at 0% 0%, #16302d 0%, var(--panel) 70%);
    border: 1px solid var(--teal-dim); border-radius: 14px; padding: 26px; }
  .own-tag { font-family: var(--mono); font-size: 11px; color: var(--gold); letter-spacing: 1px; text-transform: uppercase; margin-bottom: 10px; }
  .own-callout h3 { font-size: 19px; margin-bottom: 12px; }
  .own-callout p { font-size: 13.5px; color: var(--text-soft); margin: 0; }

  /* flow */
  .flow-wrap { background: var(--panel); border: 1px solid var(--border); border-radius: 14px; padding: 20px 12px; }
  .flow-svg { width: 100%; height: auto; display: block; }
  .proof-row { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin-top: 20px; }
  .proof { font-size: 13px; color: var(--text-soft); border: 1px solid var(--border);
    background: var(--panel); border-radius: 20px; padding: 7px 14px; }

  /* thesis + ai */
  .thesis { font-size: clamp(18px, 2.6vw, 24px); line-height: 1.45; font-weight: 600; text-align: center;
    color: var(--text-soft); max-width: 30ch; margin: 0 auto 34px; border: 0; }
  .thesis span { color: var(--teal-bright); }
  .ai-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
  .ai-card { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 18px;
    border-top: 2px solid var(--teal-dim); }
  .ai-card h3 { font-size: 15px; color: var(--teal-bright); margin-bottom: 8px; }
  .ai-card p { font-size: 13px; color: var(--text-soft); margin: 0; }

  /* vendors */
  .vendor-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
  .vendor-col { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 18px; }
  .vendor-group { font-family: var(--mono); font-size: 12px; color: var(--teal); letter-spacing: 0.5px;
    padding-bottom: 10px; margin-bottom: 12px; border-bottom: 1px solid var(--border); }
  .vendor-chips { display: flex; flex-wrap: wrap; gap: 7px; }
  .vchip { font-size: 12.5px; color: var(--text-soft); border: 1px solid var(--border-soft);
    background: var(--bg-2); padding: 4px 9px; border-radius: 6px; }
  .vchip.lead { color: #0c1211; background: var(--teal-bright); border-color: var(--teal-bright); font-weight: 650; }

  /* spec footer */
  .spec { padding: 52px 0 0; }
  .spec-title { font-size: clamp(20px, 3vw, 26px); text-align: center; margin-bottom: 26px; }
  .spec-list { list-style: none; margin: 0 auto; padding: 0; max-width: 760px; }
  .spec-list li { display: grid; grid-template-columns: auto 1fr 1.4fr; gap: 14px; align-items: baseline;
    padding: 13px 4px; border-bottom: 1px solid var(--border-soft); }
  .check { color: var(--teal-bright); font-weight: 800; }
  .spec-req { font-weight: 600; font-size: 14px; }
  .spec-met { font-size: 13px; color: var(--text-dim); }
  .foot { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px;
    margin-top: 34px; font-size: 13px; color: var(--text-dim); }
  .foot-sig { color: var(--teal-bright); font-style: italic; }

  @media (max-width: 760px) {
    .demo-grid, .ai-grid, .vendor-grid, .rail { grid-template-columns: 1fr; }
    .split { grid-template-columns: 1fr; }
    .rail::before { display: none; }
    .ai-grid { grid-template-columns: 1fr 1fr; }
    .spec-list li { grid-template-columns: auto 1fr; }
    .spec-met { grid-column: 2; }
  }
`;
