const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const definition = {
  id: 'end',
  name: 'End',
  description: 'Flow terminal. Marks where execution completes.',
  category: 'flow',
  shape: 'circle',
  defaultW: 52,
  defaultH: 52,
  payloadSchema: { label: 'string' },
  fieldHints: { label: 'Optional label, e.g. "Done" or "Error exit"' },
  actions: ['edit', 'delete'],
  renderMode: 'inline',
};

export function render(payload) {
  const label = esc(payload?.label || '');
  return `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:2px">
    <span style="font-size:18px;line-height:1">⏹</span>
    ${label ? `<span style="font-size:9px;font-weight:600;letter-spacing:.03em">${label}</span>` : ''}
  </div>`;
}
