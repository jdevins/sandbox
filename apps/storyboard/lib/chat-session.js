// In-memory session store. Sessions are per-board-tab and ephemeral by design.
// Each session tracks turn count, conversation history, and last board snapshot
// for delta computation.

const sessions = new Map();

export function newSessionId() {
  return `sess_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function getSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, { turn: 0, history: [], lastSnapshot: null });
  }
  return sessions.get(sessionId);
}

// Format conversation history as a readable transcript for the prompt.
export function formatHistory(history) {
  if (!history.length) return '';
  return history
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n\n');
}
