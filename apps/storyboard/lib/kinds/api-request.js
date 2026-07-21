const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const METHOD_COLORS = { GET: 'var(--ok)', POST: 'var(--warn)', PUT: 'var(--llm)', PATCH: 'var(--accent)', DELETE: 'var(--bad)' };

export const definition = {
  id: 'api-request',
  name: 'API Request',
  description: 'An outbound HTTP request — method, URL, and body. Rendered like a Postman call.',
  category: 'integration',
  payloadSchema: { method: 'select', url: 'string', body: 'json' },
  optionsSchema: {},
  hooks: [],
  fieldOptions: {
    method: [
      { value: 'GET', label: 'GET' },
      { value: 'POST', label: 'POST' },
      { value: 'PUT', label: 'PUT' },
      { value: 'PATCH', label: 'PATCH' },
      { value: 'DELETE', label: 'DELETE' },
    ],
  },
  exampleCard: { kind: 'api-request', payload: { method: 'POST', url: 'https://api.acme.com/v1/orders', body: '{ "sku": "AB-1", "qty": 2 }' } },
  actions: ['delete'],
  renderMode: 'inline',
  fieldHints: {
    method: 'HTTP method for this call.',
    url: 'Full request URL, or a path if a linked Host card supplies the base.',
    body: 'Request body — shown with JSON syntax highlighting.',
  },
};

export function render(payload) {
  const method = (payload?.method || 'GET').toUpperCase();
  const url = esc(payload?.url || '');
  const body = esc(payload?.body || '');
  const color = METHOD_COLORS[method] || 'var(--text-dim)';
  return `
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
      <span style="font-family:var(--mono);font-size:11px;font-weight:700;background:var(--bg-elev-2);padding:1px 6px;border-radius:4px;color:${color}">${method}</span>
      <span style="font-family:var(--mono);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${url}</span>
    </div>
    ${body ? `<pre class="sb-code" style="font-size:11px">${highlight(body)}</pre>` : ''}`;
}

// Token-level colouring over already-escaped text — degrades gracefully for
// non-JSON bodies (form-encoded, plain text), same technique as json.js.
function highlight(escaped) {
  return escaped
    .replace(/(&quot;(?:[^&]|&(?!quot;))*?&quot;)/g, '<span style="color:var(--ok)">$1</span>')
    .replace(/<span style="color:var\(--ok\)">(&quot;(?:[^&]|&(?!quot;))*?&quot;)<\/span>(\s*:)/g,
      '<span style="color:var(--accent)">$1</span>$2')
    .replace(/:(\s*)(-?\d+(?:\.\d+)?)\b/g, ':$1<span style="color:var(--llm)">$2</span>')
    .replace(/\b(true|false|null)\b/g, '<span style="color:var(--warn)">$1</span>');
}
