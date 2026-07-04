const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const definition = {
  id: 'parallel',
  name: 'Parallel',
  description: 'Fan-out — all outgoing paths run simultaneously.',
  category: 'flow',
  shape: 'wide-rect',
  defaultW: 76,
  defaultH: 22,
  payloadSchema: { label: 'string' },
  fieldHints: { label: 'Optional label for this fan-out step' },
  actions: ['edit', 'delete'],
  renderMode: 'inline',
};

export function render(payload) {
  const label = esc(payload?.label || 'Parallel');
  return `<div style="display:flex;align-items:center;justify-content:center;height:100%;gap:8px">
    <span style="font-size:9px;font-weight:600;letter-spacing:.04em;text-transform:uppercase">${label}</span>
    <span style="font-size:10px;letter-spacing:-1px;opacity:.8">║</span>
  </div>`;
}
