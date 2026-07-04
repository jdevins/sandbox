const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const definition = {
  id: 'merge',
  name: 'Merge',
  description: 'Joins multiple branch paths back into one. First arrival continues execution.',
  category: 'flow',
  shape: 'trapezoid',
  defaultW: 60,
  defaultH: 36,
  payloadSchema: { label: 'string' },
  fieldHints: { label: 'Optional label, e.g. "Rejoin" or "Converge"' },
  actions: ['edit', 'delete'],
  renderMode: 'inline',
};

export function render(payload) {
  const label = esc(payload?.label || 'Merge');
  return `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:3px">
    <span style="font-size:10px">⋁</span>
  </div>`;
}
