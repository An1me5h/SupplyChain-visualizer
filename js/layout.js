    function applyLayoutToState(layout) {
      state.nodes = layout.nodes || [];
      state.links = layout.links || [];
      state.groups = layout.groups || [];
      state.finalFields = { ...DEFAULT_FINAL_FIELDS, ...(layout.finalFields || {}) };
      state.movColumn = layout.movColumn || "";
      state.dateColumn = layout.dateColumn || "";
      state.qtyColumn = layout.qtyColumn || "";
      state.partColumn = layout.partColumn || "";
      state.timeColumn = layout.timeColumn || "";
      if (layout.srcSlocColumn !== undefined) state.srcSlocColumn = layout.srcSlocColumn;
      if (layout.dstSlocColumn !== undefined) state.dstSlocColumn = layout.dstSlocColumn;
      if (layout.zoom) {
        state.zoom = clampZoom(layout.zoom);
        state.panX = numberValue(layout.panX);
        state.panY = numberValue(layout.panY);
      }
    }

    function getSavedLayouts() {
      try { return JSON.parse(localStorage.getItem(LAYOUTS_KEY) || "[]"); } catch { return []; }
    }

    function setSavedLayouts(layouts) {
      localStorage.setItem(LAYOUTS_KEY, JSON.stringify(layouts));
    }

    function saveCurrentLayout(name) {
      if (!name.trim()) return;
      const layouts = getSavedLayouts();
      layouts.push({
        id: "layout_" + Date.now(),
        name: name.trim(),
        savedAt: new Date().toLocaleDateString(),
        nodes: clone(state.nodes),
        links: clone(state.links),
        groups: clone(state.groups),
        finalFields: clone(state.finalFields),
        movColumn: state.movColumn,
        dateColumn: state.dateColumn,
        qtyColumn: state.qtyColumn,
        partColumn: state.partColumn,
        timeColumn: state.timeColumn,
        srcSlocColumn: state.srcSlocColumn,
        dstSlocColumn: state.dstSlocColumn,
        zoom: state.zoom,
        panX: state.panX,
        panY: state.panY
      });
      setSavedLayouts(layouts);
      showToast("Layout \"" + name.trim() + "\" saved.");
      renderLayoutMgrContent();
    }

    function loadLayoutById(id) {
      const layouts = getSavedLayouts();
      const layout = layouts.find(l => l.id === id);
      if (!layout) return;
      pushHistory();
      state.nodes = normalizeNodes(layout.nodes || []);
      state.links = normalizeLinks(layout.links || []);
      state.groups = layout.groups || [];
      state.finalFields = { ...DEFAULT_FINAL_FIELDS, ...(layout.finalFields || {}) };
      state.movColumn = layout.movColumn || "";
      state.dateColumn = layout.dateColumn || "";
      state.qtyColumn = layout.qtyColumn || "";
      state.partColumn = layout.partColumn || "";
      state.timeColumn = layout.timeColumn || "";
      if (layout.srcSlocColumn !== undefined) state.srcSlocColumn = layout.srcSlocColumn;
      if (layout.dstSlocColumn !== undefined) state.dstSlocColumn = layout.dstSlocColumn;
      if (layout.zoom) { state.zoom = clampZoom(layout.zoom); state.panX = numberValue(layout.panX); state.panY = numberValue(layout.panY); }
      state.selectedKind = null;
      state.selectedId = null;
      persist();
      render();
      closeLayoutMgr();
      showToast("Layout \"" + layout.name + "\" loaded.");
    }

    function deleteLayoutById(id) {
      const layouts = getSavedLayouts().filter(l => l.id !== id);
      setSavedLayouts(layouts);
      renderLayoutMgrContent();
    }

    function openLayoutMgr() {
      const el = document.getElementById("layoutModal");
      if (!el) return;
      el.removeAttribute("aria-hidden");
      el.classList.add("lm-open");
      renderLayoutMgrContent();
    }

    function closeLayoutMgr() {
      const el = document.getElementById("layoutModal");
      if (!el) return;
      el.classList.remove("lm-open");
      el.setAttribute("aria-hidden", "true");
    }

    function renderLayoutMgrContent() {
      const body = document.getElementById("layoutModalBody");
      if (!body) return;
      const layouts = getSavedLayouts();
      const list = layouts.length
        ? layouts.map(l => `
          <div class="lm-item">
            <div>
              <div class="lm-item-name">${escapeHtml(l.name)}</div>
              <div class="lm-item-date">${escapeHtml(l.savedAt || "")}</div>
            </div>
            <button class="lm-load-btn" data-load-layout="${escapeAttr(l.id)}">Load</button>
            <button class="lm-del-btn" data-del-layout="${escapeAttr(l.id)}" title="Delete">Ã—</button>
          </div>
        `).join("")
        : `<div class="empty-state">No saved layouts yet.</div>`;

      body.innerHTML = `
        <div class="lm-save-row">
          <input id="lmNameInput" placeholder="Layout name..." value="">
          <button class="action-btn primary" id="lmSaveBtn">Save Current</button>
        </div>
        ${list}
      `;

      document.getElementById("lmSaveBtn").addEventListener("click", () => {
        saveCurrentLayout(document.getElementById("lmNameInput").value);
      });
      document.getElementById("lmNameInput").addEventListener("keydown", (e) => {
        if (e.key === "Enter") saveCurrentLayout(e.target.value);
      });
      body.querySelectorAll("[data-load-layout]").forEach(btn => {
        btn.addEventListener("click", () => loadLayoutById(btn.dataset.loadLayout));
      });
      body.querySelectorAll("[data-del-layout]").forEach(btn => {
        btn.addEventListener("click", () => {
          if (confirm("Delete this layout?")) deleteLayoutById(btn.dataset.delLayout);
        });
      });
    }

    document.getElementById("layoutModalClose").addEventListener("click", closeLayoutMgr);
    document.getElementById("layoutModal").addEventListener("pointerdown", (e) => {
      if (e.target === document.getElementById("layoutModal")) closeLayoutMgr();
    });

