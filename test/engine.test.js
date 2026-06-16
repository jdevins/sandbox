import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/app.js';

// Exercises the Claude Engine: discovery, feature mounting, code-first stores,
// the evaluation runner, and an agent run through the mock provider.
test('claude-engine: features, eval, and agent run', async () => {
  const { app, appManager } = await createServer();
  await appManager.discoverAll();
  assert.ok(appManager.list().some((a) => a.name === 'claude-engine'), 'engine discovered');

  const server = app.listen(0);
  const base = `http://localhost:${server.address().port}/apps/claude-engine`;

  // Overview + feature libraries render.
  for (const p of ['/', '/features/skill-builder', '/features/agent-composer', '/memories']) {
    assert.equal((await fetch(base + p)).status, 200, `${p} renders`);
  }

  // Evaluation runner passes the seeded skill's tests.
  const evalHtml = await fetch(`${base}/features/skill-builder/word-count/eval`, { method: 'POST' }).then((r) => r.text());
  assert.match(evalHtml, /2\/2 passed/, 'word-count tests pass');

  // Agent run flows through the mock provider.
  const runHtml = await fetch(`${base}/features/agent-composer/summarizer/run`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'task=hello world',
  }).then((r) => r.text());
  assert.match(runHtml, /mock reply/, 'agent produced a reply');

  server.close();
});
