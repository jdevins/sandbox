const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const definition = {
  id: 'agent',
  name: 'Agent',
  description: 'An agent definition: model, system prompt, and skill references.',
  category: 'ai-workflow',
  payloadSchema: { name: 'string', model: 'string', systemPrompt: 'string' },
  optionsSchema: {},
  hooks: [],
  exampleCard: { kind: 'agent', payload: { name: 'Summarizer', model: 'claude-sonnet-4-6', systemPrompt: 'You summarize documents concisely.' } },
  actions: ['delete'],
  renderMode: 'inline',
  fieldHints: {
    name: 'Human-readable label shown on the card.',
    model: 'Model ID e.g. claude-sonnet-4-6, claude-haiku-4-5-20251001.',
    systemPrompt: 'Instruction that defines what this agent does and how it behaves.',
  },
};

export function render(payload) {
  const name = esc(payload?.name || 'Unnamed agent');
  const model = esc(payload?.model || '');
  const prompt = esc(payload?.systemPrompt || '');
  return `
    <div style="font-weight:600;font-size:13px;margin-bottom:4px">${name}</div>
    ${model ? `<div style="font-size:11px;color:var(--accent);margin-bottom:4px;font-family:var(--mono)">${model}</div>` : ''}
    ${prompt ? `<div style="font-size:12px;color:var(--text-dim);white-space:pre-wrap">${prompt}</div>` : ''}`;
}
