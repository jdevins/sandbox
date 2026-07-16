import express from 'express';
import { html, toHtml, raw } from '../../src/lib/html.js';
import { ghostStamp } from '../../src/lib/release.js';
import { corpus, identity, thesis, education, certifications, roles, wins, references, capabilities, verticals, engagementBreadth } from './data/profile.js';
import { aiPractice } from './data/ai-practice.js';
import { pitch } from './data/pitches/sales-engineer-cso.js';
import { fit, fitTally } from './data/fits/defi-sales-engineer.js';
import * as pitchV1 from './presentations/sales-engineer-cso/v1.js';
import * as pitchV2 from './presentations/sales-engineer-cso/v2.js';
import * as pitchV3 from './presentations/sales-engineer-cso/v3.js';
import * as pitchV4 from './presentations/sales-engineer-cso/v4.js';
import * as pitchV5 from './presentations/sales-engineer-cso/v5.js';
import * as pitchV6 from './presentations/sales-engineer-cso/v6.js';
import * as pitchV7 from './presentations/sales-engineer-cso/v7.js';
import * as pitchV8 from './presentations/sales-engineer-cso/v8.js';
import * as pitchV9 from './presentations/sales-engineer-cso/v9.js';
import * as pitchV10 from './presentations/sales-engineer-cso/v10.js';
import * as pitchV11 from './presentations/sales-engineer-cso/v11.js';

// Module-load epoch — resets on process restart and on a dashboard Restart
// (both re-import this file). Drives the bottom-right freshness stamp.
const LOADED_AT = Date.now();

export const meta = {
  name: 'Jds',
  description: 'Judgment-layer capability pitch for Jeremy D. Stiffler — content stored in app data, multiple presentation pages to come',
  version: '0.1.0',
};

const byId = (list) => Object.fromEntries(list.map((r) => [r.id, r]));
const rolesById = byId(roles);
const winsById = byId(wins);
const capsById = byId(capabilities);
const aiThemesById = byId(aiPractice.themes);

function aiThemeCard(theme) {
  return html`<div class="card">
    <h2>${theme.label}</h2>
    <p class="desc">${theme.evidence}</p>
  </div>`;
}

function platformEcosystemBlock(pe) {
  if (!pe) return '';
  return html`<div class="collapsible" style="margin-top:12px;padding:12px">
    <div class="meta" style="margin-bottom:8px">Platform ecosystem — as of ${pe.asOf} <span class="mono">(${pe.source.join(', ')})</span></div>
    ${pe.groups.map((g) => html`<div style="margin-bottom:8px">
      <div class="meta" style="margin-bottom:4px">${g.group}</div>
      <div class="row">${g.items.map((i) => html`<span class="badge">${i}</span>`)}</div>
    </div>`)}
    ${pe.pending && pe.pending.length ? html`<div class="meta" style="margin-top:8px">Pending / new: ${pe.pending.map((p) => `${p.item} — ${p.note}`).join('; ')}</div>` : ''}
  </div>`;
}

function roleCard(role, { emphasize } = {}) {
  return html`<div class="card">
    <h2>${role.title} <span class="desc" style="display:inline">— ${role.org}</span></h2>
    <div class="meta">${role.start} – ${role.current ? 'present' : role.end}${role.note ? html` · ${role.note}` : ''}</div>
    <p class="desc">${role.summary}</p>
    ${role.highlights.length ? html`<ul class="desc">${role.highlights.map((h) => html`<li>${h}</li>`)}</ul>` : ''}
    ${platformEcosystemBlock(role.platformEcosystem)}
    <div class="row" style="margin-top:auto;padding-top:10px">${role.tags.map((t) => html`<span class="badge">${t}</span>`)}</div>
  </div>`;
}

function winCard(win) {
  return html`<div class="card">
    <h2>${win.title}</h2>
    <p class="desc">${win.summary}</p>
    <div class="row" style="margin-top:auto;padding-top:10px">
      ${win.tags.map((t) => html`<span class="badge">${t}</span>`)}
      ${win.publicQuote === false ? html`<span class="badge stopped">no public attribution</span>` : ''}
    </div>
  </div>`;
}

