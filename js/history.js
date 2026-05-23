    function clone(value) {
      return JSON.parse(JSON.stringify(value));
    }

    function slotToTime(slot) {
      const h = Math.floor(slot / 2).toString().padStart(2, "0");
      const m = slot % 2 === 0 ? "00" : "30";
      return h + ":" + m;
    }

    function normalizeTime(t) {
      const s = String(t || "").trim();
      // Handle "HH:MM", "H:MM", "HH:MM:SS"
      const m = s.match(/^(\d{1,2}):(\d{2})/);
      if (!m) return "";
      return m[1].padStart(2, "0") + ":" + m[2];
    }

    function pushHistory() {
      history.push({ nodes: clone(state.nodes), links: clone(state.links), groups: clone(state.groups) });
      if (history.length > MAX_HISTORY) history.shift();
    }

    function undo() {
      if (!history.length) { showToast("Nothing to undo."); return; }
      const snap = history.pop();
      state.nodes = snap.nodes;
      state.links = snap.links;
      state.groups = snap.groups;
      state.selectedKind = null;
      state.selectedId = null;
      state.multiSelectedIds = [];
      persist();
      render();
      showToast("Undone.");
    }

    function clampZoom(value) {
      return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, numberValue(value, 1)));
    }

    function loadInitialState() {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) {
        const layouts = getSavedLayouts();
        const latest = layouts[layouts.length - 1];
        if (latest) {
          applyLayoutToState(latest);
        } else {
          Object.assign(state, clone(demoState));
          state.finalFields = { ...DEFAULT_FINAL_FIELDS };
          state.zoom = 1;
        }
        return;
      }

      try {
        const parsed = JSON.parse(saved);
        state.nodes = Array.isArray(parsed.nodes) ? parsed.nodes : clone(demoState.nodes);
        state.links = Array.isArray(parsed.links) ? parsed.links : clone(demoState.links);
        state.groups = Array.isArray(parsed.groups) ? parsed.groups : clone(demoState.groups || []);
        state.finalFields = { ...DEFAULT_FINAL_FIELDS, ...(parsed.finalFields || {}) };
        state.zoom = clampZoom(parsed.zoom || 1);
        state.panX = numberValue(parsed.panX, 0);
        state.panY = numberValue(parsed.panY, 0);
        state.movColumn = parsed.movColumn || "";
        state.dateColumn = parsed.dateColumn || "";
        state.qtyColumn = parsed.qtyColumn || "";
        state.partColumn = parsed.partColumn || "";
        state.timeColumn = parsed.timeColumn || "";
        state.selectedDate = parsed.selectedDate || "";
        state.selectedTimeSlot = numberValue(parsed.selectedTimeSlot, 0);
      } catch (error) {
        Object.assign(state, clone(demoState));
        state.finalFields = { ...DEFAULT_FINAL_FIELDS };
        state.zoom = 1;
        state.panX = 0;
        state.panY = 0;
      }
    }

    // ── Compound Node helpers ─────────────────────────────────────────────────

    function updateCurrentCompound() {
      if (!state.compoundStack.length) return;
      const frame = state.compoundStack[state.compoundStack.length - 1];
      const cn = frame.parentNodes.find(n => n.id === frame.nodeId);
      if (cn) {
        cn.innerNodes  = state.nodes;
        cn.innerLinks  = state.links;
        cn.innerGroups = state.groups;
      }
    }

    function getRootContext() {
      if (!state.compoundStack.length) {
        return { nodes: state.nodes, links: state.links, groups: state.groups };
      }
      updateCurrentCompound();
      return {
        nodes:  state.compoundStack[0].parentNodes,
        links:  state.compoundStack[0].parentLinks,
        groups: state.compoundStack[0].parentGroups
      };
    }

    function enterCompoundNode(nodeId) {
      const node = nodeById(nodeId);
      if (!node || node.nodeClass !== "compound") return;
      state.compoundStack.push({
        nodeId,
        parentNodes:  state.nodes,
        parentLinks:  state.links,
        parentGroups: state.groups,
        zoom:  state.zoom,
        panX:  state.panX,
        panY:  state.panY,
        selectedKind: state.selectedKind,
        selectedId:   state.selectedId
      });
      state.nodes  = (node.innerNodes  || []).map(n => ({ ...n }));
      state.links  = (node.innerLinks  || []).map(l => ({ ...l }));
      state.groups = (node.innerGroups || []).map(g => ({ ...g }));
      state.zoom = 1; state.panX = 0; state.panY = 0;
      state.selectedKind = null; state.selectedId = null;
      state.connectionSource = null;
      updateCompoundBreadcrumb();
      persist();
      render();
    }

    function exitCompoundNode() {
      if (!state.compoundStack.length) return;
      updateCurrentCompound();
      const frame = state.compoundStack.pop();
      state.nodes  = frame.parentNodes;
      state.links  = frame.parentLinks;
      state.groups = frame.parentGroups;
      state.zoom = frame.zoom;
      state.panX = frame.panX;
      state.panY = frame.panY;
      state.selectedKind = frame.selectedKind;
      state.selectedId   = frame.selectedId;
      state.connectionSource = null;
      updateCompoundBreadcrumb();
      persist();
      render();
    }

    function updateCompoundBreadcrumb() {
      const bc   = document.getElementById("compoundBreadcrumb");
      const path = document.getElementById("compoundCrumbPath");
      if (!bc || !path) return;
      if (!state.compoundStack.length) {
        bc.style.display = "none";
        return;
      }
      bc.style.display = "flex";
      path.textContent = state.compoundStack.map(f => {
        const n = f.parentNodes.find(nd => nd.id === f.nodeId);
        return n ? n.label : f.nodeId;
      }).join(" › ");
    }

    function persist() {
      updateCurrentCompound();
      const root = getRootContext();
      const payload = networkPayload(root.nodes, root.links, root.groups);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      saveState.textContent = "Autosaved " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }

    function networkPayload(nodes, links, groups) {
      nodes  = nodes  || state.nodes;
      links  = links  || state.links;
      groups = groups || state.groups;
      return {
        nodes,
        links,
        groups,
        finalFields: state.finalFields,
        zoom: state.zoom,
        panX: state.panX,
        panY: state.panY,
        movColumn: state.movColumn,
        dateColumn: state.dateColumn,
        qtyColumn: state.qtyColumn,
        partColumn: state.partColumn,
        timeColumn: state.timeColumn,
        selectedDate: state.selectedDate,
        selectedTimeSlot: state.selectedTimeSlot
      };
    }

    function applyNetworkPayload(parsed) {
      if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.links)) throw new Error("Invalid network payload");
      pushHistory();
      state.nodes = normalizeNodes(parsed.nodes);
      state.links = normalizeLinks(parsed.links);
      state.groups = Array.isArray(parsed.groups) ? parsed.groups : [];
      state.finalFields = { ...DEFAULT_FINAL_FIELDS, ...(parsed.finalFields || {}) };
      state.zoom = clampZoom(parsed.zoom || 1);
      state.panX = numberValue(parsed.panX, 0);
      state.panY = numberValue(parsed.panY, 0);
      state.movColumn = parsed.movColumn || "";
      state.dateColumn = parsed.dateColumn || "";
      state.qtyColumn = parsed.qtyColumn || "";
      state.partColumn = parsed.partColumn || "";
      state.timeColumn = parsed.timeColumn || "";
      state.selectedDate = parsed.selectedDate || "";
      state.selectedTimeSlot = numberValue(parsed.selectedTimeSlot, 0);
      state.selectedKind = null;
      state.selectedId = null;
      state.connectionSource = null;
      persist();
      render();
    }
