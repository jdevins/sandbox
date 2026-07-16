// Shared HTML escaping + tagged-template helper. Server-layer, not app-layer —
// apps import this the same way they already import ghostStamp from release.js.

export const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const RAW = Symbol('raw');
export const raw = (s) => ({ [RAW]: true, value: String(s) });

function render(v) {
  if (v == null || v === false) return '';
  if (Array.isArray(v)) return v.map(render).join('');
  if (typeof v === 'object' && v[RAW]) return v.value;
  return esc(v);
}

/** Tagged template: `html\`<div>${userInput}</div>\`` escapes interpolations by default; wrap trusted fragments in raw(). */
export function html(strings, ...values) {
  let out = '';
  strings.forEach((s, i) => {
    out += s + (i < values.length ? render(values[i]) : '');
  });
  return raw(out);
}

/** Render a fragment (string | raw | array) to a final HTML string. */
export const toHtml = (v) => render(v);
