// Draft 11 — "Slideshow": same product-brief material as v10, restructured
// into full-viewport slides with prev/next controls (bottom-left) instead of
// one long scroll. Content changes requested this round: no personal name or
// status pills in the hero (blended done/doing/heading/fit copy instead), no
// AI-acceleration overlay or vendor-bus row on the hero diagram, a 4th demo
// card (Workshops), abstracted employer names on the timeline, and "What I'm
// doing now" restructured into four columns (Recent Demo Preps / Our Vendors
// / Intakes / Client-Facing Projects). Deliberately avoids any claim about
// full platform mastery or demo-environment readiness, per instruction — the
// copy describes contribution, never a readiness verdict either way.
import { html, toHtml, raw } from '../../../../src/lib/html.js';
import { versionToggle, TOGGLE_CSS } from './toggle.js';

export const meta = {
  id: 'v11',
  label: 'v11 · slideshow',
};

// --- content ---

const demoModes = [
  {
    key: 'Trade Shows',
    icon: 'booth',
    lines: [
      'Worked 4–5 trade shows a year — live demos on the floor, environment prep, and prospect handoffs.',
      'Backed presales demos and vendor bid / RFP responses as the product expert.',
    ],
  },
  {
    key: 'Demo',
    icon: 'demo',
    bullets: ['Onsite', 'Remote'],
    narrative: 'Prepped the environment, mapped out scenarios, set the strategy, and collaborated with the team before every demo went live.',
  },
  {
    key: 'Workshops',
    icon: 'workshop',
    lines: [
      'Delivered feature talks and roadmap conversations with prospects and clients.',
      'Fielded live Q&A sessions, answering product questions in real time.',
    ],
  },
  {
    key: 'Product Launches',
    icon: 'launch',
    lines: [
      'Implemented, designed, and delivered new capabilities — from a company-first cloud SaaS launch to AI-driven documentation and KBA tooling.',
      'Led the flagship 3-server migration to AWS and launched the first in-field Sales CRM — 0-to-1 delivery, more than once.',
    ],
  },
];

// Hero "pillars" — a quick-hit index across the four sections that follow,
// standing in for the old boxed pipeline diagram. Rendered over the bridge
// background: the four columns read as the bridge's supports.
const heroPillars = [
  {
    title: 'Prior Experience',
    items: ['Trade Shows', 'Demos', 'Environment Prep', 'Workshops'],
  },
  {
    title: 'Product',
    items: ['Intakes', 'Ideas to Features', 'Deliveries'],
  },
  {
    title: 'AI Enabled',
    items: ['Prospect & AI Conversations', 'Leverage to Manage Demo Sites', 'Ready to Expand AI Footprint'],
  },
  {
    title: 'Our Clients and Vendors',
    items: [
      { label: 'Clients Served Directly', metric: '11+' },
      'Vendor Partnership POC',
      'Evaluates New Features',
    ],
  },
];

const timeline = [
  { org: 'Hardware and Installation', role: 'Technical Trainer III', span: "'05–'08", note: 'Field training, 40% travel' },
  { org: 'Logistics and Billing CRM', role: 'Sr. BA / SME', span: "'12–'16", note: 'SME for trade shows & demos, 70% travel' },
  { org: 'Government Revenue Solutions', role: 'Sr. Project Manager', span: "'16–'21", note: 'Onsite launches, RFPs' },
  { org: 'defi Solutions', role: 'Lead Integration Engineer', span: "'22–now", note: 'Demo readiness for the sales team', current: true },
];

const nowColumns = [
  {
    title: 'Recent Demo Preps',
    richText: true,
    items: [
      'Prospect handoff prep: <span class="hl">Navy Federal</span>, <span class="hl">Landmark</span>, <span class="hl">M&amp;T Bank</span>, <span class="hl">PenFed</span>.',
      'New-feature demos: <span class="hl">Toyota</span>, <span class="hl">Ally</span>, <span class="hl">Nissan</span>, <span class="hl">Stellantis</span>.',
    ],
  },
  {
    title: 'Our Vendors',
    richText: true,
    items: [
      'Point of contact for numerous vendors — <span class="hl">Carleton</span>, <span class="hl">Lexis Nexis</span>, <span class="hl">Equifax</span>, <span class="hl">Guidebooks</span>, <span class="hl">Informed</span>, and others.',
      'Runs product / feature evaluations and scoping for new and updated integrations.',
    ],
  },
  {
    title: 'Intakes and Scoping',
    items: [
      'Converts requests surfaced in demos and client conversations into buildable feature asks.',
      'Channels that signal directly into product development.',
    ],
  },
  {
    title: 'Client-Facing Projects',
    asList: true,
    items: [
      'Stellantis', 'Nissan', 'Ally', 'Porsche', 'Ferrari', 'BOA',
      'TD Bank', 'VW', 'VW Canada', 'Porsche Canada', 'Toyota Canada', 'Hyundai Capital', 'Mazda',
    ],
  },
];

