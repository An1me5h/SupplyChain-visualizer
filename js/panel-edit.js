function colorSwatchField(currentColor, fieldName) {
  return `
    <div class="field full">
      <label>Color</label>
      <div class="color-swatch-row">
        <div class="color-swatch swatch-none${!currentColor ? " active" : ""}"
             onclick="setItemColor('${escapeAttr(fieldName)}', '')" title="Default"></div>
        ${PALETTE_COLORS.map(c => `
          <div class="color-swatch${currentColor === c ? " active" : ""}"
               style="background:${c}"
               onclick="setItemColor('${escapeAttr(fieldName)}', '${c}')"
               title="${c}"></div>
        `).join("")}
      </div>
    </div>`;
}

function setItemColor(field, color) {
  if (state.selectedKind === "node") {
    const node = nodeById(state.selectedId);
    if (node) { node[field] = color; persist(); render(); }
  } else if (state.selectedKind === "link") {
    const link = linkById(state.selectedId);
    if (link) { link[field] = color; persist(); render(); }
  }
}

function renderGroupEdit(group) {
  return `
    <div class="form-grid">
      <div class="field full">
        <label for="field-groupLabel">Group name</label>
        <input id="field-groupLabel" data-group-field="label" value="${escapeAttr(group.label)}">
      </div>
      <div class="field">
        <label>Color</label>
        <input type="color" data-group-field="color" value="${escapeAttr(group.color || "#7fb4ff")}">
      </div>
    </div>
    <div class="section-title">Nodes in group</div>
    <div class="access-list">
      ${state.nodes.map(n => `
        <label class="access-item">
          <input type="checkbox" data-group-node-id="${escapeAttr(n.id)}" ${(group.nodeIds || []).includes(n.id) ? "checked" : ""}>
          <span class="access-name">${escapeHtml(n.label)}</span>
          <span class="access-type">${escapeHtml(n.type || "")}</span>
        </label>
      `).join("")}
    </div>
    <div class="section-title edit-only">Actions</div>
    <button class="danger-btn edit-only" id="deleteCurrent">Delete Group</button>
  `;
}

function renderGroupStats(group) {
  const nodes = (group.nodeIds || []).map(nodeById).filter(Boolean);
  const totalWip = nodes.reduce((s, n) => s + numberValue(n.wip), 0);
  return `
    <div class="metric-grid">
      <div class="metric-tile"><span>Nodes</span><strong>${nodes.length}</strong></div>
      <div class="metric-tile"><span>Total WIP</span><strong>${totalWip}</strong></div>
    </div>
    <div class="section-title">Nodes</div>
    <div class="mini-table-wrap">
      <table><thead><tr><th>Node</th><th>Status</th><th>WIP</th></tr></thead>
      <tbody>${nodes.map(n => `<tr><td>${escapeHtml(n.label)}</td><td>${statusLabel(n.status)}</td><td>${numberValue(n.wip)}</td></tr>`).join("")}</tbody>
      </table>
    </div>
  `;
}

// â"€â"€ Panel rendering â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function renderPanel() {
  if (state.activeTab === "table") state.activeTab = "edit";

  if (state.selectedKind === "group") {
    const group = groupById(state.selectedId);
    if (group) {
      panelKicker.textContent = "Group";
      panelTitle.textContent = group.label;
      if (state.activeTab === "edit") panelBody.innerHTML = renderGroupEdit(group);
      if (state.activeTab === "stats") panelBody.innerHTML = renderGroupStats(group);
      bindPanelEvents();
      renderTabs();
      return;
    }
  }

  const item = selectedItem();
  if (!item) {
    panelKicker.textContent = "Network";
    panelTitle.textContent = "Supply Chain";
    if (state.activeTab === "stats") state.activeTab = "edit";
    if (state.activeTab === "edit") panelBody.innerHTML = renderNetworkEdit();
    bindPanelEvents();
    renderTabs();
    return;
  }

  if (state.selectedKind === "node") {
    panelKicker.textContent = "Node";
    panelTitle.textContent = item.label || item.id;
    if (state.finalMode) state.activeTab = "stats";
    if (state.activeTab === "edit") panelBody.innerHTML = renderNodeEdit(item);
    if (state.activeTab === "stats") panelBody.innerHTML = renderNodeStats(item);
  }

  if (state.selectedKind === "link") {
    const source = nodeById(item.source)?.label || item.source;
    const target = nodeById(item.target)?.label || item.target;
    panelKicker.textContent = "Link";
    panelTitle.textContent = source + " -> " + target;
    if (state.finalMode) state.activeTab = "stats";
    if (state.activeTab === "edit") panelBody.innerHTML = renderLinkEdit(item);
    if (state.activeTab === "stats") panelBody.innerHTML = renderLinkStats(item);
  }

  bindPanelEvents();
  renderTabs();
}

