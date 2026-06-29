const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const definition = {
  id: 'json',
  description: 'Displays a JSON value as formatted, scrollable text. Use for sample payloads, API responses, config snippets.',
  payloadSchema: { value: 'any' },
  optionsSchema: {},
  hooks: [],
  exampleCard: { kind: 'json', payload: { value: { hello: 'world' } } },
  actions: ['delete'],
  renderMode: 'inline',
};

export function render(payload) {
  let text;
  try {
    text = JSON.stringify(payload?.value ?? null, null, 2);
  } catch {
    text = '(unserializable value)';
  }
  return `<pre class="sb-code">${esc(text)}</pre>`;
}
