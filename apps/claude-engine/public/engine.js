// Claude Engine client. Standalone action buttons (delete, run-tests, eval)
// carry their target URL in data-name; we submit a real POST so the server's
// full HTML response loads as a normal navigation. Config forms post natively.
document.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const url = btn.dataset.name;
  if (!url) return;
  e.preventDefault();

  if (btn.dataset.action === 'delete' && !confirm('Delete this item?')) return;

  const form = document.createElement('form');
  form.method = btn.dataset.method || 'POST';
  form.action = url;
  document.body.appendChild(form);
  form.submit();
});
