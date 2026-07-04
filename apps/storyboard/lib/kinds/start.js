const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const definition = {
  id: 'start',
  name: 'Start',
  description: 'Flow entry point. Marks where execution begins.',
  category: 'flow',
  shape: 'circle',
  defaultW: 40,
  defaultH: 40,
  payloadSchema: { label: 'string' },
  fieldHints: { label: 'Optional label, e.g. "Trigger" or "Begin"' },
  actions: ['edit', 'delete'],
  renderMode: 'inline',
};

export function render(payload) {
  const label = esc(payload?.label || '');
  return `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:2px">
    <span style="font-size:14px;line-height:1">▶</span>
    ${label ? `<span style="font-size:9px;font-weight:600;letter-spacing:.03em">${label}</span>` : ''}
  </div>`;
}
