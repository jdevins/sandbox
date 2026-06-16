import express from 'express';

// Minimal example app. Copy this folder as a starting point for new apps.
export const meta = {
  name: 'Hello',
  description: 'Smallest possible sandbox app — a greeting and a JSON endpoint.',
  version: '1.0.0',
};

export function createApp({ name }) {
  const router = express.Router();

  router.get('/', (req, res) => {
    res.type('html').send(`<!doctype html><html data-theme="dark"><head>
      <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Hello</title><link rel="stylesheet" href="/static/css/dark.css"></head>
      <body><div class="wrap">
        <header class="site"><h1>👋 Hello</h1><a class="muted" href="/">← Dashboard</a></header>
        <div class="card"><p>This app is mounted at <code>/apps/${name}</code>.</p>
        <p><a href="/apps/${name}/api/ping">GET /api/ping →</a></p></div>
      </div></body></html>`);
  });

  router.get('/api/ping', (req, res) => res.json({ app: name, pong: true, at: Date.now() }));

  return router;
}

export function health() {
  return { ok: true, detail: 'always up' };
}