function capCard(cap) {
  return html`<div class="card">
    <h2>${cap.label}</h2>
    <ul class="desc">${cap.evidence.map((e) => html`<li>${e}</li>`)}</ul>
  </div>`;
}

const STRENGTH_CLASS = { direct: 'running', strong: '', partial: 'stopped', gap: 'errored' };

function fitRow(item) {
  return html`<tr style="border-top:1px solid var(--border)">
    <td style="padding:8px 10px 8px 0;vertical-align:top">${item.requirement}</td>
    <td style="padding:8px 10px;vertical-align:top;white-space:nowrap"><span class="badge ${STRENGTH_CLASS[item.strength]}">${item.strength}</span></td>
    <td style="padding:8px 10px;vertical-align:top;font-size:12px" class="meta">${item.evidence.length ? item.evidence.join(', ') : '—'}</td>
    <td style="padding:8px 0 8px 10px;vertical-align:top" class="desc">${item.note || ''}</td>
  </tr>`;
}

function fitSection(section) {
  return html`<h3 class="eng-section" style="margin:18px 0 8px">${section.section}</h3>
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="text-align:left;color:var(--text-dim);font-size:12px">
          <th style="padding:0 10px 6px 0">Requirement</th><th style="padding:0 10px 6px">Fit</th><th style="padding:0 10px 6px">Evidence</th><th style="padding:0 0 6px 10px">Note</th>
        </tr></thead>
        <tbody>${section.items.map(fitRow)}</tbody>
      </table>
    </div>`;
}

function pageNav(activeHref, pages) {
  return html`<nav class="row" style="margin-bottom:var(--gap)">
    ${pages.map((p) => html`<a class="btn ${p.href === activeHref ? 'primary' : ''}" href="${p.href}">${p.label}</a>`)}
  </nav>`;
}

// Teal accent, scoped to this app's pages only — overrides dark.css's shared
// --accent/--accent-dim locally rather than editing the sandbox-wide token
// file, which every other app also links.
const ACCENT_OVERRIDE = raw('<style>:root { --accent: #2FA6A0; --accent-dim: #123B39; }</style>');

function pageShell({ title, activeHref, headerTitle, pages, body }) {
  return html`<!doctype html><html data-theme="dark"><head>
    <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${meta.name} — ${title}</title><link rel="stylesheet" href="/static/css/dark.css">
    ${ACCENT_OVERRIDE}
  </head><body><div class="wrap">
    <header class="site"><h1>${headerTitle}</h1><a class="muted" href="/">← Sandbox</a></header>
    ${pageNav(activeHref, pages)}
    ${body}
  </div>
  ${raw(ghostStamp({ version: meta.version, loadedAt: LOADED_AT }))}</body></html>`;
}

