import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AppManager } from './appManager.js';
import { lightAuth } from './auth.js';
import { dashboardRouter } from './routes/dashboard.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');

/**
 * Builds the Express app and its AppManager. Kept separate from server.js so
 * tests can spin up the app without binding a port.
 */
export async function createServer() {
  const app = express();

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));

  // Default 100kb body limit is too small for pasted exports (e.g. session-repack
  // import bundles routinely run into the hundreds of KB per day).
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));
  app.use('/static', express.static(path.join(ROOT, 'public')));

  // Light auth: a no-op unless SANDBOX_TOKEN is set. See src/auth.js.
  app.use(lightAuth);

  const appManager = new AppManager({ appsDir: path.join(ROOT, 'apps') });

  // Dashboard + management API.
  app.use('/', dashboardRouter(appManager));

  // Live dispatcher for sandbox apps. Resolves the router at request time so
  // enable/disable/restart take effect without restarting Express.
  app.use('/apps/:name', (req, res, next) => {
    const entry = appManager.get(req.params.name);
    if (!entry) return res.status(404).render('error', { title: 'Not found', message: `No app named "${req.params.name}".` });
    if (entry.status !== 'running') {
      return res.status(503).render('error', {
        title: 'App stopped',
        message: `App "${req.params.name}" is ${entry.status}. Launch it from the dashboard.`,
      });
    }
    return entry.router(req, res, next);
  });

  app.use((req, res) => {
    res.status(404).render('error', { title: 'Not found', message: 'Nothing here.' });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).render('error', { title: 'Server error', message: err.message });
  });

  return { app, appManager };
}
