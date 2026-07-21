const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const definition = {
  id: 'host',
  name: 'Host',
  description: 'Host/environment logic or need-to-know info for this integration — base URL, environment, auth notes.',
  category: 'integration',
  payloadSchema: { description: 'text' },
  optionsSchema: {},
  hooks: [],
  exampleCard: { kind: 'host', payload: { description: 'prod: api.acme.com · staging: api-stage.acme.com (requires VPN)' } },
  actions: ['delete'],
  renderMode: 'inline',
  fieldHints: {
    description: 'Host/environment details a reader needs to know — base URLs, auth scheme, network requirements.',
  },
};

export function render(payload) {
  const description = esc(payload?.description || '');
  return `
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
      <span style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-dim);letter-spacing:.05em">Host</span>
    </div>
    ${description ? `<div style="font-size:12px;font-family:var(--mono)">${description}</div>` : ''}`;
}
