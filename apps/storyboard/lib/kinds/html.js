export const definition = {
  id: 'html',
  description: 'Arbitrary HTML fragment, mounted in a sandboxed iframe. Escape hatch for anything not covered by a structured kind — prefer markdown/json when the content fits those shapes.',
  payloadSchema: { html: 'string' },
  optionsSchema: {},
  hooks: [],
  exampleCard: { kind: 'html', payload: { html: '<p>Hello from a card.</p>' } },
  actions: ['delete'],
  renderMode: 'sandboxed',
};

// Untrusted/arbitrary markup gets the iframe treatment so one bad card can't
// break the canvas page or bleed CSS/script into siblings. Structured kinds
// (markdown, json) skip this because Node already escaped/validated their output.
export function render(payload) {
  return `<!doctype html><html data-theme="dark"><head><meta charset="utf-8">
    <link rel="stylesheet" href="/static/css/dark.css"></head>
    <body style="margin:0;padding:8px;font-family:sans-serif">${payload?.html ?? ''}</body></html>`;
}
