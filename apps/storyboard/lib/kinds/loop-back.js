const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const definition = {
  id: 'loop-back',
  name: 'Loop back',
  description: 'Explicit repeat marker. Draws attention to a backward edge that forms a loop.',
  category: 'flow',
  shape: 'circle',
  defaultW: 52,
  defaultH: 52,
  payloadSchema: { target: 'string', maxIterations: 'string' },
  fieldHints: {
    target: 'Label or ID of the node this loops back to',
    maxIterations: 'Optional guard, e.g. "10" to cap runaway loops',
  },
  exampleCard: { kind: 'loop-back', payload: { target: 'Step 2', maxIterations: '10' } },
  actions: ['edit', 'delete'],
  renderMode: 'inline',
};

export function render(payload) {
  const target = payload?.target ? esc(payload.target) : null;
  const max = payload?.maxIterations ? esc(payload.maxIterations) : null;
  return `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:2px;text-align:center">
    <span style="font-size:18px">↩</span>
    ${target ? `<span style="font-size:9px;font-weight:600;word-break:break-word">${target}</span>` : ''}
    ${max ? `<span style="font-size:8px;opacity:.55">×${max}</span>` : ''}
  </div>`;
}
