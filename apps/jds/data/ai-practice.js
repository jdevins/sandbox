// Evolving subset — current AI practice, distinct from the static career corpus
// in profile.js. Where profile.js is frozen resume material re-scrubbed by
// hand, this file is a snapshot pulled from a live, running signal source:
// apps/claude-engine/features/session-repack, which scores and summarizes
// actual Claude Code work sessions (anti-hallucination gated — every summary
// item traces to a literal file/command/quote from the session it describes).
//
// This file does not read that store at runtime (apps stay isolated per
// CLAUDE.md) — it's a hand-pulled distillation, re-pullable as more days get
// summarized. Re-pull by reading apps/claude-engine/data/repacks/*.json
// (day.summary) and data/trends/*.json for newer dates than `asOf` below.

export const aiPractice = {
  asOf: '2026-07-15',
  sourceFeature: 'apps/claude-engine/features/session-repack',
  sourceRange: '2026-06-16 to 2026-06-26 (10 summarized days, 2 trend rollups)',
  note: 'AI is a theme in the overall pitch, not its frame — this file is evidence of active leverage, kept separate so it can be refreshed on its own cadence without touching the static corpus.',

  themes: [
    {
      id: 'governance-by-design',
      label: 'Governance by Design',
      evidence:
        'Designed a self-evolving coding-standards system — proposed-to-active lifecycle, pre-commit enforcement, and a path for the AI itself to propose new rules when a fix reveals a pattern — turning rework into systemic rule-making instead of one-off fixes.',
      source: ['repack:2026-06-22', 'repack:2026-06-24'],
    },
    {
      id: 'orchestration-discipline',
      label: 'Orchestration Discipline',
      evidence:
        'Matured a Build-Test-Iterate-Done agent loop by adding an independent critic gate, moving from single-pass agent runs to a checked iteration loop with explicit gates.',
      source: ['repack:2026-06-24', 'trend:week-2026-06-15'],
    },
    {
      id: 'security-judgment',
      label: 'Security Judgment Applied to AI',
      evidence:
        'Caught a recurring fake "system" tag embedded in user-turn text attempting prompt injection, and refused to treat it as a real instruction — repeatedly and correctly, across multiple sessions.',
      source: ['repack:2026-06-24'],
    },
    {
      id: 'swappable-architecture',
      label: 'Swappable AI Architecture',
      evidence:
        'Built a provider-interface pattern (mock vs. live LLM) so AI features run deterministically offline and swap to a real model without touching calling code.',
      source: ['repack:2026-06-22'],
    },
    {
      id: 'critical-evaluation',
      label: 'Critical Evaluation of AI Output',
      evidence:
        'Pushed back on an agent design that amounted to cosmetic "theater," demanding proof the core mechanism was real before proceeding — and separately talked a heavy telemetry proposal down to a scoped, learnable middle ground.',
      source: ['repack:2026-06-22', 'repack:2026-06-25'],
    },
    {
      id: 'agent-standardization',
      label: 'Agent Pattern Design',
      evidence:
        'Validated a formal agent contract (trigger → tools → decide-loop → done) by building both rule-based and LLM-backed agents against the same contract, including a scheduled agent that ships plain-language recommendations unattended.',
      source: ['repack:2026-06-25', 'repack:2026-06-26'],
    },
  ],

  trendQuote: {
    text: "The week's through-line is infrastructure-before-features: almost every session is about making AI participation in the workflow cheap, governed, and self-correcting rather than ad-hoc.",
    source: 'trend:week-2026-06-15',
  },
};
