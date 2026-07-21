const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function statusColor(status) {
  const n = parseInt(status, 10);
  if (n >= 200 && n < 300) return 'var(--ok)';
  if (n >= 300 && n < 400) return 'var(--accent)';
  if (n >= 400 && n < 500) return 'var(--warn)';
  if (n >= 500) return 'var(--bad)';
  return 'var(--text-dim)';
}

export const definition = {
  id: 'api-response',
  name: 'API Response',
  description: 'The HTTP response — status and body. Rendered like a Postman call.',
  category: 'integration',
  payloadSchema: { status: 'string', body: 'json' },
  optionsSchema: {},
  hooks: [],
  exampleCard: { kind: 'api-response', payload: { status: '200 OK', body: '{ "id": "ord_123", "status": "created" }' } },
  actions: ['delete'],
  renderMode: 'inline',
  fieldHints: {
    status: 'HTTP status code and text, e.g. "200 OK", "404 Not Found".',
    body: 'Response body — shown with JSON syntax highlighting.',
  },
};

export function render(payload) {
  const status = esc(payload?.status || '200 OK');
  const body = esc(payload?.body || '');
  const color = statusColor(status);
  return `
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
      <span style="font-family:var(--mono);font-size:11px;font-weight:700;background:var(--bg-elev-2);padding:1px 6px;border-radius:4px;color:${color}">${status}</span>
    </div>
    ${body ? `<pre class="sb-code" style="font-size:11px">${highlight(body)}</pre>` : ''}`;
}

// Token-level colouring over already-escaped text — degrades gracefully for
// non-JSON bodies, same technique as json.js.
function highlight(escaped) {
  return escaped
    .replace(/(&quot;(?:[^&]|&(?!quot;))*?&quot;)/g, '<span style="color:var(--ok)">$1</span>')
    .replace(/<span style="color:var\(--ok\)">(&quot;(?:[^&]|&(?!quot;))*?&quot;)<\/span>(\s*:)/g,
      '<span style="color:var(--accent)">$1</span>$2')
    .replace(/:(\s*)(-?\d+(?:\.\d+)?)\b/g, ':$1<span style="color:var(--llm)">$2</span>')
    .replace(/\b(true|false|null)\b/g, '<span style="color:var(--warn)">$1</span>');
}
