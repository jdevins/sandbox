import { html } from '../../../lib/html.js';
import { core, deeper, expert } from './kit.js';

export const meta = {
  id: '02-bounds',
  order: 2,
  title: 'Bounds & Tools',
  difficulty: 'core',
  depth: 'core → deeper → expert',
  summary: "An agent's power is its tool list. The smallest list that still does the job is the safest design.",
};

export function body(ctx) {
  const { ui, base } = ctx;

  const verbToTool = ui.table(
    ['Verb the agent needs', 'Tool it implies', 'Tool to deny'],
    [
      ['read the backlog', 'HTTP GET / file read', 'any write'],
      ['leave feedback', 'append-only annotate endpoint', 'status/claim/approve writes'],
      ['build an item', 'git branch + edit + PR', 'merge, force-push, deploy'],
      ['carry a block (Foundry)', 'pick-up / drop move', 'inspect / declare-done'],
    ],
  );

  const examples = ui.table(
    ['Agent', 'Verbs', 'Bounds that fall out'],
    [
      [html`<strong>Groomer</strong>`, 'read repo, annotate',
        html`Read-only on the repo; <em>append-only</em> on the backlog. Cannot approve, claim, or finish.`],
      [html`<strong>Builder</strong>`, 'claim one, build, open PR',
        html`Branch + PR only. No merge. One item per run. Acts solely on human-approved items.`],
      [html`<strong>Foundry fetcher</strong>`, 'carry blocks',
        html`Can pick up and drop; <em>cannot</em> inspect or declare the mission done — that's the inspector's bound.`],
    ],
  );

  return html`
    ${core(html`
      <h2>Bounds are the design</h2>
      <p>An agent is exactly as powerful as the tools you hand it. So the core question isn't "what can this agent do?" — it's "<strong>what is it not allowed to do, and what stops it?</strong>"</p>
      <ul>
        <li><strong>Least privilege.</strong> Start from zero tools; add only what a verb on the agent's job demands.</li>
        <li><strong>The <code>definition</code> is a contract.</strong> Its model + allowed skills/tools + inputs <em>are</em> the leash.</li>
        <li><strong>Read vs write is the first cut.</strong> Most safety comes free from keeping an agent read-only.</li>
      </ul>`)}

    ${boundsDemo(base)}

    ${deeper('Deriving the tool list from the verbs', html`
      <p>You already listed the verbs in lesson 01. Each verb implies the <em>minimum</em> tool — and, just as important, what to withhold:</p>
      ${verbToTool}
      <p class="dim">If a verb doesn't appear in the agent's job, its tool shouldn't appear in the definition.</p>`)}

    ${deeper('Same method, different agents', html`
      <p>Bounds aren't one-size — they fall out of each agent's verbs. Three from this repo:</p>
      ${examples}`)}

    ${expert('Soft bounds vs hard bounds — where the leash actually bites', html`
      <p>A prompt that says <em>"only leave feedback, don't change status"</em> is a <strong>request</strong>. Structure that <em>can't</em> do otherwise is a <strong>guarantee</strong>. The backlog enforces bounds in code, not prose:</p>
      <ul>
        <li><code>POST /annotate</code> appends and can only nudge <code>pending → groomed</code> — it has <em>no path</em> to set a claim or approval.</li>
        <li><code>POST /claim</code> is an atomic check-and-set; only <code>ready</code> + human-approved items are claimable, so a second claimer gets a 409.</li>
        <li><code>POST /complete</code> checks <code>by === claim.by</code> — a non-claimer gets a 403.</li>
      </ul>
      <p>The Groomer prompt restating "append-only" is documentation; the endpoint shape is the enforcement. <strong>When they conflict, the structure wins — so put the real bound there.</strong></p>`)}

    ${expert('Capability leakage (read this before scheduling anything)', html`
      <p>The scheduler runs the Builder as <code>claude -p</code> in the repo root — which has full filesystem + git access. A prompt that says "read-only" does <em>not</em> make it so; the tools are still there.</p>
      <ul>
        <li>If you need a genuinely read-only agent, restrict at the <strong>tool/endpoint layer</strong> (give it an API that can only read), not in the prose.</li>
        <li>Gate irreversible power behind something structural — the human-flipped <code>approvedForBuild</code> flag, a branch-only workflow, a tool allowlist.</li>
      </ul>
      <p><strong>Exit check:</strong> for every agent you run, can you name (1) what it must <em>not</em> do, and (2) the mechanism that <em>stops</em> it? If (2) is "the prompt asks nicely," you haven't bounded it yet.</p>`)}`;
}

// Live, self-demonstrating panel. Real requests hit a sandboxed item that uses
// the same guards as the backlog. The script avoids backticks and ${} on purpose
// so it survives being embedded inside this module's html`` template literal.
function boundsDemo(base) {
  return html`
  <div class="card" id="bounds-demo" data-base="${base}">
    <style>
      #bounds-demo .bd-state{ padding:10px 12px; background:var(--bg2,#1a1a1a); border-radius:6px; margin:10px 0; font-size:0.9em; }
      #bounds-demo .bd-group{ margin:8px 0; }
      #bounds-demo .bd-group > span.lab{ display:block; font-size:0.72em; text-transform:uppercase; letter-spacing:0.05em; color:var(--muted); margin-bottom:4px; }
      #bounds-demo .bd-group .btn{ font-size:0.8em; padding:3px 9px; margin:0 5px 5px 0; }
      #bounds-demo .bd-log{ background:#0d0d0d; border:1px solid var(--border,#333); border-radius:6px; padding:10px; font-size:0.78em; max-height:180px; overflow:auto; margin-top:10px; line-height:1.5; }
      #bounds-demo .bd-log:empty::before{ content:'click an action — responses stream here'; color:var(--muted); }
    </style>
    <h2 style="margin-top:0">Try it live <span class="badge" style="background:var(--accent,#7c6af7)">interactive</span></h2>
    <p class="dim">Real <code>POST</code>s to a sandboxed item with the backlog's exact guards. Watch the structure <em>ignore</em> what a prompt could only ask for.</p>
    <div class="bd-state" id="bd-state">loading…</div>
    <div class="bd-actions">
      <div class="bd-group"><span class="lab">Groomer (annotator)</span>
        <button class="btn" data-call="annotate" data-args='{"kind":"usefulness","body":"Who benefits, and is it worth the estimate?"}'>annotate</button>
        <button class="btn" data-call="annotate" data-args='{"kind":"estimate","body":"M — touches schema + UI","estimate":"M"}'>set estimate</button>
        <button class="btn" data-call="annotate" data-args='{"kind":"note","body":"force build now","status":"in-progress","claim":{"by":"groomer"}}'>sneak a status change ✗</button>
      </div>
      <div class="bd-group"><span class="lab">You (human gate)</span>
        <button class="btn primary" data-call="approve" data-args='{"value":"1"}'>approve for build</button>
        <button class="btn" data-call="approve" data-args='{"value":"0"}'>revoke</button>
      </div>
      <div class="bd-group"><span class="lab">Builder (worker)</span>
        <button class="btn" data-call="claim" data-args='{"by":"builder"}'>claim</button>
        <button class="btn" data-call="complete" data-args='{"by":"builder","status":"done"}'>complete</button>
      </div>
      <div class="bd-group"><span class="lab">Intruder</span>
        <button class="btn" data-call="complete" data-args='{"by":"intruder","status":"done"}'>complete someone else's claim ✗</button>
      </div>
      <div class="bd-group"><span class="lab">Reset</span>
        <button class="btn" data-call="reset">reset demo</button>
      </div>
    </div>
    <div class="bd-log" id="bd-log"></div>
  </div>
  <p class="dim" style="font-size:0.85em">Try the order: <strong>sneak a status change</strong> (see it ignored) → <strong>claim</strong> before approving (409) → <strong>approve</strong> → <strong>claim</strong> (works) → <strong>intruder complete</strong> (403) → <strong>builder complete</strong>.</p>
  <script>
  (function(){
    var root = document.getElementById('bounds-demo');
    if(!root || root.dataset.wired) return;
    root.dataset.wired = '1';
    var base = root.dataset.base;
    var stateEl = document.getElementById('bd-state');
    var logEl = document.getElementById('bd-log');
    var COLORS = { pending:'#888', groomed:'#3a6ea5', ready:'#7c6af7', 'in-progress':'#ff9800', done:'#4caf50', blocked:'#f44336' };
    function badge(t,c){ return '<span class="badge" style="background:'+c+'">'+t+'</span>'; }
    function render(it){
      if(!it){ stateEl.innerHTML='no state'; return; }
      var p = [];
      p.push('status: '+badge(it.status, COLORS[it.status]||'#888'));
      p.push('approved: '+(it.approvedForBuild ? badge('yes','#4caf50') : badge('no','#555')));
      p.push('claim: '+(it.claim ? badge(it.claim.by,'#ff9800') : '<span class="dim">none</span>'));
      p.push('annotations: '+((it.annotations && it.annotations.length)||0));
      if(it.estimate) p.push('estimate: '+it.estimate);
      stateEl.innerHTML = p.join(' &nbsp;·&nbsp; ');
    }
    function log(action, code, j){
      var ok = code < 300, summary;
      if(j && j.error) summary = '✗ '+j.error;
      else if(j && j.ignored && j.ignored.length) summary = '⛔ ignored: '+j.ignored.join(', ');
      else if(j && j.applied && j.applied.length) summary = 'applied: '+j.applied.join(', ');
      else summary = 'ok';
      var color = !ok ? '#f44336' : (summary.indexOf('ignored')>-1 ? '#ff9800' : '#4caf50');
      var line = document.createElement('div');
      line.style.color = color;
      line.textContent = 'POST /'+action+'  →  '+code+'   '+summary;
      logEl.insertBefore(line, logEl.firstChild);
    }
    function call(action, args){
      fetch(base+'/learn/demo/'+action, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(args||{}) })
        .then(function(r){ return r.json().then(function(j){ return { code:r.status, j:j }; }); })
        .then(function(res){ log(action, res.code, res.j); render(res.j.item || res.j); })
        .catch(function(e){ log(action, 0, { error:String(e) }); });
    }
    root.addEventListener('click', function(e){
      var b = e.target.closest('button[data-call]');
      if(!b) return;
      e.preventDefault();
      call(b.dataset.call, b.dataset.args ? JSON.parse(b.dataset.args) : {});
    });
    fetch(base+'/learn/demo/state').then(function(r){ return r.json(); }).then(render).catch(function(){});
  })();
  </script>`;
}
