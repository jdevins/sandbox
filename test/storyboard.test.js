import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/app.js';
import { deleteBoard } from '../apps/storyboard/lib/store.js';

test('storyboard: board + card + edge contract round-trip', async () => {
  process.env.NODE_ENV = 'test';
  const { app, appManager } = await createServer();
  await appManager.discoverAll();

  const server = app.listen(0);
  let boardId;
  try {
    const port = server.address().port;
    const base = `http://localhost:${port}/apps/storyboard`;

    const contract = await fetch(`${base}/api/contract`).then((r) => r.json());
    assert.ok(contract.kinds.find((k) => k.id === 'markdown'), 'markdown kind registered');
    assert.ok(contract.kinds.find((k) => k.id === 'json'), 'json kind registered');
    assert.ok(contract.kinds.find((k) => k.id === 'html'), 'html kind registered');

    const board = await fetch(`${base}/api/boards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test board' }),
    }).then((r) => r.json());
    assert.ok(board.id);
    boardId = board.id;

    const card = await fetch(`${base}/api/boards/${board.id}/cards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'markdown', x: 13, y: 27, payload: { text: '# hi' } }),
    }).then((r) => r.json());
    assert.equal(card.x, 20, 'x snapped to grid');
    assert.equal(card.y, 20, 'y snapped to grid');

    const card2 = await fetch(`${base}/api/boards/${board.id}/cards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'json', x: 200, y: 200, payload: { value: { a: 1 } } }),
    }).then((r) => r.json());

    const rendered = await fetch(`${base}/api/boards/${board.id}/cards/${card.id}/render`).then((r) => r.json());
    assert.equal(rendered.renderMode, 'inline');
    assert.match(rendered.html, /<h3>hi<\/h3>/);

    const edge = await fetch(`${base}/api/boards/${board.id}/edges`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: card.id, to: card2.id }),
    }).then((r) => r.json());
    assert.equal(edge.kind, 'link');

    const dispatch = await fetch(`${base}/api/boards/${board.id}/cards/${card.id}/actions/delete`, { method: 'POST' });
    assert.equal(dispatch.status, 202);
    const { jobId } = await dispatch.json();

    await new Promise((resolve) => setTimeout(resolve, 50));
    const job = await fetch(`${base}/api/boards/${board.id}/actions/${jobId}`).then((r) => r.json());
    assert.equal(job.status, 'ok');

    const cardsAfter = await fetch(`${base}/api/boards/${board.id}/cards`).then((r) => r.json());
    assert.equal(cardsAfter.find((c) => c.id === card.id), undefined, 'card deleted');
  } finally {
    server.close();
    if (boardId) deleteBoard(boardId);
  }
});
