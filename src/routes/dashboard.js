import express from 'express';
import { ghostStamp, BOOT, serverVersion } from '../lib/release.js';

/**
 * Dashboard UI + management API.
 *
 * UI:
 *   GET  /                      → dashboard
 *
 * API (JSON):
 *   GET  /healthz               → overall + per-app health
 *   GET  /api/apps              → list apps
 *   POST /api/apps/:name/start
 *   POST /api/apps/:name/stop
 *   POST /api/apps/:name/restart
 *   POST /api/apps/:name/test   → run the app's test command (stub)
 *   POST /api/apps/:name/deploy → run the app's deploy command (stub)
 *   POST /api/discover          → rescan apps/
 */
export function dashboardRouter(appManager) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    const apps = appManager.list();
    const health = await appManager.healthReport();
    res.render('dashboard', {
      title: 'Sandbox',
      apps,
      health,
      ghost: ghostStamp({ version: serverVersion, loadedAt: BOOT }),
    });
  });

  router.get('/healthz', async (req, res) => {
    const health = await appManager.healthReport();
    const ok = Object.values(health).every((h) => h.ok);
    res.status(ok ? 200 : 503).json({ ok, uptime: process.uptime(), apps: health });
  });

  router.get('/api/apps', (req, res) => {
    res.json(appManager.list());
  });

  const action = (fn) => async (req, res) => {
    try {
      const entry = await fn(req.params.name);
      if (!entry) return res.status(404).json({ error: 'No such app' });
      res.json({ ok: true, app: { name: entry.name, status: entry.status } });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  };

  router.post('/api/apps/:name/start', action((n) => appManager.start(n)));
  router.post('/api/apps/:name/stop', action((n) => appManager.stop(n)));
  router.post('/api/apps/:name/restart', action((n) => appManager.restart(n)));

  // Test / deploy are stubbed hooks — wire to real commands per app later.
  router.post('/api/apps/:name/test', (req, res) => {
    res.json({ ok: true, stub: true, message: `test hook for "${req.params.name}" not wired yet.` });
  });
  router.post('/api/apps/:name/deploy', (req, res) => {
    res.json({ ok: true, stub: true, message: `deploy hook for "${req.params.name}" not wired yet.` });
  });

  router.post('/api/discover', async (req, res) => {
    await appManager.discoverAll();
    res.json({ ok: true, apps: appManager.list() });
  });

  return router;
}
