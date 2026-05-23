// -- Node expanded view overlay

function renderNodeViewDataTable(node) {
  const inLinks  = state.links.filter(l => l.target === node.id);
  const outLinks = state.links.filter(l => l.source === node.id);
  const inv = nodeInventory(node);
  const rows = [
    ["ID", node.id], ["Type", node.type], ["Status", statusLabel(node.status)],
    ["Inventory", inv],
    ["Defects", numberValue(node.defects)],
    ["Owner", node.owner || "-"], ["Location", node.location || "-"]
  ];
  return `
    <div class="nv-tables-row">
      <div class="nv-table-block">
        <h4>Node Properties</h4>
        <table class="nv-data-table">
          <tbody>${rows.map(([k,v]) => `<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(String(v))}</td></tr>`).join("")}
          </tbody>
        </table>
      </div>
      <div class="nv-table-block">
        <h4>Inbound Links</h4>
        <table class="nv-data-table">
          <thead><tr><th>From</th><th>Label</th><th>Flow</th></tr></thead>
          <tbody>${inLinks.length ? inLinks.map(l => {
            const src  = nodeById(l.source);
            const flow = computeLinkFlow(l);
            return `<tr><td>${escapeHtml(src?.label||l.source)}</td><td>${escapeHtml(l.label||"")}</td><td>${flow !== null ? flow + " units" : "-"}</td></tr>`;
          }).join("") : `<tr><td colspan="3" style="opacity:.5">None</td></tr>`}
          </tbody>
        </table>
      </div>
      <div class="nv-table-block">
        <h4>Outbound Links</h4>
        <table class="nv-data-table">
          <thead><tr><th>To</th><th>Label</th><th>Flow</th></tr></thead>
          <tbody>${outLinks.length ? outLinks.map(l => {
            const tgt  = nodeById(l.target);
            const flow = computeLinkFlow(l);
            return `<tr><td>${escapeHtml(tgt?.label||l.target)}</td><td>${escapeHtml(l.label||"")}</td><td>${flow !== null ? flow + " units" : "-"}</td></tr>`;
          }).join("") : `<tr><td colspan="3" style="opacity:.5">None</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// -- Time series chart

const CHART_COLORS = ["#7fb4ff","#8ce0c2","#ffd27a","#f47a6a","#b59aff","#66cccc","#ff9966","#a8d8a8"];

