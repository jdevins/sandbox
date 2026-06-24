import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/app.js';

// Exercises the Claude Engine: discovery, feature mounting, code-first stores,
// the evaluation runner, and an agent run through the mock provider.
test('claude-engine: features, eval, and agent run', async () => {
  process.env.NODE_ENV = 'test';
  // Force the mock provider — the real default shells out to the `claude` CLI,
  // which is slow, non-deterministic, and burns real tokens on every test run.
  process.env.ENGINE_LLM = 'mock';
  const { app, appManager } = await createServer();
  await appManager.discoverAll();
  assert.ok(appManager.list().some((a) => a.name === 'claude-engine'), 'engine discovered');

  const server = app.listen(0);
  try {
    const base = `http://localhost:${server.address().port}/apps/claude-engine`;

    // Overview + feature libraries render.
    for (const p of ['/', '/features/skill-builder', '/features/agent-composer', '/memories']) {
      assert.equal((await fetch(base + p)).status, 200, `${p} renders`);
    }

    // Evaluation runner passes the seeded skill's tests. Skills/agents are
    // multi-owner now, so the route carries the owner segment.
    const evalHtml = await fetch(`${base}/features/skill-builder/claude-engine/check-standards/eval`, { method: 'POST' }).then((r) => r.text());
    assert.match(evalHtml, /3\/3 passed/, 'check-standards tests pass');

    // Agent run flows through the mock provider.
    const runHtml = await fetch(`${base}/features/agent-composer/claude-engine/summarizer/run`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'task=hello world',
    }).then((r) => r.text());
    assert.match(runHtml, /mock reply/, 'agent produced a reply');
  } finally {
    server.close();
  }
});