const aiThemes = [
  { label: 'Applying AI to the Process', body: 'Using AI to help manage environments, run research, and plan initiatives — the operational work behind every demo and delivery.' },
  { label: 'Client-Facing AI, Today', body: "As AI starts showing up in what we demo, I'm already supporting it and showing it off in the room." },
  { label: 'Ready for AI-Led Conversations', body: "As more sales conversations center on AI, I'm active in that work now and ready to bring that expertise directly into those discussions." },
];

const specChecklist = [
  { req: 'Live product demos to prospects', met: 'Trade shows, on-site, remote, and workshops — the SME in the room' },
  { req: 'Demo / POC environment involvement', met: 'Regularly preps the integrations and features that go into live demos' },
  { req: 'Deep technical + integration fluency', met: 'REST/SOAP, .NET C#, Azure + AWS, KYC/AML, PCI-DSS' },
  { req: 'Translates the field back to product', met: 'Converts demo- and client-surfaced requests into buildable features' },
  { req: 'Vendor / partner relationship management', met: 'POC for numerous vendors; scopes and evaluates new integrations' },
  { req: 'Ready for AI-led conversations', met: 'Active, evidenced AI-tooling practice — not slideware' },
];

// --- inline icons for the demo-mode cards ---

function demoIcon(kind) {
  const c = 'stroke:var(--teal-bright);stroke-width:1.6;fill:none;stroke-linecap:round;stroke-linejoin:round';
  if (kind === 'booth') {
    return `<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path style="${c}" d="M4 9l1-4h14l1 4M4 9v10h16V9M4 9h16M9 19v-5h6v5"/></svg>`;
  }
  if (kind === 'demo') {
    return `<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><circle cx="12" cy="12" r="9" style="${c}"/><path d="M10 8l6 4-6 4z" fill="var(--teal-bright)" stroke="none"/></svg>`;
  }
  if (kind === 'workshop') {
    return `<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path style="${c}" d="M3 4h18v13H3zM9 20h6M12 17v3"/><path style="${c}" d="M7 9h10M7 12.5h6"/></svg>`;
  }
  return `<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path style="${c}" d="M12 2c3 2 5 6 5 10 0 2-1 4-2 5l-3 3-3-3c-1-1-2-3-2-5 0-4 2-8 5-10z"/><circle cx="12" cy="10" r="1.6" style="${c}"/><path style="${c}" d="M8 17l-2 4M16 17l2 4"/></svg>`;
}

// --- hero background: a simple suspension-bridge silhouette, decorative ---

function heroBridge() {
  const towerX1 = 260, towerX2 = 940, deckY = 300, topY = 55, midX = (towerX1 + towerX2) / 2, sagY = 150;
  const cableY = (x) => {
    const t = (x - towerX1) / (towerX2 - towerX1);
    return topY + (sagY - topY) * 4 * t * (1 - t);
  };
  const suspenders = [340, 400, 460, 520, 580, 660, 740, 800, 860]
    .map((x) => `<line x1="${x}" y1="${cableY(x).toFixed(1)}" x2="${x}" y2="${deckY}" stroke="var(--teal)" stroke-width="1.5"/>`)
    .join('');
  return `
  <svg viewBox="0 0 1200 400" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <path d="M0 ${deckY} Q ${towerX1} ${topY} ${midX} ${sagY} Q ${towerX2} ${topY} 1200 ${deckY}"
      stroke="var(--teal)" stroke-width="2.5" fill="none"/>
    ${suspenders}
    <line x1="0" y1="${deckY}" x2="1200" y2="${deckY}" stroke="var(--teal)" stroke-width="5"/>
    <line x1="${towerX1}" y1="${deckY}" x2="${towerX1}" y2="${topY}" stroke="var(--teal)" stroke-width="6"/>
    <line x1="${towerX2}" y1="${deckY}" x2="${towerX2}" y2="${topY}" stroke="var(--teal)" stroke-width="6"/>
    <line x1="${towerX1}" y1="${deckY + 6}" x2="${towerX1}" y2="390" stroke="var(--teal)" stroke-width="10"/>
    <line x1="${towerX2}" y1="${deckY + 6}" x2="${towerX2}" y2="390" stroke="var(--teal)" stroke-width="10"/>
  </svg>`;
}

