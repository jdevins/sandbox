const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const definition = {
  id: 'trigger',
  name: 'Trigger',
  description: 'Describes how this integration is fired — event, schedule, manual call, etc.',
  category: 'integration',
  payloadSchema: { description: 'text' },
  optionsSchema: {},
  hooks: [],
  exampleCard: { kind: 'trigger', payload: { description: 'Fires when a new order is placed in the POS system' } },
  actions: ['delete'],
  renderMode: 'inline',
  fieldHints: {
    description: 'What fires this integration — e.g. "Nightly at 2am", "Webhook from Stripe", "Manual button click".',
  },
};

export function render(payload) {
  const description = esc(payload?.description || '');
  return `
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
      <span style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--accent);letter-spacing:.05em">Trigger</span>
    </div>
    ${description ? `<div style="font-size:12px">${description}</div>` : ''}`;
}
