import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/app.js';

// Boots the app without binding a port and exercises the core surface.
test('discovers example apps and serves them', async () => {
  const { app, appManager } = await createServer();
  await appManager.discoverAll();

  const names = appManager.list().map((a) => a.name).sort();
  assert.ok(names.includes('hello'), 'hello app discovered');
  assert.ok(names.includes('guestbook'), 'guestbook app discovered');

  const server = app.listen(0);
  const port = server.address().port;
  const base = `http://localhost:${port}`;

  const health = await fetch(`${base}/healthz`).then((r) => r.json());
  assert.equal(health.ok, true);

  const ping = await fetch(`${base}/apps/hello/api/ping`).then((r) => r.json());
  assert.equal(ping.pong, true);

  await appManager.stop('hello');
  const stopped = await fetch(`${base}/apps/hello/api/ping`);
  assert.equal(stopped.status, 503, 'stopped app returns 503');

  server.close();
});
