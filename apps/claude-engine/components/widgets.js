import { html } from '../lib/html.js';

// App-local UI widgets. Every built component has a UI wrapper; configurable
// components render a config widget via `configForm` from a schema.

export const pageHead = ({ title, subtitle, actions }) => html`
  <header class="eng-head">
    <div><h1>${title}</h1>${subtitle ? html`<p class="dim">${subtitle}</p>` : ''}</div>
    <div class="row">${actions || ''}</div>
  </header>`;

export const card = ({ title, badge, desc, meta, actions }) => html`
  <div class="card">
    <div class="row spread"><h2>${title}</h2>${badge || ''}</div>
    ${desc ? html`<div class="desc">${desc}</div>` : ''}
    ${meta ? html`<div class="meta">${meta}</div>` : ''}
    ${actions ? html`<div class="card-actions">${actions}</div>` : ''}
  </div>`;

export const grid = (cards) => html`<div class="grid">${cards}</div>`;

export const empty = (msg) => html`<div class="empty">${msg}</div>`;

export const badge = (text, kind = '') => html`<span class="badge ${kind}">${text}</span>`;

// `status` (a JSON status endpoint URL) marks the button as a background job
// trigger — the client polls it for progress inline instead of navigating to
// a status page. Used for llm actions like summarize/trend.
export const btn = ({ href, label, action, name, primary, danger, llm, method, title, status }) => {
  const cls = ['btn', primary ? 'primary' : '', danger ? 'danger' : '', llm ? 'llm' : ''].filter(Boolean).join(' ');
  if (href) return html`<a class="${cls}" title="${title || ''}" href="${href}">${label}</a>`;
  return html`<button class="${cls}" title="${title || ''}" data-action="${action || ''}" data-name="${name || ''}" data-method="${method || 'POST'}" data-llm-status="${status || ''}">${label}</button>`;
};

// Overflow action menu for page headers — collapses several actions behind a
// single "⋯" toggle so headers stay scannable. Built on <details>, matching the
// .collapsible pattern, so it needs no custom JS.
export const menu = (items, { label = '⋯' } = {}) => html`
  <details class="eng-menu">
    <summary class="btn" title="Actions">${label}</summary>
    <div class="eng-menu-body">${items}</div>
  </details>`;

export const table = (headers, rows) => html`
  <table class="eng-table">
    <thead><tr>${headers.map((h) => html`<th>${h}</th>`)}</tr></thead>
    <tbody>${rows.map((r) => html`<tr>${r.map((c) => html`<td>${c}</td>`)}</tr>`)}</tbody>
  </table>`;

/**
 * Schema-driven configuration widget. `fields` is an array of:
 *   { name, label, type, required, placeholder, value, options, help, rows }
 * type ∈ string | text | number | boolean | select | code
 */
export function configForm({ action, method = 'POST', fields, submit = 'Save', extra }) {
  return html`
    <form class="eng-form card" method="${method}" action="${action}">
      ${fields.map((f) => field(f))}
      ${extra || ''}
      <div class="row" style="margin-top:8px">
        <button class="btn primary" type="submit">${submit}</button>
      </div>
    </form>`;
}

function field(f) {
  const id = `f_${f.name}`;
  const req = f.required ? 'required' : '';
  let input;
  switch (f.type) {
    case 'text':
      input = html`<textarea id="${id}" name="${f.name}" rows="${f.rows || 4}" placeholder="${f.placeholder || ''}" ${req}>${f.value || ''}</textarea>`;
      break;
    case 'code':
      input = html`<textarea id="${id}" name="${f.name}" class="code" rows="${f.rows || 12}" spellcheck="false" placeholder="${f.placeholder || ''}" ${req}>${f.value || ''}</textarea>`;
      break;
    case 'boolean':
      input = html`<label class="eng-check"><input type="checkbox" id="${id}" name="${f.name}" ${f.value ? 'checked' : ''}/> ${f.checkboxLabel || 'Enabled'}</label>`;
      break;
    case 'number':
      input = html`<input type="number" id="${id}" name="${f.name}" value="${f.value ?? ''}" placeholder="${f.placeholder || ''}" ${req}/>`;
      break;
    case 'select':
      input = html`<select id="${id}" name="${f.name}" ${req}>
        ${(f.options || []).map((o) => {
          const val = typeof o === 'string' ? o : o.value;
          const lab = typeof o === 'string' ? o : o.label;
          const sel = String(f.value) === String(val) ? 'selected' : '';
          return html`<option value="${val}" ${sel}>${lab}</option>`;
        })}
      </select>`;
      break;
    default:
      input = html`<input type="text" id="${id}" name="${f.name}" value="${f.value ?? ''}" placeholder="${f.placeholder || ''}" ${req}/>`;
  }
  return html`<div class="eng-field">
    <label for="${id}">${f.label || f.name}${f.required ? html`<span class="req">*</span>` : ''}</label>
    ${input}
    ${f.help ? html`<small class="dim">${f.help}</small>` : ''}
  </div>`;
}
