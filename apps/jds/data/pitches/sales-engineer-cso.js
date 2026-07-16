// Pitch variant: does not duplicate facts from ../profile.js — it selects,
// orders, and frames a subset of the corpus for one specific audience.
// Add sibling files here for future pitches (different role, different
// audience) without touching profile.js.

export const pitch = {
  id: 'sales-engineer-cso',
  employer: 'defi Solutions',
  isInternal: true,
  audience:
    "defi Solutions' Chief Sales Officer, hiring for a Sales Engineer — demos, trade shows, RFP responses, technical arm of the sales group. This is Jeremy's current employer: an internal move, not an outside pitch. See data/fits/defi-sales-engineer.js.",
  goal: 'Get added to the team, with an approved salary bump.',
  feel:
    'Ultra-modern but familiar. The reader should feel the effort and polish — the craft of the page is part of the argument.',
  thesisId: 'judgment-layer',

  // Role IDs from profile.js, in the order they should carry weight.
  leadRoleIds: ['desertmicro', 'defi-solutions', 'system-innovators'],
  complementaryRoleIds: ['navusoft', 'fisher-communications', 'brinks'],

  winIds: ['kent-inovah-launch', 'si-bookings', 'flagship-cloud-migration', 'first-field-sales-crm'],
  capabilityIds: ['field-presence', 'systems-fluency', 'delivery-judgment'],

  // AI is a theme in this pitch, not the frame — the page is about the person,
  // where they've been, and the hats they've worn. These ids (from
  // ../ai-practice.js) are the subset worth surfacing as current evidence of
  // leverage, not a comprehensive AI section.
  aiThemeIds: ['governance-by-design', 'critical-evaluation', 'agent-standardization', 'swappable-architecture'],

  certDisplay: 'historical',
  referencesDisplay: 'available-on-request',

  // Audience intelligence — provided directly by Jeremy (2026-07-15). This is
  // how the reader thinks and what they don't yet know, which drives framing.
  // Not facts about Jeremy; facts about the room he's pitching into.
  audienceIntel: {
    reader: 'Chief Sales Officer. Hands-off — the team drives design and delivery of sales activities.',
    boardMandate:
      'The CSO carries a board mandate to solidify the demo environments. This is the single sharpest wedge — it maps straight onto the fit and onto Jeremy\'s existing demo-prep work.',
    // Competition, as capability archetypes — not real named people. Frame
    // gracefully (coverage, not disparagement); each archetype is genuinely
    // strong in one axis, which is exactly the point of a coverage comparison.
    competition: [
      { archetype: 'Seasoned Sales Engineer', strength: 'Polished demo craft', gap: "Doesn't know defi's systems — starts from zero on the platform" },
      { archetype: 'The Connected Hire', strength: 'A high-value prospect or board relationship', gap: 'Relationship-led, not platform- or demo-led' },
      { archetype: 'Auto-Lending Specialist', strength: 'Deep auto-lending industry knowledge', gap: 'Narrow — light outside the vertical' },
    ],
    // What the CSO likely does NOT know about Jeremy — the reveals the pitch
    // exists to deliver.
    blindSpots: [
      'That Jeremy is already a trusted sales partner and vendor-relations partner internally.',
      'That he has carried complex technical conversations across levels and roles.',
      'That he already prepped integrations and demo readiness behind recent named wins (see roles.defi-solutions.internalDemoWork).',
    ],
  },
};
