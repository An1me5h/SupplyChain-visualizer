function bindPanelEvents() {
  panelBody.querySelectorAll("[data-field], [data-node-field], [data-group-field]").forEach((field) => {
    field.addEventListener("focus", () => pushHistory(), { once: true });
  });

  panelBody.querySelectorAll("[data-field]").forEach((field) => {
    field.addEventListener("input", (event) => {
      const item = selectedItem();
      if (!item) return;
      const key = event.target.dataset.field;
      const numeric = ["defects"].includes(key);
      item[key] = numeric ? numberValue(event.target.value) : event.target.value;
      persist();
      if (key === "nodeCode") renderPanel();
      else refreshAfterFieldEdit();
    });
  });

  panelBody.querySelectorAll("[data-node-field]").forEach((field) => {
    field.addEventListener("input", (event) => {
      const node = selectedItem();
      if (!node || state.selectedKind !== "node") return;
      node[event.target.dataset.nodeField] = event.target.value;
      persist();
      refreshAfterFieldEdit();
    });
  });

  panelBody.querySelectorAll("[data-final-field]").forEach((checkbox) => {
    checkbox.addEventListener("change", (event) => {
      state.finalFields[event.target.dataset.finalField] = event.target.checked;
      persist();
      render();
    });
  });

  panelBody.querySelectorAll("input[name='linkType']").forEach(radio => {
    radio.addEventListener("change", () => {
      const link = selectedItem();
      if (!link || state.selectedKind !== "link") return;
      link.linkType = radio.value;
      persist();
      refreshAfterFieldEdit();
    });
  });

  panelBody.querySelectorAll("input[name='nodeClass']").forEach(radio => {
    radio.addEventListener("change", () => {
      const node = selectedItem();
      if (!node || state.selectedKind !== "node") return;
      node.nodeClass = radio.value;
      persist();
      refreshAfterFieldEdit();
      renderPanel();
    });
  });

  panelBody.querySelectorAll(".ledger-col-check, .register-col-check").forEach(cb => {
    cb.addEventListener("change", () => {
      const node = selectedItem();
      if (!node || state.selectedKind !== "node") return;
      const isLedger = cb.classList.contains("ledger-col-check");
      const key = isLedger ? "ledgerColumns" : "registerColumns";
      node[key] = Array.from(
        panelBody.querySelectorAll(isLedger ? ".ledger-col-check:checked" : ".register-col-check:checked")
      ).map(c => c.value);
      persist();
      renderNodes();
    });
  });

  const addBomRowBtn = document.getElementById("addBomRow");
  if (addBomRowBtn) {
    addBomRowBtn.addEventListener("click", () => {
      const node = selectedItem();
      if (!node || state.selectedKind !== "node") return;
      node.bom = Array.isArray(node.bom) ? node.bom : [];
      node.bom.push({ inputPart: "", qty: 1 });
      persist();
      refreshAfterFieldEdit();
      renderPanel();
    });
  }

  panelBody.querySelectorAll(".bom-del-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const node = selectedItem();
      if (!node || state.selectedKind !== "node") return;
      const idx = Number(btn.dataset.bomIdx);
      node.bom = Array.isArray(node.bom) ? node.bom : [];
      node.bom.splice(idx, 1);
      persist();
      refreshAfterFieldEdit();
      renderPanel();
    });
  });

  panelBody.querySelectorAll(".bom-part-input").forEach(inp => {
    inp.addEventListener("input", () => {
      const node = selectedItem();
      if (!node || state.selectedKind !== "node") return;
      const idx = Number(inp.dataset.bomIdx);
      node.bom = Array.isArray(node.bom) ? node.bom : [];
      if (node.bom[idx]) node.bom[idx].inputPart = inp.value;
      persist(); refreshAfterFieldEdit();
    });
  });

  panelBody.querySelectorAll(".bom-qty-input").forEach(inp => {
    inp.addEventListener("input", () => {
      const node = selectedItem();
      if (!node || state.selectedKind !== "node") return;
      const idx = Number(inp.dataset.bomIdx);
      node.bom = Array.isArray(node.bom) ? node.bom : [];
      if (node.bom[idx]) node.bom[idx].qty = parseFloat(inp.value) || 1;
      persist(); refreshAfterFieldEdit();
    });
  });

  const bomCsvInput = document.getElementById("bomCsvInput");
  if (bomCsvInput) {
    bomCsvInput.addEventListener("change", () => {
      const file = bomCsvInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = e => {
        const node = selectedItem();
        if (!node || state.selectedKind !== "node") return;
        const text = e.target.result;
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (!lines.length) return;
        const delim = file.name.toLowerCase().endsWith(".tsv") ? "\t" : ",";
        const headers = lines[0].split(delim).map(h => h.trim().toLowerCase());
        const partIdx = headers.findIndex(h => /part|material|input/i.test(h));
        const qtyIdx  = headers.findIndex(h => /qty|quantity|amount/i.test(h));
        if (partIdx < 0) { showToast("BOM CSV needs an Input Part column."); return; }
        const bom = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(delim).map(c => c.trim());
          const inputPart = cols[partIdx] || "";
          const qty = qtyIdx >= 0 ? (parseFloat(cols[qtyIdx]) || 1) : 1;
          if (inputPart) bom.push({ inputPart, qty });
        }
        node.bom = bom;
        persist();
        refreshAfterFieldEdit();
        renderPanel();
        showToast(`BOM loaded: ${bom.length} input part(s).`);
      };
      reader.readAsText(file);
    });
  }

  // Extra row filters on nodes
  const addExtraFilterBtn = document.getElementById("addExtraFilter");
  if (addExtraFilterBtn) {
    addExtraFilterBtn.addEventListener("click", () => {
      const node = selectedItem();
      if (!node || state.selectedKind !== "node") return;
      pushHistory();
      node.extraFilters = Array.isArray(node.extraFilters) ? node.extraFilters : [];
      node.extraFilters.push({ column: "", value: "" });
      persist();
      renderPanel();
    });
  }

  panelBody.querySelectorAll(".ef-col-select").forEach(sel => {
    sel.addEventListener("change", () => {
      const node = selectedItem();
      if (!node || state.selectedKind !== "node") return;
      const idx = Number(sel.dataset.efIdx);
      if (!node.extraFilters || !node.extraFilters[idx]) return;
      node.extraFilters[idx].column = sel.value;
      persist(); refreshAfterFieldEdit();
    });
  });

  panelBody.querySelectorAll(".ef-val-input").forEach(inp => {
    inp.addEventListener("input", () => {
      const node = selectedItem();
      if (!node || state.selectedKind !== "node") return;
      const idx = Number(inp.dataset.efIdx);
      if (!node.extraFilters || !node.extraFilters[idx]) return;
      node.extraFilters[idx].value = inp.value;
      persist(); refreshAfterFieldEdit();
    });
  });

  panelBody.querySelectorAll(".ef-del-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const node = selectedItem();
      if (!node || state.selectedKind !== "node") return;
      pushHistory();
      const idx = Number(btn.dataset.efIdx);
      node.extraFilters = node.extraFilters || [];
      node.extraFilters.splice(idx, 1);
      persist();
      renderPanel();
    });
  });

  const deleteButton = document.getElementById("deleteCurrent");
  if (deleteButton) deleteButton.addEventListener("click", deleteSelected);

  // Group field edit
  panelBody.querySelectorAll("[data-group-field]").forEach(field => {
    field.addEventListener("input", () => {
      const group = groupById(state.selectedId);
      if (!group) return;
      group[field.dataset.groupField] = field.value;
      persist(); renderGroups(); renderPanel();
    });
  });

  // Group node membership toggles
  panelBody.querySelectorAll("[data-group-node-id]").forEach(cb => {
    cb.addEventListener("change", () => {
      pushHistory();
      const group = groupById(state.selectedId);
      if (!group) return;
      group.nodeIds = group.nodeIds || [];
      if (cb.checked && !group.nodeIds.includes(cb.dataset.groupNodeId)) group.nodeIds.push(cb.dataset.groupNodeId);
      if (!cb.checked) group.nodeIds = group.nodeIds.filter(id => id !== cb.dataset.groupNodeId);
      persist(); renderGroups();
    });
  });

  // Routing rules textarea
  const rulesTextarea = document.getElementById("nodeRulesText");
  if (rulesTextarea) {
    rulesTextarea.addEventListener("input", () => {
      const node = selectedItem();
      if (!node || state.selectedKind !== "node") return;
      node.rules = rulesTextarea.value;
      persist();
    });
  }

  // Group selection from list
  panelBody.querySelectorAll("[data-select-group]").forEach(el => {
    el.addEventListener("click", () => selectItem("group", el.dataset.selectGroup));
  });

  // New group form toggle
  const newGroupBtn = document.getElementById("newGroupBtn");
  if (newGroupBtn) newGroupBtn.addEventListener("click", () => {
    const form = document.getElementById("newGroupForm");
    if (form) form.style.display = form.style.display === "none" ? "block" : "none";
  });

  // Create group
  const createGroupBtn = document.getElementById("createGroupBtn");
  if (createGroupBtn) createGroupBtn.addEventListener("click", () => {
    pushHistory();
    const nameInput = document.getElementById("newGroupName");
    const label = nameInput?.value.trim() || "Group " + ((state.groups?.length || 0) + 1);
    const nodeIds = Array.from(panelBody.querySelectorAll("[data-new-group-node]:checked")).map(el => el.dataset.newGroupNode);
    const colors = ["#5ba4cf","#7fb4ff","#8ce0c2","#ffd27a","#e07a7a","#c4a6ff"];
    const color = colors[(state.groups?.length || 0) % colors.length];
    state.groups = state.groups || [];
    state.groups.push({ id: "grp_" + Date.now(), label, nodeIds, color });
    persist(); render();
  });
}

