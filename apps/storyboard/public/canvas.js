(function () {
  const canvas = document.getElementById('sb-canvas');
  const edgesSvg = document.getElementById('sb-edges');
  const radial = document.getElementById('sb-radial');
  let contract = null;
  let cards = [];
  let edges = [];
  let linkMode = null; // card id being linked from, or null
  let radialFor = null;

  const api = (path, opts) => fetch(BASE + path, opts).then((r) => (r.status === 204 ? null : r.json()));

  function closeRadial() {
    radial.style.display = 'none';
    radialFor = null;
  }

  function setLinkMode(cardId) {
    linkMode = cardId;
    document.getElementById('sb-link-hint').style.display = cardId ? 'inline' : 'none';
    document.querySelectorAll('.sb-card').forEach((el) => el.classList.toggle('linking', el.dataset.id === cardId));
  }

  function cardCenter(card) {
    return { x: card.x + card.w / 2, y: card.y + card.h / 2 };
  }

  function drawEdges() {
    edgesSvg.setAttribute('width', canvas.scrollWidth);
    edgesSvg.setAttribute('height', canvas.scrollHeight);
    edgesSvg.innerHTML = edges
      .map((e) => {
        const a = cards.find((c) => c.id === e.from);
        const b = cards.find((c) => c.id === e.to);
        if (!a || !b) return '';
        const pa = cardCenter(a);
        const pb = cardCenter(b);
        return `<line x1="${pa.x}" y1="${pa.y}" x2="${pb.x}" y2="${pb.y}" stroke="var(--border)" stroke-width="1.5" />`;
      })
      .join('');
  }

  function mountCard(card) {
    const el = document.createElement('div');
    el.className = 'sb-card';
    el.dataset.id = card.id;
    el.style.left = card.x + 'px';
    el.style.top = card.y + 'px';
    el.style.width = card.w + 'px';
    el.style.height = card.h + 'px';
    el.innerHTML = `
      <div class="sb-card-head">
        <span>${card.kind}</span>
        <button class="sb-dots" type="button">⋯</button>
      </div>
      <div class="sb-card-body">loading…</div>`;
    canvas.appendChild(el);

    api(`/api/boards/${BOARD_ID}/cards/${card.id}/render`).then((res) => {
      const body = el.querySelector('.sb-card-body');
      if (res.renderMode === 'sandboxed') {
        const iframe = document.createElement('iframe');
        iframe.sandbox = 'allow-scripts';
        iframe.srcdoc = res.html;
        body.innerHTML = '';
        body.appendChild(iframe);
      } else {
        body.innerHTML = res.html;
      }
    });

    wireDrag(el, card);
    el.querySelector('.sb-dots').addEventListener('click', (e) => {
      e.stopPropagation();
      openRadial(el, card);
    });

    el.addEventListener('pointerdown', () => {
      if (linkMode && linkMode !== card.id) {
        api(`/api/boards/${BOARD_ID}/edges`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: linkMode, to: card.id, kind: 'link' }),
        }).then((edge) => {
          edges.push(edge);
          drawEdges();
          setLinkMode(null);
        });
      }
    });
  }

  function wireDrag(el, card) {
    const head = el.querySelector('.sb-card-head');
    let dragging = false, offX = 0, offY = 0;

    head.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.sb-dots')) return;
      dragging = true;
      head.setPointerCapture(e.pointerId);
      const r = el.getBoundingClientRect();
      const c = canvas.getBoundingClientRect();
      offX = e.clientX - r.left;
      offY = e.clientY - r.top;
      closeRadial();
    });
    head.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const c = canvas.getBoundingClientRect();
      const x = e.clientX - c.left + canvas.scrollLeft - offX;
      const y = e.clientY - c.top + canvas.scrollTop - offY;
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      card.x = x;
      card.y = y;
      drawEdges();
    });
    head.addEventListener('pointerup', (e) => {
      if (!dragging) return;
      dragging = false;
      head.releasePointerCapture(e.pointerId);
      const snappedX = Math.round(card.x / GRID) * GRID;
      const snappedY = Math.round(card.y / GRID) * GRID;
      el.style.left = snappedX + 'px';
      el.style.top = snappedY + 'px';
      card.x = snappedX;
      card.y = snappedY;
      drawEdges();
      api(`/api/boards/${BOARD_ID}/cards/${card.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x: snappedX, y: snappedY }),
      });
    });
  }

  function openRadial(cardEl, card) {
    if (radialFor === card.id) return closeRadial();
    const r = cardEl.getBoundingClientRect();
    const c = canvas.getBoundingClientRect();
    radial.style.left = (r.left - c.left + canvas.scrollLeft + r.width / 2 - 50) + 'px';
    radial.style.top = (r.top - c.top + canvas.scrollTop + r.height / 2 - 50) + 'px';
    radial.style.display = 'block';
    radialFor = card.id;
    radial.onclick = (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const action = btn.dataset.action;
      closeRadial();
      if (action === 'link') {
        setLinkMode(card.id);
        return;
      }
      api(`/api/boards/${BOARD_ID}/cards/${card.id}/actions/${action}`, { method: 'POST' }).then((res) => {
        if (action === 'delete') {
          cardEl.remove();
          cards = cards.filter((c) => c.id !== card.id);
          edges = edges.filter((e) => e.from !== card.id && e.to !== card.id);
          drawEdges();
        }
      });
    };
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('.sb-card') && !e.target.closest('.sb-radial')) {
      closeRadial();
      setLinkMode(null);
    }
  });

  // ── Board action menu (popover, not a native dropdown) ───────────────────
  const boardMenuBtn = document.getElementById('sb-board-menu-btn');
  const boardMenu = document.getElementById('sb-board-menu');

  boardMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = boardMenu.style.display === 'flex';
    boardMenu.style.display = open ? 'none' : 'flex';
    boardMenu.style.left = '0px';
    boardMenu.style.top = '100%';
  });
  boardMenu.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    boardMenu.style.display = 'none';
    if (btn.dataset.action === 'add-card') openAddDialog();
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#sb-board-menu') && !e.target.closest('#sb-board-menu-btn')) {
      boardMenu.style.display = 'none';
    }
  });

  // ── Add-card flyout: kind list (click, not type/select) + per-kind detail ─
  // The kind contract has optionsSchema/hooks reserved for later (see card-kind
  // modules) — sections for them only render once a kind actually populates one,
  // so "add a card" doesn't show empty ceremony for kinds that don't need it.
  const addDialog = document.getElementById('sb-add-dialog');
  const kindGrid = document.getElementById('sb-kind-grid');
  const detailEl = document.getElementById('sb-kind-detail');
  const addError = document.getElementById('sb-add-error');
  const addCreateBtn = document.getElementById('sb-add-create');
  let selectedKind = null;

  function openAddDialog() {
    if (!contract) return;
    selectedKind = null;
    addError.hidden = true;
    addCreateBtn.disabled = true;
    detailEl.innerHTML = '';
    kindGrid.innerHTML = contract.kinds
      .map((k) => `<button type="button" class="sb-kind-tile" data-kind="${k.id}">
        <div class="k-id">${k.id}</div><div class="k-desc">${k.description}</div></button>`)
      .join('');
    addDialog.showModal();
  }

  function fieldHtml(key, type, value) {
    const isLong = type === 'any' || key === 'text' || key === 'html';
    const tag = isLong ? 'textarea' : 'input';
    const val = type === 'any' ? JSON.stringify(value, null, 2) : (value ?? '');
    return `<div class="sb-field"><label>${key}${type === 'any' ? ' (JSON)' : ''}</label>
      <${tag} data-field="${key}" data-type="${type}">${val}</${tag}></div>`;
  }

  function renderDetail(kind) {
    const example = kind.exampleCard.payload || {};
    const contentFields = Object.keys(kind.payloadSchema || {})
      .map((key) => fieldHtml(key, kind.payloadSchema[key], example[key]))
      .join('');
    const optionsKeys = Object.keys(kind.optionsSchema || {});
    const optionsSection = optionsKeys.length
      ? `<div class="sb-detail-section"><h4>Options</h4>${optionsKeys.map((k) => fieldHtml(k, kind.optionsSchema[k])).join('')}</div>`
      : '';
    const hooksSection = (kind.hooks || []).length
      ? `<div class="sb-detail-section"><h4>Hooks</h4>${kind.hooks.map((h) => `<span class="badge">${h}</span>`).join(' ')}</div>`
      : '';
    detailEl.innerHTML = `
      <div class="sb-detail-section"><h4>Use</h4><p class="muted" style="font-size:13px;margin:0">${kind.description}</p></div>
      <div class="sb-detail-section"><h4>Core contents</h4>${contentFields}</div>
      ${optionsSection}${hooksSection}`;
  }

  function collectPayload(kind) {
    const payload = {};
    const schema = kind.payloadSchema || {};
    Object.keys(schema).forEach((key) => {
      const field = detailEl.querySelector(`[data-field="${key}"]`);
      payload[key] = schema[key] === 'any' ? JSON.parse(field.value) : field.value;
    });
    return payload;
  }

  kindGrid.addEventListener('click', (e) => {
    const tile = e.target.closest('.sb-kind-tile');
    if (!tile) return;
    kindGrid.querySelectorAll('.sb-kind-tile').forEach((t) => t.classList.remove('selected'));
    tile.classList.add('selected');
    selectedKind = contract.kinds.find((k) => k.id === tile.dataset.kind);
    renderDetail(selectedKind);
    addCreateBtn.disabled = false;
    addError.hidden = true;
  });

  document.getElementById('sb-add-cancel').addEventListener('click', () => addDialog.close());

  addCreateBtn.addEventListener('click', () => {
    if (!selectedKind) return;
    let payload;
    try {
      payload = collectPayload(selectedKind);
    } catch (err) {
      addError.textContent = 'Invalid JSON in a field: ' + err.message;
      addError.hidden = false;
      return;
    }
    const x = Math.round((canvas.scrollLeft + 40) / GRID) * GRID;
    const y = Math.round((canvas.scrollTop + 40) / GRID) * GRID;
    api(`/api/boards/${BOARD_ID}/cards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: selectedKind.id, x, y, payload }),
    })
      .then((card) => {
        cards.push(card);
        mountCard(card);
        drawEdges();
        addDialog.close();
      })
      .catch(() => {
        addError.textContent = 'Failed to create card.';
        addError.hidden = false;
      });
  });

  Promise.all([
    api('/api/contract'),
    api(`/api/boards/${BOARD_ID}/cards`),
    api(`/api/boards/${BOARD_ID}/edges`),
  ]).then(([c, cs, es]) => {
    contract = c;
    cards = cs;
    edges = es;
    cards.forEach(mountCard);
    drawEdges();
  });
})();