function pillarItem(item) {
  if (typeof item === 'object') {
    return html`<li><span class="metric">${item.metric}</span> ${item.label}</li>`;
  }
  return html`<li><span class="check">✓</span> ${item}</li>`;
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
    aria-label="Pain points captured in demos become scoped MVPs, which feed the roadmap, which become deliveries.">
    ${step(70, 'Pain Points', 'captured in demos', '💬')}
    ${link(104, 226)}
    ${step(260, 'Scoped MVPs', 'right-sized asks', '📐')}
    ${link(294, 416)}
    ${step(450, 'Feeding Roadmap', 'shapes what ships next', '🗺️')}
    ${link(484, 606)}
    ${step(640, 'Deliveries', 'shipped to production', '🚀')}
  </svg>`;
}

export function render({ base }) {
  const body = html`
    ${versionToggle({ base, current: 'v11' })}

    <div class="slides">

      <!-- ============ SLIDE 1 — HERO ============ -->
      <section class="slide hero-slide">
        <div class="hero-bg">${raw(heroBridge())}</div>
        <div class="slide-inner hero">
          <div class="hero-box">
            <div class="eyebrow">SALES ENGINEERING — INTERNAL FIT BRIEF</div>
            <h1>An Ideal Bridge to the Backend</h1>
            <p class="tagline">Supporting sales is a theme — running demos, managing the demo environments,
              researching RFP responses. A valuable complement to that: being the bridge to the complexities
              of the ecosystem underneath it all — the integrations, the vendors, the systems, and
              increasingly, the AI woven through them.</p>

            <div class="pillars">
              ${heroPillars.map((p) => html`
                <div class="pillar">
                  <h3>${p.title}</h3>
                  <ul>${p.items.map(pillarItem)}</ul>
                </div>`)}
            </div>
          </div>
        </div>
      </section>

      <!-- ============ SLIDE 2 — HISTORY OF SUPPORTING SALES ============ -->
      <section class="slide">
        <div class="slide-inner">
          <div class="mod-head">
            <span class="mod-num">01</span>
            <div>
              <h2>A History of Supporting Sales</h2>
              <p class="lead">I'm no stranger to being in the <strong>supporting cast for sales teams</strong> —
                the product expert at the booth, on-site, and in the room.</p>
            </div>
          </div>

          <div class="demo-grid">
            ${demoModes.map((m) => html`
              <article class="demo-card">
                <div class="demo-ico">${raw(demoIcon(m.icon))}</div>
                <h3>${m.key}</h3>
                ${m.bullets
                  ? html`<div class="demo-bullets">${m.bullets.map((b) => html`<span class="demo-bullet">${b}</span>`)}</div>
                    <p>${m.narrative}</p>`
                  : m.lines.map((l) => html`<p>${l}</p>`)}
              </article>`)}
          </div>

          <div class="rail" aria-label="Sales-adjacent career timeline">
            ${timeline.map((t) => html`
              <div class="rail-stop ${t.current ? 'now' : ''}">
                <div class="rail-dot"></div>
                <div class="rail-span">${t.span}</div>
                <div class="rail-org">${t.org}</div>
                <div class="rail-role">${t.role}</div>
                <div class="rail-note">${t.note}</div>
              </div>`)}
          </div>
        </div>
      </section>

      <!-- ============ SLIDE 3 — WHAT I'M DOING NOW ============ -->
      <section class="slide">
        <div class="slide-inner">
          <div class="mod-head">
            <span class="mod-num">02</span>
            <div>
              <h2>What I'm Doing Now</h2>
              <p class="lead">Active across the business — supporting our sales team, our vendors and
                partners, our revenue department, and our professional services teams. Fluent in the
                systems, integrations, and feature sets underneath all of it.</p>
            </div>
          </div>

          <div class="now-grid">
            ${nowColumns.map((col) => html`
              <article class="now-card">
                <h3>${col.title}</h3>
                ${col.asList
                  ? html`<p class="cf-list">${col.items.join(', ')}</p>`
                  : html`<ul>${col.items.map((i) => html`<li>${col.richText ? raw(i) : i}</li>`)}</ul>`}
              </article>`)}
          </div>
        </div>
      </section>

      <!-- ============ SLIDE 4 — DEMO → ROADMAP ============ -->
      <section class="slide">
        <div class="slide-inner">
          <div class="mod-head">
            <span class="mod-num">03</span>
            <div>
              <h2>Sales Conversations Become Product</h2>
              <p class="lead">Often times, the demo isn't the end. I can move from loosely structured
                conversation to shippable product.</p>
            </div>
          </div>
          <div class="flow-wrap">${raw(roadmapFlow())}</div>
          <p class="walk-line">A familiar path of building against the need.</p>
        </div>
      </section>

      <!-- ============ SLIDE 5 — AI & FUTURE STATE ============ -->
      <section class="slide">
        <div class="slide-inner">
          <div class="mod-head">
            <span class="mod-num">04</span>
            <div>
              <h2>Built for Where the Conversations Are Going</h2>
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
          <p class="fine center">This isn't theoretical — it's already how I work day to day.</p>
        </div>
      </section>

      <!-- ============ SLIDE 6 — SPEC SHEET / CLOSE ============ -->
      <section class="slide">
        <div class="slide-inner spec">
          <h2 class="spec-title">Spec Sheet — Requirements Met</h2>
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
          </footer>
        </div>
      </section>

    </div>

    <nav class="slide-nav" aria-label="Slide navigation">
      <button type="button" id="prevSlide" class="nav-btn" aria-label="Previous slide">▲</button>
      <div id="slideCounter" class="slide-counter" aria-live="polite">1 / 6</div>
      <button type="button" id="nextSlide" class="nav-btn" aria-label="Next slide">▼</button>
    </nav>

    <script>${raw(SLIDE_SCRIPT)}</script>`;

  return toHtml(html`<!doctype html><html data-theme="dark"><head>
    <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>JDS — Sales Engineer · Slideshow</title>
    <style>${raw(STYLE)}</style>
    <style>${raw(TOGGLE_CSS)}</style>
  </head><body>${body}</body></html>`);
}

const SLIDE_SCRIPT = `
(function () {
  var container = document.querySelector('.slides');
  var slides = Array.prototype.slice.call(document.querySelectorAll('.slide'));
  var counter = document.getElementById('slideCounter');
  var prevBtn = document.getElementById('prevSlide');
  var nextBtn = document.getElementById('nextSlide');
  var current = 0;
  var ticking = false;

  function updateUI(i) {
    current = i;
    counter.textContent = (i + 1) + ' / ' + slides.length;
    prevBtn.disabled = i === 0;
    nextBtn.disabled = i === slides.length - 1;
  }

  function goTo(i) {
    i = Math.max(0, Math.min(slides.length - 1, i));
    slides[i].scrollIntoView({ behavior: 'smooth', block: 'start' });
    updateUI(i);
  }

  prevBtn.addEventListener('click', function () { goTo(current - 1); });
  nextBtn.addEventListener('click', function () { goTo(current + 1); });

  window.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); goTo(current + 1); }
    if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); goTo(current - 1); }
  });

  container.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      var top = container.scrollTop;
      var idx = 0;
      for (var i = 0; i < slides.length; i++) {
        if (slides[i].offsetTop - 20 <= top) idx = i;
      }
      updateUI(idx);
      ticking = false;
    });
  });

  updateUI(0);
})();
`;

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
  html, body { height: 100%; margin: 0; overflow: hidden; }
  body {
    background:
      radial-gradient(1100px 620px at 50% -8%, #16302d 0%, rgba(22,48,45,0) 62%),
      var(--bg);
    color: var(--text); font-family: var(--sans);
    line-height: 1.55; -webkit-font-smoothing: antialiased;
  }
  h1,h2,h3 { margin: 0; letter-spacing: -0.01em; }

  /* slideshow scaffolding */
  .slides { height: 100vh; overflow-y: scroll; scroll-snap-type: y mandatory; scroll-behavior: smooth; }
  .slide { min-height: 100vh; scroll-snap-align: start; display: flex; flex-direction: column;
    justify-content: center; padding: 9vh 6vw; }
  .slide-inner { max-width: 1040px; width: 100%; margin: 0 auto; }

  .slide-nav { position: fixed; left: 22px; bottom: 22px; z-index: 30; display: flex; flex-direction: column;
    align-items: center; gap: 8px; }
  .nav-btn { width: 38px; height: 38px; border-radius: 9px; border: 1px solid var(--teal-dim);
    background: var(--panel); color: var(--teal-bright); font-size: 14px; cursor: pointer;
    display: flex; align-items: center; justify-content: center; }
  .nav-btn:hover:not(:disabled) { background: #0f2320; border-color: var(--teal); }
  .nav-btn:disabled { color: var(--text-faint); border-color: var(--border-soft); cursor: default; }
  .slide-counter { font-family: var(--mono); font-size: 11px; color: var(--text-dim); }

  /* hero */
  .hero-slide { position: relative; overflow: hidden; }
  .hero-bg { position: absolute; inset: 0; z-index: 0; opacity: 0.22; pointer-events: none; }
  .hero-bg svg { width: 100%; height: 100%; display: block; }
  .hero { padding: 0; position: relative; z-index: 1; }
  .hero-box { background: rgba(12, 18, 17, 0.74); backdrop-filter: blur(7px); -webkit-backdrop-filter: blur(7px);
    border: 1px solid var(--border-soft); border-radius: 18px; padding: 40px 46px; }
  .eyebrow { font-family: var(--mono); font-size: 12px; color: var(--teal-bright); letter-spacing: 1.5px;
    margin-bottom: 22px; }
  .hero h1 { font-size: clamp(32px, 5.4vw, 52px); font-weight: 800; line-height: 1.08; max-width: 20ch; }
  .tagline { font-size: clamp(15px, 1.9vw, 19px); color: var(--text-soft); max-width: 62ch; margin: 26px 0 46px; }

  .pillars { display: grid; grid-template-columns: repeat(4, 1fr); gap: 22px; }
  .pillar { border-top: 2px solid var(--teal-dim); padding-top: 14px; }
  .pillar h3 { font-size: 12px; color: var(--teal-bright); letter-spacing: 0.5px; margin-bottom: 12px;
    text-transform: uppercase; }
  .pillar ul { list-style: none; margin: 0; padding: 0; }
  .pillar li { font-size: 12.5px; color: var(--text-soft); display: flex; align-items: baseline; gap: 7px;
    margin-bottom: 7px; }
  .pillar li:last-child { margin-bottom: 0; }
  .pillar .metric { color: var(--teal-bright); font-weight: 700; font-family: var(--mono); flex: none; }

  /* module scaffolding */
  .mod-head { display: flex; gap: 18px; align-items: flex-start; margin-bottom: 44px; }
  .mod-num { font-family: var(--mono); font-size: 13px; color: var(--teal); border: 1px solid var(--teal-dim);
    border-radius: 8px; padding: 6px 9px; background: #0f2320; flex: none; margin-top: 4px; }
  .mod-head h2 { font-size: clamp(24px, 3.6vw, 33px); font-weight: 750; }
  .lead { color: var(--text-soft); font-size: 16px; margin: 12px 0 0; max-width: 62ch; }
  .lead strong { color: var(--text); }

  /* demo cards */
  .demo-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
  .demo-card { background: linear-gradient(180deg, var(--panel) 0%, var(--bg-2) 100%);
    border: 1px solid var(--border); border-radius: 12px; padding: 24px; }
  .demo-ico { width: 40px; height: 40px; border-radius: 10px; background: #0f2320; border: 1px solid var(--teal-dim);
    display: flex; align-items: center; justify-content: center; margin-bottom: 14px; }
  .demo-card h3 { font-size: 16px; margin-bottom: 10px; color: var(--teal-bright); }
  .demo-card p { font-size: 12.5px; color: var(--text-soft); margin: 0 0 9px; }
  .demo-card p:last-child { margin-bottom: 0; }
  .demo-bullets { display: flex; gap: 6px; margin-bottom: 10px; }
  .demo-bullet { font-family: var(--mono); font-size: 11px; color: var(--teal-bright); border: 1px solid var(--teal-dim);
    background: #0f2320; padding: 2px 8px; border-radius: 5px; }

  /* timeline rail */
  .rail { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; margin-top: 44px; position: relative; }
  .rail::before { content: ""; position: absolute; top: 6px; left: 4%; right: 4%; height: 2px; background: var(--border); }
  .rail-stop { padding: 0 10px; position: relative; }
  .rail-dot { width: 13px; height: 13px; border-radius: 50%; background: var(--bg); border: 2px solid var(--text-faint);
    position: relative; z-index: 1; margin-bottom: 12px; }
  .rail-stop.now .rail-dot { border-color: var(--teal-bright); background: var(--teal-bright); box-shadow: 0 0 0 4px rgba(69,202,191,0.16); }
  .rail-span { font-family: var(--mono); font-size: 12px; color: var(--teal); }
  .rail-org { font-size: 13.5px; font-weight: 650; margin-top: 3px; }
  .rail-role { font-size: 12px; color: var(--text-dim); }
  .rail-note { font-size: 11.5px; color: var(--text-soft); margin-top: 6px; }
  /* what i'm doing now */
  .now-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
  .now-card { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 24px;
    border-top: 2px solid var(--teal-dim); }
  .now-card h3 { font-size: 14.5px; color: var(--teal-bright); margin-bottom: 12px; }
  .now-card ul { list-style: none; margin: 0; padding: 0; }
  .now-card li { font-size: 12.5px; color: var(--text-soft); margin-bottom: 9px; padding-left: 14px; position: relative; }
  .now-card li::before { content: "–"; position: absolute; left: 0; color: var(--teal); }
  .now-card li:last-child { margin-bottom: 0; }
  .hl { color: var(--teal-bright); font-weight: 700; }
  .cf-list { font-size: 12.5px; color: var(--text-dim); line-height: 1.7; margin: 0; }

  /* flow */
  .flow-wrap { background: var(--panel); border: 1px solid var(--border); border-radius: 14px; padding: 28px 16px; }
  .flow-svg { width: 100%; height: auto; display: block; }
  .walk-line { text-align: center; font-size: 15px; color: var(--text); font-weight: 600; margin: 26px 0 0; }

  /* thesis + ai */
  .thesis { font-size: clamp(18px, 2.6vw, 24px); line-height: 1.45; font-weight: 600; text-align: center;
    color: var(--text-soft); max-width: 32ch; margin: 0 auto 40px; border: 0; }
  .thesis span { color: var(--teal-bright); }
  .ai-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
  .ai-card { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 22px;
    border-top: 2px solid var(--teal-dim); }
  .ai-card h3 { font-size: 14px; color: var(--teal-bright); margin-bottom: 8px; }
  .ai-card p { font-size: 12.5px; color: var(--text-soft); margin: 0; }
  .fine.center { font-size: 12.5px; color: var(--text-dim); text-align: center; max-width: 66ch; margin: 28px auto 0; }

  /* spec footer */
  .spec { padding-top: 0; }
  .spec-title { font-size: clamp(20px, 3vw, 27px); text-align: center; margin-bottom: 32px; }
  .spec-list { list-style: none; margin: 0 auto; padding: 0; max-width: 760px; }
  .spec-list li { display: grid; grid-template-columns: auto 1fr 1.4fr; gap: 14px; align-items: baseline;
    padding: 16px 4px; border-bottom: 1px solid var(--border-soft); }
  .check { color: var(--teal-bright); font-weight: 800; }
  .spec-req { font-weight: 600; font-size: 13.5px; }
  .spec-met { font-size: 12.5px; color: var(--text-dim); }
  .foot { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px;
    margin-top: 36px; font-size: 13px; color: var(--text-dim); }

  @media (max-width: 980px) {
    .demo-grid, .now-grid, .pillars { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 620px) {
    .demo-grid, .now-grid, .ai-grid, .rail, .pillars { grid-template-columns: 1fr; }
    .rail::before { display: none; }
    .spec-list li { grid-template-columns: auto 1fr; }
    .spec-met { grid-column: 2; }
  }
`;
