const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const definition = {
  id: 'xml',
  description: 'Displays an XML document as formatted, syntax-highlighted text. Use for API envelopes, config files, or any XML payload.',
  payloadSchema: { xml: 'string' },
  optionsSchema: {},
  hooks: [],
  exampleCard: { kind: 'xml', payload: { xml: '<root>\n  <item id="1">Hello</item>\n</root>' } },
  actions: ['delete'],
  renderMode: 'inline',
};

export function render(payload) {
  const raw = String(payload?.xml ?? '').trim();
  return `<pre class="sb-code">${highlight(esc(pretty(raw)))}</pre>`;
}

// Indent XML by re-tokenising — tolerates missing declarations and partial snippets.
function pretty(xml) {
  let indent = 0;
  const out = [];
  // Split on tag boundaries, keeping delimiters
  const tokens = xml.split(/(<[^>]+>)/g);
  for (const tok of tokens) {
    const text = tok.trim();
    if (!text) continue;
    if (/^<\//.test(text)) {
      indent = Math.max(0, indent - 1);
      out.push('  '.repeat(indent) + text);
    } else if (/^<[^?!]/.test(text) && !/\/>$/.test(text) && !/<.*>.*<.*>/.test(text)) {
      out.push('  '.repeat(indent) + text);
      indent++;
    } else if (/\/>$/.test(text) || /^<[?!]/.test(text)) {
      out.push('  '.repeat(indent) + text);
    } else {
      // Text node — attach to previous tag if possible
      if (out.length > 0) out[out.length - 1] += text;
      else out.push(text);
    }
  }
  return out.join('\n');
}

// Minimal syntax colouring via span wraps (colours from dark.css vars)
function highlight(escaped) {
  return escaped
    // attributes: name="value"
    .replace(/(\s[\w:-]+)(=)(&quot;[^&]*&quot;)/g, '<span style="color:var(--accent-dim)">$1</span>$2<span style="color:var(--ok)">$3</span>')
    // tag names
    .replace(/(&lt;\/?)([\w:-]+)/g, '<span style="color:var(--text-dim)">$1</span><span style="color:var(--accent)">$2</span>')
    // processing instructions / doctype
    .replace(/(&lt;[?!][^&]*&gt;)/g, '<span style="color:var(--text-dim)">$1</span>');
}
