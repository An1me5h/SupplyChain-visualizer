function renderConsumptionStats(node) {
  const timeLabel = state.selectedDate && state.selectedTimeSlot > 0 ? " " + slotToTime(state.selectedTimeSlot) : "";
  const dateLabel = state.selectedDate ? state.selectedDate + timeLabel : "All dates";

  if (!state.rawData.length || !state.movColumn) {
    return `<div class="tx-no-data">No data loaded. Upload a data file to see consumption stats.</div>`;
  }

  const { produced, consumed, remaining } = nodeConsumptionValues(node);
  const bom = Array.isArray(node.bom) ? node.bom : [];

  const bomRows = bom.map(({ inputPart, qty }) => {
    const used = consumed[inputPart] || 0;
    const rem  = remaining[inputPart] !== undefined ? remaining[inputPart] : 0;
    const neg  = rem < 0;
    return `<tr>
      <td class="tx-part">${escapeHtml(inputPart)}</td>
      <td style="text-align:right">${numberValue(qty) || 1}</td>
      <td style="text-align:right">${used}</td>
      <td style="text-align:right;color:${neg ? "#e05252" : "inherit"}">${rem}</td>
    </tr>`;
  }).join("");

  return `
    <div class="metric-grid" style="margin-bottom:8px">
      <div class="metric-tile"><span>Units Produced</span><strong>${produced}</strong></div>
      <div class="metric-tile"><span>BOM Inputs</span><strong>${bom.length}</strong></div>
    </div>
    <div class="section-title">BOM Consumption - ${escapeHtml(dateLabel)}</div>
    ${bom.length === 0
      ? `<div class="tx-no-data">No BOM configured. Add input parts in the Edit tab.</div>`
      : `<div class="tx-log-wrap">
          <table class="tx-log-table">
            <thead><tr>
              <th>Input Part</th>
              <th style="text-align:right">Qty/Unit</th>
              <th style="text-align:right">Used</th>
              <th style="text-align:right">Remaining</th>
            </tr></thead>
            <tbody>${bomRows}</tbody>
          </table>
        </div>`
    }
  `;
}

function renderTransitStats(node) {
  const inLinks  = state.links.filter(l => l.target === node.id && l.movCode);
  const outLinks = state.links.filter(l => l.source === node.id && l.movCode);

  if (!state.rawData.length || !state.movColumn) {
    return `<div class="tx-no-data">No data loaded. Upload a data file to see the transit log.</div>`;
  }

  const rows = [];
  state.rawData.forEach(row => {
    const inLink = inLinks.find(l => rowMatchesLink(row, l));
    if (!inLink) return;
    const date    = state.dateColumn ? String(row[state.dateColumn] || "").trim().slice(0, 10) : "";
    const time    = state.timeColumn ? String(row[state.timeColumn] || "").trim().slice(0, 8)  : "";
    const part    = state.partColumn ? String(row[state.partColumn] || "").trim()              : "";
    const qty     = state.qtyColumn  ? (numberValue(row[state.qtyColumn]) || 1)                : 1;
    const movCode = inLink.movCode;

    const fromNode  = resolveRealCounterpart(row, inLink, "In");
    const fromLabel = fromNode ? fromNode.label : (nodeById(inLink.source)?.label || inLink.source);

    const sameCodeOut = outLinks.filter(l => l.movCode === movCode);
    let matchingOut = sameCodeOut.length === 1
      ? sameCodeOut[0]
      : sameCodeOut.find(l => rowMatchesLink(row, l));
    const toNode    = matchingOut ? resolveRealCounterpart(row, matchingOut, "Out") : null;
    const toLabel   = toNode ? toNode.label
      : (matchingOut ? (nodeById(matchingOut.target)?.label || matchingOut.target) : "-");

    rows.push({ date, time, part, movCode, fromLabel, toLabel, qty, _raw: row });
  });

  const filtered = rows
    .filter(r => {
      if (!rowMatchesDate(r._raw)) return false;
      if (state.highlightPart && r.part !== state.highlightPart) return false;
      return true;
    })
    .reverse();

  const timeLabel = state.selectedDate && state.selectedTimeSlot > 0 ? " " + slotToTime(state.selectedTimeSlot) : "";
  const dateLabel = state.selectedDate ? state.selectedDate + timeLabel : "All dates";
  const totalQty  = filtered.reduce((s, r) => s + r.qty, 0);

  return `
    <div class="metric-grid" style="margin-bottom:8px">
      <div class="metric-tile"><span>Passed Through</span><strong>${totalQty}</strong></div>
      <div class="metric-tile"><span>Rows shown</span><strong>${filtered.length}</strong></div>
    </div>
    <div class="section-title">Transit Log - ${escapeHtml(dateLabel)}${state.highlightPart ? " / " + escapeHtml(state.highlightPart) : ""}</div>
    ${filtered.length === 0
      ? `<div class="tx-no-data">No transactions match the current filters.</div>`
      : `<div class="tx-log-wrap">
          <table class="tx-log-table">
            <thead><tr><th>Date</th><th>Time</th><th>Part</th><th>MvT</th><th>From</th><th>To</th><th>Qty</th></tr></thead>
            <tbody>
              ${filtered.map(r => `
                <tr>
                  <td>${escapeHtml(r.date)}</td>
                  <td class="tx-time">${escapeHtml(r.time)}</td>
                  <td class="tx-part">${escapeHtml(r.part)}</td>
                  <td class="tx-code">${escapeHtml(r.movCode)}</td>
                  <td class="tx-node">${escapeHtml(r.fromLabel)}</td>
                  <td class="tx-node">${escapeHtml(r.toLabel)}</td>
                  <td class="tx-qty">${r.qty}</td>
                </tr>`).join("")}
            </tbody>
          </table>
        </div>`
    }
    ${renderPartInventoryBreakdown(node, dateLabel, "Flow by Part")}
  `;
}

