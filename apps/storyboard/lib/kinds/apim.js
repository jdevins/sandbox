const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const definition = {
  id: 'apim',
  name: 'APIM',
  description: 'API Management gateway policy — inbound/outbound direction, transformations, mTLS, and IP whitelisting.',
  category: 'integration',
  payloadSchema: { direction: 'select', transformations: 'list', mtls: 'select', ipWhitelist: 'list' },
  optionsSchema: {},
  hooks: [],
  fieldOptions: {
    direction: [
      { value: 'inbound', label: 'Inbound — client → APIM' },
      { value: 'outbound', label: 'Outbound — APIM → backend' },
    ],
    mtls: [
      { value: 'disabled', label: 'Disabled' },
      { value: 'enabled', label: 'Enabled — mutual TLS required' },
    ],
  },
  exampleCard: { kind: 'apim', payload: { direction: 'inbound', transformations: 'strip-headers, rewrite-path', mtls: 'enabled', ipWhitelist: '10.0.0.0/8, 203.0.113.5' } },
  actions: ['delete'],
  renderMode: 'inline',
  fieldHints: {
    direction: 'inbound — policies applied to requests entering APIM · outbound — policies applied to requests leaving APIM toward the backend',
    transformations: 'Named transformation steps applied by this policy, e.g. strip-headers, rewrite-path, set-header.',
    mtls: 'Whether mutual TLS (client certificate) is required for this direction.',
    ipWhitelist: 'Allowed source IPs/CIDRs. Leave empty to allow all.',
  },
};

export function render(payload) {
  const direction = payload?.direction || 'inbound';
  const mtls = payload?.mtls || 'disabled';
  const transformations = String(payload?.transformations || '').split(',').map((s) => s.trim()).filter(Boolean);
  const ips = String(payload?.ipWhitelist || '').split(',').map((s) => s.trim()).filter(Boolean);
  const dirColor = direction === 'inbound' ? 'var(--ok)' : 'var(--accent)';
  const mtlsColor = mtls === 'enabled' ? 'var(--ok)' : 'var(--text-dim)';
  return `
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
      <span style="font-size:11px;font-weight:700;text-transform:uppercase;color:${dirColor};letter-spacing:.04em">${esc(direction)}</span>
      <span style="font-size:11px;color:var(--text-dim)">APIM</span>
      <span style="margin-left:auto;font-size:10px;font-weight:600;color:${mtlsColor}">mTLS ${mtls === 'enabled' ? 'on' : 'off'}</span>
    </div>
    ${transformations.length ? `<div style="font-size:12px;margin-bottom:4px"><span style="color:var(--text-dim);font-size:10px">transforms </span>${transformations.map(esc).join(', ')}</div>` : ''}
    ${ips.length ? `<div style="font-size:11px;font-family:var(--mono);color:var(--text-dim)">${ips.map(esc).join(', ')}</div>` : ''}`;
}
