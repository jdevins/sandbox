import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/app.js';

// Boots the app without binding a port and exercises the core surface.
test('discovers example apps and serves them', async () => {
  process.env.NODE_ENV = 'test';
  process.env.ENGINE_LLM = 'mock';
  const { app, appManager } = await createServer();
  await appManager.discoverAll();

  const names = appManager.list().map((a) => a.name).sort();
  assert.ok(names.includes('backlog'), 'backlog app discovered');
  assert.ok(names.includes('claude-engine'), 'claude-engine app discovered');

  const server = app.listen(0);
  try {
    const port = server.address().port;
    const base = `http://localhost:${port}`;

    const health = await fetch(`${base}/healthz`).then((r) => r.json());
    assert.equal(health.ok, true);

    const items = await fetch(`${base}/apps/backlog/api/items`).then((r) => r.json());
    assert.ok(Array.isArray(items), 'backlog api returns an item list');

    await appManager.stop('backlog');
    const stopped = await fetch(`${base}/apps/backlog/api/items`);
    assert.equal(stopped.status, 503, 'stopped app returns 503');
  } finally {
    server.close();
  }
});
