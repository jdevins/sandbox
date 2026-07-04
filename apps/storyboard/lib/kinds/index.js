import * as markdown from './markdown.js';
import * as json from './json.js';
import * as html from './html.js';
import * as xml from './xml.js';
import * as sql from './sql.js';
import * as prompt from './prompt.js';
import * as agent from './agent.js';
import * as toolCall from './tool-call.js';
import * as hook from './hook.js';
import * as gate from './gate.js';
import * as memory from './memory.js';
import * as output from './output.js';
import * as evalKind from './eval.js';
import * as start from './start.js';
import * as end from './end.js';
import * as branch from './branch.js';
import * as merge from './merge.js';
import * as parallel from './parallel.js';
import * as join from './join.js';
import * as wait from './wait.js';
import * as error from './error.js';
import * as loopBack from './loop-back.js';

// New kinds register here. Each module exports { definition, render }.
// The canvas/API never branch on a kind id directly — they only call
// getKind(id).render(...) and read getKind(id).definition.
const registry = [markdown, json, html, xml, sql, prompt, agent, toolCall, hook, gate, memory, output, evalKind,
  start, end, branch, merge, parallel, join, wait, error, loopBack];

export const kinds = Object.fromEntries(registry.map((k) => [k.definition.id, k]));

export function getKind(id) {
  return kinds[id] || null;
}

export function listDefinitions() {
  return registry.map((k) => k.definition);
}
