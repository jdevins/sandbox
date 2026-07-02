const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const TYPE_ICONS = { function: 'ƒ', mcp: 'MCP', api: 'API', cli: 'CLI' };
const IO_COLORS = { read: 'var(--ok)', write: 'var(--bad)', 'read-write': 'var(--warn)' };

export const definition = {
  id: 'tool-call',
  name: 'Tool Call',
  description: 'A tool invocation. Specify the type (function/MCP/API/CLI) and whether it reads, writes, or both.',
  category: 'ai-workflow',
  payloadSchema: { name: 'string', callType: 'string', io: 'string', args: 'string' },
  optionsSchema: {},
  hooks: [],
  exampleCard: { kind: 'tool-call', payload: { name: 'search_files', callType: 'function', io: 'read', args: '{ "path": "src/", "query": "TODO" }' } },
  actions: ['delete'],
  renderMode: 'inline',
  fieldHints: {
    name: 'The function name, endpoint, command, or MCP tool being called.',
    callType: 'function — JS/Python fn · mcp — MCP server tool · api — HTTP endpoint · cli — shell command',
    io: 'read — fetches data only · write — mutates state · read-write — does both',
    args: 'Arguments as JSON object or key=value pairs.',
  },
};

export function render(payload) {
  const name = esc(payload?.name || 'tool');
  const callType = payload?.callType || 'function';
  const io = payload?.io || 'read';
  const args = esc(payload?.args || '');
  const typeLabel = esc(TYPE_ICONS[callType] || callType);
  const ioColor = IO_COLORS[io] || 'var(--text-dim)';
  return `
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
      <span style="font-family:var(--mono);font-size:11px;background:var(--bg-elev-2);padding:1px 5px;border-radius:4px;color:var(--accent)">${typeLabel}</span>
      <span style="font-weight:600;font-size:13px;font-family:var(--mono)">${name}</span>
      <span style="margin-left:auto;font-size:10px;font-weight:600;color:${ioColor};text-transform:uppercase">${esc(io)}</span>
    </div>
    ${args ? `<pre class="sb-code" style="font-size:11px">${args}</pre>` : ''}`;
}
