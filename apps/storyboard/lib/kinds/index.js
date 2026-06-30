import * as markdown from './markdown.js';
import * as json from './json.js';
import * as html from './html.js';
import * as xml from './xml.js';

// New kinds register here. Each module exports { definition, render }.
// The canvas/API never branch on a kind id directly — they only call
// getKind(id).render(...) and read getKind(id).definition.
const registry = [markdown, json, html, xml];

export const kinds = Object.fromEntries(registry.map((k) => [k.definition.id, k]));

export function getKind(id) {
  return kinds[id] || null;
}

export function listDefinitions() {
  return registry.map((k) => k.definition);
}
