const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const definition = {
  id: 'request-data',
  name: 'Request Data',
  description: 'Data sources for this request\'s fields. Rows are free-form — add one per header, path/query param, or body field.',
  category: 'integration',
  payloadSchema: { table: 'table' },
  optionsSchema: {},
  hooks: [],
  exampleCard: {
    kind: 'request-data',
    payload: { table: { columns: ['Field', 'Source'], rows: [
      ['Headers', 'Bearer token from Host card'],
      ['Path: order.id', 'From Trigger payload'],
      ['Body', 'Mapped from order object'],
    ] } },
  },
  actions: ['delete'],
  renderMode: 'inline',
};

export function render(payload) {
  const t = payload?.table || {};
  const cols = t.columns || [];
  const rows = t.rows || [];
  if (!cols.length) return '<div style="font-size:12px;color:var(--text-dim)">Empty table</div>';
  const head = `<tr>${cols.map((c) => `<th style="text-align:left;padding:3px 8px 3px 0;font-size:11px;color:var(--text-dim);border-bottom:1px solid var(--border)">${esc(c)}</th>`).join('')}</tr>`;
  const body = rows.map((row) => `<tr>${cols.map((_, i) => `<td style="padding:3px 8px 3px 0;font-size:12px;border-bottom:1px solid var(--border)">${esc(row[i] || '')}</td>`).join('')}</tr>`).join('');
  return `<table style="width:100%;border-collapse:collapse">${head}${body}</table>`;
}
