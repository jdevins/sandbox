const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const definition = {
  id: 'error',
  name: 'Error / Catch',
  description: 'Exception handler. Catches errors from upstream and routes to a recovery path.',
  category: 'flow',
  shape: 'shield',
  defaultW: 46,
  defaultH: 44,
  payloadSchema: { catches: 'string', action: 'string' },
  fieldHints: {
    catches: 'Error types to handle, e.g. "timeout, validation" or "*" for all',
    action: '"retry", "escalate", "skip", or a label for the recovery path',
  },
  exampleCard: { kind: 'error', payload: { catches: '*', action: 'retry' } },
  actions: ['edit', 'delete'],
  renderMode: 'inline',
};

export function render(payload) {
  const catches = esc(payload?.catches || '!');
  const action = payload?.action ? esc(payload.action) : null;
  return `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:85%;gap:3px;text-align:center;padding:0 8px">
    <span style="font-size:13px;font-weight:700">!</span>
    <span style="font-size:8px;font-weight:600">${catches}</span>
  </div>`;
}