function renderNodeStats(node) {
  if (node.nodeClass === "consumption") return renderConsumptionStats(node);
  if (node.nodeClass === "transit")     return renderTransitStats(node);

  const inLinks  = state.links.filter(l => l.target === node.id && l.movCode);
  const outLinks = state.links.filter(l => l.source === node.id && l.movCode);

  if (!state.rawData.length || !state.movColumn) {
    return `<div class="tx-no-data">No data loaded. Upload a data file to see the transaction log.</div>`;
  }

  const rows = [];
  state.rawData.forEach(row => {
    const inLink  = inLinks.find(l => rowMatchesLink(row, l));
    const outLink = !inLink ? outLinks.find(l => rowMatchesLink(row, l)) : null;
    if (!inLink && !outLink) return;
    const matchedLink = inLink || outLink;
    const dir     = inLink ? "In" : "Out";
    const date    = state.dateColumn ? String(row[state.dateColumn]  || "").trim().slice(0, 10) : "";
    const time    = state.timeColumn ? String(row[state.timeColumn]  || "").trim().slice(0, 8)  : "";
    const part    = state.partColumn ? String(row[state.partColumn]  || "").trim()              : "";
    const qty     = state.qtyColumn  ? (numberValue(row[state.qtyColumn]) || 1)                 : 1;
    const refNode = resolveRealCounterpart(row, matchedLink, dir);
    const nodeRef = refNode ? refNode.label : (dir === "In" ? matchedLink.source : matchedLink.target);
    rows.push({ date, time, part, dir, qty, nodeRef, _raw: row });
  });

  const filtered = rows
    .filter(r => {
      if (!rowMatchesDate(r._raw)) return false;
      if (state.highlightPart && r.part !== state.highlightPart) return false;
      return true;
    })
    .reverse();

  const inv = nodeInventory(node);
  const isSource = node.nodeClass === "source";
  const isEnd    = node.nodeClass === "end";
  const totalReturns = isSource ? nodeReturnQty(node) : 0;
  const timeLabel = state.selectedDate && state.selectedTimeSlot > 0 ? " " + slotToTime(state.selectedTimeSlot) : "";
  const dateLabel = state.selectedDate ? state.selectedDate + timeLabel : "All dates";
  const invLabel  = isSource ? "Sent" : isEnd ? "Arrived" : "Inventory";

  return `
    <div class="metric-grid" style="margin-bottom:8px">
      <div class="metric-tile"><span>${invLabel}</span><strong class="${inv < 0 ? "neg-val" : ""}">${inv}</strong></div>
      ${isSource && totalReturns > 0 ? `<div class="metric-tile"><span>Returned</span><strong style="color:#f47a6a">${totalReturns}</strong></div>` : ""}
      <div class="metric-tile"><span>Rows shown</span><strong>${filtered.length}</strong></div>
    </div>
    <div class="section-title">Transaction Log - ${escapeHtml(dateLabel)}${state.highlightPart ? " / " + escapeHtml(state.highlightPart) : ""}</div>
    ${filtered.length === 0
      ? `<div class="tx-no-data">No transactions match the current filters.</div>`
      : `<div class="tx-log-wrap">
          <table class="tx-log-table">
            <thead><tr><th>Date</th><th>Time</th><th>Part</th><th>Dir</th><th>Node</th><th>Qty</th></tr></thead>
            <tbody>
              ${filtered.map(r => `
                <tr>
                  <td>${escapeHtml(r.date)}</td>
                  <td class="tx-time">${escapeHtml(r.time)}</td>
                  <td class="tx-part">${escapeHtml(r.part)}</td>
                  <td class="${r.dir === "In" ? "tx-in" : "tx-out"}">${r.dir}</td>
                  <td class="tx-node" title="${r.dir === "In" ? "From" : "To"}: ${escapeAttr(r.nodeRef)}">${escapeHtml(r.nodeRef || "-")}</td>
                  <td class="tx-qty">${r.qty}</td>
                </tr>`).join("")}
            </tbody>
          </table>
        </div>`
    }
    ${renderPartInventoryBreakdown(node, dateLabel)}
    ${isSource ? renderReturnsBreakdown(node, dateLabel) : ""}
  `;
}

