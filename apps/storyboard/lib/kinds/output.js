const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const definition = {
  id: 'output',
  name: 'Output',
  description: 'Final result or delivery node. Describes what format and destination the workflow produces.',
  category: 'ai-workflow',
  payloadSchema: { format: 'string', destination: 'string', description: 'string' },
  optionsSchema: {},
  hooks: [],
  exampleCard: { kind: 'output', payload: { format: 'JSON', destination: 'API response', description: 'Structured summary returned to caller' } },
  actions: ['delete'],
  renderMode: 'inline',
  fieldHints: {
    format: 'Shape of the output: JSON · markdown · plain text · stream · file · etc.',
    destination: 'Where the result goes: API caller, file system, UI, downstream service, etc.',
    description: 'What this output represents in the workflow.',
  },
};

export function render(payload) {
  const format = esc(payload?.format || '');
  const dest = esc(payload?.destination || '');
  const desc = esc(payload?.description || '');
  return `
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
      <span style="font-size:14px">📤</span>
      ${format ? `<span style="font-family:var(--mono);font-size:11px;background:var(--bg-elev-2);padding:1px 5px;border-radius:4px;color:var(--ok)">${format}</span>` : ''}
      ${dest ? `<span style="font-size:12px;color:var(--text-dim)">→ ${dest}</span>` : ''}
    </div>
    ${desc ? `<div style="font-size:12px;color:var(--text-dim)">${desc}</div>` : ''}`;
}
