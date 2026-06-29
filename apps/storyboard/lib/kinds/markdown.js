const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const definition = {
  id: 'markdown',
  description: 'Renders markdown text. Supports headers, bold, italic, inline code, fenced code blocks, links, and bullet lists.',
  payloadSchema: { text: 'string' },
  // Declared now so the contract shape doesn't change later when a kind
  // actually needs one — empty/none until a real kind populates them.
  optionsSchema: {},
  hooks: [],
  exampleCard: { kind: 'markdown', payload: { text: '# Heading\n\nSome **bold** and *italic* text.\n\n- one\n- two' } },
  actions: ['delete'],
  renderMode: 'inline',
};

// Deliberately minimal — a small, predictable subset rather than a full
// markdown spec. Escapes first so user/agent text can never inject markup.
export function render(payload) {
  const text = esc(payload?.text ?? '');
  const blocks = text.split(/\n{2,}/);
  const html = blocks
    .map((block) => {
      if (/^```/.test(block)) {
        return `<pre class="sb-code">${block.replace(/^```\w*\n?|```$/g, '')}</pre>`;
      }
      if (/^(#{1,3}) /.test(block)) {
        const level = block.match(/^(#{1,3})/)[1].length;
        return `<h${level + 2}>${inline(block.replace(/^#{1,3} /, ''))}</h${level + 2}>`;
      }
      if (/^- /m.test(block)) {
        const items = block.split('\n').filter((l) => l.startsWith('- '));
        return `<ul>${items.map((i) => `<li>${inline(i.slice(2))}</li>`).join('')}</ul>`;
      }
      return `<p>${inline(block).replace(/\n/g, '<br>')}</p>`;
    })
    .join('\n');
  return html;
}

function inline(s) {
  return s
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}
