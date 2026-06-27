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

  document.getElementById('sb-add').addEventListener('click', () => {
    if (!contract) return;
    const kindId = prompt('Card kind: ' + contract.kinds.map((k) => k.id).join(', '), contract.kinds[0].id);
    const kind = contract.kinds.find((k) => k.id === kindId);
    if (!kind) return;
    const payloadText = prompt('Payload JSON:', JSON.stringify(kind.exampleCard.payload));
    let payload;
    try {
      payload = JSON.parse(payloadText);
    } catch {
      alert('Invalid JSON.');
      return;
    }
    api(`/api/boards/${BOARD_ID}/cards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: kindId, x: 40, y: 40, payload }),
    }).then((card) => {
      cards.push(card);
      mountCard(card);
      drawEdges();
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
