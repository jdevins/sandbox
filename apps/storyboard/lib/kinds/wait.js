const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const definition = {
  id: 'wait',
  name: 'Wait',
  description: 'Pauses execution until a condition, event, or timeout is met.',
  category: 'flow',
  shape: 'pill',
  defaultW: 130,
  defaultH: 60,
  payloadSchema: { condition: 'string', timeout: 'string' },
  fieldHints: {
    condition: 'What to wait for, e.g. "user confirms", "webhook received", "file exists"',
    timeout: 'Optional max wait time, e.g. "30s", "5m", "1h"',
  },
  exampleCard: { kind: 'wait', payload: { condition: 'user confirms', timeout: '10m' } },
  actions: ['delete'],
  renderMode: 'inline',
};

export function render(payload) {
  const condition = esc(payload?.condition || 'waiting…');
  const timeout = payload?.timeout ? esc(payload.timeout) : null;
  return `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:3px;text-align:center;padding:0 12px">
    <span style="font-size:13px">⏱</span>
    <span style="font-size:10px;font-weight:600;word-break:break-word">${condition}</span>
    ${timeout ? `<span style="font-size:9px;opacity:.65">max ${timeout}</span>` : ''}
  </div>`;
}
