import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { jsonStore } from './lib/store.js';
import { discoverOwners, multiStore } from './lib/registry.js';
import { getProvider } from './lib/provider.js';
import { usageLog } from './lib/usageLog.js';
import { discoverFeatures } from './lib/features.js';
import * as ui from './components/widgets.js';
import { page, markBuild } from './components/layout.js';
import { overviewPage } from './pages/overview.js';
import { memoriesRouter } from './pages/memories.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const meta = {
  name: 'Claude Engine',
  description: 'Authoring & ops console for Claude: skills, agents, memories — code-first and modular.',
  version: '0.1.0',
};

export async function createApp({ name }) {
  markBuild(meta); // refresh the build stamp's load epoch on every (re)load
  const router = express.Router();
  const dataDir = path.join(__dirname, 'data');
  const appsDir = path.join(__dirname, '..');

  const [skillOwners, agentOwners] = await Promise.all([
    discoverOwners({ appsDir, engineOwner: name, engineDir: path.join(dataDir, 'skills'), kind: 'skills', suffix: '.skill.js' }),
    discoverOwners({ appsDir, engineOwner: name, engineDir: path.join(dataDir, 'agents'), kind: 'agents', suffix: '.agent.js' }),
  ]);

  // Engine context — explicit dependencies handed to every feature so
  // capabilities stay modular, swappable, and uncommingled. skills/agents are
  // multi-owner: the engine leases the right to craft them, each owning app
  // keeps and runs its own copy.
  const ctx = {
    appName: name,
    base: `/apps/${name}`,
    paths: { app: __dirname, data: dataDir },
    stores: {
      skills: multiStore(skillOwners),
      agents: multiStore(agentOwners),
      memories: jsonStore({ dir: path.join(dataDir, 'memories') }),
    },
    provider: getProvider(),
    usage: usageLog({ dataDir }),
    ui,
    page,
  };

  // App-local static assets (engine.css / engine.js) — not shared with other apps.
  router.use('/assets', express.static(path.join(__dirname, 'public')));

  // Discover + mount features. Each feature gets the engine ctx.
  const features = await discoverFeatures(path.join(__dirname, 'features'));
  ctx.features = features.map((f) => ({ id: f.id, ...f.meta, error: f.error }));
  for (const f of features) {
    if (!f.createFeature) continue;
    const sub = await f.createFeature({ ...ctx, featureId: f.id, base: `${ctx.base}/features/${f.id}` });
    router.use(`/features/${f.id}`, sub);
  }

  // Pages that expose vital components.
  router.use('/memories', memoriesRouter(ctx));
  router.get('/', (req, res) => overviewPage(ctx, req, res));

  return router;
}

export async function health() {
  return { ok: true, detail: 'engine online' };
}
