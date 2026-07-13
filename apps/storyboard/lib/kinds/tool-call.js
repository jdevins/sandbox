const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const TYPE_ICONS = { mcp: 'MCP', skill: 'SKILL', api: 'API', 'server-function': 'ƒ', builtin: 'BUILT-IN' };
const IO_COLORS = { read: 'var(--ok)', write: 'var(--bad)', 'read-write': 'var(--warn)' };

export const definition = {
  id: 'tool-call',
  name: 'Tool Call',
  description: 'A tool invocation. Pick the source (MCP/skill/API/server function/built-in) and whether it reads, writes, or both.',
  category: 'ai-workflow',
  payloadSchema: { name: 'string', callType: 'select', io: 'string', args: 'string' },
  optionsSchema: {},
  hooks: [],
  fieldOptions: {
    callType: [
      { value: 'mcp', label: 'MCP — tool from a connected MCP server' },
      { value: 'skill', label: 'Skill — reusable skill (this repo or Claude Code)' },
      { value: 'api', label: 'API call — external HTTP endpoint' },
      { value: 'server-function', label: 'Server function — this app\'s own backend code' },
      { value: 'builtin', label: 'Claude built-in — Read, Bash, Grep, Edit, WebFetch, …' },
    ],
  },
  // Name field offers suggestions from known-existing tools per callType, but
  // stays a free-text input — typing a name that isn't in the list plans a
  // tool that doesn't exist yet (feature planning). Four of five types have a
  // real, live source; `api` doesn't — there's no discoverable catalog of
  // external HTTP endpoints anywhere in this sandbox, so it stays freeform.
  //   skill            → claude-engine's own skill store (live)
  //   server-function   → Command Center's declared CAPABILITIES registry
  //                       (code-grounded, not auto-discovered — see its comment)
  //   builtin / mcp     → system-tools.json, refreshed manually by the
  //                       .claude/skills/system-discovery skill (the assistant
  //                       is the only thing that can see its own tool/MCP list —
  //                       Node has no way to introspect that)
  fieldSuggestions: {
    name: {
      keyedBy: 'callType',
      sources: {
        skill: '/apps/claude-engine/features/skill-builder/api/list',
        'server-function': '/apps/claude-engine/features/command-center/api/capabilities',
        builtin: '/apps/claude-engine/features/command-center/api/system-tools?category=builtin',
        mcp: '/apps/claude-engine/features/command-center/api/system-tools?category=mcp',
      },
    },
  },
  exampleCard: { kind: 'tool-call', payload: { name: 'search_files', callType: 'server-function', io: 'read', args: '{ "path": "src/", "query": "TODO" }' } },
  actions: ['delete'],
  renderMode: 'inline',
  fieldHints: {
    name: 'The tool\'s name — e.g. Read/Bash (built-in), github/create_issue (MCP), doc-summarizer (skill), POST /users (API), formatCurrency (server function).',
    callType: 'Where this tool comes from — pick the closest match so the diagram shows what kind of call it is.',
    io: 'read — fetches data only · write — mutates state · read-write — does both',
    args: 'Arguments as JSON object or key=value pairs.',
  },
};

export function render(payload) {
  const name = esc(payload?.name || 'tool');
  const callType = payload?.callType || 'server-function';
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
