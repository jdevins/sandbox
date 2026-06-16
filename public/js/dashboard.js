// Dashboard client: wires action buttons to the management API.
const toast = (msg) => {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 2200);
};

async function call(method, url) {
  const res = await fetch(url, { method });
  let body = {};
  try { body = await res.json(); } catch {}
  return { ok: res.ok, body };
}

document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  const name = btn.dataset.name;

  if (action === 'discover') {
    btn.disabled = true;
    await call('POST', '/api/discover');
    return location.reload();
  }

  if (['start', 'stop', 'restart'].includes(action)) {
    btn.disabled = true;
    const { ok, body } = await call('POST', `/api/apps/${name}/${action}`);
    toast(ok ? `${name}: ${body.app?.status || action}` : `Error: ${body.error}`);
    return setTimeout(() => location.reload(), 400);
  }

  if (['test', 'deploy'].includes(action)) {
    btn.disabled = true;
    const { body } = await call('POST', `/api/apps/${name}/${action}`);
    toast(body.message || `${action} done`);
    btn.disabled = false;
  }
});