function drawTimeSeriesChart(node, selectedParts, date) {
  const W = 1000, H = 220, PL = 52, PR = 16, PT = 14, PB = 34;
  const innerW = W - PL - PR;
  const innerH = H - PT - PB;
  const chartDate = date || state.selectedDate || (getDataDates()[0] || "");
  if (!chartDate || !selectedParts.length) {
    return `<div class="chart-empty">Select a date and at least one part to view the chart.</div>`;
  }

  const lines = selectedParts.map((part, ci) => ({
    part,
    color: CHART_COLORS[ci % CHART_COLORS.length],
    values: nodeInventoryTimeSeries(node, part, chartDate)
  }));

  const allVals = lines.flatMap(l => l.values);
  const minV  = Math.min(0, ...allVals);
  const maxV  = Math.max(1, ...allVals);
  const range = maxV - minV || 1;
  const isFlat = allVals.every(v => v === allVals[0]);

  function px(slot) { return PL + (slot / 47) * innerW; }
  function py(val)  { return PT + (1 - (val - minV) / range) * innerH; }

  const xTicks     = [0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 47];
  const yTickCount = 5;
  const yTicks     = Array.from({length: yTickCount}, (_, i) => minV + (range / (yTickCount - 1)) * i);

  const bgRect  = `<rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff" rx="6"/>`;
  const plotBg  = `<rect x="${PL}" y="${PT}" width="${innerW}" height="${innerH}" fill="#f8f9fb"/>`;
  const gridLines   = yTicks.map(v =>
    `<line x1="${PL}" y1="${py(v)}" x2="${W-PR}" y2="${py(v)}" stroke="#e2e6ed" stroke-width="1"/>`
  ).join("");
  const xAxisLabels = xTicks.map(s =>
    `<text x="${px(s)}" y="${H-8}" font-size="11" fill="#66707c" font-family="monospace" text-anchor="middle">${slotToTime(s).slice(0,5)}</text>`
  ).join("");
  const yAxisLabels = yTicks.map(v =>
    `<text x="${PL-6}" y="${py(v)+4}" font-size="11" fill="#66707c" font-family="monospace" text-anchor="end">${Math.round(v)}</text>`
  ).join("");

  const paths = lines.map(({ color, values }) => {
    const d    = values.map((v, i) => (i === 0 ? "M" : "L") + px(i).toFixed(1) + "," + py(v).toFixed(1)).join(" ");
    const dots = values.reduce((acc, v, i) => {
      if (i === 0 || v !== values[i-1]) {
        acc += `<circle cx="${px(i).toFixed(1)}" cy="${py(v).toFixed(1)}" r="3" fill="${color}" stroke="#fff" stroke-width="1.5"/>`;
      }
      return acc;
    }, "");
    return `<path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>${dots}`;
  }).join("");

  const flatNote = isFlat
    ? `<text x="${W/2}" y="${PT+innerH/2}" font-size="11" fill="#aeb7c2" text-anchor="middle" font-family="sans-serif">No movements on this date - stock level constant</text>`
    : "";

  const legend = lines.map(({ part, color }) =>
    `<span class="chart-legend-item"><span class="chart-legend-dot" style="background:${color}"></span>${escapeHtml(part)}</span>`
  ).join("");

  return `
    <svg class="nv-chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      ${bgRect}${plotBg}${gridLines}
      <line x1="${PL}" y1="${PT}" x2="${PL}" y2="${H-PB}" stroke="#cdd3db" stroke-width="1"/>
      <line x1="${PL}" y1="${H-PB}" x2="${W-PR}" y2="${H-PB}" stroke="#cdd3db" stroke-width="1"/>
      ${xAxisLabels}${yAxisLabels}${paths}${flatNote}
    </svg>
    <div class="chart-legend">${legend}</div>
  `;
}

// -- Node card helpers used in the overlay

function renderExpandedNodeCard(node) {
  const status = cssStatus(node.status);
  return `
    <div class="node-expanded ${status}">
      <div class="node-exp-header">
        <span class="status-dot"></span>
        <h2 class="node-exp-title">${escapeHtml(node.label)}</h2>
      </div>
      <div class="node-exp-meta">${escapeHtml(node.type || "Station")} / ${escapeHtml(statusLabel(node.status))}</div>
      <div class="node-exp-metrics">
        <div class="node-exp-metric"><span>Inventory</span><strong>${nodeInventory(node)}</strong></div>
        <div class="node-exp-metric"><span>Defects</span><strong>${numberValue(node.defects)}</strong></div>
        <div class="node-exp-metric"><span>Owner</span><strong>${escapeHtml(node.owner || "-")}</strong></div>
      </div>
      ${node.description ? `<div class="node-exp-desc">${escapeHtml(node.description)}</div>` : ""}
      <div class="node-exp-section-title">Logic / Filters <span class="future-badge" style="vertical-align:middle">Future</span></div>
      <div class="node-exp-logic-placeholder">
        In a future version, each node will let you define exactly what data it reads and how it processes it -
        custom column mappings, conditional routing rules, calculated fields, and multi-source joins.
      </div>
    </div>
  `;
}

function renderMiniNodeCard(node) {
  const status = cssStatus(node.status);
  return `
    <div class="node-mini ${status}" data-mini-node-id="${escapeAttr(node.id)}">
      <div class="node-mini-header">
        <span class="status-dot"></span>
        <span class="node-mini-label" title="${escapeAttr(node.label)}">${escapeHtml(node.label)}</span>
      </div>
      <span class="node-mini-meta">${escapeHtml(node.type || "Station")}</span>
      <span class="node-mini-wip">Inv: ${nodeInventory(node)}</span>
    </div>
  `;
}

