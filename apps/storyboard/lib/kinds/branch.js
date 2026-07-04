const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const definition = {
  id: 'branch',
  name: 'Branch',
  description: 'Deterministic conditional fork. Evaluates an expression and routes to a path.',
  category: 'flow',
  shape: 'diamond',
  defaultW: 110,
  defaultH: 90,
  payloadSchema: { condition: 'string', outputs: 'string' },
  fieldHints: {
    condition: 'Expression or field to evaluate, e.g. "status == approved" or "score > 0.8"',
    outputs: 'Comma-separated path names, e.g. "yes, no" or "pass, fail, retry"',
  },
  exampleCard: { kind: 'branch', payload: { condition: 'approved?', outputs: 'yes, no' } },
  actions: ['delete'],
  renderMode: 'inline',
};

export function render(payload) {
  const condition = esc(payload?.condition || '?');
  const outputs = esc(payload?.outputs || 'yes · no');
  return `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:3px;text-align:center;padding:0 8px">
    <span style="font-size:11px;font-weight:600;word-break:break-word">${condition}</span>
    <span style="font-size:9px;opacity:0.7">${outputs}</span>
  </div>`;
}
