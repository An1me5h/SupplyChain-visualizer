    // ── Action tray toggle (⋮ button) ─────────────────────────────────────────
    (function() {
      const toggle = document.getElementById("actionTrayToggle");
      const clip   = document.getElementById("actionTrayClip");
      const tray   = document.getElementById("actionTray");
      if (!toggle || !clip || !tray) return;

      function openTray() {
        clip.style.width = (tray.scrollWidth + 8) + "px";
        clip.classList.add("tray-open");
        toggle.classList.add("tray-open");
      }

      function closeTray() {
        clip.style.width = "0";
        clip.classList.remove("tray-open");
        toggle.classList.remove("tray-open");
      }

      toggle.addEventListener("click", (e) => {
        e.stopPropagation();
        clip.classList.contains("tray-open") ? closeTray() : openTray();
      });

      document.addEventListener("pointerdown", (e) => {
        if (!clip.contains(e.target) && e.target !== toggle) closeTray();
      });
    })();

    document.querySelectorAll(".tool-btn[data-tool]").forEach((button) => {
      button.addEventListener("click", () => setTool(button.dataset.tool));
    });

    document.querySelectorAll(".panel-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        if (state.finalMode && tab.dataset.tab !== "stats") return;
        state.activeTab = tab.dataset.tab;
        renderPanel();
      });
    });

    document.getElementById("nodeViewBtn").addEventListener("click", () => {
      if (state.selectedKind === "node" && state.selectedId) openNodeView(state.selectedId);
    });

    document.getElementById("linkViewBtn").addEventListener("click", () => {
      if (state.selectedKind === "link" && state.selectedId) openLinkView(state.selectedId);
    });

    // ── Init Stock Mode ────────────────────────────────────────────────────────
    function setInitStockMode(on) {
      state.initStockMode = on;
      const btn = document.getElementById("initStockBtn");
      if (btn) btn.classList.toggle("active", on);
      renderNodes();
    }

    document.getElementById("initStockBtn").addEventListener("click", () => {
      setInitStockMode(!state.initStockMode);
    });

    // When in init stock mode, clicking a node opens the init stock popup
    canvas.addEventListener("pointerdown", (e) => {
      if (!state.initStockMode) return;
      const nodeEl = e.target.closest(".node[data-node-id]");
      if (!nodeEl) return;
      e.stopPropagation();
      openInitStockPopup(nodeEl.dataset.nodeId);
    }, true);

    function openInitStockPopup(nodeId) {
      const node = nodeById(nodeId);
      if (!node) return;
      const parts = getPartsAtNode(node);
      const existing = node.initStock || {};

      const overlay = document.getElementById("initStockOverlay");
      const popup   = document.getElementById("initStockPopup");
      overlay.removeAttribute("aria-hidden");

      const partOptions = parts.length
        ? parts.map(p => `<option value="${escapeAttr(p)}">${escapeHtml(p)}</option>`).join("")
        : `<option value="">— no parts detected —</option>`;

      popup.innerHTML = `
        <div class="is-popup-title">Set Initial Stock — ${escapeHtml(node.label)}</div>
        <div class="is-popup-body">
          <div class="is-current-list" id="isCurrentList">
            ${Object.entries(existing).length
              ? Object.entries(existing).map(([p, q]) =>
                  `<div class="is-row"><span>${escapeHtml(p)}</span><strong>${q}</strong>
                   <button class="is-del-btn" data-part="${escapeAttr(p)}">✕</button></div>`
                ).join("")
              : `<div style="opacity:.5;font-size:11px">No initial stock set yet.</div>`}
          </div>
          <div class="is-form-row">
            ${parts.length
              ? `<select id="isPartSel">${partOptions}</select>`
              : `<input id="isPartSel" type="text" placeholder="Part number" style="width:120px">`}
            <input id="isQtyInput" type="number" min="0" step="1" placeholder="Qty" style="width:70px">
            <button class="action-btn" id="isAddBtn">Add</button>
          </div>
          <div class="is-error" id="isError" style="display:none;color:#d94f4f;font-size:11px"></div>
          <div class="is-popup-actions">
            <button class="action-btn primary" id="isOkBtn">OK</button>
            <button class="action-btn" id="isCancelBtn">Cancel</button>
          </div>
        </div>
      `;

      overlay.classList.add("is-open");

      let tempStock = { ...existing };

      function refreshList() {
        const list = document.getElementById("isCurrentList");
        if (!list) return;
        list.innerHTML = Object.entries(tempStock).length
          ? Object.entries(tempStock).map(([p, q]) =>
              `<div class="is-row"><span>${escapeHtml(p)}</span><strong>${q}</strong>
               <button class="is-del-btn" data-part="${escapeAttr(p)}">✕</button></div>`
            ).join("")
          : `<div style="opacity:.5;font-size:11px">No initial stock set yet.</div>`;
        list.querySelectorAll(".is-del-btn").forEach(btn => {
          btn.addEventListener("click", () => {
            delete tempStock[btn.dataset.part];
            refreshList();
          });
        });
      }
      refreshList();

      document.getElementById("isAddBtn").addEventListener("click", () => {
        const partEl = document.getElementById("isPartSel");
        const qtyEl  = document.getElementById("isQtyInput");
        const err    = document.getElementById("isError");
        const part = partEl?.value?.trim();
        const qty  = Number(qtyEl?.value);
        err.style.display = "none";
        if (!part) { err.textContent = "Select or enter a part number."; err.style.display = ""; return; }
        if (!Number.isFinite(qty) || qty < 0) { err.textContent = "Enter a positive number (≥ 0)."; err.style.display = ""; return; }
        tempStock[part] = qty;
        if (qtyEl) qtyEl.value = "";
        refreshList();
      });

      document.getElementById("isOkBtn").addEventListener("click", () => {
        pushHistory();
        node.initStock = tempStock;
        persist();
        renderNodes();
        renderLinks();
        closeInitStockPopup();
      });
      document.getElementById("isCancelBtn").addEventListener("click", closeInitStockPopup);
      overlay.addEventListener("pointerdown", (e) => { if (e.target === overlay) closeInitStockPopup(); });
    }

    function closeInitStockPopup() {
      const overlay = document.getElementById("initStockOverlay");
      overlay.classList.remove("is-open");
      overlay.setAttribute("aria-hidden", "true");
    }

    // ── Refresh Data Button ───────────────────────────────────────────────────
    document.getElementById("refreshDataBtn").addEventListener("click", () => {
      autoLoadDataFile({ isRefresh: true }).catch(() => showToast("Could not reload — server not running."));
    });

    // ── Day Reset (Now) Button ────────────────────────────────────────────────
    document.getElementById("dayReset").addEventListener("click", () => {
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      const slot = Math.min(47, Math.floor((now.getHours() * 60 + now.getMinutes()) / 30));
      state.selectedDate = todayStr;
      dayDatePicker.value = todayStr;
      syncTimeSlot(slot);
      persist();
      renderNodes();
      renderLinks();
      renderPanel();
    });

    document.getElementById("undoBtn").addEventListener("click", undo);

    // ── Part combobox ─────────────────────────────────────────────────────────

    function initPartCombo() {
      const input = document.getElementById("partComboInput");
      const list = document.getElementById("partComboList");
      if (!input || !list) return;

      function renderDropdown(query) {
        const parts = getPartsList();
        const q = query.trim().toLowerCase();
        const matches = q ? parts.filter(p => p.label.toLowerCase().includes(q)) : parts;
        list.innerHTML = `
          <div class="part-combo-item part-combo-clear" data-value="">All Parts</div>
          ${matches.length
            ? matches.map(p => `<div class="part-combo-item${state.highlightPart === p.value ? " active" : ""}" data-value="${escapeAttr(p.value)}">${escapeHtml(p.label)}</div>`).join("")
            : `<div class="part-combo-item" style="color:var(--muted);pointer-events:none">Load data with Part No column</div>`
          }
        `;
        list.hidden = false;
      }

      input.addEventListener("focus", () => renderDropdown(input.value));
      input.addEventListener("input", () => renderDropdown(input.value));

      list.addEventListener("pointerdown", (e) => {
        const item = e.target.closest(".part-combo-item");
        if (!item) return;
        e.preventDefault();
        const val = item.dataset.value;
        state.highlightPart = val;
        input.value = val || "";
        list.hidden = true;
        renderNodes();
        renderLinks();
        renderPanel();
      });

      document.addEventListener("pointerdown", (e) => {
        if (!document.getElementById("partComboWrap")?.contains(e.target)) {
          list.hidden = true;
        }
      });
    }
    initPartCombo();

    function navigateDate(direction) {
      const dates = getDataDates();
      if (dates.length) {
        const idx = dates.indexOf(state.selectedDate);
        let next;
        if (idx === -1) {
          next = direction > 0 ? dates[0] : dates[dates.length - 1];
        } else {
          const newIdx = Math.max(0, Math.min(dates.length - 1, idx + direction));
          next = dates[newIdx];
        }
        state.selectedDate = next;
      } else if (state.selectedDate) {
        // No data dates available — step by calendar day
        const d = new Date(state.selectedDate + "T00:00:00");
        d.setDate(d.getDate() + direction);
        state.selectedDate = d.toISOString().slice(0, 10);
      }
      dayDatePicker.value = state.selectedDate;
      persist();
      renderNodes();
      renderLinks();
      renderPanel();
    }

    // ── Day filter ────────────────────────────────────────────────────────────
    const daySlider = document.getElementById("daySlider");
    const dayDatePicker = document.getElementById("dayDatePicker");
    const timeDisplay = document.getElementById("timeDisplay");

    if (state.selectedDate) dayDatePicker.value = state.selectedDate;
    daySlider.value = state.selectedTimeSlot;
    if (timeDisplay) timeDisplay.textContent = slotToTime(state.selectedTimeSlot);

    function syncTimeSlot(slot) {
      state.selectedTimeSlot = slot;
      daySlider.value = slot;
      if (timeDisplay) timeDisplay.textContent = slotToTime(slot);
    }

    dayDatePicker.addEventListener("change", (e) => {
      state.selectedDate = e.target.value;
      persist();
      renderNodes();
      renderLinks();
      renderPanel();
    });

    daySlider.addEventListener("input", (e) => {
      syncTimeSlot(Number(e.target.value));
      persist();
      renderNodes();
      renderLinks();
      renderPanel();
    });

    document.getElementById("dayClear").addEventListener("click", () => {
      state.selectedDate = "";
      dayDatePicker.value = "";
      syncTimeSlot(0);
      persist();
      renderNodes();
      renderLinks();
      renderPanel();
    });

    document.getElementById("dayPrev").addEventListener("click", () => navigateDate(-1));
    document.getElementById("dayNext").addEventListener("click", () => navigateDate(1));
    document.getElementById("autoLayout").addEventListener("click", autoLayout);
    document.getElementById("resetDemo").addEventListener("click", resetDemo);
    document.getElementById("exportJson").addEventListener("click", exportJson);
    document.getElementById("exportCsv").addEventListener("click", exportCsv);
    document.getElementById("loadBackend").addEventListener("click", loadFromBackend);
    document.getElementById("saveBackend").addEventListener("click", saveToBackend);
    document.getElementById("importJson").addEventListener("change", importJson);
    document.getElementById("importNodesCsv").addEventListener("change", (event) => importCsvFile(event, "nodes"));
    document.getElementById("importLinksCsv").addEventListener("change", (event) => importCsvFile(event, "links"));
    document.getElementById("zoomOut").addEventListener("click", () => setZoom(state.zoom - ZOOM_STEP));
    document.getElementById("zoomIn").addEventListener("click", () => setZoom(state.zoom + ZOOM_STEP));
    document.getElementById("zoomReset").addEventListener("click", () => setZoom(1));

    document.getElementById("toggleFinal").addEventListener("click", () => {
      state.finalMode = !state.finalMode;
      document.getElementById("toggleFinal").textContent = state.finalMode ? "Edit Mode" : "Monitor View";
      if (state.finalMode) {
        state.tool = "select";
        state.activeTab = "stats";
      } else {
        state.activeTab = "edit";
      }
      setTool("select");
      render();
    });

    window.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && !event.shiftKey && !isTyping(event.target)) {
        event.preventDefault();
        undo();
        return;
      }
      if (event.key === "Escape") {
        state.connectionSource = null;
        state.dragging = null;
        render();
      }
      if ((event.key === "Delete" || event.key === "Backspace") && !isTyping(event.target) && !state.finalMode) {
        deleteSelected();
      }
      if (!isTyping(event.target) && !state.finalMode) {
        if (event.key.toLowerCase() === "v") setTool("select");
        if (event.key.toLowerCase() === "n") setTool("add");
        if (event.key.toLowerCase() === "l") setTool("connect");
        if (event.key.toLowerCase() === "p") setTool("pan");
        // Ctrl+G: group currently multi-selected nodes
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "g" && state.multiSelectedIds.length >= 2) {
          event.preventDefault();
          pushHistory();
          const label = prompt("Group name:", "New Group") || "New Group";
          const colors = ["#5ba4cf","#7fb4ff","#8ce0c2","#ffd27a","#e07a7a","#c4a6ff"];
          const color = colors[(state.groups?.length || 0) % colors.length];
          state.groups = state.groups || [];
          state.groups.push({ id: "grp_" + Date.now(), label, nodeIds: [...state.multiSelectedIds], color });
          state.multiSelectedIds = [];
          persist(); render();
        }
      }
    });

    function isTyping(target) {
      return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
    }
