import express from 'express';

// Example app with in-memory state + a form, to show a slightly richer app.
// State lives in module scope, so a "Restart" from the dashboard clears it.
export const meta = {
  name: 'Guestbook',
  description: 'In-memory guestbook with a post form. Restart to clear entries.',
  version: '1.0.0',
};

export function createApp({ name }) {
  const router = express.Router();
  const entries = [];

  router.get('/', (req, res) => {
    const list = entries.length
      ? entries.map((e) => `<div class="card" style="margin-bottom:10px"><b>${esc(e.who)}</b><br>${esc(e.msg)}</div>`).join('')
      : '<div class="empty">No entries yet.</div>';
    res.type('html').send(`<!doctype html><html data-theme="dark"><head>
      <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Guestbook</title><link rel="stylesheet" href="/static/css/dark.css"></head>
      <body><div class="wrap">
        <header class="site"><h1>📓 Guestbook</h1><a class="muted" href="/">← Dashboard</a></header>
        <form class="card" method="post" action="/apps/${name}/" style="margin-bottom:16px">
          <div class="row"><input class="btn" name="who" placeholder="name" required>
          <input class="btn" name="msg" placeholder="message" required style="flex:1">
          <button class="btn primary" type="submit">Sign</button></div>
        </form>${list}
      </div></body></html>`);
  });

  router.post('/', (req, res) => {
    const { who, msg } = req.body || {};
    if (who && msg) entries.unshift({ who: String(who).slice(0, 40), msg: String(msg).slice(0, 200) });
    res.redirect(`/apps/${name}/`);
  });

  router.get('/api/entries', (req, res) => res.json(entries));

  return router;
}

export function health() {
  return { ok: true, detail: 'in-memory store' };
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
