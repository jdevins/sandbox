const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'ON', 'GROUP BY', 'ORDER BY',
  'HAVING', 'LIMIT', 'OFFSET', 'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE TABLE',
  'ALTER TABLE', 'DROP TABLE', 'AS', 'AND', 'OR', 'NOT', 'NULL', 'IS', 'IN', 'LIKE', 'BETWEEN',
  'DISTINCT', 'UNION', 'ALL', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'WITH', 'DESC', 'ASC',
];

export const definition = {
  id: 'sql',
  description: 'Displays a SQL statement as formatted, syntax-highlighted text. Use for queries, schema snippets, or migrations.',
  payloadSchema: { sql: 'string' },
  optionsSchema: {},
  hooks: [],
  exampleCard: { kind: 'sql', payload: { sql: 'SELECT id, name\nFROM users\nWHERE active = true\nORDER BY name ASC;' } },
  actions: ['delete'],
  renderMode: 'inline',
};

export function render(payload) {
  const raw = String(payload?.sql ?? '').trim();
  return `<pre class="sb-code">${highlight(esc(raw))}</pre>`;
}

function highlight(escaped) {
  // Comments must be claimed first — every later replacement injects literal
  // "--" sequences via CSS vars (var(--llm), var(--accent)...) that would
  // otherwise be mistaken for new comment starts.
  let out = escaped
    .replace(/(--[^\n]*)/g, '<span style="color:var(--text-dim)">$1</span>')
    // strings
    .replace(/(&#39;(?:[^&]|&(?!#39;))*?&#39;)/g, '<span style="color:var(--ok)">$1</span>')
    // numbers
    .replace(/\b(\d+(?:\.\d+)?)\b/g, '<span style="color:var(--llm)">$1</span>');
  // keywords, longest first so multi-word ones match before their parts
  const sorted = [...KEYWORDS].sort((a, b) => b.length - a.length);
  for (const kw of sorted) {
    const re = new RegExp(`\\b${kw.replace(' ', '\\s+')}\\b`, 'gi');
    out = out.replace(re, (m) => `<span style="color:var(--accent);font-weight:600">${m}</span>`);
  }
  return out;
}