function renderTabs() {
  document.querySelectorAll(".panel-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.tab === state.activeTab);
  });
}

function renderNetworkEdit() {
  const groups = state.groups || [];
  return `
    <div class="empty-state">No item selected. Click a node, link, or group.</div>
    <div class="section-title">Groups</div>
    ${groups.length ? `
      <div class="access-list">
        ${groups.map(g => `
          <div class="access-item" style="cursor:pointer" data-select-group="${escapeAttr(g.id)}">
            <span style="width:12px;height:12px;border-radius:3px;background:${escapeAttr(g.color||'#7fb4ff')};flex-shrink:0"></span>
            <span class="access-name">${escapeHtml(g.label)}</span>
            <span class="access-type">${(g.nodeIds||[]).length} nodes</span>
          </div>
        `).join("")}
      </div>
    ` : `<div class="empty-state">No groups yet.</div>`}
    <button class="action-btn" id="newGroupBtn" style="margin-top:6px">+ New Group</button>
    <div id="newGroupForm" style="display:none;margin-top:8px">
      <div class="form-grid">
        <div class="field full">
          <label>Group Name</label>
          <input id="newGroupName" placeholder="e.g. Assembly Line">
        </div>
      </div>
      <div class="section-title" style="margin-top:6px">Select Nodes</div>
      <div class="access-list">
        ${state.nodes.map(n => `
          <label class="access-item">
            <input type="checkbox" data-new-group-node="${escapeAttr(n.id)}">
            <span class="access-name">${escapeHtml(n.label)}</span>
            <span class="access-type">${escapeHtml(n.type||"")}</span>
          </label>
        `).join("")}
      </div>
      <button class="action-btn primary" id="createGroupBtn" style="margin-top:8px">Create Group</button>
    </div>
    <div class="section-title">Monitor View Display</div>
    ${renderFinalDisplayControls()}
    <div class="section-title">Current Structure</div>
    ${renderNetworkStats()}
  `;
}

function renderFinalDisplayControls() {
  const fields = [
    ["nodeType", "Node type"],
    ["nodeStatus", "Node status"],
    ["nodeWip", "Inventory"],
    ["nodeOwner", "Owner"],
    ["nodeLocation", "Location"],
    ["linkLabel", "Link label"]
  ];

  return `
    <div class="visibility-grid">
      ${fields.map(([key, label]) => `
        <label class="visibility-toggle">
          <input type="checkbox" data-final-field="${key}" ${state.finalFields[key] ? "checked" : ""}>
          <span>${escapeHtml(label)}</span>
        </label>
      `).join("")}
    </div>
  `;
}

