(function () {
  const canvas = document.getElementById('sb-canvas');
  const zoomLayer = document.getElementById('sb-zoom-layer');
  const edgesSvg = document.getElementById('sb-edges');
  const radial = document.getElementById('sb-radial');
  let contract = null;
  let cards = [];
  let edges = [];
  let linkMode = null;
  let radialFor = null;
  let portDrag = null;   // { fromCard, fromEl, x1, y1 }
  let selectedEdge = null;
  let zoom = 1;

  // ── Zoom ─────────────────────────────────────────────────────────────────
  function toModel(clientX, clientY) {
    const c = canvas.getBoundingClientRect();
    return { x: (clientX - c.left + canvas.scrollLeft) / zoom, y: (clientY - c.top + canvas.scrollTop) / zoom };
  }

  function updateLayerSize() {
    const maxX = Math.max(1000, canvas.clientWidth / zoom, ...cards.map((c) => c.x + (c.w || 200) + 300));
    const maxY = Math.max(700, canvas.clientHeight / zoom, ...cards.map((c) => c.y + (c.h || 120) + 300));
    zoomLayer.style.width = maxX + 'px';
    zoomLayer.style.height = maxY + 'px';
    edgesSvg.setAttribute('width', maxX);
    edgesSvg.setAttribute('height', maxY);
  }

  const zoomLabel = document.getElementById('sb-zoom-reset');

  function zoomAt(newZoom, clientX, clientY) {
    const c = canvas.getBoundingClientRect();
    const cx = clientX ?? (c.left + canvas.clientWidth / 2);
    const cy = clientY ?? (c.top + canvas.clientHeight / 2);
    const before = toModel(cx, cy);
    zoom = Math.min(2, Math.max(0.25, newZoom));
    zoomLayer.style.transform = `scale(${zoom})`;
    updateLayerSize();
    canvas.scrollLeft = before.x * zoom - (cx - c.left);
    canvas.scrollTop = before.y * zoom - (cy - c.top);
    zoomLabel.textContent = Math.round(zoom * 100) + '%';
    drawEdges();
  }

  document.getElementById('sb-zoom-in').addEventListener('click', () => zoomAt(zoom + 0.1));
  document.getElementById('sb-zoom-out').addEventListener('click', () => zoomAt(zoom - 0.1));
  zoomLabel.addEventListener('click', () => zoomAt(1));
  canvas.addEventListener('wheel', (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    zoomAt(zoom * (e.deltaY < 0 ? 1.1 : 0.9), e.clientX, e.clientY);
  }, { passive: false });

  const KIND_ICONS = { markdown: '¶', json: '{}', html: '<>', xml: '</>', sql: 'DB' };

  const api = (path, opts) => fetch(BASE + path, opts).then((r) => (r.status === 204 ? null : r.json()));

  // ── SVG setup ────────────────────────────────────────────────────────────
  const edgesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  edgesGroup.id = 'sb-edges-content';
  edgesSvg.appendChild(edgesGroup);

  const rubberLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  rubberLine.setAttribute('stroke', 'var(--accent)');
  rubberLine.setAttribute('stroke-width', '2');
  rubberLine.setAttribute('stroke-dasharray', '5 4');
  rubberLine.setAttribute('marker-end', 'url(#sb-arrow)');
  rubberLine.setAttribute('pointer-events', 'none');
  rubberLine.style.display = 'none';
  edgesSvg.appendChild(rubberLine);

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
    return { x: card.x + (card.w || 200) / 2, y: card.y + (card.h || 120) / 2 };
  }

  // Port positions in canvas coords
  function portCoords(card, side) {
    const w = card.w || 200, h = card.h || 120;
    if (side === 'top')    return { x: card.x + w / 2, y: card.y };
    if (side === 'right')  return { x: card.x + w,     y: card.y + h / 2 };
    if (side === 'bottom') return { x: card.x + w / 2, y: card.y + h };
    if (side === 'left')   return { x: card.x,         y: card.y + h / 2 };
  }

  // Single-bend elbow path (axis-aligned) with a slightly rounded corner.
  function elbowPath(x1, y1, x2, y2, r = 12) {
    const dx = x2 - x1, dy = y2 - y1;
    const [cx, cy] = Math.abs(dx) >= Math.abs(dy) ? [x2, y1] : [x1, y2];
    const seg1 = Math.hypot(cx - x1, cy - y1);
    const seg2 = Math.hypot(x2 - cx, y2 - cy);
    const rr = Math.min(r, seg1, seg2);
    if (rr < 1) return { d: `M${x1},${y1} L${cx},${cy} L${x2},${y2}`, mx: cx, my: cy };
    const t1x = cx + (x1 - cx) * (rr / seg1);
    const t1y = cy + (y1 - cy) * (rr / seg1);
    const t2x = cx + (x2 - cx) * (rr / seg2);
    const t2y = cy + (y2 - cy) * (rr / seg2);
    return { d: `M${x1},${y1} L${t1x},${t1y} Q${cx},${cy} ${t2x},${t2y} L${x2},${y2}`, mx: cx, my: cy };
  }

  // ── Edges ────────────────────────────────────────────────────────────────
  function drawEdges() {
    updateLayerSize();

    // Ensure defs exist (only once)
    if (!edgesSvg.querySelector('defs')) {
      const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      defs.innerHTML = `
        <marker id="sb-arrow" markerWidth="10" markerHeight="10" refX="7" refY="4" orient="auto">
          <path d="M0,0 L0,8 L9,4 z" fill="var(--text-dim)"/>
        </marker>
        <marker id="sb-arrow-sel" markerWidth="10" markerHeight="10" refX="7" refY="4" orient="auto">
          <path d="M0,0 L0,8 L9,4 z" fill="var(--accent)"/>
        </marker>`;
      edgesSvg.insertBefore(defs, edgesGroup);
    }

    edgesGroup.innerHTML = edges.map((e) => {
      const a = cards.find((c) => c.id === e.from);
      const b = cards.find((c) => c.id === e.to);
      if (!a || !b) return '';
      const pa = cardCenter(a);
      const pb = cardCenter(b);
      const { d, mx, my } = elbowPath(pa.x, pa.y, pb.x, pb.y);
      const sel = selectedEdge === e.id;
      const col = sel ? 'var(--accent)' : 'var(--text-dim)';
      const marker = sel ? 'url(#sb-arrow-sel)' : 'url(#sb-arrow)';
      return `
        <path d="${d}" fill="none"
          stroke="transparent" stroke-width="14" style="cursor:pointer" pointer-events="stroke" data-edge="${e.id}"/>
        <path d="${d}" fill="none"
          stroke="${col}" stroke-width="${sel ? 2.5 : 2}" stroke-linejoin="round" marker-end="${marker}" pointer-events="none"/>
        ${sel ? `
          <foreignObject x="${mx - 42}" y="${my - 15}" width="84" height="30" style="overflow:visible;pointer-events:auto">
            <div xmlns="http://www.w3.org/1999/xhtml" class="sb-edge-toolbar">
              <button data-flip-edge="${e.id}" title="Flip direction" type="button">⇄</button>
              <button data-add-edge="${e.id}" title="Insert card here" type="button">+</button>
              <button data-del-edge="${e.id}" title="Delete connector" type="button" class="danger">×</button>
            </div>
          </foreignObject>` : ''}`;
    }).join('');

    canvas.querySelectorAll('.sb-card.target-highlight').forEach((el) => el.classList.remove('target-highlight'));
    const selEdge = edges.find((e) => e.id === selectedEdge);
    if (selEdge) {
      const toEl = canvas.querySelector(`.sb-card[data-id="${selEdge.to}"]`);
      if (toEl) toEl.classList.add('target-highlight');
    }

    edgesGroup.querySelectorAll('[data-edge]').forEach((el) => {
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        selectedEdge = selectedEdge === el.dataset.edge ? null : el.dataset.edge;
        drawEdges();
      });
    });
    edgesGroup.querySelectorAll('[data-del-edge]').forEach((el) => {
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const id = el.dataset.delEdge;
        api(`/api/boards/${BOARD_ID}/edges/${id}`, { method: 'DELETE' }).then(() => {
          edges = edges.filter((e) => e.id !== id);
          selectedEdge = null;
          drawEdges();
        });
      });
    });
    edgesGroup.querySelectorAll('[data-flip-edge]').forEach((el) => {
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const id = el.dataset.flipEdge;
        const edge = edges.find((e) => e.id === id);
        if (!edge) return;
        api(`/api/boards/${BOARD_ID}/edges/${id}`, { method: 'DELETE' })
          .then(() => api(`/api/boards/${BOARD_ID}/edges`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: edge.to, to: edge.from, kind: edge.kind }),
          }))
          .then((newEdge) => {
            edges = edges.filter((e) => e.id !== id);
            edges.push(newEdge);
            selectedEdge = newEdge.id;
            drawEdges();
          });
      });
    });
    edgesGroup.querySelectorAll('[data-add-edge]').forEach((el) => {
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        openInsertDialog(el.dataset.addEdge);
      });
    });
  }

  // ── Card mounting ────────────────────────────────────────────────────────
  function renderCardBody(el, card) {
    const body = el.querySelector('.sb-card-body');
    body.innerHTML = 'loading…';
    api(`/api/boards/${BOARD_ID}/cards/${card.id}/render`).then((res) => {
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
  }

  function mountCard(card) {
    const el = document.createElement('div');
    el.className = 'sb-card';
    el.dataset.id = card.id;
    el.style.left = card.x + 'px';
    el.style.top = card.y + 'px';
    if (card.w) el.style.width = card.w + 'px';
    if (card.h) el.style.height = card.h + 'px';
    const icon = KIND_ICONS[card.kind] || '□';
    el.innerHTML = `
      <div class="sb-card-head">
        <span class="sb-kind-icon" aria-hidden="true">${icon}</span>
        <span class="sb-kind-label">${card.kind}</span>
        <button class="sb-dots" type="button">⋯</button>
      </div>
      <div class="sb-card-body">loading…</div>
      <div class="sb-resize" title="Drag to resize"></div>
      <div class="sb-port" data-side="top" title="Drag to connect">↑</div>
      <div class="sb-port" data-side="right" title="Drag to connect">→</div>
      <div class="sb-port" data-side="bottom" title="Drag to connect">↓</div>
      <div class="sb-port" data-side="left" title="Drag to connect">←</div>`;
    zoomLayer.appendChild(el);

    renderCardBody(el, card);
    wireDrag(el, card);
    wireResize(el, card);
    wirePorts(el, card);

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

  // ── Drag (move card) ─────────────────────────────────────────────────────
  function wireDrag(el, card) {
    const head = el.querySelector('.sb-card-head');
    let dragging = false, offX = 0, offY = 0;

    head.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.sb-dots')) return;
      dragging = true;
      head.setPointerCapture(e.pointerId);
      const r = el.getBoundingClientRect();
      offX = (e.clientX - r.left) / zoom;
      offY = (e.clientY - r.top) / zoom;
      closeRadial();
    });
    head.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const p = toModel(e.clientX, e.clientY);
      const x = p.x - offX;
      const y = p.y - offY;
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

  // ── Resize ───────────────────────────────────────────────────────────────
  function wireResize(el, card) {
    const handle = el.querySelector('.sb-resize');
    let resizing = false, startX = 0, startY = 0, startW = 0, startH = 0;

    handle.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      resizing = true;
      handle.setPointerCapture(e.pointerId);
      startX = e.clientX;
      startY = e.clientY;
      startW = el.offsetWidth;
      startH = el.offsetHeight;
      closeRadial();
    });
    handle.addEventListener('pointermove', (e) => {
      if (!resizing) return;
      const w = Math.max(GRID * 4, startW + (e.clientX - startX) / zoom);
      const h = Math.max(GRID * 3, startH + (e.clientY - startY) / zoom);
      el.style.width = w + 'px';
      el.style.height = h + 'px';
      card.w = w;
      card.h = h;
      drawEdges();
    });
    handle.addEventListener('pointerup', () => {
      if (!resizing) return;
      resizing = false;
      handle.releasePointerCapture(0);
      const snappedW = Math.round(card.w / GRID) * GRID;
      const snappedH = Math.round(card.h / GRID) * GRID;
      el.style.width = snappedW + 'px';
      el.style.height = snappedH + 'px';
      card.w = snappedW;
      card.h = snappedH;
      drawEdges();
      api(`/api/boards/${BOARD_ID}/cards/${card.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ w: snappedW, h: snappedH }),
      });
    });
  }

  // ── Port drag (draw connections) ─────────────────────────────────────────
  function wirePorts(el, card) {
    el.querySelectorAll('.sb-port').forEach((port) => {
      port.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        port.setPointerCapture(e.pointerId);
        const c = canvas.getBoundingClientRect();
        const coords = portCoords(card, port.dataset.side);
        portDrag = { fromCard: card, fromEl: el };
        rubberLine.setAttribute('x1', coords.x);
        rubberLine.setAttribute('y1', coords.y);
        rubberLine.setAttribute('x2', coords.x);
        rubberLine.setAttribute('y2', coords.y);
        rubberLine.style.display = '';
        closeRadial();
      });
      port.addEventListener('pointermove', (e) => {
        if (!portDrag) return;
        const p = toModel(e.clientX, e.clientY);
        rubberLine.setAttribute('x2', p.x);
        rubberLine.setAttribute('y2', p.y);
        const hover = document.elementFromPoint(e.clientX, e.clientY)?.closest('.sb-card');
        const valid = hover && hover !== portDrag.fromEl;
        if (portDrag.targetEl && portDrag.targetEl !== hover) {
          portDrag.targetEl.classList.remove('drop-target');
          portDrag.targetEl = null;
        }
        if (valid && portDrag.targetEl !== hover) {
          hover.classList.add('drop-target');
          portDrag.targetEl = hover;
        }
      });
      port.addEventListener('pointerup', (e) => {
        if (!portDrag) return;
        rubberLine.style.display = 'none';
        if (portDrag.targetEl) portDrag.targetEl.classList.remove('drop-target');
        const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('.sb-card');
        if (target && target !== portDrag.fromEl) {
          const toCard = cards.find((c) => c.id === target.dataset.id);
          if (toCard) {
            api(`/api/boards/${BOARD_ID}/edges`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ from: portDrag.fromCard.id, to: toCard.id, kind: 'link' }),
            }).then((edge) => { edges.push(edge); drawEdges(); });
          }
        }
        portDrag = null;
      });
    });
  }

  // ── Radial menu ───────────────────────────────────────────────────────────
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
      if (action === 'link') { setLinkMode(card.id); return; }
      if (action === 'edit') { openEditDialog(cardEl, card); return; }
      api(`/api/boards/${BOARD_ID}/cards/${card.id}/actions/${action}`, { method: 'POST' }).then(() => {
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
    if (!e.target.closest('.sb-card') && !e.target.closest('.sb-radial') && !e.target.closest('#sb-edges')) {
      closeRadial();
      setLinkMode(null);
      if (selectedEdge) { selectedEdge = null; drawEdges(); }
    }
  });

  // ── Board menu ────────────────────────────────────────────────────────────
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
    if (!e.target.closest('#sb-board-menu') && !e.target.closest('#sb-board-menu-btn'))
      boardMenu.style.display = 'none';
  });

  // ── Add-card flyout ───────────────────────────────────────────────────────
  const addDialog = document.getElementById('sb-add-dialog');
  const kindGrid = document.getElementById('sb-kind-grid');
  const detailEl = document.getElementById('sb-kind-detail');
  const addError = document.getElementById('sb-add-error');
  const addCreateBtn = document.getElementById('sb-add-create');
  const addDialogTitle = document.getElementById('sb-add-title');
  let selectedKind = null;
  let insertEdgeId = null;

  function openAddDialog() {
    if (!contract) return;
    insertEdgeId = null;
    addDialogTitle.textContent = 'Add card';
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

  function openInsertDialog(edgeId) {
    openAddDialog();
    insertEdgeId = edgeId;
    addDialogTitle.textContent = 'Insert card on connector';
  }

  function fieldHtml(key, type, value) {
    const isLong = type === 'any' || key === 'text' || key === 'html' || key === 'xml' || key === 'sql';
    const tag = isLong ? 'textarea' : 'input';
    const val = type === 'any' ? JSON.stringify(value, null, 2) : (value ?? '');
    return `<div class="sb-field"><label>${key}${type === 'any' ? ' (JSON)' : ''}</label>
      <${tag} data-field="${key}" data-type="${type}">${val}</${tag}></div>`;
  }

  function renderDetail(kind, values) {
    const example = values || kind.exampleCard.payload || {};
    const contentFields = Object.keys(kind.payloadSchema || {})
      .map((key) => fieldHtml(key, kind.payloadSchema[key], example[key]))
      .join('');
    const optionsKeys = Object.keys(kind.optionsSchema || {});
    const optionsSection = optionsKeys.length
      ? `<div class="sb-detail-section"><h4>Options</h4>${optionsKeys.map((k) => fieldHtml(k, kind.optionsSchema[k])).join('')}</div>`
      : '';
    return `
      <div class="sb-detail-section"><h4>Use</h4><p class="muted" style="font-size:13px;margin:0">${kind.description}</p></div>
      <div class="sb-detail-section"><h4>Core contents</h4>${contentFields}</div>
      ${optionsSection}`;
  }

  function collectPayload(kind, containerEl) {
    const payload = {};
    const schema = kind.payloadSchema || {};
    Object.keys(schema).forEach((key) => {
      const field = containerEl.querySelector(`[data-field="${key}"]`);
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
    detailEl.innerHTML = renderDetail(selectedKind);
    addCreateBtn.disabled = false;
    addError.hidden = true;
  });

  document.getElementById('sb-add-cancel').addEventListener('click', () => addDialog.close());

  addCreateBtn.addEventListener('click', () => {
    if (!selectedKind) return;
    let payload;
    try { payload = collectPayload(selectedKind, detailEl); }
    catch (err) { addError.textContent = 'Invalid JSON: ' + err.message; addError.hidden = false; return; }

    if (insertEdgeId) {
      insertCardOnEdge(insertEdgeId, selectedKind, payload);
      return;
    }

    const x = Math.round((canvas.scrollLeft / zoom + 40) / GRID) * GRID;
    const y = Math.round((canvas.scrollTop / zoom + 40) / GRID) * GRID;
    api(`/api/boards/${BOARD_ID}/cards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: selectedKind.id, x, y, payload }),
    }).then((card) => {
      cards.push(card);
      mountCard(card);
      drawEdges();
      addDialog.close();
    }).catch(() => { addError.textContent = 'Failed to create card.'; addError.hidden = false; });
  });

  // Insert a new card in the middle of an existing connector, pushing the
  // downstream card further away along the same direction to make room.
  function insertCardOnEdge(edgeId, kind, payload) {
    const edge = edges.find((e) => e.id === edgeId);
    const a = cards.find((c) => c.id === edge.from);
    const b = cards.find((c) => c.id === edge.to);
    if (!edge || !a || !b) { addDialog.close(); return; }

    const pa = cardCenter(a), pb = cardCenter(b);
    const dx = pb.x - pa.x, dy = pb.y - pa.y;
    const dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist, uy = dy / dist;
    const newW = 200, newH = 120;
    const midX = Math.round(((pa.x + pb.x) / 2 - newW / 2) / GRID) * GRID;
    const midY = Math.round(((pa.y + pb.y) / 2 - newH / 2) / GRID) * GRID;

    api(`/api/boards/${BOARD_ID}/edges/${edgeId}`, { method: 'DELETE' })
      .then(() => api(`/api/boards/${BOARD_ID}/cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: kind.id, x: midX, y: midY, w: newW, h: newH, payload }),
      }))
      .then((newCard) => {
        cards.push(newCard);
        mountCard(newCard);

        const shift = newW + 40;
        const newBx = Math.round((b.x + ux * shift) / GRID) * GRID;
        const newBy = Math.round((b.y + uy * shift) / GRID) * GRID;
        b.x = newBx; b.y = newBy;
        const bEl = canvas.querySelector(`.sb-card[data-id="${b.id}"]`);
        if (bEl) { bEl.style.left = newBx + 'px'; bEl.style.top = newBy + 'px'; }
        api(`/api/boards/${BOARD_ID}/cards/${b.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ x: newBx, y: newBy }),
        });

        edges = edges.filter((e) => e.id !== edgeId);
        return Promise.all([
          api(`/api/boards/${BOARD_ID}/edges`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: a.id, to: newCard.id, kind: 'link' }),
          }),
          api(`/api/boards/${BOARD_ID}/edges`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: newCard.id, to: b.id, kind: 'link' }),
          }),
        ]);
      })
      .then(([e1, e2]) => {
        edges.push(e1, e2);
        selectedEdge = null;
        insertEdgeId = null;
        drawEdges();
        addDialog.close();
      })
      .catch(() => { addError.textContent = 'Failed to insert card.'; addError.hidden = false; });
  }

  // ── Edit-card flyout ──────────────────────────────────────────────────────
  const editDialog = document.getElementById('sb-edit-dialog');
  const editDetailEl = document.getElementById('sb-edit-detail');
  const editError = document.getElementById('sb-edit-error');
  const editSaveBtn = document.getElementById('sb-edit-save');
  let editTarget = null;

  function openEditDialog(cardEl, card) {
    if (!contract) return;
    const kind = contract.kinds.find((k) => k.id === card.kind);
    if (!kind) return;
    editTarget = { cardEl, card, kind };
    editError.hidden = true;
    editDetailEl.innerHTML = renderDetail(kind, card.payload);
    editDialog.showModal();
  }

  document.getElementById('sb-edit-cancel').addEventListener('click', () => editDialog.close());

  editSaveBtn.addEventListener('click', () => {
    if (!editTarget) return;
    const { cardEl, card, kind } = editTarget;
    let payload;
    try { payload = collectPayload(kind, editDetailEl); }
    catch (err) { editError.textContent = 'Invalid JSON: ' + err.message; editError.hidden = false; return; }
    api(`/api/boards/${BOARD_ID}/cards/${card.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload }),
    }).then((updated) => {
      Object.assign(card, updated);
      renderCardBody(cardEl, card);
      editDialog.close();
    }).catch(() => { editError.textContent = 'Failed to save.'; editError.hidden = false; });
  });

  // ── Boot ──────────────────────────────────────────────────────────────────
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