function filterPartSearch(query) {
  const q = (query || "").toLowerCase().trim();
  document.querySelectorAll(".part-inv-row").forEach(row => {
    const part = (row.dataset.part || "").toLowerCase();
    row.style.display = (!q || part.includes(q)) ? "" : "none";
  });
}

function renderPartInventoryBreakdown(node, dateLabel, sectionTitle) {
  const title = sectionTitle || "Inventory by Part";
  const parts = getPartsAtNode(node);
  if (!parts.length) return "";

  const savedPart = state.highlightPart;
  const partRows = parts.map(part => {
    state.highlightPart = part;
    const qty = nodeInventory(node);
    return { part, qty };
  }).filter(r => r.qty !== 0);
  state.highlightPart = savedPart;

  if (!partRows.length) return "";

  const maxQty = Math.max(...partRows.map(r => Math.abs(r.qty)));
  const scrollStyle = partRows.length > 10 ? " style=\"max-height:220px;overflow-y:auto\"" : "";

  return `
    <div class="section-title" style="margin-top:12px">${escapeHtml(title)} - ${escapeHtml(dateLabel)}</div>
    <input type="text" class="part-search-input" placeholder="Search part..." oninput="filterPartSearch(this.value)">
    <div class="part-inv-list"${scrollStyle}>
      ${partRows.map(r => {
        const pct = maxQty > 0 ? Math.round((Math.abs(r.qty) / maxQty) * 100) : 0;
        const neg = r.qty < 0;
        return `
          <div class="part-inv-row" data-part="${escapeAttr(r.part)}">
            <span class="part-inv-label">${escapeHtml(r.part)}</span>
            <div class="part-inv-bar-wrap">
              <div class="part-inv-bar${neg ? " neg" : ""}" style="width:${pct}%"></div>
            </div>
            <span class="part-inv-qty${neg ? " neg-val" : ""}">${r.qty}</span>
          </div>`;
      }).join("")}
    </div>`;
}

function renderReturnsBreakdown(node, dateLabel) {
  const inLinks = state.links.filter(l => l.target === node.id && l.movCode);
  if (!inLinks.length || !state.rawData.length || !state.movColumn || !state.partColumn) return "";

  const partTotals = {};
  state.rawData.forEach(row => {
    if (!rowBeforeOrOnDate(row)) return;
    for (const l of inLinks) {
      if (rowMatchesLink(row, l)) {
        const part = String(row[state.partColumn] || "").trim();
        if (part) partTotals[part] = (partTotals[part] || 0) + (state.qtyColumn ? (numberValue(row[state.qtyColumn]) || 1) : 1);
        break;
      }
    }
  });

  const partRows = Object.entries(partTotals).sort((a, b) => b[1] - a[1]);
  if (!partRows.length) return "";
  const maxQty = Math.max(...partRows.map(([, v]) => v));
  const scrollStyle = partRows.length > 10 ? " style=\"max-height:220px;overflow-y:auto\"" : "";

  return `
    <div class="section-title" style="margin-top:12px">Returns by Part - ${escapeHtml(dateLabel)}</div>
    <div class="part-inv-list"${scrollStyle}>
      ${partRows.map(([part, qty]) => {
        const pct = maxQty > 0 ? Math.round((qty / maxQty) * 100) : 0;
        return `
          <div class="part-inv-row" data-part="${escapeAttr(part)}">
            <span class="part-inv-label">${escapeHtml(part)}</span>
            <div class="part-inv-bar-wrap">
              <div class="part-inv-bar" style="width:${pct}%;background:#f47a6a"></div>
            </div>
            <span class="part-inv-qty" style="color:#f47a6a">${qty}</span>
          </div>`;
      }).join("")}
    </div>`;
}