// -- Open / close node view overlay

function openNodeView(id) {
  const node = nodeById(id);
  if (!node) return;
  state.nodeViewMode = true;
  state.nodeViewId   = id;

  const preds     = getNodePredecessors(id);
  const succs     = getNodeSuccessors(id);
  const allParts  = getPartsAtNode(node);
  const chartDate = state.selectedDate || (getDataDates()[0] || "");
  const overlay   = document.getElementById("nodeViewOverlay");
  overlay.removeAttribute("aria-hidden");

  function buildHTML(selectedParts, nvGraphMode, nvSnapDate, nvSnapSlot) {
    const snapDateVal = nvSnapDate || chartDate;
    const snapSlotVal = nvSnapSlot !== undefined ? nvSnapSlot : state.selectedTimeSlot;
    let snapshotRows = "";
    if (nvGraphMode === "snapshot") {
      const savedDate = state.selectedDate, savedSlot = state.selectedTimeSlot;
      state.selectedDate = snapDateVal; state.selectedTimeSlot = snapSlotVal;
      const snapParts = selectedParts.length ? selectedParts : allParts;
      snapshotRows = snapParts.map(part => {
        const savedPart = state.highlightPart;
        state.highlightPart = part;
        const inv = nodeInventory(node);
        state.highlightPart = savedPart;
        return `<tr><td>${escapeHtml(part)}</td><td class="${inv < 0 ? "neg-val" : ""}">${inv}</td></tr>`;
      }).join("");
      state.selectedDate = savedDate; state.selectedTimeSlot = savedSlot;
    }

    return `
    <div class="node-view-shell">
      <button class="node-view-close" id="nodeViewClose" title="Close node view">&times;</button>
      <div class="nv-flow">
        <div class="node-view-col node-view-left">
          <div class="node-view-col-label">Upstream</div>
          ${preds.length ? preds.map(renderMiniNodeCard).join("") : `<div class="node-view-empty">No upstream</div>`}
        </div>
        ${preds.length ? `<div class="nv-arrow-sep">&#x2192;</div>` : ""}
        <div class="node-view-center">
          ${renderExpandedNodeCard(node)}
        </div>
        ${succs.length ? `<div class="nv-arrow-sep">&#x2192;</div>` : ""}
        <div class="node-view-col node-view-right">
          <div class="node-view-col-label">Downstream</div>
          ${succs.length ? succs.map(renderMiniNodeCard).join("") : `<div class="node-view-empty">No downstream</div>`}
        </div>
      </div>

      <div class="nv-analytics-section">
        <div class="nv-analytics-header">
          <div class="nv-analytics-title">Analytics - ${escapeHtml(node.label)}</div>
          <div class="nv-graph-toggle">
            <button class="nv-toggle-btn${nvGraphMode === "timeseries" ? " active" : ""}" data-nv-mode="timeseries">Time Series</button>
            <button class="nv-toggle-btn${nvGraphMode === "snapshot"   ? " active" : ""}" data-nv-mode="snapshot">Snapshot</button>
          </div>
        </div>

        ${allParts.length ? `
        <div class="nv-part-filter">
          <div class="nv-part-filter-label">Parts at this node:</div>
          <div class="nv-part-filter-search">
            <input class="nv-part-search-input" id="nvPartSearch" type="text" placeholder="Search parts..." autocomplete="off">
          </div>
          <div class="nv-part-checklist" id="nvPartChecklist">
            ${allParts.map(p => `
              <label class="nv-part-check-item">
                <input type="checkbox" class="nv-part-checkbox" value="${escapeAttr(p)}" ${selectedParts.includes(p) ? "checked" : ""}>
                <span>${escapeHtml(p)}</span>
              </label>
            `).join("")}
          </div>
        </div>` : `<div class="nv-part-empty">Load data with a Part No column to enable part filtering.</div>`}

        ${nvGraphMode === "timeseries" ? `
        <div class="nv-chart-area">
          <div class="nv-chart-date-label">Date: <strong>${escapeHtml(chartDate || "-")}</strong> (uses main date filter)</div>
          ${drawTimeSeriesChart(node, selectedParts, chartDate)}
        </div>` : `
        <div class="nv-snapshot-area">
          <div class="nv-snapshot-filters">
            <label class="nv-snap-label">Date:</label>
            <input type="date" id="nvSnapDate" class="day-date-picker" value="${escapeAttr(snapDateVal)}">
            <input type="range" id="nvSnapSlider" min="0" max="47" value="${snapSlotVal}" style="width:120px">
            <span id="nvSnapTime" class="time-display">${slotToTime(snapSlotVal)}</span>
          </div>
          <table class="nv-data-table" style="margin-top:8px">
            <thead><tr><th>Part No</th><th>Inventory</th></tr></thead>
            <tbody>${snapshotRows || `<tr><td colspan="2" style="opacity:.5">No parts or no data.</td></tr>`}</tbody>
          </table>
        </div>`}
      </div>

      <div class="nv-data-section">
        <div class="nv-data-title">Links - ${escapeHtml(node.label)}</div>
        ${renderNodeViewDataTable(node)}
      </div>
    </div>`;
  }

  let nvSelectedParts = [];
  let nvGraphMode  = "timeseries";
  let nvSnapDate   = chartDate;
  let nvSnapSlot   = state.selectedTimeSlot;

  function rerender() {
    overlay.innerHTML = buildHTML(nvSelectedParts, nvGraphMode, nvSnapDate, nvSnapSlot);
    bindNvEvents();
  }

  function bindNvEvents() {
    document.getElementById("nodeViewClose")?.addEventListener("click", closeNodeView);
    overlay.addEventListener("pointerdown", (e) => { if (e.target === overlay) closeNodeView(); });

    overlay.querySelectorAll("[data-mini-node-id]").forEach(el => {
      el.addEventListener("click", () => {
        closeNodeView();
        selectItem("node", el.dataset.miniNodeId);
        setTimeout(() => openNodeView(el.dataset.miniNodeId), 310);
      });
    });

    overlay.querySelectorAll("[data-nv-mode]").forEach(btn => {
      btn.addEventListener("click", () => { nvGraphMode = btn.dataset.nvMode; rerender(); });
    });

    overlay.querySelectorAll(".nv-part-checkbox").forEach(cb => {
      cb.addEventListener("change", () => {
        nvSelectedParts = Array.from(overlay.querySelectorAll(".nv-part-checkbox:checked")).map(c => c.value);
        rerender();
      });
    });

    const partSearch = document.getElementById("nvPartSearch");
    partSearch?.addEventListener("input", () => {
      const q = partSearch.value.trim().toLowerCase();
      overlay.querySelectorAll(".nv-part-check-item").forEach(item => {
        const label = item.querySelector("span")?.textContent.toLowerCase() || "";
        item.style.display = (!q || label.includes(q)) ? "" : "none";
      });
    });

    const snapDate   = document.getElementById("nvSnapDate");
    const snapSlider = document.getElementById("nvSnapSlider");
    const snapTimeEl = document.getElementById("nvSnapTime");
    if (snapDate)   snapDate.addEventListener("change",   () => { nvSnapDate = snapDate.value; rerender(); });
    if (snapSlider) snapSlider.addEventListener("input",  () => {
      nvSnapSlot = Number(snapSlider.value);
      if (snapTimeEl) snapTimeEl.textContent = slotToTime(nvSnapSlot);
      rerender();
    });
  }

  overlay.innerHTML = buildHTML(nvSelectedParts, nvGraphMode, nvSnapDate, nvSnapSlot);
  requestAnimationFrame(() => overlay.classList.add("nv-active"));
  bindNvEvents();
}

function closeNodeView() {
  const overlay = document.getElementById("nodeViewOverlay");
  overlay.classList.remove("nv-active");
  setTimeout(() => {
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML        = "";
    state.nodeViewMode       = false;
    state.nodeViewId         = null;
  }, 300);
}
