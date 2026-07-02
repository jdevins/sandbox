const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const GATE_ICONS = { human: '👤', ai: '🤖', api: 'API', query: 'SQL', calc: '∑' };

export const definition = {
  id: 'gate',
  name: 'Gate',
  description: 'Decision or condition check. Types: human approval, AI judgment, API result, query result, or calculation.',
  category: 'ai-workflow',
  payloadSchema: { gateType: 'string', condition: 'string' },
  optionsSchema: {},
  hooks: [],
  exampleCard: { kind: 'gate', payload: { gateType: 'human', condition: 'Is the output safe to send?' } },
  actions: ['delete'],
  renderMode: 'inline',
  fieldHints: {
    gateType: 'human — manual approval · ai — LLM judgment · api — external check · query — DB/search result · calc — computed value',
    condition: 'The question or test evaluated at this gate. Outcome determines which branch continues.',
  },
};

export function render(payload) {
  const gateType = payload?.gateType || 'human';
  const condition = esc(payload?.condition || '');
  const icon = esc(GATE_ICONS[gateType] || gateType);
  return `
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
      <span style="font-size:14px">${icon}</span>
      <span style="font-size:11px;color:var(--warn);font-weight:600;text-transform:uppercase;letter-spacing:.04em">${esc(gateType)}</span>
      <span style="font-size:11px;color:var(--text-dim)">gate</span>
    </div>
    ${condition ? `<div style="font-size:13px;font-style:italic">"${condition}"</div>` : ''}`;
}
