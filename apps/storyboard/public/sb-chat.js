(function () {
  // ── Inject styles ───────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    #sb-chat-btn { font-size:13px; }
    #sb-chat-btn.active { background:var(--accent-dim); color:var(--accent); border-color:var(--accent); }
    #sb-chat-panel {
      position:fixed; top:0; right:0; width:380px; height:100vh; z-index:100;
      background:var(--bg-elev); border-left:1px solid var(--border);
      display:none; flex-direction:column; font-size:13px;
      box-shadow:-4px 0 24px rgba(0,0,0,0.35);
    }
    #sb-chat-panel.open { display:flex; }
    .sb-chat-head {
      display:flex; align-items:center; justify-content:space-between;
      padding:12px 16px; border-bottom:1px solid var(--border); flex:none;
    }
    .sb-chat-head-title { font-weight:600; font-size:13px; display:flex; align-items:center; gap:7px; }
    .sb-chat-head-title span { font-size:16px; }
    .sb-chat-close { background:none; border:0; color:var(--text-dim); cursor:pointer; font-size:18px; padding:0 4px; line-height:1; }
    .sb-chat-close:hover { color:var(--text); }
    .sb-chat-history {
      flex:1; overflow-y:auto; padding:16px; display:flex; flex-direction:column; gap:14px;
    }
    .sb-chat-msg { display:flex; flex-direction:column; gap:4px; max-width:100%; }
    .sb-chat-msg.user { align-items:flex-end; }
    .sb-chat-msg.assistant { align-items:flex-start; }
    .sb-chat-bubble {
      padding:9px 13px; border-radius:10px; font-size:13px; line-height:1.55;
      white-space:pre-wrap; word-break:break-word; max-width:90%;
    }
    .sb-chat-msg.user .sb-chat-bubble { background:var(--accent-dim); color:var(--text); border-radius:10px 10px 2px 10px; }
    .sb-chat-msg.assistant .sb-chat-bubble { background:var(--bg-elev-2); border:1px solid var(--border); border-radius:2px 10px 10px 10px; }
    .sb-chat-msg-label { font-size:10px; color:var(--text-dim); padding:0 4px; }
    .sb-chat-thinking { display:flex; gap:4px; align-items:center; padding:10px 13px; }
    .sb-chat-thinking span { width:6px; height:6px; border-radius:50%; background:var(--text-dim); animation:sb-pulse 1.2s ease-in-out infinite; }
    .sb-chat-thinking span:nth-child(2) { animation-delay:.2s; }
    .sb-chat-thinking span:nth-child(3) { animation-delay:.4s; }
    @keyframes sb-pulse { 0%,80%,100%{opacity:.2;transform:scale(.8)} 40%{opacity:1;transform:scale(1)} }
    .sb-chat-foot { padding:12px 16px; border-top:1px solid var(--border); flex:none; display:flex; flex-direction:column; gap:8px; }
    .sb-chat-starters { display:flex; flex-wrap:wrap; gap:5px; }
    .sb-chat-starter {
      font-size:11px; padding:4px 9px; border:1px solid var(--border); border-radius:12px;
      background:var(--bg-elev-2); color:var(--text-dim); cursor:pointer;
    }
    .sb-chat-starter:hover { border-color:var(--accent); color:var(--accent); }
    .sb-chat-input-row { display:flex; gap:8px; align-items:flex-end; }
    .sb-chat-input {
      flex:1; background:var(--bg-elev-2); border:1px solid var(--border); border-radius:8px;
      color:var(--text); padding:8px 10px; font-size:13px; font-family:inherit;
      resize:none; min-height:38px; max-height:120px; line-height:1.4;
    }
    .sb-chat-input:focus { outline:none; border-color:var(--accent); }
    .sb-chat-send { padding:8px 14px; font-size:13px; flex:none; align-self:flex-end; }
    .sb-chat-reset { font-size:11px; color:var(--text-dim); background:none; border:0; cursor:pointer; padding:0; }
    .sb-chat-reset:hover { color:var(--bad); }
  `;
  document.head.appendChild(style);

  // ── DOM ──────────────────────────────────────────────────────────────────────
  const toolbar = document.querySelector('.sb-toolbar > div:last-child');
  const chatBtn = document.createElement('button');
  chatBtn.id = 'sb-chat-btn';
  chatBtn.className = 'btn';
  chatBtn.title = 'Board chat';
  chatBtn.textContent = '✦ Chat';
  toolbar.insertBefore(chatBtn, toolbar.firstChild);

  const panel = document.createElement('div');
  panel.id = 'sb-chat-panel';
  panel.innerHTML = `
    <div class="sb-chat-head">
      <div class="sb-chat-head-title"><span>✦</span> Board Chat</div>
      <button class="sb-chat-close" title="Close">×</button>
    </div>
    <div class="sb-chat-history" id="sb-chat-history"></div>
    <div class="sb-chat-foot">
      <div class="sb-chat-starters" id="sb-chat-starters">
        <button class="sb-chat-starter">Walk me through this board</button>
        <button class="sb-chat-starter">Simulate execution step by step</button>
        <button class="sb-chat-starter">What's wrong with this flow?</button>
        <button class="sb-chat-starter">Suggest improvements</button>
      </div>
      <div class="sb-chat-input-row">
        <textarea class="sb-chat-input" id="sb-chat-input" placeholder="Ask about this board…" rows="1"></textarea>
        <button class="btn primary sb-chat-send" id="sb-chat-send">Send</button>
      </div>
      <button class="sb-chat-reset" id="sb-chat-reset">↺ New conversation</button>
    </div>`;
  document.body.appendChild(panel);

  // ── State ─────────────────────────────────────────────────────────────────
  const storageKey = `sb-chat-session-${BOARD_ID}`;
  let sessionId = sessionStorage.getItem(storageKey) || null;
  let busy = false;

  const history = document.getElementById('sb-chat-history');
  const input = document.getElementById('sb-chat-input');
  const sendBtn = document.getElementById('sb-chat-send');
  const starters = document.getElementById('sb-chat-starters');
  const resetBtn = document.getElementById('sb-chat-reset');

  // ── Panel toggle ───────────────────────────────────────────────────────────
  function openPanel() { panel.classList.add('open'); chatBtn.classList.add('active'); }
  function closePanel() { panel.classList.remove('open'); chatBtn.classList.remove('active'); }

  chatBtn.addEventListener('click', () => panel.classList.contains('open') ? closePanel() : openPanel());
  panel.querySelector('.sb-chat-close').addEventListener('click', closePanel);

  // ── Message rendering ───────────────────────────────────────────────────────
  function appendMsg(role, text) {
    starters.style.display = 'none';
    const msg = document.createElement('div');
    msg.className = `sb-chat-msg ${role}`;
    msg.innerHTML = `
      <div class="sb-chat-msg-label">${role === 'user' ? 'You' : 'Board'}</div>
      <div class="sb-chat-bubble">${escHtml(text)}</div>`;
    history.appendChild(msg);
    history.scrollTop = history.scrollHeight;
    return msg;
  }

  function appendThinking() {
    const el = document.createElement('div');
    el.className = 'sb-chat-msg assistant';
    el.innerHTML = `<div class="sb-chat-bubble sb-chat-thinking"><span></span><span></span><span></span></div>`;
    history.appendChild(el);
    history.scrollTop = history.scrollHeight;
    return el;
  }

  function escHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ── Send ────────────────────────────────────────────────────────────────────
  async function send(text) {
    text = text.trim();
    if (!text || busy) return;
    busy = true;
    sendBtn.disabled = true;
    input.value = '';
    input.style.height = 'auto';

    appendMsg('user', text);
    const thinking = appendThinking();

    try {
      const res = await fetch(`${BASE}/api/boards/${BOARD_ID}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Chat failed');
      sessionId = data.sessionId;
      sessionStorage.setItem(storageKey, sessionId);
      thinking.remove();
      appendMsg('assistant', data.reply);
    } catch (err) {
      thinking.remove();
      appendMsg('assistant', `Error: ${err.message}`);
    } finally {
      busy = false;
      sendBtn.disabled = false;
      input.focus();
    }
  }

  sendBtn.addEventListener('click', () => send(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input.value); }
  });
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  });

  starters.addEventListener('click', (e) => {
    const btn = e.target.closest('.sb-chat-starter');
    if (btn) send(btn.textContent);
  });

  resetBtn.addEventListener('click', () => {
    sessionId = null;
    sessionStorage.removeItem(storageKey);
    history.innerHTML = '';
    starters.style.display = '';
    input.focus();
  });
})();