// â"€â"€ Master render â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function render() {
  app.classList.toggle("final-mode", state.finalMode);
  applyViewport();
  renderHeaderState();
  renderGroups();
  renderLinks();
  renderNodes();
  renderPanel();
  updateNodeViewButton();
  updateLinkViewButton();
}

function updateNodeViewButton() {
  const btn = document.getElementById("nodeViewBtn");
  if (!btn) return;
  btn.disabled = state.selectedKind !== "node" || state.finalMode;
}

function updateLinkViewButton() {
  const btn = document.getElementById("linkViewBtn");
  if (!btn) return;
  btn.disabled = state.selectedKind !== "link";
}

function refreshAfterFieldEdit() {
  const item = selectedItem();
  renderHeaderState();
  renderLinks();
  renderNodes();

  if (!item) {
    panelKicker.textContent = "Network";
    panelTitle.textContent = "Supply Chain";
    return;
  }

  if (state.selectedKind === "node") {
    panelKicker.textContent = "Node";
    panelTitle.textContent = item.label || item.id;
  }

  if (state.selectedKind === "link") {
    const source = nodeById(item.source)?.label || item.source;
    const target = nodeById(item.target)?.label || item.target;
    panelKicker.textContent = "Link";
    panelTitle.textContent = source + " -> " + target;
  }
}

// â"€â"€ Node View overlay â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

