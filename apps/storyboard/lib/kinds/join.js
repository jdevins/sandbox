const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const definition = {
  id: 'join',
  name: 'Join',
  description: 'Fan-in — waits for all parallel paths to complete before continuing.',
  category: 'flow',
  shape: 'wide-rect',
  defaultW: 140,
  defaultH: 44,
  payloadSchema: { strategy: 'string', label: 'string' },
  fieldHints: {
    strategy: '"all" waits for every path (default). "first" continues on the first to finish.',
    label: 'Optional label',
  },
  exampleCard: { kind: 'join', payload: { strategy: 'all', label: 'Join' } },
  actions: ['delete'],
  renderMode: 'inline',
};

export function render(payload) {
  const label = esc(payload?.label || 'Join');
  const strategy = esc(payload?.strategy || 'all');
  return `<div style="display:flex;align-items:center;justify-content:center;height:100%;gap:8px">
    <span style="font-size:13px;letter-spacing:-1px;opacity:.8">║</span>
    <span style="font-size:10px;font-weight:600;letter-spacing:.04em;text-transform:uppercase">${label}</span>
    <span style="font-size:9px;opacity:.65">${strategy}</span>
  </div>`;
}
