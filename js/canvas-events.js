    canvas.addEventListener("click", (event) => {
      if (state.skipNextClick) {
        state.skipNextClick = false;
        return;
      }
      if (event.target.closest(".node") || event.target.closest(".link") || event.target.closest(".port-dot")) return;
      if (state.finalMode) return;

      if (state.tool === "add") {
        addNodeAt(canvasPoint(event));
        return;
      }

      if (state.tool === "compound") {
        addCompoundNodeAt(canvasPoint(event));
        return;
      }

      if (state.tool === "select") clearSelection();
    });

    canvas.addEventListener("pointerdown", (event) => {
      if (event.target.closest(".node") || event.target.closest(".link") || event.target.closest(".port-dot")) return;
      if (event.ctrlKey || state.tool === "pan") { startPan(event); return; }
      if (state.tool === "select" && !state.finalMode) { startBoxSelect(event); }
    });

    canvas.addEventListener("wheel", (event) => {
      event.preventDefault();
      const factor = event.deltaY > 0 ? 0.9 : 1.1;
      setZoomAt(state.zoom * factor, event.clientX, event.clientY);
    }, { passive: false });

    // Manual double-click tracking (dblclick event is unreliable when nodeLayer
    // innerHTML is replaced between the two clicks by render()).
    let lastNodeClick = { id: null, time: 0 };

    nodeLayer.addEventListener("click", (event) => {
      const btn = event.target.closest(".node-collapse-btn");
      if (!btn) return;
      const node = nodeById(btn.dataset.nodeId);
      if (!node) return;
      pushHistory();
      const newCollapsed = !node.collapsed;
      const targets = state.multiSelectedIds.length > 1 && state.multiSelectedIds.includes(node.id)
        ? state.multiSelectedIds
        : [node.id];
      targets.forEach(id => { const n = nodeById(id); if (n) n.collapsed = newCollapsed; });
      render();
    });

    nodeLayer.addEventListener("pointerdown", (event) => {
      if (event.target.closest(".node-collapse-btn")) return;
      const element = event.target.closest(".node");
      if (!element) return;
      const id = element.dataset.nodeId;
      const node = nodeById(id);
      if (!node) return;

      if (event.ctrlKey || state.tool === "pan") {
        startPan(event);
        return;
      }

      if (state.finalMode) {
        selectItem("node", id);
        return;
      }

      if (state.tool === "delete") {
        state.selectedKind = "node";
        state.selectedId = id;
        deleteSelected();
        return;
      }

      if (state.tool === "connect") {
        if (!state.connectionSource) {
          state.connectionSource = id;
          state.selectedKind = "node";
          state.selectedId = id;
          render();
        } else {
          addLink(state.connectionSource, id);
        }
        return;
      }

      if (state.tool !== "select") return;

      // Detect double-click manually: two pointerdowns on same node within 300 ms
      const now = Date.now();
      if (!state.initStockMode && node.nodeClass === "compound" &&
          lastNodeClick.id === id && now - lastNodeClick.time < 300) {
        lastNodeClick = { id: null, time: 0 };
        enterCompoundNode(id);
        return;
      }
      lastNodeClick = { id, time: now };

      // Ctrl+click toggles multi-select for grouping
      if (event.ctrlKey || event.metaKey) {
        const idx = state.multiSelectedIds.indexOf(id);
        if (idx >= 0) state.multiSelectedIds.splice(idx, 1);
        else state.multiSelectedIds.push(id);
        render();
        return;
      }

      const point = canvasPoint(event);
      state.selectedKind = "node";
      state.selectedId = id;
      state.connectionSource = null;
      pushHistory();

      // If this node is part of a multi-selection, drag all selected nodes together
      if (state.multiSelectedIds.length > 1 && state.multiSelectedIds.includes(id)) {
        const initialPositions = {};
        state.multiSelectedIds.forEach(nid => {
          const n = nodeById(nid);
          if (n) initialPositions[nid] = { x: numberValue(n.x), y: numberValue(n.y) };
        });
        state.dragging = { kind: "multi-node", startX: point.x, startY: point.y, initialPositions };
        render();
        return;
      }

      // Regular single-node drag: clear multi-select
      state.multiSelectedIds = [];
      state.dragging = {
        kind: "node",
        id,
        dx: point.x - numberValue(node.x),
        dy: point.y - numberValue(node.y)
      };
      render();
    });

    document.getElementById("compoundBackBtn")?.addEventListener("click", exitCompoundNode);

    function startPan(event) {
      state.dragging = {
        kind: "pan",
        startX: event.clientX,
        startY: event.clientY,
        panX: state.panX,
        panY: state.panY,
        moved: false
      };
      canvas.classList.add("is-panning");
      event.preventDefault();
    }

    function moveDraggedItem(event) {
      if (!state.dragging) return;
      if (state.finalMode && state.dragging.kind !== "pan") return;

      if (state.dragging.kind === "pan") {
        const dx = event.clientX - state.dragging.startX;
        const dy = event.clientY - state.dragging.startY;
        state.panX = Math.round(state.dragging.panX + dx);
        state.panY = Math.round(state.dragging.panY + dy);
        state.dragging.moved = state.dragging.moved || Math.abs(dx) + Math.abs(dy) > 4;
        applyViewport();
        return;
      }

      const point = canvasPoint(event);

      if (state.dragging.kind === "box-select") {
        state.dragging.currentX = point.x;
        state.dragging.currentY = point.y;
        updateBoxSelectOverlay(event.clientX, event.clientY);
        return;
      }

      if (state.dragging.kind === "multi-node") {
        const dx = Math.round(point.x - state.dragging.startX);
        const dy = Math.round(point.y - state.dragging.startY);
        state.multiSelectedIds.forEach(nid => {
          const n = nodeById(nid);
          if (!n) return;
          const init = state.dragging.initialPositions[nid];
          if (!init) return;
          n.x = init.x + dx;
          n.y = init.y + dy;
          state.links.forEach(l => {
            if (l.source === nid || l.target === nid) {
              delete l.controlX; delete l.controlY;
              delete l.curveOffX; delete l.curveOffY;
            }
          });
        });
        const rect = canvas.getBoundingClientRect();
        const MARGIN = 80, MAX_SPEED = 14;
        const dl = event.clientX - rect.left, dr = rect.right  - event.clientX;
        const dt = event.clientY - rect.top,  db = rect.bottom - event.clientY;
        let dpx = 0, dpy = 0;
        if (dl < MARGIN) dpx =  MAX_SPEED * (1 - dl / MARGIN);
        if (dr < MARGIN) dpx = -MAX_SPEED * (1 - dr / MARGIN);
        if (dt < MARGIN) dpy =  MAX_SPEED * (1 - dt / MARGIN);
        if (db < MARGIN) dpy = -MAX_SPEED * (1 - db / MARGIN);
        if (dpx || dpy) {
          state.dragging.startX -= dpx / state.zoom;
          state.dragging.startY -= dpy / state.zoom;
          state.panX = Math.round(state.panX + dpx);
          state.panY = Math.round(state.panY + dpy);
          applyViewport();
        }
        renderLinks();
        renderNodes();
        return;
      }

      if (state.dragging.kind === "node") {
        const node = nodeById(state.dragging.id);
        if (!node) return;
        node.x = Math.round(point.x - state.dragging.dx);
        node.y = Math.round(point.y - state.dragging.dy);

        // Clear stored bezier offsets so links re-centre on the new node position.
        state.links.forEach(l => {
          if (l.source === node.id || l.target === node.id) {
            delete l.controlX; delete l.controlY;
            delete l.curveOffX; delete l.curveOffY;
          }
        });

        // Edge auto-pan: shift viewport when pointer is near canvas boundary
        const rect = canvas.getBoundingClientRect();
        const MARGIN = 80, MAX_SPEED = 14;
        const dl = event.clientX - rect.left;
        const dr = rect.right  - event.clientX;
        const dt = event.clientY - rect.top;
        const db = rect.bottom - event.clientY;
        let dpx = 0, dpy = 0;
        if (dl < MARGIN) dpx = -MAX_SPEED * (1 - dl / MARGIN);
        if (dr < MARGIN) dpx =  MAX_SPEED * (1 - dr / MARGIN);
        if (dt < MARGIN) dpy = -MAX_SPEED * (1 - dt / MARGIN);
        if (db < MARGIN) dpy =  MAX_SPEED * (1 - db / MARGIN);
        if (dpx !== 0 || dpy !== 0) {
          state.panX = Math.round(state.panX + dpx);
          state.panY = Math.round(state.panY + dpy);
          applyViewport();
        }

        renderLinks();
        renderNodes();
      }

      if (state.dragging.kind === "wip") {
        const link = linkById(state.dragging.id);
        if (!link) return;
        link.curveOffX = Math.round(state.dragging.startOffX + (point.x - state.dragging.startX));
        link.curveOffY = Math.round(state.dragging.startOffY + (point.y - state.dragging.startY));
        renderLinks();
        return;
      }

      if (state.dragging.kind === "port") {
        const node = nodeById(state.dragging.nodeId);
        if (!node) return;
        const dy = point.y - state.dragging.anchorY;
        const newIdx = Math.max(0, Math.min(state.dragging.totalPorts - 1,
          Math.round(state.dragging.origIdx + dy / PORT_SPACING)));
        const order = [...state.dragging.origOrder];
        const [moved] = order.splice(state.dragging.origIdx, 1);
        order.splice(newIdx, 0, moved);
        const orderKey = state.dragging.side === "out" ? "portOrderOut" : "portOrderIn";
        node[orderKey] = order;
        renderLinks();
        renderNodes();
        return;
      }
    }

    function startBoxSelect(event) {
      const point = canvasPoint(event);
      state.dragging = {
        kind: "box-select",
        startClientX: event.clientX,
        startClientY: event.clientY,
        startX: point.x,
        startY: point.y,
        currentX: point.x,
        currentY: point.y
      };
      event.preventDefault();
    }

    function updateBoxSelectOverlay(clientX, clientY) {
      const overlay = document.getElementById("boxSelectOverlay");
      if (!overlay) return;
      const d = state.dragging;
      const rect = canvas.getBoundingClientRect();
      overlay.style.display = "block";
      overlay.style.left   = Math.min(d.startClientX, clientX) - rect.left + "px";
      overlay.style.top    = Math.min(d.startClientY, clientY) - rect.top  + "px";
      overlay.style.width  = Math.abs(clientX - d.startClientX) + "px";
      overlay.style.height = Math.abs(clientY - d.startClientY) + "px";
    }

    function stopDragging() {
      if (!state.dragging) return;
      if (state.dragging.kind === "pan" && state.dragging.moved) state.skipNextClick = true;

      if (state.dragging.kind === "box-select") {
        const overlay = document.getElementById("boxSelectOverlay");
        if (overlay) overlay.style.display = "none";
        const d = state.dragging;
        const x1 = Math.min(d.startX, d.currentX), x2 = Math.max(d.startX, d.currentX);
        const y1 = Math.min(d.startY, d.currentY), y2 = Math.max(d.startY, d.currentY);
        if (x2 - x1 > 5 || y2 - y1 > 5) {
          const selected = state.nodes.filter(n => {
            const nx = numberValue(n.x), ny = numberValue(n.y);
            return nx + NODE_W > x1 && nx < x2 && ny + NODE_H > y1 && ny < y2;
          }).map(n => n.id);
          if (selected.length > 0) state.multiSelectedIds = selected;
          state.skipNextClick = true;
        }
        state.dragging = null;
        render();
        return;
      }

      state.dragging = null;
      canvas.classList.remove("is-panning");
      persist();
      render();
    }

    window.addEventListener("pointermove", moveDraggedItem);
    window.addEventListener("pointerup", stopDragging);
    window.addEventListener("pointercancel", () => {
      state.dragging = null;
      canvas.classList.remove("is-panning");
    });

    linkLayer.addEventListener("pointerdown", (event) => {
      if (event.ctrlKey || state.tool === "pan") {
        startPan(event);
        return;
      }
      const wipHandle = event.target.closest(".wip-pill");
      if (!wipHandle || state.finalMode) return;
      const id = wipHandle.dataset.wipLinkId;
      const link = linkById(id);
      if (!link) return;

      const point = canvasPoint(event);

      pushHistory();
      state.selectedKind = "link";
      state.selectedId = id;
      state.connectionSource = null;
      state.dragging = {
        kind: "wip",
        id,
        startX: point.x,
        startY: point.y,
        startOffX: link.curveOffX || 0,
        startOffY: link.curveOffY || 0
      };
      event.stopPropagation();
      render();
    });

    linkLayer.addEventListener("click", (event) => {
      const element = event.target.closest(".link");
      if (!element) return;
      const id = element.dataset.linkId;

      if (!state.finalMode && state.tool === "delete") {
        state.selectedKind = "link";
        state.selectedId = id;
        deleteSelected();
        return;
      }

      selectItem("link", id);
    });

    portLayer.addEventListener("pointerdown", (event) => {
      if (event.ctrlKey || state.tool === "pan") { startPan(event); return; }
      const dot = event.target.closest(".port-dot");
      if (!dot || state.finalMode || state.tool !== "select") return;
      const nodeId = dot.dataset.nodeId;
      const side   = dot.dataset.side;
      const portKeyVal = dot.dataset.portKey;
      if (!nodeId || !side || !portKeyVal) return;
      const node = nodeById(nodeId);
      if (!node || node.collapsed) return;
      const ports = side === "out" ? getNodeOutPorts(node) : getNodeInPorts(node);
      if (ports.length < 2) return;
      const origOrder = ports.map(p => portKey(p));
      const origIdx   = origOrder.indexOf(portKeyVal);
      if (origIdx < 0) return;
      pushHistory();
      state.dragging = {
        kind: "port",
        nodeId,
        side,
        origIdx,
        origOrder,
        anchorY: canvasPoint(event).y,
        totalPorts: ports.length
      };
      event.stopPropagation();
      event.preventDefault();
    });
