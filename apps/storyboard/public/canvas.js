(function () {
  const canvas = document.getElementById('sb-canvas');
  const dfContainer = document.getElementById('drawflow');
  const framesLayer = document.getElementById('sb-frames-layer');
  const edgeToolbarLayer = document.getElementById('sb-edge-toolbar-layer');
  const radial = document.getElementById('sb-radial');

  let contract = null;
  let cards = [];
  let edges = [];
  let frames = [];
  let linkMode = null;
  let radialFor = null;
  let selectedEdgeId = null;
  let pendingEdge = null;          // set right before a programmatic addConnection() replaying a known edge
  let pendingSelectAfterCreate = false;
  let cleanView = localStorage.getItem(`sb-clean-${BOARD_ID}`) === '1';

  const cardIdToNode = new Map();  // card.id -> drawflow numeric node id
  const nodeIdToCard = new Map();  // drawflow numeric node id -> card object
  const edgeKeyToId = new Map();   // "out:in:outClass:inClass" -> edge.id
  const edgeIdToKey = new Map();   // edge.id -> key

  function setCleanView(v) {
    cleanView = v;
    document.body.classList.toggle('sb-clean', v);
    localStorage.setItem(`sb-clean-${BOARD_ID}`, v ? '1' : '0');
    const btn = document.querySelector('[data-action="clean-view"]');
    if (btn) btn.textContent = v ? '✓ Clean view' : 'Clean view';
  }

  // ── Drawflow setup ───────────────────────────────────────────────────────
  const editor = new Drawflow(dfContainer);
  editor.reroute = false;
  editor.zoom_min = 0.25;
  editor.zoom_max = 2;
  editor.start();
  editor.precanvas.appendChild(framesLayer);
  editor.precanvas.appendChild(edgeToolbarLayer);
  // Any mousedown inside these overlay layers belongs to our own custom
  // drag logic — stop it from also bubbling to Drawflow's container-level
  // mousedown handler, which would otherwise start a node/canvas drag too.
  framesLayer.addEventListener('mousedown', (e) => e.stopPropagation());
  edgeToolbarLayer.addEventListener('mousedown', (e) => e.stopPropagation());

  function toModel(clientX, clientY) {
    const r = dfContainer.getBoundingClientRect();
    return {
      x: (clientX - r.left - editor.canvas_x) / editor.zoom,
      y: (clientY - r.top - editor.canvas_y) / editor.zoom,
    };
  }

  const zoomLabel = document.getElementById('sb-zoom-reset');
  function syncZoomLabel() { zoomLabel.textContent = Math.round(editor.zoom * 100) + '%'; }
  editor.on('zoom', syncZoomLabel);
  document.getElementById('sb-zoom-in').addEventListener('click', () => editor.zoom_in());
  document.getElementById('sb-zoom-out').addEventListener('click', () => editor.zoom_out());
  zoomLabel.addEventListener('click', () => editor.zoom_reset());

  const KIND_ICONS = {
    markdown: '¶', json: '{}', html: '<>', xml: '</>', sql: 'DB',
    prompt: '✦', agent: '⬡', 'tool-call': '⚙', hook: '⚡', gate: '◈', memory: '◉', output: '◀', eval: '✓',
    start: '▶', end: '⏹', branch: '◇', merge: '⋁', parallel: '║', join: '║', wait: '⏸', error: '!', 'loop-back': '↩',
  };

  const PORT_COLORS_BINARY  = ['#1D9E75', '#D85A30'];
  const PORT_COLORS_NEUTRAL = ['#534AB7', '#185FA5', '#BA7517', '#5F5E5A', '#993556', '#0F6E56'];
  const PORT_TEXT = {
    '#1D9E75': '#9FE1CB', '#D85A30': '#F5C4B3',
    '#534AB7': '#CECBF6', '#185FA5': '#B5D4F4',
    '#BA7517': '#FAC775', '#5F5E5A': '#D3D1C7',
    '#993556': '#F4C0D1', '#0F6E56': '#9FE1CB',
  };

  function getPortColor(index, outputColors) {
    const palette = outputColors === 'binary' ? PORT_COLORS_BINARY : PORT_COLORS_NEUTRAL;
    return palette[index % palette.length];
  }

  function portNames(card) {
    const raw = card?.payload?.outputs;
    if (!raw) return [];
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }

  function portColorForEdge(edge) {
    if (!edge.sourcePort) return null;
    const fromCard = cards.find((c) => c.id === edge.from);
    const names = portNames(fromCard);
    const idx = names.indexOf(edge.sourcePort);
    if (idx < 0) return null;
    const kindDef = contract?.kinds?.find((k) => k.id === fromCard.kind);
    return getPortColor(idx, kindDef?.outputColors);
  }

  function edgeOutClassFor(edge, fromCard) {
    if (!edge.sourcePort) return 'output_1';
    const idx = portNames(fromCard).indexOf(edge.sourcePort);
    return idx >= 0 ? `output_${idx + 1}` : 'output_1';
  }

  const api = (path, opts) => fetch(BASE + path, opts).then((r) => (r.status === 204 ? null : r.json()));

  function cardCenter(card) {
    return { x: card.x + (card.w || 200) / 2, y: card.y + (card.h || 120) / 2 };
  }

  function closeRadial() {
    radial.style.display = 'none';
    radialFor = null;
  }

  function setLinkMode(cardId) {
    linkMode = cardId;
    document.getElementById('sb-link-hint').style.display = cardId ? 'inline' : 'none';
    document.querySelectorAll('.sb-card').forEach((el) => el.classList.toggle('linking', el.dataset.id === cardId));
  }

  // Arrow marker defs shared by every connection path (Drawflow doesn't add its own).
  const markerHost = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  markerHost.style.cssText = 'position:absolute;width:0;height:0';
  markerHost.innerHTML = `<defs>
    <marker id="sb-arrow" markerWidth="10" markerHeight="10" refX="7" refY="4" orient="auto">
      <path d="M0,0 L0,8 L9,4 z" fill="var(--text-dim)"/>
    </marker>
    <marker id="sb-arrow-sel" markerWidth="10" markerHeight="10" refX="7" refY="4" orient="auto">
      <path d="M0,0 L0,8 L9,4 z" fill="var(--accent)"/>
    </marker>
    <marker id="sb-arrow-ref" markerWidth="10" markerHeight="10" refX="7" refY="4" orient="auto">
      <path d="M0,0 L0,8 L9,4 z" fill="var(--accent-muted,#5a9a8a)"/>
    </marker>`;
  canvas.appendChild(markerHost);

  function connSelector(outId, inId, outClass, inClass) {
    return `.connection.node_out_node-${outId}.node_in_node-${inId}.${outClass}.${inClass}`;
  }

  function updateEdgeVisual(edge) {
    const key = edgeIdToKey.get(edge.id);
    if (!key) return;
    const [outId, inId, outClass, inClass] = key.split(':');
    const el = dfContainer.querySelector(connSelector(outId, inId, outClass, inClass));
    if (!el) return;
    const path = el.querySelector('.main-path');
    const isRef = edge.type === 'reference';
    const sel = selectedEdgeId === edge.id;
    const portColor = portColorForEdge(edge);
    const col = sel ? 'var(--accent)' : portColor || (isRef ? 'var(--accent-muted,#5a9a8a)' : 'var(--text-dim)');
    const marker = sel ? 'url(#sb-arrow-sel)' : isRef ? 'url(#sb-arrow-ref)' : 'url(#sb-arrow)';
    path.style.stroke = col;
    path.style.strokeWidth = sel ? '2.5px' : isRef ? '1.5px' : '2px';
    path.style.strokeDasharray = isRef ? '7 4' : '';
    path.setAttribute('marker-end', marker);
    el.classList.toggle('selected', sel);
  }

  function registerConnection(edge, outId, inId, outClass, inClass) {
    const key = `${outId}:${inId}:${outClass}:${inClass}`;
    edgeKeyToId.set(key, edge.id);
    edgeIdToKey.set(edge.id, key);
    updateEdgeVisual(edge);
  }

  function attachEdge(edge) {
    const fromNode = cardIdToNode.get(edge.from);
    const toNode = cardIdToNode.get(edge.to);
    if (fromNode == null || toNode == null) return;
    const fromCard = cards.find((c) => c.id === edge.from);
    const outClass = edgeOutClassFor(edge, fromCard);
    pendingEdge = edge;
    editor.addConnection(fromNode, toNode, outClass, 'input_1');
    pendingEdge = null;
  }

  editor.on('connectionCreated', ({ output_id, input_id, output_class, input_class }) => {
    if (pendingEdge) {
      registerConnection(pendingEdge, output_id, input_id, output_class, input_class);
      return;
    }
    const fromCard = nodeIdToCard.get(Number(output_id));
    const toCard = nodeIdToCard.get(Number(input_id));
    if (!fromCard || !toCard) return;
    const names = portNames(fromCard);
    const idx = Number(output_class.split('_')[1]) - 1;
    const sourcePort = names[idx] || undefined;
    api(`/api/boards/${BOARD_ID}/edges`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: fromCard.id, to: toCard.id, kind: 'link', sourcePort }),
    }).then((edge) => {
      edges.push(edge);
      registerConnection(edge, output_id, input_id, output_class, input_class);
      if (pendingSelectAfterCreate) {
        selectedEdgeId = edge.id;
        pendingSelectAfterCreate = false;
        edges.forEach(updateEdgeVisual);
        renderEdgeToolbar();
      }
    }).catch(() => {
      editor.removeSingleConnection(output_id, input_id, output_class, input_class);
    });
  });

  editor.on('connectionRemoved', ({ output_id, input_id, output_class, input_class }) => {
    const key = `${output_id}:${input_id}:${output_class}:${input_class}`;
    const edgeId = edgeKeyToId.get(key);
    edgeKeyToId.delete(key);
    if (!edgeId) return;
    edgeIdToKey.delete(edgeId);
    edges = edges.filter((e) => e.id !== edgeId);
    if (selectedEdgeId === edgeId) { selectedEdgeId = null; renderEdgeToolbar(); }
    api(`/api/boards/${BOARD_ID}/edges/${edgeId}`, { method: 'DELETE' });
  });

  editor.on('connectionSelected', ({ output_id, input_id, output_class, input_class }) => {
    const key = `${output_id}:${input_id}:${output_class}:${input_class}`;
    selectedEdgeId = edgeKeyToId.get(key) || null;
    edges.forEach(updateEdgeVisual);
    renderEdgeToolbar();
  });
  editor.on('connectionUnselected', () => {
    selectedEdgeId = null;
    edges.forEach(updateEdgeVisual);
    renderEdgeToolbar();
  });

  editor.on('nodeMoved', (id) => {
    const card = nodeIdToCard.get(Number(id));
    if (!card) return;
    const data = editor.getNodeFromId(id);
    const snappedX = Math.round(data.pos_x / GRID) * GRID;
    const snappedY = Math.round(data.pos_y / GRID) * GRID;
    card.x = snappedX; card.y = snappedY;
    const el = document.getElementById('node-' + id);
    if (el) { el.style.left = snappedX + 'px'; el.style.top = snappedY + 'px'; }
    editor.drawflow.drawflow[editor.module].data[id].pos_x = snappedX;
    editor.drawflow.drawflow[editor.module].data[id].pos_y = snappedY;
    editor.updateConnectionNodes('node-' + id);
    const center = cardCenter(card);
    const hostFrame = findFrameAt(center.x, center.y);
    const newFrameId = hostFrame ? hostFrame.id : null;
    const patch = { x: snappedX, y: snappedY };
    if (newFrameId !== (card.frameId || null)) patch.frameId = newFrameId;
    card.frameId = newFrameId;
    api(`/api/boards/${BOARD_ID}/cards/${card.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
    });
    renderEdgeToolbar();
  });

  canvas.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('.drawflow-node') && !e.target.closest('.sb-radial')
      && !e.target.closest('.connection') && !e.target.closest('#sb-edge-toolbar-layer')) {
      closeRadial();
      setLinkMode(null);
    }
  });

  // ── Edge toolbar (shown for the selected connection) ────────────────────
  function renderEdgeToolbar() {
    const edge = edges.find((e) => e.id === selectedEdgeId);
    if (!edge) { edgeToolbarLayer.innerHTML = ''; return; }
    const a = cards.find((c) => c.id === edge.from);
    const b = cards.find((c) => c.id === edge.to);
    if (!a || !b) { edgeToolbarLayer.innerHTML = ''; return; }
    const pa = cardCenter(a), pb = cardCenter(b);
    const mx = (pa.x + pb.x) / 2, my = (pa.y + pb.y) / 2;
    const type = edge.type || 'sequence';
    edgeToolbarLayer.innerHTML = `
      <div class="sb-edge-toolbar" style="left:${mx - 55}px;top:${my - 15}px">
        <button data-type-edge="${edge.id}" title="${type === 'reference' ? 'Switch to sequence' : 'Switch to reference'}" type="button" style="${type === 'reference' ? 'color:var(--accent-muted,#5a9a8a)' : ''}">${type === 'reference' ? '╌' : '—'}</button>
        <button data-flip-edge="${edge.id}" title="Flip direction" type="button">⇄</button>
        <button data-add-edge="${edge.id}" title="Insert card here" type="button">+</button>
        <button data-del-edge="${edge.id}" title="Delete connector" type="button" class="danger">×</button>
      </div>`;

    edgeToolbarLayer.querySelector('[data-del-edge]').addEventListener('click', (ev) => {
      ev.stopPropagation();
      const e2 = edges.find((e) => e.id === edge.id);
      if (!e2) return;
      const fromNode = cardIdToNode.get(e2.from), toNode = cardIdToNode.get(e2.to);
      const outClass = edgeOutClassFor(e2, cards.find((c) => c.id === e2.from));
      editor.removeSingleConnection(fromNode, toNode, outClass, 'input_1');
    });
    edgeToolbarLayer.querySelector('[data-flip-edge]').addEventListener('click', (ev) => {
      ev.stopPropagation();
      const e2 = edges.find((e) => e.id === edge.id);
      if (!e2) return;
      const fromNode = cardIdToNode.get(e2.from), toNode = cardIdToNode.get(e2.to);
      const outClass = edgeOutClassFor(e2, cards.find((c) => c.id === e2.from));
      pendingSelectAfterCreate = true;
      editor.removeSingleConnection(fromNode, toNode, outClass, 'input_1');
      editor.addConnection(toNode, fromNode, 'output_1', 'input_1');
    });
    edgeToolbarLayer.querySelector('[data-type-edge]').addEventListener('click', (ev) => {
      ev.stopPropagation();
      const e2 = edges.find((e) => e.id === edge.id);
      if (!e2) return;
      const next = e2.type === 'reference' ? 'sequence' : 'reference';
      api(`/api/boards/${BOARD_ID}/edges/${e2.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: next }),
      }).then(() => { e2.type = next; updateEdgeVisual(e2); renderEdgeToolbar(); });
    });
    edgeToolbarLayer.querySelector('[data-add-edge]').addEventListener('click', (ev) => {
      ev.stopPropagation();
      openInsertDialog(edge.id);
    });
  }

  // ── Frames (groups / loops / note regions) ──────────────────────────────
  // A frame's box is freestanding (its own x/y/w/h) — membership is derived
  // by checking which frame a card's center currently falls inside, not the
  // other way around, so an empty frame can exist and cards can be dragged
  // into or out of it without the frame's geometry drifting.
  const FRAME_ICONS = { group: '▢', loop: '↻', note: '✎' };
  const FRAME_TYPES = ['group', 'loop', 'note'];

  function findFrameAt(x, y) {
    for (let i = frames.length - 1; i >= 0; i--) {
      const f = frames[i];
      if (x >= f.x && x <= f.x + f.w && y >= f.y && y <= f.y + f.h) return f;
    }
    return null;
  }

  function membersOf(frameId) {
    return cards.filter((c) => c.frameId === frameId);
  }

  function moveCardNodeTo(card, x, y) {
    const nodeId = cardIdToNode.get(card.id);
    if (nodeId == null) return;
    const el = document.getElementById('node-' + nodeId);
    if (el) { el.style.left = x + 'px'; el.style.top = y + 'px'; }
    const data = editor.drawflow.drawflow[editor.module].data[nodeId];
    if (data) { data.pos_x = x; data.pos_y = y; }
    editor.updateConnectionNodes('node-' + nodeId);
  }

  function mountFrame(frame) {
    const el = document.createElement('div');
    el.className = 'sb-frame';
    el.dataset.id = frame.id;
    el.dataset.type = frame.type;
    el.style.left = frame.x + 'px';
    el.style.top = frame.y + 'px';
    el.style.width = frame.w + 'px';
    el.style.height = frame.h + 'px';
    el.innerHTML = `
      <div class="sb-frame-label">
        <span class="sb-frame-icon" title="Click to change type">${FRAME_ICONS[frame.type] || '▢'}</span>
        <span class="sb-frame-title" data-placeholder="${frame.type}">${frame.label || ''}</span>
        <button class="sb-frame-del" type="button" title="Delete frame">×</button>
      </div>
      <div class="sb-frame-resize" title="Drag to resize"></div>`;
    framesLayer.appendChild(el);

    const label = el.querySelector('.sb-frame-label');
    const icon = el.querySelector('.sb-frame-icon');
    const title = el.querySelector('.sb-frame-title');
    const del = el.querySelector('.sb-frame-del');
    const resize = el.querySelector('.sb-frame-resize');

    icon.addEventListener('click', (e) => {
      e.stopPropagation();
      const next = FRAME_TYPES[(FRAME_TYPES.indexOf(frame.type) + 1) % FRAME_TYPES.length];
      frame.type = next;
      el.dataset.type = next;
      icon.textContent = FRAME_ICONS[next];
      title.dataset.placeholder = next;
      api(`/api/boards/${BOARD_ID}/frames/${frame.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: next }),
      });
    });

    title.addEventListener('click', (e) => {
      e.stopPropagation();
      title.contentEditable = 'true';
      title.focus();
      const sel = window.getSelection(), range = document.createRange();
      range.selectNodeContents(title);
      sel.removeAllRanges(); sel.addRange(range);
    });
    title.addEventListener('pointerdown', (e) => e.stopPropagation());
    title.addEventListener('blur', () => {
      title.contentEditable = 'false';
      frame.label = title.textContent.trim();
      api(`/api/boards/${BOARD_ID}/frames/${frame.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label: frame.label }),
      });
    });
    title.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); title.blur(); } });

    del.addEventListener('pointerdown', (e) => e.stopPropagation());
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      api(`/api/boards/${BOARD_ID}/frames/${frame.id}`, { method: 'DELETE' }).then(() => {
        el.remove();
        frames = frames.filter((f) => f.id !== frame.id);
        cards.forEach((c) => { if (c.frameId === frame.id) c.frameId = null; });
      });
    });

    // Drag: frame border (within BORDER_HIT px of edge) OR label bar acts as handle.
    const BORDER_HIT = 14;
    let dragging = false, offX = 0, offY = 0;
    el.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.sb-frame-title') || e.target.closest('.sb-frame-del') || e.target.closest('.sb-frame-resize')) return;
      const r = el.getBoundingClientRect();
      const lx = (e.clientX - r.left) / editor.zoom, ly = (e.clientY - r.top) / editor.zoom;
      const onBorder = lx < BORDER_HIT || ly < BORDER_HIT || lx > frame.w - BORDER_HIT || ly > frame.h - BORDER_HIT;
      const onLabel = e.target.closest('.sb-frame-label');
      if (!onBorder && !onLabel) return;
      dragging = true;
      el.setPointerCapture(e.pointerId);
      offX = lx; offY = ly;
    });
    el.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const p = toModel(e.clientX, e.clientY);
      const x = p.x - offX, y = p.y - offY;
      const dx = x - frame.x, dy = y - frame.y;
      frame.x = x; frame.y = y;
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      membersOf(frame.id).forEach((c) => {
        c.x += dx; c.y += dy;
        moveCardNodeTo(c, c.x, c.y);
      });
    });
    el.addEventListener('pointerup', (e) => {
      if (!dragging) return;
      dragging = false;
      el.releasePointerCapture(e.pointerId);
      frame.x = Math.round(frame.x / GRID) * GRID;
      frame.y = Math.round(frame.y / GRID) * GRID;
      el.style.left = frame.x + 'px';
      el.style.top = frame.y + 'px';
      api(`/api/boards/${BOARD_ID}/frames/${frame.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ x: frame.x, y: frame.y }),
      });
      membersOf(frame.id).forEach((c) => {
        c.x = Math.round(c.x / GRID) * GRID;
        c.y = Math.round(c.y / GRID) * GRID;
        moveCardNodeTo(c, c.x, c.y);
        api(`/api/boards/${BOARD_ID}/cards/${c.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ x: c.x, y: c.y }),
        });
      });
      renderEdgeToolbar();
    });

    let resizing = false, startX = 0, startY = 0, startW = 0, startH = 0;
    resize.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      resizing = true;
      resize.setPointerCapture(e.pointerId);
      startX = e.clientX; startY = e.clientY;
      startW = el.offsetWidth; startH = el.offsetHeight;
    });
    resize.addEventListener('pointermove', (e) => {
      if (!resizing) return;
      const w = Math.max(GRID * 4, startW + (e.clientX - startX) / editor.zoom);
      const h = Math.max(GRID * 3, startH + (e.clientY - startY) / editor.zoom);
      el.style.width = w + 'px';
      el.style.height = h + 'px';
      frame.w = w; frame.h = h;
    });
    resize.addEventListener('pointerup', () => {
      if (!resizing) return;
      resizing = false;
      const w = Math.round(frame.w / GRID) * GRID;
      const h = Math.round(frame.h / GRID) * GRID;
      frame.w = w; frame.h = h;
      el.style.width = w + 'px';
      el.style.height = h + 'px';
      api(`/api/boards/${BOARD_ID}/frames/${frame.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ w, h }),
      });
    });
  }

  // ── Named output ports ────────────────────────────────────────────────────
  // Drawflow's own output_N dots stay the real drag-to-connect targets — we
  // only overlay a name+color label on top of them (per-index).
  function labelOutputPorts(nodeId, card, kindDef) {
    const el = document.getElementById('node-' + nodeId);
    if (!el) return;
    el.querySelectorAll('.sb-port-label').forEach((l) => l.remove());
    const names = portNames(card);
    const outputEls = el.querySelectorAll('.outputs .output');
    outputEls.forEach((port, i) => {
      const name = names[i];
      const color = getPortColor(i, kindDef?.outputColors);
      port.style.background = name ? color : '';
      if (!name) return;
      const textColor = PORT_TEXT[color] || '#fff';
      const label = document.createElement('span');
      label.className = 'sb-port-label';
      label.textContent = name;
      label.style.cssText = `position:absolute; left:100%; top:50%; transform:translateY(-50%); margin-left:6px;
        white-space:nowrap; background:${color}; color:${textColor}; font-size:9px; font-weight:600;
        padding:2px 6px; border-radius:3px; pointer-events:none; z-index:20;`;
      port.appendChild(label);
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
    const kindDef = contract?.kinds?.find((k) => k.id === card.kind);
    const isFlow = !!kindDef?.shape;
    if (isFlow) {
      // Flow cards are always sized by their kind definition — not resizable.
      card.w = kindDef.defaultW || 40;
      card.h = kindDef.defaultH || 40;
    }
    const names = portNames(card);
    const numOut = Math.max(1, names.length);
    const icon = KIND_ICONS[card.kind] || '□';
    const classes = isFlow ? 'sb-card sb-flow-card' : 'sb-card';
    const html = `
      <div class="sb-card-head">
        <span class="sb-kind-icon" aria-hidden="true">${icon}</span>
        <span class="sb-kind-label">${card.kind}</span>
        <button class="sb-dots" type="button">⋯</button>
      </div>
      <div class="sb-card-body">loading…</div>
      <div class="sb-resize" title="Drag to resize"></div>`;

    const nodeId = editor.addNode(card.kind, 1, numOut, card.x, card.y, classes, {}, html, false);
    cardIdToNode.set(card.id, nodeId);
    nodeIdToCard.set(nodeId, card);

    const el = document.getElementById('node-' + nodeId);
    el.dataset.id = card.id;
    el.dataset.kindId = card.kind;
    if (isFlow) {
      el.dataset.shape = kindDef.shape;
      el.style.width = card.w + 'px';
      el.style.height = card.h + 'px';
    } else {
      if (card.w) el.style.width = card.w + 'px';
      if (card.h) el.style.height = card.h + 'px';
    }

    renderCardBody(el, card);
    wireResize(el, card);
    labelOutputPorts(nodeId, card, kindDef);

    if (!isFlow) {
      el.querySelector('.sb-dots').addEventListener('click', (e) => {
        e.stopPropagation();
        openRadial(el, card);
      });
    } else {
      el.addEventListener('click', (e) => {
        if (e.target.closest('.input') || e.target.closest('.output')) return;
        e.stopPropagation();
        openRadial(el, card);
      });
    }

    el.addEventListener('pointerdown', () => {
      if (linkMode && linkMode !== card.id) {
        api(`/api/boards/${BOARD_ID}/edges`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: linkMode, to: card.id, kind: 'link' }),
        }).then((edge) => {
          edges.push(edge);
          attachEdge(edge);
          setLinkMode(null);
        });
      }
    });
  }

  // ── Resize (Drawflow has no built-in resize; kept custom) ────────────────
  function wireResize(el, card) {
    const handle = el.querySelector('.sb-resize');
    let resizing = false, startX = 0, startY = 0, startW = 0, startH = 0;

    handle.addEventListener('mousedown', (e) => e.stopPropagation());
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
      const w = Math.max(GRID * 4, startW + (e.clientX - startX) / editor.zoom);
      const h = Math.max(GRID * 3, startH + (e.clientY - startY) / editor.zoom);
      el.style.width = w + 'px';
      el.style.height = h + 'px';
      card.w = w;
      card.h = h;
    });
    handle.addEventListener('pointerup', () => {
      if (!resizing) return;
      resizing = false;
      const snappedW = Math.round(card.w / GRID) * GRID;
      const snappedH = Math.round(card.h / GRID) * GRID;
      el.style.width = snappedW + 'px';
      el.style.height = snappedH + 'px';
      card.w = snappedW;
      card.h = snappedH;
      const nodeId = cardIdToNode.get(card.id);
      editor.updateConnectionNodes('node-' + nodeId);
      renderEdgeToolbar();
      api(`/api/boards/${BOARD_ID}/cards/${card.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ w: snappedW, h: snappedH }),
      });
    });
  }

  // ── Radial menu ───────────────────────────────────────────────────────────
  function openRadial(cardEl, card) {
    if (radialFor === card.id) return closeRadial();
    const r = cardEl.getBoundingClientRect();
    const c = canvas.getBoundingClientRect();
    radial.style.left = (r.left - c.left + r.width / 2 - 50) + 'px';
    radial.style.top = (r.top - c.top + r.height / 2 - 50) + 'px';
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
          const nodeId = cardIdToNode.get(card.id);
          editor.removeNodeId('node-' + nodeId);
          cardIdToNode.delete(card.id);
          nodeIdToCard.delete(nodeId);
          cards = cards.filter((c) => c.id !== card.id);
        }
      });
    };
  }

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
    if (btn.dataset.action === 'clean-view') { setCleanView(!cleanView); return; }
    if (btn.dataset.action === 'add-frame') {
      const x = Math.round((-editor.canvas_x / editor.zoom + 40) / GRID) * GRID;
      const y = Math.round((-editor.canvas_y / editor.zoom + 40) / GRID) * GRID;
      api(`/api/boards/${BOARD_ID}/frames`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'group', x, y }),
      }).then((frame) => { frames.push(frame); mountFrame(frame); });
    }
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

  let activeCategory = 'general';

  function renderKindGrid(category) {
    activeCategory = category;
    const filtered = contract.kinds.filter((k) =>
      category === 'ai-workflow' ? k.category === 'ai-workflow' :
      category === 'flow' ? k.category === 'flow' :
      !k.category || k.category === 'general'
    );
    kindGrid.innerHTML = filtered
      .map((k) => {
        const icon = KIND_ICONS[k.id] || '□';
        return `<button type="button" class="sb-kind-tile" data-kind="${k.id}">
          <div class="k-icon">${icon}</div><div class="k-id">${k.name || k.id}</div><div class="k-desc">${k.description}</div></button>`;
      })
      .join('');
    document.querySelectorAll('.sb-cat-tab').forEach((t) => t.classList.toggle('active', t.dataset.cat === category));
  }

  function openAddDialog() {
    if (!contract) return;
    insertEdgeId = null;
    addDialogTitle.textContent = 'Add card';
    addError.hidden = true;
    showKindGrid();
    renderKindGrid(activeCategory);
    addDialog.showModal();
  }

  function openInsertDialog(edgeId) {
    openAddDialog();
    insertEdgeId = edgeId;
    addDialogTitle.textContent = 'Insert card on connector';
  }

  function fieldHtml(key, type, value, hints = {}, fieldOptions = {}, listId = null) {
    const isLong = type === 'any' || key === 'text' || key === 'html' || key === 'xml' || key === 'sql';
    const val = type === 'any' ? JSON.stringify(value ?? null, null, 2) : String(value ?? '');
    const hint = hints[key] || '';
    const hintEl = hint ? ` <span class="sb-field-hint" title="${hint}">?</span>` : '';
    const label = `<label>${key}${type === 'any' ? ' (JSON)' : ''}${hintEl}</label>`;
    if (type === 'select') {
      const opts = fieldOptions[key] || [];
      const optionsHtml = opts
        .map((o) => `<option value="${o.value}"${o.value === val ? ' selected' : ''}>${o.label || o.value}</option>`)
        .join('');
      return `<div class="sb-field">${label}<select data-field="${key}" data-type="${type}">${optionsHtml}</select></div>`;
    }
    if (isLong) {
      return `<div class="sb-field">${label}<textarea data-field="${key}" data-type="${type}" placeholder="${hint || key}">${val}</textarea></div>`;
    }
    const listAttr = listId ? ` list="${listId}"` : '';
    const datalistEl = listId ? `<datalist id="${listId}"></datalist>` : '';
    return `<div class="sb-field">${label}<input data-field="${key}" data-type="${type}" value="${val}" placeholder="${hint || key}"${listAttr}>${datalistEl}</div>`;
  }

  function listFieldHtml(key, value, hints, outputColors) {
    const val = String(value ?? '');
    const items = val ? val.split(',').map((s) => s.trim()).filter(Boolean) : [];
    const hint = hints[key] || '';
    const hintEl = hint ? ` <span class="sb-field-hint" title="${hint}">?</span>` : '';
    const itemsHtml = items.map((name, i) => {
      const color = getPortColor(i, outputColors);
      return `<div class="sb-list-item"><span class="sb-list-dot" style="background:${color}"></span><span class="sb-list-name">${name}</span><button class="sb-list-del" type="button" data-idx="${i}">×</button></div>`;
    }).join('');
    return `<div class="sb-field">
      <label>${key}${hintEl}</label>
      <div class="sb-list-editor" data-field="${key}" data-type="list">
        <input type="hidden" data-list-value value="${val}">
        <div class="sb-list-items">${itemsHtml}</div>
        <div class="sb-list-add-row">
          <input type="text" class="sb-list-input" placeholder="path name">
          <button class="sb-list-add-btn" type="button">Add</button>
        </div>
      </div>
    </div>`;
  }

  function renderDetail(kind, values) {
    const example = values || kind.exampleCard?.payload || {};
    const hints = kind.fieldHints || {};
    const fieldOptions = kind.fieldOptions || {};
    const suggestions = kind.fieldSuggestions || {};
    const contentFields = Object.keys(kind.payloadSchema || {})
      .map((key) => {
        const type = kind.payloadSchema[key];
        if (type === 'list') return listFieldHtml(key, example[key], hints, kind.outputColors);
        const listId = suggestions[key] ? `sb-dl-${key}` : null;
        return fieldHtml(key, type, example[key], hints, fieldOptions, listId);
      })
      .join('');
    const optionsKeys = Object.keys(kind.optionsSchema || {});
    const optionsSection = optionsKeys.length
      ? `<div class="sb-detail-section"><h4>Options</h4>${optionsKeys.map((k) => fieldHtml(k, kind.optionsSchema[k], undefined, hints, fieldOptions)).join('')}</div>`
      : '';
    return `
      <div class="sb-detail-section"><h4>Core contents</h4>${contentFields}</div>
      ${optionsSection}`;
  }

  function collectPayload(kind, containerEl) {
    const payload = {};
    const schema = kind.payloadSchema || {};
    Object.keys(schema).forEach((key) => {
      if (schema[key] === 'list') {
        const editor2 = containerEl.querySelector(`[data-field="${key}"][data-type="list"]`);
        payload[key] = editor2?.querySelector('[data-list-value]')?.value || '';
      } else {
        const field = containerEl.querySelector(`[data-field="${key}"]`);
        payload[key] = schema[key] === 'any' ? JSON.parse(field.value) : field.value;
      }
    });
    return payload;
  }

  function setupListFields(containerEl, kind) {
    containerEl.querySelectorAll('.sb-list-editor[data-type="list"]').forEach((listEditor) => {
      const key = listEditor.dataset.field;
      const outputColors = kind?.outputColors;
      const hidden = listEditor.querySelector('[data-list-value]');
      const itemsEl = listEditor.querySelector('.sb-list-items');
      const addInput = listEditor.querySelector('.sb-list-input');
      const addBtn = listEditor.querySelector('.sb-list-add-btn');

      function getItems() { return (hidden.value || '').split(',').map((s) => s.trim()).filter(Boolean); }
      function setItems(arr) {
        hidden.value = arr.join(', ');
        itemsEl.innerHTML = arr.map((name, i) => {
          const color = getPortColor(i, outputColors);
          return `<div class="sb-list-item"><span class="sb-list-dot" style="background:${color}"></span><span class="sb-list-name">${name}</span><button class="sb-list-del" type="button" data-idx="${i}">×</button></div>`;
        }).join('');
        itemsEl.querySelectorAll('.sb-list-del').forEach((btn) => {
          btn.addEventListener('click', () => { const a = getItems(); a.splice(Number(btn.dataset.idx), 1); setItems(a); });
        });
      }

      itemsEl.querySelectorAll('.sb-list-del').forEach((btn) => {
        btn.addEventListener('click', () => { const a = getItems(); a.splice(Number(btn.dataset.idx), 1); setItems(a); });
      });
      addBtn.addEventListener('click', () => {
        const name = addInput.value.trim();
        if (!name) return;
        const items = getItems();
        if (items.length >= 6) return;
        items.push(name);
        setItems(items);
        addInput.value = '';
        addInput.focus();
      });
      addInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addBtn.click(); } });
    });
  }

  // Suggestion sources are URL strings fetched once and cached, keyed by
  // another field's value (e.g. name suggestions keyed by the callType
  // select). Every source endpoint returns [{ value, label? }, ...] — one
  // shape regardless of what's behind it (a live store, a declared registry,
  // or a manually-refreshed file) — so this stays source-agnostic. The field
  // is always a free-text input too — picking a suggestion is optional;
  // typing something new plans a tool that doesn't exist yet.
  const escAttr = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const suggestionCache = new Map();
  function fetchSuggestionList(url) {
    if (!suggestionCache.has(url)) {
      suggestionCache.set(url, fetch(url).then((r) => (r.ok ? r.json() : [])).catch(() => []));
    }
    return suggestionCache.get(url);
  }

  function setupSuggestions(containerEl, kind) {
    Object.entries(kind.fieldSuggestions || {}).forEach(([fieldKey, cfg]) => {
      const datalistEl = containerEl.querySelector(`#sb-dl-${fieldKey}`);
      const keyField = containerEl.querySelector(`[data-field="${cfg.keyedBy}"]`);
      if (!datalistEl || !keyField) return;
      const apply = () => {
        const url = (cfg.sources || {})[keyField.value];
        if (!url) { datalistEl.innerHTML = ''; return; }
        datalistEl.innerHTML = '';
        fetchSuggestionList(url).then((list) => {
          datalistEl.innerHTML = (list || [])
            .map((it) => `<option value="${escAttr(it.value)}"${it.label ? ` label="${escAttr(it.label)}"` : ''}></option>`)
            .join('');
        });
      };
      apply();
      keyField.addEventListener('change', apply);
    });
  }

  document.getElementById('sb-cat-tabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.sb-cat-tab');
    if (!tab) return;
    selectedKind = null;
    detailEl.innerHTML = '';
    addCreateBtn.disabled = true;
    renderKindGrid(tab.dataset.cat);
  });

  const kindBack = document.getElementById('sb-kind-back');
  const catTabs = document.getElementById('sb-cat-tabs');

  function showKindDetail(kind) {
    selectedKind = kind;
    kindGrid.style.display = 'none';
    catTabs.style.display = 'none';
    kindBack.style.display = 'flex';
    kindBack.querySelector('.sb-kind-back-label').textContent = kind.name || kind.id;
    detailEl.innerHTML = renderDetail(kind);
    setupListFields(detailEl, kind);
    setupSuggestions(detailEl, kind);
    addCreateBtn.disabled = false;
    addError.hidden = true;
  }

  function showKindGrid() {
    selectedKind = null;
    detailEl.innerHTML = '';
    addCreateBtn.disabled = true;
    kindGrid.style.display = '';
    catTabs.style.display = '';
    kindBack.style.display = 'none';
  }

  kindBack.querySelector('.sb-kind-back-btn').addEventListener('click', showKindGrid);

  kindGrid.addEventListener('click', (e) => {
    const tile = e.target.closest('.sb-kind-tile');
    if (!tile) return;
    const kind = contract.kinds.find((k) => k.id === tile.dataset.kind) || null;
    if (kind) showKindDetail(kind);
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

    const x = Math.round((-editor.canvas_x / editor.zoom + 40) / GRID) * GRID;
    const y = Math.round((-editor.canvas_y / editor.zoom + 40) / GRID) * GRID;
    api(`/api/boards/${BOARD_ID}/cards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: selectedKind.id, x, y, payload }),
    }).then((card) => {
      cards.push(card);
      mountCard(card);
      addDialog.close();
    }).catch(() => { addError.textContent = 'Failed to create card.'; addError.hidden = false; });
  });

  // Insert a new card in the middle of an existing connector, pushing the
  // downstream card further away along the same direction to make room.
  function insertCardOnEdge(edgeId, kind, payload) {
    const edge = edges.find((e) => e.id === edgeId);
    const a = cards.find((c) => c.id === edge?.from);
    const b = cards.find((c) => c.id === edge?.to);
    if (!edge || !a || !b) { addDialog.close(); return; }

    const pa = cardCenter(a), pb = cardCenter(b);
    const dx = pb.x - pa.x, dy = pb.y - pa.y;
    const dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist, uy = dy / dist;
    const newW = 200, newH = 120;
    const midX = Math.round(((pa.x + pb.x) / 2 - newW / 2) / GRID) * GRID;
    const midY = Math.round(((pa.y + pb.y) / 2 - newH / 2) / GRID) * GRID;

    const aOut = cardIdToNode.get(a.id), bIn = cardIdToNode.get(b.id);
    const edgeOutClass = edgeOutClassFor(edge, a);
    editor.removeSingleConnection(aOut, bIn, edgeOutClass, 'input_1');

    api(`/api/boards/${BOARD_ID}/cards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: kind.id, x: midX, y: midY, w: newW, h: newH, payload }),
    }).then((newCard) => {
      cards.push(newCard);
      mountCard(newCard);

      const shift = newW + 40;
      const newBx = Math.round((b.x + ux * shift) / GRID) * GRID;
      const newBy = Math.round((b.y + uy * shift) / GRID) * GRID;
      b.x = newBx; b.y = newBy;
      moveCardNodeTo(b, newBx, newBy);
      api(`/api/boards/${BOARD_ID}/cards/${b.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x: newBx, y: newBy }),
      });

      const newNodeId = cardIdToNode.get(newCard.id);
      editor.addConnection(aOut, newNodeId, edgeOutClass, 'input_1');
      editor.addConnection(newNodeId, bIn, 'output_1', 'input_1');

      selectedEdgeId = null;
      insertEdgeId = null;
      renderEdgeToolbar();
      addDialog.close();
    }).catch(() => { addError.textContent = 'Failed to insert card.'; addError.hidden = false; });
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
    setupListFields(editDetailEl, kind);
    setupSuggestions(editDetailEl, kind);
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
      const nodeId = cardIdToNode.get(card.id);
      const kindDef = contract?.kinds?.find((k) => k.id === card.kind);
      labelOutputPorts(nodeId, card, kindDef);
      edges.filter((e) => e.from === card.id).forEach(updateEdgeVisual);
      editDialog.close();
    }).catch(() => { editError.textContent = 'Failed to save.'; editError.hidden = false; });
  });

  // ── Boot ──────────────────────────────────────────────────────────────────
  Promise.all([
    api('/api/contract'),
    api(`/api/boards/${BOARD_ID}/cards`),
    api(`/api/boards/${BOARD_ID}/edges`),
    api(`/api/boards/${BOARD_ID}/frames`),
  ]).then(([c, cs, es, fs]) => {
    contract = c;
    cards = cs;
    edges = es;
    frames = fs;
    setCleanView(cleanView);
    cards.forEach(mountCard);
    edges.forEach(attachEdge);
    frames.forEach(mountFrame);
    syncZoomLabel();
  });
})();
