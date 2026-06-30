import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from '../../../src/app.js';

export const GRID = 20;
const SCHEMA_VERSION = 1;

const DATA_DIR = path.join(ROOT, 'data', 'storyboard');
const BOARDS_INDEX = path.join(DATA_DIR, 'boards.json');

const boardDir = (id) => path.join(DATA_DIR, 'boards', id);
const cardsFile = (id) => path.join(boardDir(id), 'cards.json');
const edgesFile = (id) => path.join(boardDir(id), 'edges.json');

function readJSON(file, fallback) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJSON(file, data) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(data, null, 2));
}

const snapToGrid = (n) => Math.round((Number(n) || 0) / GRID) * GRID;

function newId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

// ─── Boards ──────────────────────────────────────────────────────────────────

export function listBoards() {
  return readJSON(BOARDS_INDEX, []);
}

export function getBoard(id) {
  return listBoards().find((b) => b.id === id) || null;
}

export function createBoard({ name }) {
  const boards = listBoards();
  const board = { id: newId('board'), name: name || 'Untitled board', createdAt: new Date().toISOString() };
  boards.unshift(board);
  if (!existsSync(BOARDS_INDEX)) mkdirSync(DATA_DIR, { recursive: true });
  writeJSON(BOARDS_INDEX, boards);
  writeJSON(cardsFile(board.id), []);
  writeJSON(edgesFile(board.id), []);
  return board;
}

export function deleteBoard(id) {
  const boards = listBoards().filter((b) => b.id !== id);
  writeJSON(BOARDS_INDEX, boards);
  rmSync(boardDir(id), { recursive: true, force: true });
}

// ─── Cards ───────────────────────────────────────────────────────────────────
// schemaVersion is stamped now (even with no migration logic yet) so a future
// kind-shape change can tell old cards from new ones instead of guessing.

function normalizeCard(c) {
  const defined = Object.fromEntries(Object.entries(c).filter(([, v]) => v !== undefined));
  return {
    schemaVersion: SCHEMA_VERSION,
    w: 180,
    h: 120,
    payload: {},
    createdAt: new Date().toISOString(),
    ...defined,
    x: snapToGrid(defined.x),
    y: snapToGrid(defined.y),
  };
}

export function listCards(boardId) {
  return readJSON(cardsFile(boardId), []);
}

export function saveCard(boardId, card) {
  const cards = listCards(boardId);
  const idx = cards.findIndex((c) => c.id === card.id);
  if (idx === -1) cards.push(card);
  else cards[idx] = card;
  writeJSON(cardsFile(boardId), cards);
  return card;
}

export function createCard(boardId, { kind, x, y, w, h, payload }) {
  const card = normalizeCard({ id: newId('card'), kind, x, y, w, h, payload });
  return saveCard(boardId, card);
}

export function updateCard(boardId, cardId, patch) {
  const cards = listCards(boardId);
  const card = cards.find((c) => c.id === cardId);
  if (!card) return null;
  Object.assign(card, patch);
  if (patch.x !== undefined) card.x = snapToGrid(patch.x);
  if (patch.y !== undefined) card.y = snapToGrid(patch.y);
  writeJSON(cardsFile(boardId), cards);
  return card;
}

export function deleteCard(boardId, cardId) {
  const cards = listCards(boardId).filter((c) => c.id !== cardId);
  writeJSON(cardsFile(boardId), cards);
  const edges = listEdges(boardId).filter((e) => e.from !== cardId && e.to !== cardId);
  writeJSON(edgesFile(boardId), edges);
}

// ─── Edges ───────────────────────────────────────────────────────────────────
// Edges are their own collection, not embedded in cards, so a new edge kind
// (e.g. a future data-passing "pipe") can be added without migrating cards.

export function listEdges(boardId) {
  return readJSON(edgesFile(boardId), []);
}

export function createEdge(boardId, { from, to, kind }) {
  const edges = listEdges(boardId);
  const edge = { id: newId('edge'), from, to, kind: kind || 'link', createdAt: new Date().toISOString() };
  edges.push(edge);
  writeJSON(edgesFile(boardId), edges);
  return edge;
}

export function deleteEdge(boardId, edgeId) {
  const edges = listEdges(boardId).filter((e) => e.id !== edgeId);
  writeJSON(edgesFile(boardId), edges);
}
