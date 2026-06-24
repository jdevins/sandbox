// Claude Engine client. Standalone action buttons (delete, run-tests, eval)
// carry their target URL in data-name; we submit a real POST so the server's
// full HTML response loads as a normal navigation. Config forms post natively.
//
// Buttons/submit-buttons tagged with data-llm-status are background jobs
// (e.g. summarize/trend): we kick off the POST via fetch and poll that JSON
// status endpoint, rendering progress inline on the current page instead of
// navigating to a separate status page.
document.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const url = btn.dataset.name;
  if (!url) return;
  e.preventDefault();

  if (btn.dataset.action === 'delete' && !confirm('Delete this item?')) return;

  if (btn.dataset.llmStatus) {
    startJob(url, btn.dataset.method || 'POST', null, btn.dataset.llmStatus);
    return;
  }

  const form = document.createElement('form');
  form.method = btn.dataset.method || 'POST';
  form.action = url;
  document.body.appendChild(form);
  form.submit();
});

document.addEventListener('submit', (e) => {
  const submitter = e.submitter;
  if (!submitter || !submitter.dataset.llmStatus) return;
  e.preventDefault();
  const form = e.target;
  const url = submitter.getAttribute('formaction') || form.action;
  const body = new URLSearchParams(new FormData(form));
  startJob(url, form.method || 'POST', body, submitter.dataset.llmStatus);
});

// LLM jobs don't have meaningful fractional progress (each step is a single
// blocking call of unknown duration) — a determinate bar just looks stuck, so
// show an indeterminate "waiting" indicator instead.
function startJob(url, method, body, statusUrl) {
  const bar = showWaitBar();
  fetch(url, { method, body })
    .catch(() => {})
    .then(() => poll());

  function poll() {
    fetch(statusUrl)
      .then((r) => r.json())
      .then((s) => {
        if (s.running) {
          updateWaitBar(bar, s);
          setTimeout(poll, 1500);
        } else {
          finishWaitBar(bar, s);
        }
      })
      .catch(() => setTimeout(poll, 2000));
  }
}

function showWaitBar() {
  let bar = document.getElementById('job-progress');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'job-progress';
    bar.innerHTML = '<span class="job-progress-spinner"></span><span class="job-progress-label"></span>';
    document.body.appendChild(bar);
  }
  bar.classList.add('on');
  updateWaitBar(bar, { label: 'Starting' });
  return bar;
}

function updateWaitBar(bar, s) {
  bar.querySelector('.job-progress-label').textContent =
    `✨ ${s.label || 'Working'}…${s.current ? ' ' + s.current : ''}${s.total > 1 ? ` (${s.done}/${s.total})` : ''}`;
}

function finishWaitBar(bar, s) {
  const errs = s.errors?.length || 0;
  bar.querySelector('.job-progress-spinner').remove();
  bar.querySelector('.job-progress-label').textContent = errs ? `⚠ Done with ${errs} error${errs === 1 ? '' : 's'}` : '✓ Done';
  setTimeout(() => {
    bar.classList.remove('on');
    location.reload();
  }, errs ? 2500 : 900);
}
