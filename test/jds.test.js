import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/app.js';

// NODE_ENV=test keeps claude-engine's session-repack cron from scheduling and
// pinning the event loop, which otherwise stalls this file for the full timeout.
test('jds app serves its page', async () => {
  process.env.NODE_ENV = 'test';
  const { app, appManager } = await createServer();
  await appManager.discoverAll();

  const server = app.listen(0);
  try {
    const port = server.address().port;
    const res = await fetch(`http://localhost:${port}/apps/jds/`);
    assert.equal(res.status, 200);
  } finally {
    server.close();
  }
});
