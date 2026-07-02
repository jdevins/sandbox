/**
 * Loosely-coupled context builder for the board chat.
 *
 * Sources register themselves via registerSource(). buildSystemPrompt()
 * runs them all in parallel (one batch) and joins the results.
 * Add or remove sources without touching the chat route.
 */

import { listCards, listEdges, listFrames, getBoard } from './store.js';
import { listDefinitions } from './kinds/index.js';

const sources = [];
export function registerSource(fn) { sources.push(fn); }

export async function buildSystemPrompt(boardId, session) {
  const parts = await Promise.all(sources.map((fn) => fn(boardId, session)));
  return parts.filter(Boolean).join('\n\n---\n\n');
}

// ── Source: static storyboard rules ─────────────────────────────────────────
registerSource(() => `\
You are an expert analyst embedded in Storyboard, a canvas-based workflow design tool.

Your responsibilities:
- Walk through the board flow and explain what each card does in order
- Simulate step-by-step execution: what runs, what it produces, what flows to the next card
- Identify issues with card content, ordering, missing connections, or misused kinds
- Suggest concrete improvements
- Help author or modify cards when asked

Canvas model:
- Cards are nodes with a KIND (defines structure) and a PAYLOAD (the content)
- Connectors are directed edges: A → B means B receives output from A
- Execution follows connectors; a card with no incoming connector is a starting point
- Frames (group/loop/note) are visual regions — loops indicate repeated execution
- Card coordinates (x,y) reflect left-to-right or top-to-bottom reading order by convention`);

// ── Source: kind definitions (only kinds present on this board) ───────────────
// Included on turn 0; subsequent turns carry it in conversation history.
registerSource(async (boardId, session) => {
  if (session.turn > 0) return null; // already in history
  const cards = await Promise.resolve(listCards(boardId));
  const usedKinds = new Set(cards.map((c) => c.kind));
  const defs = listDefinitions().filter((d) => usedKinds.has(d.id));
  if (!defs.length) return null;
  const lines = defs.map((d) => {
    const fields = Object.entries(d.payloadSchema || {})
      .map(([k, t]) => {
        const hint = d.fieldHints?.[k] ? ` — ${d.fieldHints[k]}` : '';
        return `    ${k} (${t})${hint}`;
      })
      .join('\n');
    return `${d.id}: ${d.description}\n${fields}`;
  });
  return `## Card Kinds on This Board\n${lines.join('\n\n')}`;
});

// ── Source: live board state ──────────────────────────────────────────────────
// Turn 0: full snapshot. Turn N: delta from last snapshot.
registerSource(async (boardId, session) => {
  const [board, cards, edges, frames] = await Promise.all([
    Promise.resolve(getBoard(boardId)),
    Promise.resolve(listCards(boardId)),
    Promise.resolve(listEdges(boardId)),
    Promise.resolve(listFrames(boardId)),
  ]);

  const snapshot = { cards, edges, frames };

  if (session.turn === 0) {
    session.lastSnapshot = snapshot;
    return formatFullBoard(board, cards, edges, frames);
  }

  // Delta mode for subsequent turns
  const delta = computeDelta(session.lastSnapshot, snapshot);
  session.lastSnapshot = snapshot;
  return delta || '## Board State\n(no changes since last message)';
});

// ── Serialisation helpers ─────────────────────────────────────────────────────

function formatFullBoard(board, cards, edges, frames) {
  const lines = [`## Board: "${board?.name || '(unknown)'}"`];

  if (frames.length) {
    lines.push(`\nFrames (${frames.length}):`);
    for (const f of frames) {
      const members = cards.filter((c) => c.frameId === f.id).map((c) => c.id);
      lines.push(`  [${f.id}] "${f.label || f.type}" (${f.type}) at (${f.x},${f.y}) ${f.w}×${f.h}`);
      if (members.length) lines.push(`    contains: ${members.join(', ')}`);
    }
  }

  if (cards.length) {
    lines.push(`\nCards (${cards.length}):`);
    for (const c of cards) {
      lines.push(`  [${c.id}] ${c.kind} at (${c.x},${c.y}) ${c.w || 180}×${c.h || 120}`);
      for (const [k, v] of Object.entries(c.payload || {})) {
        const val = typeof v === 'object' ? JSON.stringify(v) : String(v ?? '');
        const trimmed = val.length > 120 ? val.slice(0, 120) + '…' : val;
        if (trimmed) lines.push(`    ${k}: ${trimmed}`);
      }
    }
  } else {
    lines.push('\n(no cards on this board)');
  }

  if (edges.length) {
    lines.push(`\nConnectors (${edges.length}):`);
    for (const e of edges) lines.push(`  ${e.from} → ${e.to}`);
  } else {
    lines.push('\n(no connectors)');
  }

  return lines.join('\n');
}

function computeDelta(prev, curr) {
  const lines = ['## Board Changes Since Last Message'];
  let changed = false;

  const prevCardIds = new Set(prev.cards.map((c) => c.id));
  const currCardIds = new Set(curr.cards.map((c) => c.id));
  for (const c of curr.cards) {
    if (!prevCardIds.has(c.id)) { lines.push(`+ card [${c.id}] ${c.kind} added at (${c.x},${c.y})`); changed = true; }
  }
  for (const c of prev.cards) {
    if (!currCardIds.has(c.id)) { lines.push(`- card [${c.id}] removed`); changed = true; }
  }
  // Detect moved or payload-changed cards
  for (const c of curr.cards) {
    const p = prev.cards.find((x) => x.id === c.id);
    if (!p) continue;
    if (p.x !== c.x || p.y !== c.y) { lines.push(`~ card [${c.id}] moved to (${c.x},${c.y})`); changed = true; }
    if (JSON.stringify(p.payload) !== JSON.stringify(c.payload)) {
      lines.push(`~ card [${c.id}] payload updated`);
      for (const [k, v] of Object.entries(c.payload || {})) {
        const val = typeof v === 'object' ? JSON.stringify(v) : String(v ?? '');
        lines.push(`    ${k}: ${val.length > 80 ? val.slice(0, 80) + '…' : val}`);
      }
      changed = true;
    }
  }

  const prevEdgeIds = new Set(prev.edges.map((e) => e.id));
  const currEdgeIds = new Set(curr.edges.map((e) => e.id));
  for (const e of curr.edges) {
    if (!prevEdgeIds.has(e.id)) { lines.push(`+ connector ${e.from} → ${e.to} added`); changed = true; }
  }
  for (const e of prev.edges) {
    if (!currEdgeIds.has(e.id)) { lines.push(`- connector ${e.from} → ${e.to} removed`); changed = true; }
  }

  return changed ? lines.join('\n') : null;
}
