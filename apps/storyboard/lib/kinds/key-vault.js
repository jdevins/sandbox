const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const definition = {
  id: 'key-vault',
  name: 'Key Vault',
  description: 'A secret reference stored in a key vault — which vault, which secret, and why it\'s used here.',
  category: 'integration',
  payloadSchema: { vault: 'string', secretName: 'string', description: 'text' },
  optionsSchema: {},
  hooks: [],
  exampleCard: { kind: 'key-vault', payload: { vault: 'acme-prod-kv', secretName: 'orders-api-client-secret', description: 'Client secret for the orders API service principal' } },
  actions: ['delete'],
  renderMode: 'inline',
  fieldHints: {
    vault: 'Name/reference of the key vault instance.',
    secretName: 'Name of the secret within the vault — not its value.',
    description: 'What this secret is used for here.',
  },
};

export function render(payload) {
  const vault = esc(payload?.vault || '');
  const secretName = esc(payload?.secretName || '');
  const description = esc(payload?.description || '');
  return `
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
      <span style="font-size:14px">🔑</span>
      ${vault ? `<span style="font-family:var(--mono);font-size:11px;background:var(--bg-elev-2);padding:1px 5px;border-radius:4px;color:var(--accent)">${vault}</span>` : ''}
    </div>
    ${secretName ? `<div style="font-size:12px;font-family:var(--mono);margin-bottom:4px">${secretName}</div>` : ''}
    ${description ? `<div style="font-size:12px;color:var(--text-dim)">${description}</div>` : ''}`;
}
