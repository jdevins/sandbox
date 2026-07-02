const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const definition = {
  id: 'prompt',
  name: 'Prompt',
  description: 'LLM prompt block. Holds a system instruction and/or user message turn.',
  category: 'ai-workflow',
  payloadSchema: { system: 'string', user: 'string' },
  optionsSchema: {},
  hooks: [],
  exampleCard: { kind: 'prompt', payload: { system: 'You are a helpful assistant.', user: 'Summarize the input.' } },
  actions: ['delete'],
  renderMode: 'inline',
  fieldHints: {
    system: 'Sets model behavior, persona, and constraints. Omit to use the model default.',
    user: 'The human turn — the actual request or input the model should respond to.',
  },
};

export function render(payload) {
  const sys = esc(payload?.system || '');
  const user = esc(payload?.user || '');
  return `
    ${sys ? `<div style="margin-bottom:6px"><span style="font-size:10px;color:var(--text-dim);text-transform:uppercase;letter-spacing:.05em">System</span><div style="font-size:12px;color:var(--text-dim);margin-top:2px;white-space:pre-wrap">${sys}</div></div>` : ''}
    ${user ? `<div><span style="font-size:10px;color:var(--text-dim);text-transform:uppercase;letter-spacing:.05em">User</span><div style="font-size:12px;margin-top:2px;white-space:pre-wrap">${user}</div></div>` : ''}
    ${!sys && !user ? '<span style="color:var(--text-dim);font-size:12px">Empty prompt</span>' : ''}`;
}
