const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const IO_COLORS = { read: 'var(--ok)', write: 'var(--bad)', 'read-write': 'var(--warn)' };

export const definition = {
  id: 'memory',
  name: 'Memory / State',
  description: 'A memory or state store node. Indicate whether the workflow reads, writes, or both.',
  category: 'ai-workflow',
  payloadSchema: { key: 'string', io: 'string', description: 'string' },
  optionsSchema: {},
  hooks: [],
  exampleCard: { kind: 'memory', payload: { key: 'conversation_history', io: 'read-write', description: 'Running list of prior turns' } },
  actions: ['delete'],
  renderMode: 'inline',
  fieldHints: {
    key: 'Variable name or store key (e.g. conversation_history, user_context).',
    io: 'read — retrieves stored value · write — stores a new value · read-write — does both',
    description: 'What this memory holds and when it is used.',
  },
};

export function render(payload) {
  const key = esc(payload?.key || '');
  const io = payload?.io || 'read-write';
  const desc = esc(payload?.description || '');
  const ioColor = IO_COLORS[io] || 'var(--text-dim)';
  return `
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
      <span style="font-size:14px">🧠</span>
      ${key ? `<span style="font-family:var(--mono);font-size:12px;font-weight:600">${key}</span>` : ''}
      <span style="margin-left:auto;font-size:10px;font-weight:700;color:${ioColor};text-transform:uppercase">${esc(io)}</span>
    </div>
    ${desc ? `<div style="font-size:12px;color:var(--text-dim)">${desc}</div>` : ''}`;
}
