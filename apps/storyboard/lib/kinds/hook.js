const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const definition = {
  id: 'hook',
  name: 'Hook',
  description: 'Pre- or post-tool hook. Runs logic before or after a tool call executes.',
  category: 'ai-workflow',
  payloadSchema: { phase: 'string', trigger: 'string', action: 'string' },
  optionsSchema: {},
  hooks: [],
  exampleCard: { kind: 'hook', payload: { phase: 'pre', trigger: 'Before any Bash tool call', action: 'Validate command against allowlist' } },
  actions: ['delete'],
  renderMode: 'inline',
  fieldHints: {
    phase: 'pre — runs before the tool executes · post — runs after the tool returns',
    trigger: 'Describe the event or condition that fires this hook (e.g. "Before any Bash call").',
    action: 'What the hook does when it fires (e.g. "Validate against allowlist").',
  },
};

export function render(payload) {
  const phase = payload?.phase || 'pre';
  const trigger = esc(payload?.trigger || '');
  const action = esc(payload?.action || '');
  const phaseColor = phase === 'pre' ? 'var(--accent)' : 'var(--llm)';
  return `
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
      <span style="font-size:11px;font-weight:700;text-transform:uppercase;color:${phaseColor};letter-spacing:.05em">${esc(phase)}</span>
      <span style="font-size:11px;color:var(--text-dim)">hook</span>
    </div>
    ${trigger ? `<div style="font-size:12px;margin-bottom:4px"><span style="color:var(--text-dim);font-size:10px">trigger </span>${trigger}</div>` : ''}
    ${action ? `<div style="font-size:12px"><span style="color:var(--text-dim);font-size:10px">action </span>${action}</div>` : ''}`;
}