function renderLinkStats(link) {
  const source = nodeById(link.source);
  const target = nodeById(link.target);
  const flow = computeLinkFlow(link);
  return `
    <div class="metric-grid">
      <div class="metric-tile"><span>Status</span><strong>${statusLabel(link.status)}</strong></div>
      <div class="metric-tile"><span>Flow</span><strong>${flow !== null ? flow + " units" : "-"}</strong></div>
      <div class="metric-tile"><span>Route</span><strong>${source ? source.label : link.source} -> ${target ? target.label : link.target}</strong></div>
    </div>
    <div class="section-title">Connected Nodes</div>
    <div class="mini-table-wrap">
      <table>
        <thead><tr><th>Node</th><th>Status</th><th>Inventory</th></tr></thead>
        <tbody>
          ${[source, target].filter(Boolean).map((node) => `
            <tr>
              <td>${escapeHtml(node.label)}</td>
              <td>${statusLabel(node.status)}</td>
              <td>${nodeInventory(node)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

// â"€â"€ Form field helpers â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function inputField(label, field, value, type = "text") {
  return `
    <div class="field">
      <label for="field-${field}">${escapeHtml(label)}</label>
      <input id="field-${field}" type="${type}" data-field="${escapeAttr(field)}" value="${escapeAttr(value ?? "")}">
    </div>
  `;
}

function slocSelectField(label, field, value, stateColKey) {
  const colName = state[stateColKey] || "";
  const opts = [];
  if (colName && state.rawData.length) {
    const seen = new Set();
    state.rawData.forEach(row => {
      const v = String(row[colName] || "").trim();
      if (v && !seen.has(v)) { seen.add(v); opts.push(v); }
    });
    opts.sort();
  }
  const noDataNote = colName && !opts.length
    ? ` <span style="font-size:10px;color:var(--muted)">(no data loaded yet)</span>`
    : (!colName ? ` <span style="font-size:10px;color:var(--muted)">(column not mapped)</span>` : "");
  return `
    <div class="field">
      <label for="field-${field}">${escapeHtml(label)}${noDataNote}</label>
      <select id="field-${field}" data-field="${escapeAttr(field)}" ${!opts.length ? "disabled" : ""}>
        <option value="">- not set -</option>
        ${opts.map(v => `<option value="${escapeAttr(v)}"${value === v ? " selected" : ""}>${escapeHtml(v)}</option>`).join("")}
      </select>
    </div>
  `;
}

function nodeCodeSelectField(value) {
  const seen = new Set();
  const opts = [];
  [state.srcSlocColumn, state.dstSlocColumn].forEach(col => {
    if (!col) return;
    state.rawData.forEach(row => {
      const v = String(row[col] || "").trim();
      if (v && !seen.has(v)) { seen.add(v); opts.push(v); }
    });
  });
  opts.sort();
  const colsMapped = state.srcSlocColumn || state.dstSlocColumn;
  const note = !colsMapped
    ? ` <span style="font-size:10px;color:var(--muted)">(map SLoc columns first)</span>`
    : (!opts.length ? ` <span style="font-size:10px;color:var(--muted)">(no data loaded yet)</span>` : "");
  return `
    <div class="field">
      <label for="field-nodeCode">Node Code${note}</label>
      <select id="field-nodeCode" data-field="nodeCode" ${!opts.length ? "disabled" : ""}>
        <option value="">- not set -</option>
        ${opts.map(v => `<option value="${escapeAttr(v)}"${value === v ? " selected" : ""}>${escapeHtml(v)}</option>`).join("")}
      </select>
    </div>
  `;
}

function matchColumnSelectField(value) {
  const headers = Array.isArray(state.rawHeaders) ? state.rawHeaders : [];
  const note = !headers.length ? ` <span style="font-size:10px;color:var(--muted)">(load data first)</span>` : "";
  return `
    <div class="field">
      <label for="field-matchColumn">Match Column${note}</label>
      <select id="field-matchColumn" data-field="matchColumn" ${!headers.length ? "disabled" : ""}>
        <option value="">- use default SLoc columns -</option>
        ${headers.map(h => `<option value="${escapeAttr(h)}"${value === h ? " selected" : ""}>${escapeHtml(h)}</option>`).join("")}
      </select>
    </div>
  `;
}

function selectField(label, field, value) {
  return `
    <div class="field">
      <label for="field-${field}">${escapeHtml(label)}</label>
      <select id="field-${field}" data-field="${escapeAttr(field)}">
        ${["ok", "warning", "critical", "blocked"].map((status) => `
          <option value="${status}" ${value === status ? "selected" : ""}>${statusLabel(status)}</option>
        `).join("")}
      </select>
    </div>
  `;
}

function infoRow(label, value) {
  return `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value || "")}</td></tr>`;
}

// â"€â"€ Panel event bindings â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

