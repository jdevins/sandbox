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
  return `<pre class="sb-code">${highlight(esc(text))}</pre>`;
}

// Token-level colouring via regex over already-escaped text (colours from dark.css vars).
// Strings are wrapped first (covers object values and array items alike), then
// re-coloured to accent wherever they're actually object keys (followed by ":").
function highlight(escaped) {
  return escaped
    .replace(/(&quot;(?:[^&]|&(?!quot;))*?&quot;)/g, '<span style="color:var(--ok)">$1</span>')
    .replace(/<span style="color:var\(--ok\)">(&quot;(?:[^&]|&(?!quot;))*?&quot;)<\/span>(\s*:)/g,
      '<span style="color:var(--accent)">$1</span>$2')
    // numbers
    .replace(/:(\s*)(-?\d+(?:\.\d+)?)\b/g, ':$1<span style="color:var(--llm)">$2</span>')
    // booleans / null
    .replace(/\b(true|false|null)\b/g, '<span style="color:var(--warn)">$1</span>');
}
