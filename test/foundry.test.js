import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createServer } from '../src/app.js';
import { createEngine } from '../apps/claude-engine/features/foundry/lib/engine.js';
import * as letterA from '../apps/claude-engine/features/foundry/scenarios/letter-a.scenario.js';

const agentsDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../apps/claude-engine/features/foundry/agents',
);

// Drive the engine by hand (no timers) so the loop is deterministic in tests.
async function runToCompletion(configName, overrides = []) {
  const e = await createEngine({ scenario: letterA, configName, throttle: 0, agentsDir, workerOverrides: overrides });
  let guard = 0;
  while (!e.state.done && guard++ < 6000) e.tick();
  return e;
}

test('solo builder fills every target cell', async () => {
  const e = await runToCompletion('solo');
  assert.equal(e.state.done, true, 'run finishes');
  assert.equal(e.score(), 100, 'letter A fully built');
});

test('crew (foreman + fetchers + inspector) completes the build', async () => {
  const e = await runToCompletion('crew');
  assert.equal(e.score(), 100);
});

test('the run is deterministic from the seed', async () => {
  const a = await createEngine({ scenario: letterA, configName: 'solo', throttle: 0, agentsDir });
  const b = await createEngine({ scenario: letterA, configName: 'solo', throttle: 0, agentsDir });
  assert.deepEqual(
    a.state.pieces.map((p) => [p.x, p.y]),
    b.state.pieces.map((p) => [p.x, p.y]),
    'same seed scatters pieces identically',
  );
});

test('hoarding (carry-until-full) costs far more budget than just-in-time delivery', async () => {
  const spend = async (deliver) => {
    const e = await createEngine({
      scenario: letterA, configName: 'solo', throttle: 0, agentsDir, budget: 100000,
      workerOverrides: [{ id: 'mason', strategy: { capacity: 6, deliver } }],
    });
    let g = 0;
    while (!e.state.done && g++ < 20000) e.tick();
    assert.equal(e.score(), 100);
    return e.state.budget.total - e.state.budget.remaining;
  };
  const lean = await spend('nearest');
  const hoard = await spend('full');
  assert.ok(hoard > lean * 2, `hoarding (${hoard}) should cost >2x lean (${lean})`);
});

test('a tight budget rewards lean delivery and punishes hoarding', async () => {
  const lean = await createEngine({
    scenario: letterA, configName: 'solo', throttle: 0, agentsDir, budget: 600,
    workerOverrides: [{ id: 'mason', strategy: { capacity: 3, deliver: 'nearest' } }],
  });
  let g = 0;
  while (!lean.state.done && g++ < 20000) lean.tick();
  assert.equal(lean.score(), 100, 'lean delivery finishes inside the budget');

  const hoard = await createEngine({
    scenario: letterA, configName: 'solo', throttle: 0, agentsDir, budget: 600,
    workerOverrides: [{ id: 'mason', strategy: { capacity: 8, deliver: 'full' } }],
  });
  g = 0;
  while (!hoard.state.done && g++ < 20000) hoard.tick();
  assert.ok(hoard.score() < 100, 'hoarding runs out of budget before finishing');
  assert.equal(hoard.state.budget.remaining, 0, 'budget is fully spent');
});

test('a roster of only foremen builds nothing (no one can carry)', async () => {
  const e = await createEngine({
    scenario: letterA, throttle: 0, agentsDir, budget: 5000,
    roster: [
      { id: 'a', agent: 'foreman', role: 'foreman', name: 'Otis', strategy: { assign: 'nearest' } },
      { id: 'b', agent: 'foreman', role: 'foreman', name: 'Burt', strategy: { assign: 'nearest' } },
    ],
  });
  let g = 0;
  while (!e.state.done && g++ < 20000) e.tick();
  assert.equal(e.score(), 0, 'nothing gets placed');
});

test('a custom roster honors each chosen role (lone fetcher completes it)', async () => {
  const e = await createEngine({
    scenario: letterA, throttle: 0, agentsDir, budget: 5000,
    roster: [{ id: 'solo', agent: 'fetcher', role: 'fetcher', name: 'Lone', strategy: { pick: 'nearest', capacity: 3, deliver: 'nearest' } }],
  });
  assert.equal(e.state.workers[0].role, 'fetcher');
  let g = 0;
  while (!e.state.done && g++ < 20000) e.tick();
  assert.equal(e.score(), 100);
});

test('worker overrides (rename + strategy edit) apply', async () => {
  const e = await createEngine({
    scenario: letterA, configName: 'solo', throttle: 0, agentsDir,
    workerOverrides: [{ id: 'mason', name: 'Bob', strategy: { fill: 'bottom-up' } }],
  });
  assert.equal(e.state.workers[0].name, 'Bob');
  assert.equal(e.state.workers[0].strategy.fill, 'bottom-up');
});

test('the foundry observatory page is served', async () => {
  const { app, appManager } = await createServer();
  await appManager.discoverAll();
  const server = app.listen(0);
  const base = `http://localhost:${server.address().port}`;

  const res = await fetch(`${base}/apps/claude-engine/features/foundry/letter-a`);
  assert.equal(res.status, 200);
  const body = await res.text();
  assert.ok(body.includes('foundry-data'), 'page embeds the client payload');

  server.close();
});