export function createApp({ name }) {
  const router = express.Router();

  // Absolute, not relative — /fit/:id sits one segment deeper than / and
  // /corpus, so relative hrefs ("." or "corpus") resolve to different targets
  // depending which page rendered them. Rooting every link at the app's own
  // mount point keeps the nav correct at any depth.
  const base = `/apps/${name}`;
  const PAGES = [
    { href: `${base}/`, label: 'Home' },
    { href: `${base}/corpus`, label: 'Corpus' },
    { href: `${base}/fit/${fit.id}`, label: `Fit: ${fit.roleTitle}` },
    { href: `${base}/pitch/sales-engineer-cso/v1`, label: `Pitch (${pitchV1.meta.label})` },
    { href: `${base}/pitch/sales-engineer-cso/v2`, label: `Pitch (${pitchV2.meta.label})` },
    { href: `${base}/pitch/sales-engineer-cso/v3`, label: `Pitch (${pitchV3.meta.label})` },
    { href: `${base}/pitch/sales-engineer-cso/v4`, label: `Pitch (${pitchV4.meta.label})` },
    { href: `${base}/pitch/sales-engineer-cso/v5`, label: `Pitch (${pitchV5.meta.label})` },
    { href: `${base}/pitch/sales-engineer-cso/v6`, label: `Pitch (${pitchV6.meta.label})` },
    { href: `${base}/pitch/sales-engineer-cso/v7`, label: `Pitch (${pitchV7.meta.label})` },
    { href: `${base}/pitch/sales-engineer-cso/v8`, label: `Pitch (${pitchV8.meta.label})` },
    { href: `${base}/pitch/sales-engineer-cso/v9`, label: `Pitch (${pitchV9.meta.label})` },
    { href: `${base}/pitch/sales-engineer-cso/v10`, label: `Pitch (${pitchV10.meta.label})` },
    { href: `${base}/pitch/sales-engineer-cso/v11`, label: `Pitch (${pitchV11.meta.label})` },
  ];

  // Landing page: who this is, what pitch is active, and where to go. Not the
  // corpus dump — that's backend content and lives at /corpus.
  router.get('/', (req, res) => {
    const body = html`
      <div class="card" style="margin-bottom:var(--gap)">
        <h2>${identity.name}</h2>
        <p class="desc">${thesis.statement}</p>
        <div class="meta">${identity.personalNote}</div>
      </div>
      <div class="grid">
        <div class="card">
          <h2>Corpus</h2>
          <p class="desc">The full data set behind every page here — roles, wins, capabilities, engagement breadth, AI practice, certifications. Backend content, not a pitch.</p>
          <div class="card-actions"><a class="btn" href="${base}/corpus">Open →</a></div>
        </div>
        <div class="card">
          <h2>Fit: ${fit.roleTitle} @ ${fit.employer}</h2>
          <p class="desc">First fit — the corpus mapped requirement-by-requirement against a real job description, gaps included.</p>
          <div class="card-actions"><a class="btn" href="${base}/fit/${fit.id}">Open →</a></div>
        </div>
        <div class="card">
          <h2>Pitch — ${pitchV1.meta.label}</h2>
          <p class="desc">Bespoke design, not the shared dashboard chrome. Internal review version — nav chrome included.</p>
          <div class="card-actions"><a class="btn" href="${base}/pitch/sales-engineer-cso/v1">Open →</a></div>
        </div>
        <div class="card">
          <h2>Pitch — ${pitchV2.meta.label}</h2>
          <p class="desc">Written for the actual reader — no internal chrome, no salary language.</p>
          <div class="card-actions"><a class="btn" href="${base}/pitch/sales-engineer-cso/v2">Open →</a></div>
        </div>
        <div class="card">
          <h2>Pitch — ${pitchV3.meta.label}</h2>
          <p class="desc">More graphics, fewer words — a radial diagram of concerns × levels showing dynamic range, animated.</p>
          <div class="card-actions"><a class="btn" href="${base}/pitch/sales-engineer-cso/v3">Open →</a></div>
        </div>
        <div class="card">
          <h2>Pitch — ${pitchV4.meta.label}</h2>
          <p class="desc">Simpler still — a hub-and-spoke web, him at the center, with real connections drawn between concerns.</p>
          <div class="card-actions"><a class="btn" href="${base}/pitch/sales-engineer-cso/v4">Open →</a></div>
        </div>
        <div class="card">
          <h2>Pitch — ${pitchV5.meta.label}</h2>
          <p class="desc">v2's structure, copy rewritten for value, power, and pull — leads with what this means for defi, leaves a few threads for the room.</p>
          <div class="card-actions"><a class="btn" href="${base}/pitch/sales-engineer-cso/v5">Open →</a></div>
        </div>
        <div class="card">
          <h2>Pitch — ${pitchV6.meta.label}</h2>
          <p class="desc">Executive take that over-rotated — mandate-led, competitor scoreboard, "this candidate." Kept for the record.</p>
          <div class="card-actions"><a class="btn" href="${base}/pitch/sales-engineer-cso/v6">Open →</a></div>
        </div>
        <div class="card">
          <h2>Pitch — ${pitchV7.meta.label}</h2>
          <p class="desc">First-person and substance-forward — the platform system-map, the sales-adjacent decade, the range. Steering intel shapes emphasis, never printed.</p>
          <div class="card-actions"><a class="btn" href="${base}/pitch/sales-engineer-cso/v7">Open →</a></div>
        </div>
        <div class="card">
          <h2>Pitch — ${pitchV8.meta.label}</h2>
          <p class="desc">Sales support leads, a new Product Management section, the pull-quote promoted, stat row cut.</p>
          <div class="card-actions"><a class="btn" href="${base}/pitch/sales-engineer-cso/v8">Open →</a></div>
        </div>
        <div class="card">
          <h2>Pitch — ${pitchV9.meta.label}</h2>
          <p class="desc">Capability-arc grid replaces value-seeking prose ("From Demo Concept → Product Roadmap"), no employer citations, visual rhythm broken up. Current best draft.</p>
          <div class="card-actions"><a class="btn" href="${base}/pitch/sales-engineer-cso/v9">Open →</a></div>
        </div>
        <div class="card">
          <h2>Pitch — ${pitchV10.meta.label}</h2>
          <p class="desc">Product-brief take — hero system-diagram, sales-support history (trade shows / on-site / remote demos), current demo prep, demo→roadmap, AI, and vendors.</p>
          <div class="card-actions"><a class="btn" href="${base}/pitch/sales-engineer-cso/v10">Open →</a></div>
        </div>
        <div class="card">
          <h2>Pitch — ${pitchV11.meta.label}</h2>
          <p class="desc">v10's material restructured into full-screen slides with prev/next controls. Adds a Workshops card, abstracted employer names on the timeline, and a 4-column "what I'm doing now." No name or status pills in the hero. Current best draft.</p>
          <div class="card-actions"><a class="btn primary" href="${base}/pitch/sales-engineer-cso/v11">Open →</a></div>
        </div>
      </div>`;
    res.type('html').send(toHtml(pageShell({ title: 'home', activeHref: `${base}/`, headerTitle: identity.name, pages: PAGES, body })));
  });

  // Corpus: a plain review of the data + the sales-engineer-cso pitch
  // selection, so content can be sanity-checked before any visual presentation
  // is built. This is backend/management content, not a page meant to be shared.
  router.get('/corpus', (req, res) => {
    const leadRoles = pitch.leadRoleIds.map((id) => rolesById[id]);
    const complementaryRoles = pitch.complementaryRoleIds.map((id) => rolesById[id]);
    const pitchWins = pitch.winIds.map((id) => winsById[id]);
    const pitchCaps = pitch.capabilityIds.map((id) => capsById[id]);

    const body = html`
      <div class="card" style="margin-bottom:var(--gap)">
        <h2>Thesis</h2>
        <p class="desc">${thesis.statement}</p>
        <div class="meta">Pitch: ${pitch.audience}</div>
        <div class="meta">Goal: ${pitch.goal}</div>
        <div class="meta">Feel: ${pitch.feel}</div>
        <div class="meta">${identity.personalNote}</div>
      </div>

      <details class="collapsible" open style="margin-bottom:var(--gap)">
        <summary>Lead roles <span class="coll-count">(${leadRoles.length})</span></summary>
        <div class="coll-body grid">${leadRoles.map((r) => roleCard(r))}</div>
      </details>

      <details class="collapsible" style="margin-bottom:var(--gap)">
        <summary>Complementary roles <span class="coll-count">(${complementaryRoles.length})</span></summary>
        <div class="coll-body grid">${complementaryRoles.map((r) => roleCard(r))}</div>
      </details>

      <details class="collapsible" open style="margin-bottom:var(--gap)">
        <summary>Wins <span class="coll-count">(${pitchWins.length})</span></summary>
        <div class="coll-body grid">${pitchWins.map((w) => winCard(w))}</div>
      </details>

      <details class="collapsible" open style="margin-bottom:var(--gap)">
        <summary>Capabilities <span class="coll-count">(${pitchCaps.length})</span></summary>
        <div class="coll-body grid">${pitchCaps.map((c) => capCard(c))}</div>
      </details>

      <details class="collapsible" open style="margin-bottom:var(--gap)">
        <summary>Engagement breadth — thematic <span class="coll-count">(${engagementBreadth.categories.length} categories)</span></summary>
        <div class="coll-body">
          <p class="desc" style="margin-bottom:12px">Deliberately not tied to a specific role or employer — the abstraction is the point. Not individually traceable to a dated engagement the way roles/wins are.</p>
          <div class="grid">
            ${engagementBreadth.categories.map((c) => html`<div class="card">
              <h2>${c.category}</h2>
              <div class="row" style="margin-top:6px">${c.items.map((i) => html`<span class="badge">${i}</span>`)}</div>
            </div>`)}
          </div>
        </div>
      </details>

      <details class="collapsible" open style="margin-bottom:var(--gap)">
        <summary>AI Practice — current, evolving <span class="coll-count">(${pitch.aiThemeIds.length} of ${aiPractice.themes.length} themes)</span></summary>
        <div class="coll-body">
          <p class="desc" style="margin-bottom:12px">${aiPractice.note}</p>
          <div class="grid">${pitch.aiThemeIds.map((id) => aiThemeCard(aiThemesById[id]))}</div>
          <div class="meta" style="margin-top:12px">"${aiPractice.trendQuote.text}" — ${aiPractice.trendQuote.source}</div>
          <div class="meta">Snapshot as of ${aiPractice.asOf}, from ${aiPractice.sourceRange}. Re-pullable as more days get summarized.</div>
        </div>
      </details>

      <details class="collapsible" style="margin-bottom:var(--gap)">
        <summary>Verticals <span class="coll-count">(${verticals.length})</span></summary>
        <div class="coll-body row">${verticals.map((v) => html`<span class="badge">${v.label}</span>`)}</div>
      </details>

      <details class="collapsible" style="margin-bottom:var(--gap)">
        <summary>Certifications <span class="coll-count">(${certifications.length}, ${pitch.certDisplay})</span></summary>
        <div class="coll-body row">
          ${certifications.map((c) => html`<span class="badge ${c.status === 'historical' ? 'stopped' : ''}">${c.name}${c.expired ? html` — expired ${c.expired}` : ''}</span>`)}
        </div>
      </details>

      <details class="collapsible" style="margin-bottom:var(--gap)">
        <summary>Education</summary>
        <div class="coll-body row">${education.map((e) => html`<span class="badge">${e.degree}${e.honors ? ` (${e.honors})` : ''} — ${e.school} '${String(e.year).slice(-2)}</span>`)}</div>
      </details>

      <details class="collapsible" style="margin-bottom:var(--gap)">
        <summary>References</summary>
        <div class="coll-body desc">${references.count} on file — display mode: ${references.publicDisplay}. Contact details intentionally withheld from this page.</div>
      </details>

      <details class="collapsible" style="margin-bottom:var(--gap)">
        <summary>Corpus notes</summary>
        <div class="coll-body">
          <div class="meta">Scanned ${corpus.scannedAt} from ${corpus.sourceDirectory}</div>
          <div class="meta">${corpus.filesScanned.length} files scanned</div>
          ${corpus.omitted.length ? html`<p class="desc" style="margin-top:10px">Deliberately omitted:</p><ul class="desc">${corpus.omitted.map((o) => html`<li>${o.what} — ${o.why}</li>`)}</ul>` : ''}
        </div>
      </details>

      <p class="meta">Backend content — data behind every pitch/fit page in this app.</p>`;
    res.type('html').send(toHtml(pageShell({ title: 'corpus', activeHref: `${base}/corpus`, headerTitle: `${identity.name} — Corpus`, pages: PAGES, body })));
  });

  // First fit: requirement-by-requirement map of the corpus against a real JD.
  router.get(`/fit/${fit.id}`, (req, res) => {
    const tally = fitTally();
    const body = html`
      ${fit.isInternal ? html`<div class="card" style="margin-bottom:var(--gap);border-color:var(--accent)">
        <h2>Internal move, not an outside pitch</h2>
        <p class="desc">${fit.internalNote}</p>
      </div>` : ''}

      <div class="card" style="margin-bottom:var(--gap)">
        <h2>Scorecard</h2>
        <div class="row">
          <span class="badge running">direct ${tally.direct}</span>
          <span class="badge">strong ${tally.strong}</span>
          <span class="badge stopped">partial ${tally.partial}</span>
          <span class="badge errored">gap ${tally.gap}</span>
        </div>
      </div>

      <div class="card">
        ${fit.sections.map(fitSection)}
      </div>

      <p class="meta" style="margin-top:var(--gap)">Gaps are named on purpose — a fit map that hides them isn't useful preparation.</p>`;
    res.type('html').send(toHtml(pageShell({ title: `fit: ${fit.roleTitle}`, activeHref: `${base}/fit/${fit.id}`, headerTitle: `Fit: ${fit.roleTitle} @ ${fit.employer}`, pages: PAGES, body })));
  });

  // Graphical pitch, draft 1 — bespoke design, not the shared dashboard shell.
  // Owns its own <html>/<head> because the visual language here is intentionally
  // different from the corpus/fit review pages.
  router.get('/pitch/sales-engineer-cso/v1', (req, res) => {
    res.type('html').send(pitchV1.render({ base }));
  });

  // Draft 2 — written for the actual reader, no internal chrome beyond the
  // minimal version toggle (which needs `base` to build its own links).
  router.get('/pitch/sales-engineer-cso/v2', (req, res) => {
    res.type('html').send(pitchV2.render({ base }));
  });

  // Draft 3 — more graphics, fewer words: a radial concerns×levels diagram.
  router.get('/pitch/sales-engineer-cso/v3', (req, res) => {
    res.type('html').send(pitchV3.render({ base }));
  });

  // Draft 4 — simpler graphic language: hub-and-spoke web, no rings/levels.
  router.get('/pitch/sales-engineer-cso/v4', (req, res) => {
    res.type('html').send(pitchV4.render({ base }));
  });

  // Draft 5 — same structure as v2, copy rewritten for value, power, and pull.
  router.get('/pitch/sales-engineer-cso/v5', (req, res) => {
    res.type('html').send(pitchV5.render({ base }));
  });

  // Draft 6 — executive take: board-mandate lead, named-win reveal, and a
  // coverage matrix against real competition archetypes.
  router.get('/pitch/sales-engineer-cso/v6', (req, res) => {
    res.type('html').send(pitchV6.render({ base }));
  });

  // Draft 7 — first-person, substance-forward: platform system-map, sales-
  // adjacent history, range. Steering intel shapes emphasis, never printed.
  router.get('/pitch/sales-engineer-cso/v7', (req, res) => {
    res.type('html').send(pitchV7.render({ base }));
  });

  // Draft 8 — refinement: sales-support leads, new Product Management
  // section, stat row cut, pull-quote promoted, "a Lead" not "the lead."
  router.get('/pitch/sales-engineer-cso/v8', (req, res) => {
    res.type('html').send(pitchV8.render({ base }));
  });

  // Draft 9 — capability-arc grid replaces value-seeking prose; no employer
  // citations; structural variety (tags, arcs, tiles, table) breaks the
  // "blog post" rhythm.
  router.get('/pitch/sales-engineer-cso/v9', (req, res) => {
    res.type('html').send(pitchV9.render({ base }));
  });

  // Draft 10 — "product brief": Jeremy as a software product. Hero system
  // diagram encapsulating all sections, then sales-support history, current
  // demo prep, demo→roadmap, AI/future, and vendors.
  router.get('/pitch/sales-engineer-cso/v10', (req, res) => {
    res.type('html').send(pitchV10.render({ base }));
  });

  // Draft 11 — same material as v10, restructured as a full-viewport
  // slideshow with prev/next controls (bottom-left).
  router.get('/pitch/sales-engineer-cso/v11', (req, res) => {
    res.type('html').send(pitchV11.render({ base }));
  });

  return router;
}

export function health() {
  return { ok: true, roles: roles.length, wins: wins.length };
}
