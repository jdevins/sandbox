const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const definition = {
  id: 'eval',
  name: 'Eval',
  description: 'Evaluation node. Grades or scores output against defined criteria before passing it downstream.',
  category: 'ai-workflow',
  payloadSchema: { metric: 'string', criteria: 'string', passCondition: 'string' },
  optionsSchema: {},
  hooks: [],
  exampleCard: { kind: 'eval', payload: { metric: 'accuracy', criteria: 'Response matches expected format and covers all required fields', passCondition: 'score >= 0.85' } },
  actions: ['delete'],
  renderMode: 'inline',
  fieldHints: {
    metric: 'What is being measured (e.g. accuracy, relevance, latency, format compliance).',
    criteria: 'Detailed description of what a passing result looks like.',
    passCondition: 'Expression that determines pass/fail (e.g. score >= 0.85, contains_all_fields == true).',
  },
};

export function render(payload) {
  const metric = esc(payload?.metric || '');
  const criteria = esc(payload?.criteria || '');
  const pass = esc(payload?.passCondition || '');
  return `
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
      <span style="font-size:14px">✓</span>
      ${metric ? `<span style="font-weight:600;font-size:13px">${metric}</span>` : '<span style="color:var(--text-dim);font-size:12px">eval</span>'}
      ${pass ? `<span style="margin-left:auto;font-family:var(--mono);font-size:10px;color:var(--ok)">${pass}</span>` : ''}
    </div>
    ${criteria ? `<div style="font-size:12px;color:var(--text-dim)">${criteria}</div>` : ''}`;
}
