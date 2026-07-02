(function () {
  const canvas = document.getElementById('sb-canvas');
  const zoomLayer = document.getElementById('sb-zoom-layer');
  const edgesSvg = document.getElementById('sb-edges');
  const edgeToolbarLayer = document.getElementById('sb-edge-toolbar-layer');
  const framesLayer = document.getElementById('sb-frames-layer');
  const radial = document.getElementById('sb-radial');
  let contract = null;
  let cards = [];
  let edges = [];
  let frames = [];
  let linkMode = null;
  let radialFor = null;
  let cleanView = localStorage.getItem(`sb-clean-${BOARD_ID}`) === '1';

  function setCleanView(v) {
    cleanView = v;
    document.body.classList.toggle('sb-clean', v);
    localStorage.setItem(`sb-clean-${BOARD_ID}`, v ? '1' : '0');
    const btn = document.querySelector('[data-action="clean-view"]');
    if (btn) btn.textContent = v ? '✓ Clean view' : 'Clean view';
  }
  let portDrag = null;   // { fromCard, fromEl, x1, y1 }
  let selectedEdge = null;
  let zoom = 1;

  // ── Zoom ─────────────────────────────────────────────────────────────────
  function toModel(clientX, clientY) {
    const c = canvas.getBoundingClientRect();
    return { x: (clientX - c.left + canvas.scrollLeft) / zoom, y: (clientY - c.top + canvas.scrollTop) / zoom };
  }

  function updateLayerSize() {
    const maxX = Math.max(1000, canvas.clientWidth / zoom, ...cards.map((c) => c.x + (c.w || 200) + 300), ...frames.map((f) => f.x + f.w + 300));
    const maxY = Math.max(700, canvas.clientHeight / zoom, ...cards.map((c) => c.y + (c.h || 120) + 300), ...frames.map((f) => f.y + f.h + 300));
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

  const KIND_ICONS = {
    markdown: '¶', json: '{}', html: '<>', xml: '</>', sql: 'DB',
    prompt: '✦', agent: '⬡', 'tool-call': '⚙', hook: '⚡', gate: '◈', memory: '◉', output: '◀', eval: '✓',
  };

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
  // Returns d, mx/my (toolbar anchor), cv1 (near source) and cv2 (near destination).
  function elbowPath(x1, y1, x2, y2, r = 12) {
    const dx = x2 - x1, dy = y2 - y1;
    const [cx, cy] = Math.abs(dx) >= Math.abs(dy) ? [x2, y1] : [x1, y2];
    const seg1 = Math.hypot(cx - x1, cy - y1);
    const seg2 = Math.hypot(x2 - cx, y2 - cy);
    const rr = Math.min(r, seg1, seg2);
    const a1 = Math.atan2(cy - y1, cx - x1) * 180 / Math.PI;
    const a2 = Math.atan2(y2 - cy, x2 - cx) * 180 / Math.PI;
    // cv1 near source (30% into leg1), cv2 near destination (70% into leg2).
    // Only show if the leg is long enough to not overlap the card border.
    const MIN = 30;
    const cv1 = seg1 >= MIN
      ? { x: x1 + (cx - x1) * 0.3, y: y1 + (cy - y1) * 0.3, a: a1, show: true }
      : { x: (x1 + cx) / 2, y: (y1 + cy) / 2, a: a1, show: false };
    const cv2 = seg2 >= MIN
      ? { x: cx + (x2 - cx) * 0.7, y: cy + (y2 - cy) * 0.7, a: a2, show: true }
      : { x: (cx + x2) / 2, y: (cy + y2) / 2, a: a2, show: false };
    if (rr < 1) return { d: `M${x1},${y1} L${cx},${cy} L${x2},${y2}`, mx: cx, my: cy, cv1, cv2 };
    const t1x = cx + (x1 - cx) * (rr / seg1);
    const t1y = cy + (y1 - cy) * (rr / seg1);
    const t2x = cx + (x2 - cx) * (rr / seg2);
    const t2y = cy + (y2 - cy) * (rr / seg2);
    return { d: `M${x1},${y1} L${t1x},${t1y} Q${cx},${cy} ${t2x},${t2y} L${x2},${y2}`, mx: cx, my: cy, cv1, cv2 };
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
      const lx = (e.clientX - r.left) / zoom, ly = (e.clientY - r.top) / zoom;
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
        const cardEl = canvas.querySelector(`.sb-card[data-id="${c.id}"]`);
        if (cardEl) { cardEl.style.left = c.x + 'px'; cardEl.style.top = c.y + 'px'; }
      });
      drawEdges();
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
        const cardEl = canvas.querySelector(`.sb-card[data-id="${c.id}"]`);
        if (cardEl) { cardEl.style.left = c.x + 'px'; cardEl.style.top = c.y + 'px'; }
        api(`/api/boards/${BOARD_ID}/cards/${c.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ x: c.x, y: c.y }),
        });
      });
      drawEdges();
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
      const w = Math.max(GRID * 4, startW + (e.clientX - startX) / zoom);
      const h = Math.max(GRID * 3, startH + (e.clientY - startY) / zoom);
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

    let toolbarFor = null; // { id, mx, my } — rendered outside the SVG so it isn't hidden behind cards
    edgesGroup.innerHTML = edges.map((e) => {
      const a = cards.find((c) => c.id === e.from);
      const b = cards.find((c) => c.id === e.to);
      if (!a || !b) return '';
      const pa = cardCenter(a);
      const pb = cardCenter(b);
      const { d, mx, my, cv1, cv2 } = elbowPath(pa.x, pa.y, pb.x, pb.y);
      const sel = selectedEdge === e.id;
      const col = sel ? 'var(--accent)' : 'var(--text-dim)';
      const marker = sel ? 'url(#sb-arrow-sel)' : 'url(#sb-arrow)';
      const op = sel ? 1 : 0.65;
      if (sel) toolbarFor = { id: e.id, mx, my };
      const chevron = (cv) => cv.show
        ? `<polygon points="-7,-5 7,0 -7,5" fill="${col}" opacity="${op}" pointer-events="none"
            transform="translate(${cv.x},${cv.y}) rotate(${cv.a})"/>`
        : '';
      return `
        <path d="${d}" fill="none"
          stroke="transparent" stroke-width="14" style="cursor:pointer" pointer-events="stroke" data-edge="${e.id}"/>
        <path d="${d}" fill="none"
          stroke="${col}" stroke-width="${sel ? 2.5 : 2}" stroke-linejoin="round" marker-end="${marker}" pointer-events="none"/>
        ${chevron(cv1)}${chevron(cv2)}`;
    }).join('');

    edgeToolbarLayer.innerHTML = toolbarFor ? `
      <div class="sb-edge-toolbar" style="left:${toolbarFor.mx - 42}px;top:${toolbarFor.my - 15}px">
        <button data-flip-edge="${toolbarFor.id}" title="Flip direction" type="button">⇄</button>
        <button data-add-edge="${toolbarFor.id}" title="Insert card here" type="button">+</button>
        <button data-del-edge="${toolbarFor.id}" title="Delete connector" type="button" class="danger">×</button>
      </div>` : '';

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
    edgeToolbarLayer.querySelectorAll('[data-del-edge]').forEach((el) => {
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
    edgeToolbarLayer.querySelectorAll('[data-flip-edge]').forEach((el) => {
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
    edgeToolbarLayer.querySelectorAll('[data-add-edge]').forEach((el) => {
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
    zoomLayer.appendChild(edgeToolbarLayer); // keep above all cards for hit-testing/visibility

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
      const center = cardCenter(card);
      const hostFrame = findFrameAt(center.x, center.y);
      const newFrameId = hostFrame ? hostFrame.id : null;
      const patch = { x: snappedX, y: snappedY };
      if (newFrameId !== (card.frameId || null)) patch.frameId = newFrameId;
      card.frameId = newFrameId;
      api(`/api/boards/${BOARD_ID}/cards/${card.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
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
    if (!e.target.closest('.sb-card') && !e.target.closest('.sb-radial') && !e.target.closest('#sb-edges') && !e.target.closest('#sb-edge-toolbar-layer')) {
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
    if (btn.dataset.action === 'clean-view') { setCleanView(!cleanView); return; }
    if (btn.dataset.action === 'add-frame') {
      const x = Math.round((canvas.scrollLeft / zoom + 40) / GRID) * GRID;
      const y = Math.round((canvas.scrollTop / zoom + 40) / GRID) * GRID;
      api(`/api/boards/${BOARD_ID}/frames`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'group', x, y }),
      }).then((frame) => { frames.push(frame); mountFrame(frame); drawEdges(); });
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
      category === 'ai-workflow' ? k.category === 'ai-workflow' : !k.category || k.category === 'general'
    );
    kindGrid.innerHTML = filtered
      .map((k) => `<button type="button" class="sb-kind-tile" data-kind="${k.id}">
        <div class="k-id">${k.name || k.id}</div><div class="k-desc">${k.description}</div></button>`)
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

  function fieldHtml(key, type, value, hints = {}) {
    const isLong = type === 'any' || key === 'text' || key === 'html' || key === 'xml' || key === 'sql';
    const val = type === 'any' ? JSON.stringify(value ?? null, null, 2) : String(value ?? '');
    const hint = hints[key] || '';
    const hintEl = hint ? ` <span class="sb-field-hint" title="${hint}">?</span>` : '';
    const label = `<label>${key}${type === 'any' ? ' (JSON)' : ''}${hintEl}</label>`;
    if (isLong) {
      return `<div class="sb-field">${label}<textarea data-field="${key}" data-type="${type}" placeholder="${hint || key}">${val}</textarea></div>`;
    }
    return `<div class="sb-field">${label}<input data-field="${key}" data-type="${type}" value="${val}" placeholder="${hint || key}"></div>`;
  }

  function renderDetail(kind, values) {
    const example = values || kind.exampleCard?.payload || {};
    const hints = kind.fieldHints || {};
    const contentFields = Object.keys(kind.payloadSchema || {})
      .map((key) => fieldHtml(key, kind.payloadSchema[key], example[key], hints))
      .join('');
    const optionsKeys = Object.keys(kind.optionsSchema || {});
    const optionsSection = optionsKeys.length
      ? `<div class="sb-detail-section"><h4>Options</h4>${optionsKeys.map((k) => fieldHtml(k, kind.optionsSchema[k], undefined, hints)).join('')}</div>`
      : '';
    return `
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
    api(`/api/boards/${BOARD_ID}/frames`),
  ]).then(([c, cs, es, fs]) => {
    contract = c;
    cards = cs;
    edges = es;
    frames = fs;
    setCleanView(cleanView);
    frames.forEach(mountFrame);
    cards.forEach(mountCard);
    drawEdges();
  });
})();