function renderNetworkStats() {
  const data = metrics();
  return `
    <div class="metric-grid">
      <div class="metric-tile"><span>Nodes</span><strong>${data.nodes}</strong></div>
      <div class="metric-tile"><span>Links</span><strong>${data.links}</strong></div>
      <div class="metric-tile"><span>Total Inventory</span><strong>${data.wip}</strong></div>
      <div class="metric-tile"><span>Risk Nodes</span><strong>${data.critical}</strong></div>
    </div>
    <div class="section-title">Status Mix</div>
    <div class="mini-table-wrap">
      <table>
        <thead><tr><th>Status</th><th>Nodes</th><th>Links</th></tr></thead>
        <tbody>
          ${["ok", "warning", "critical", "blocked"].map((status) => `
            <tr>
              <td>${statusLabel(status)}</td>
              <td>${state.nodes.filter((node) => node.status === status).length}</td>
              <td>${state.links.filter((link) => link.status === status).length}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderNodeClassConfig(node) {
  const nc = node.nodeClass || "";
  if (nc === "transit") {
    const inLinks  = state.links.filter(l => l.target === node.id && l.movCode);
    const outLinks = state.links.filter(l => l.source === node.id && l.movCode);
    const codes = [...new Set([...inLinks, ...outLinks].map(l => l.movCode))].join(", ") || "none";
    return `
      <div class="section-title">In-Transit Node</div>
      <div style="font-size:12px;color:var(--text-2);line-height:1.6">
        This node acts as a transparent pass-through hub.<br>
        <strong>No SLoc is assigned</strong> &mdash; rows are routed by reading the source and destination node codes directly from the data.<br><br>
        A row with <code>movCode=101, srcSLoc=V001, destSLoc=0001</code> flows through:<br>
        &nbsp;&bull; Link <em>from</em> the node whose code matches <code>V001</code> &rarr; this node<br>
        &nbsp;&bull; Link <em>to</em> the node whose code matches <code>0001</code> from this node<br><br>
        <strong>Movement codes on connected links:</strong> ${escapeHtml(codes)}
      </div>`;
  }
  if (nc === "source") {
    return `
      <div class="section-title">Source Node Config</div>
      <div style="font-size:10px;color:var(--muted);margin-bottom:6px">
        Outbound movements show as <strong>Sent</strong> (always positive).<br>
        Any link pointing <em>to</em> this source node with a movement code is automatically counted as a <strong>Return</strong> &mdash; no extra config needed.
      </div>`;
  }
  if (nc === "end") {
    return `
      <div class="section-title">End Node Config</div>
      <div style="font-size:10px;color:var(--muted);margin-bottom:6px">
        Inbound movements show as <strong>Arrived</strong>.<br>
        Set a <strong>Node Code</strong> if this destination has a standard SLoc. Otherwise leave it unset and add <strong>Extra Row Filter</strong> conditions below.
      </div>`;
  }
  if (nc === "ledger") {
    const cols = state.rawHeaders.filter(h => h);
    const sel  = Array.isArray(node.ledgerColumns) ? node.ledgerColumns : [];
    return `
      <div class="section-title">Ledger Node Config</div>
      <div class="form-grid">
        ${inputField("Movement Codes (comma-sep)", "ledgerMovCodes", node.ledgerMovCodes || "")}
      </div>
      <div class="nv-part-filter-label" style="margin:6px 0 4px">Columns to accumulate:</div>
      <div class="nc-col-checklist" id="ledgerColList">
        ${cols.length ? cols.map(c => `
          <label class="nv-part-check-item">
            <input type="checkbox" class="ledger-col-check" value="${escapeAttr(c)}" ${sel.includes(c) ? "checked" : ""}>
            <span>${escapeHtml(c)}</span>
          </label>`).join("") : `<span style="font-size:11px;color:var(--muted)">Load data first to pick columns.</span>`}
      </div>
      <div style="font-size:10px;color:var(--muted);margin-top:6px">Accumulates totals for selected columns on matching movement codes up to the selected date/time.</div>`;
  }
  if (nc === "register") {
    const cols = state.rawHeaders.filter(h => h);
    const sel  = Array.isArray(node.registerColumns) ? node.registerColumns : [];
    return `
      <div class="section-title">Register Node Config</div>
      <div class="form-grid">
        ${inputField("Movement Codes (comma-sep)", "registerMovCodes", node.registerMovCodes || "")}
      </div>
      <div class="nv-part-filter-label" style="margin:6px 0 4px">Columns to display:</div>
      <div class="nc-col-checklist" id="registerColList">
        ${cols.length ? cols.map(c => `
          <label class="nv-part-check-item">
            <input type="checkbox" class="register-col-check" value="${escapeAttr(c)}" ${sel.includes(c) ? "checked" : ""}>
            <span>${escapeHtml(c)}</span>
          </label>`).join("") : `<span style="font-size:11px;color:var(--muted)">Load data first to pick columns.</span>`}
      </div>
      <div style="font-size:10px;color:var(--muted);margin-top:6px">Shows values from the most recent matching row up to the selected date/time.</div>`;
  }
  if (nc === "compound") {
    const inner = (node.innerNodes || []).length;
    return `
      <div class="section-title">Compound Node</div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:8px">${inner} inner node${inner !== 1 ? "s" : ""}. Double-click the node on the canvas to enter the inner workspace.</div>`;
  }
  if (nc === "consumption") {
    const bom = Array.isArray(node.bom) ? node.bom : [];
    return `
      <div class="section-title">Consumption Node Config</div>
      <div class="form-grid">
        ${inputField("Output Part (finished good)", "bomOutputPart", node.bomOutputPart || "")}
        ${inputField("Production Mov. Codes (comma-sep)", "bomMovCodes", node.bomMovCodes || "")}
      </div>
      <div class="bom-section">
        <div class="bom-header">
          <span class="nv-part-filter-label">Bill of Materials &mdash; inputs per output unit</span>
          <label class="action-btn bom-upload-lbl" title="CSV with columns: InputPart, Qty">
            Upload BOM CSV
            <input type="file" id="bomCsvInput" accept=".csv,.tsv" style="display:none">
          </label>
        </div>
        <table class="bom-table">
          <thead><tr><th>Input Part</th><th>Qty / unit</th><th></th></tr></thead>
          <tbody id="bomRows">
            ${bom.map((r, i) => `
              <tr data-bom-idx="${i}">
                <td><input class="bom-part-input" data-bom-idx="${i}" value="${escapeAttr(r.inputPart || "")}"></td>
                <td><input class="bom-qty-input" type="number" min="0.001" step="any" data-bom-idx="${i}" value="${numberValue(r.qty) || 1}"></td>
                <td><button class="bom-del-btn" data-bom-idx="${i}" title="Remove row">&times;</button></td>
              </tr>`).join("")}
          </tbody>
        </table>
        <button class="action-btn" id="addBomRow" style="margin-top:6px;font-size:11px;width:100%">+ Add Input Part</button>
      </div>
      <div style="font-size:10px;color:var(--muted);margin-top:6px">
        Set initial stock for each input part via the <strong>Init Stock</strong> button on the toolbar. Remaining = initStock - (produced &times; BOM qty).
      </div>`;
  }
  return "";
}

function renderNodeExtraFilters(node) {
  const filters = Array.isArray(node.extraFilters) ? node.extraFilters : [];
  const headers = Array.isArray(state.rawHeaders) ? state.rawHeaders : [];
  return `
    <div class="section-title">Extra Row Filter</div>
    <div style="font-size:11px;color:var(--muted);margin-bottom:6px">
      No Node Code set. Add column = value conditions to identify rows for this node. All conditions must match (AND).
    </div>
    <div id="nodeExtraFilters">
      ${filters.map((f, i) => `
        <div class="extra-filter-row" data-ef-idx="${i}">
          <select class="ef-col-select" data-ef-idx="${i}" ${!headers.length ? "disabled" : ""}>
            <option value="">- column -</option>
            ${headers.map(h => `<option value="${escapeAttr(h)}"${f.column === h ? " selected" : ""}>${escapeHtml(h)}</option>`).join("")}
          </select>
          <span class="ef-eq">=</span>
          <input class="ef-val-input" data-ef-idx="${i}" type="text" value="${escapeAttr(f.value || "")}" placeholder="value...">
          <button class="ef-del-btn" data-ef-idx="${i}" title="Remove filter">&times;</button>
        </div>
      `).join("")}
    </div>
    <button class="action-btn" id="addExtraFilter" style="margin-top:4px;font-size:11px;width:100%">+ Add Filter</button>
  `;
}

function renderNodeEdit(node) {
  const nc = node.nodeClass || "";
  const rulesText = typeof node.rules === "string" ? node.rules : "";
  return `
    <div class="section-title">Node Class</div>
    <div class="node-class-row">
      ${["","source","end","transit"].map(v => {
        const labels = { "": "Standard", source: "Source", end: "End", transit: "In-Transit" };
        return `<label class="link-type-opt${nc === v ? " active" : ""}">
          <input type="radio" name="nodeClass" value="${escapeAttr(v)}" ${nc === v ? "checked" : ""}> ${labels[v]}
        </label>`;
      }).join("")}
      <label class="link-type-opt dimmed" title="Ledger node &mdash; coming in a future version">
        <input type="radio" name="nodeClass" value="ledger" disabled> Ledger &nbsp;<span class="future-badge">Future</span>
      </label>
      <label class="link-type-opt dimmed" title="Register node &mdash; coming in a future version">
        <input type="radio" name="nodeClass" value="register" disabled> Register &nbsp;<span class="future-badge">Future</span>
      </label>
      <label class="link-type-opt dimmed" title="Consumption node &mdash; coming in a future version">
        <input type="radio" name="nodeClass" value="consumption" disabled> Consumption &nbsp;<span class="future-badge">Future</span>
      </label>
      <label class="link-type-opt dimmed" title="Compound node &mdash; coming in a future version">
        <input type="radio" name="nodeClass" value="compound" disabled> Compound &nbsp;<span class="future-badge">Soon</span>
      </label>
    </div>
    ${renderNodeClassConfig(node)}
    <div class="form-grid">
      ${inputField("Label", "label", node.label)}
      ${nc !== "transit" ? inputField("Type", "type", node.type) : ""}
      ${nc !== "transit" && nc !== "source" && nc !== "end" ? selectField("Status", "status", node.status) : ""}
      ${nc !== "transit" && nc !== "source" && nc !== "end" ? inputField("Owner", "owner", node.owner) : ""}
      ${nc !== "transit" ? inputField("Location", "location", node.location) : ""}
      ${nc !== "transit" ? nodeCodeSelectField(node.nodeCode || "") : ""}
      <div class="field full">
        <label for="field-description">Description</label>
        <textarea id="field-description" data-node-field="description">${escapeHtml(node.description || "")}</textarea>
      </div>
    </div>
    ${nc !== "transit" && !(node.nodeCode || "").trim() ? renderNodeExtraFilters(node) : ""}
    <div class="section-title" style="opacity:.45">Routing Rules</div>
    <div style="font-size:10px;color:var(--muted);margin-bottom:6px;opacity:.55">
      Format: <code>IF [!Column] IS_EQUAL_TO value THEN "Node Label"</code> - coming in a future version.
    </div>
    <textarea class="rules-textarea" id="nodeRulesText" rows="4" disabled style="opacity:.4;cursor:not-allowed;resize:none">${escapeHtml(rulesText)}</textarea>
    ${colorSwatchField(node.color || "", "color")}
    <div class="section-title edit-only">Actions</div>
    <button class="danger-btn edit-only" id="deleteCurrent">Delete selected</button>
  `;
}

function renderLinkEdit(link) {
  return `
    <div class="form-grid">
      ${inputField("Label", "label", link.label)}
      ${inputField("Movement Code", "movCode", link.movCode || "")}
      ${selectField("Status", "status", link.status)}
      <div class="field">
        <label>Source</label>
        <input value="${escapeAttr(nodeById(link.source)?.label || link.source)}" disabled>
      </div>
      <div class="field">
        <label>Target</label>
        <input value="${escapeAttr(nodeById(link.target)?.label || link.target)}" disabled>
      </div>
    </div>
    <div class="section-title">Link Type</div>
    <div class="link-type-row">
      <label class="link-type-opt${link.linkType !== "transit" ? " active" : ""}">
        <input type="radio" name="linkType" value="movement" ${link.linkType !== "transit" ? "checked" : ""}> Movement Link
      </label>
      <label class="link-type-opt dimmed" title="Coming in a future version">
        <input type="radio" name="linkType" value="transit" disabled>
        Transit / Delivery Time &nbsp;<span class="future-badge">Future</span>
      </label>
    </div>
    ${renderSLocWarning(link)}
    <div class="section-title">Extra Row Filter</div>
    <div class="hint-text" style="font-size:11px;color:var(--muted);margin-bottom:6px">
      If the same movement code leads to multiple destinations, set a column + value here to narrow which rows belong to this link.
    </div>
    <div class="form-grid">
      ${matchColumnSelectField(link.matchColumn || "")}
      ${inputField("Match Value", "matchValue", link.matchValue || "")}
    </div>
    ${colorSwatchField(link.color || "", "color")}
    <div class="section-title edit-only">Actions</div>
    <button class="danger-btn edit-only" id="deleteCurrent">Delete selected</button>
  `;
}

function renderSLocWarning(link) {
  if (!link.movCode) return "";
  const warnings = [];

  function nodeWarning(node) {
    if (!node || node.nodeClass === "transit") return;
    if ((node.nodeCode || "").trim()) return;
    const filters = node.extraFilters || [];
    if (filters.some(f => f.column && f.value)) return;
    warnings.push(`<div class="sloc-warning">
      <strong>(!) No identifier set on "${escapeHtml(node.label)}".</strong>
      Set a <strong>Node Code</strong> or at least one <strong>Extra Row Filter</strong> so rows can be matched to this node.
    </div>`);
  }

  nodeWarning(nodeById(link.source));
  nodeWarning(nodeById(link.target));
  return warnings.join("");
}

