// -- Link transaction log overlay

function getLinkRows(link, filterMode, dateFrom, dateTo, singleDate, singleSlot) {
  if (!state.rawData.length || !state.movColumn || !link.movCode) return [];
  return state.rawData.filter(row => {
    const code = String(row[state.movColumn] || "").trim();
    if (code !== link.movCode) return false;
    if (filterMode === "range") {
      if (!dateFrom && !dateTo) return true;
      const d = String(row[state.dateColumn] || "").trim().slice(0, 10);
      if (dateFrom && d < dateFrom) return false;
      if (dateTo   && d > dateTo)   return false;
      return true;
    } else {
      if (!singleDate) return true;
      const d = String(row[state.dateColumn] || "").trim().slice(0, 10);
      if (d !== singleDate) return false;
      const rt = normalizeTime(state.timeColumn ? row[state.timeColumn] : "");
      if (rt && rt > slotToTime(singleSlot)) return false;
      return true;
    }
  });
}

function openLinkView(linkId) {
  const link    = linkById(linkId);
  if (!link) return;
  const srcNode = nodeById(link.source);
  const tgtNode = nodeById(link.target);
  const overlay = document.getElementById("linkViewOverlay");
  overlay.removeAttribute("aria-hidden");

  let lvMode = "single";
  let lvDate = state.selectedDate || "";
  let lvSlot = state.selectedTimeSlot;
  let lvFrom = "";
  let lvTo   = "";

  const srcSloc = state.rawHeaders.find(h => /source.*sloc|src.*sloc|sloc.*from|from.*sloc/i.test(h));
  const dstSloc = state.rawHeaders.find(h => /dest.*sloc|dst.*sloc|sloc.*to|to.*sloc/i.test(h));
  const partCol = state.partColumn;

  function buildLvHTML() {
    const rows = getLinkRows(link, lvMode, lvFrom, lvTo, lvDate, lvSlot);

    const byPart = {};
    rows.forEach(row => {
      const part = partCol ? String(row[partCol] || "").trim() : "-";
      const qty  = state.qtyColumn ? (numberValue(row[state.qtyColumn]) || 1) : 1;
      byPart[part] = (byPart[part] || 0) + qty;
    });

    const summaryRows = Object.entries(byPart).sort((a, b) => b[1] - a[1])
      .map(([p, q]) => `<tr><td>${escapeHtml(p)}</td><td>${q}</td></tr>`).join("");

    const txRows = rows.slice(0, 500).map(row => {
      const date = state.dateColumn ? String(row[state.dateColumn] || "").trim() : "-";
      const time = state.timeColumn ? String(row[state.timeColumn] || "").trim() : "-";
      const qty  = state.qtyColumn  ? String(row[state.qtyColumn]  || "").trim() : "1";
      const part = partCol           ? String(row[partCol]          || "").trim() : "-";
      const src  = srcSloc           ? String(row[srcSloc]          || "").trim() : "";
      const dst  = dstSloc           ? String(row[dstSloc]          || "").trim() : "";
      return `<tr>
        <td>${escapeHtml(part)}</td>
        <td>${escapeHtml(date)}</td>
        <td>${escapeHtml(time)}</td>
        <td>${escapeHtml(qty)}</td>
        ${srcSloc ? `<td>${escapeHtml(src)}</td>` : ""}
        ${dstSloc ? `<td>${escapeHtml(dst)}</td>` : ""}
      </tr>`;
    }).join("");

    return `
    <div class="lv-shell">
      <button class="node-view-close" id="lvClose">&times;</button>
      <div class="lv-header">
        <div class="lv-title">${escapeHtml(link.label || ("Mv" + (link.movCode || "?")))} &nbsp;<span class="lv-movc">Mv${escapeHtml(link.movCode || "-")}</span></div>
        <div class="lv-route">${escapeHtml(srcNode?.label || link.source)} &rarr; ${escapeHtml(tgtNode?.label || link.target)}</div>
      </div>

      <div class="lv-filter-bar">
        <div class="lv-mode-toggle">
          <button class="nv-toggle-btn${lvMode === "single" ? " active" : ""}" data-lv-mode="single">Single Date</button>
          <button class="nv-toggle-btn${lvMode === "range"  ? " active" : ""}" data-lv-mode="range">Date Range</button>
        </div>
        ${lvMode === "single" ? `
          <input type="date" id="lvDate" class="day-date-picker" value="${escapeAttr(lvDate)}" style="margin-left:8px">
          <input type="range" id="lvSlider" min="0" max="47" value="${lvSlot}" style="width:120px;margin-left:6px">
          <span id="lvTimeDisp" class="time-display">${slotToTime(lvSlot)}</span>
        ` : `
          <label class="nv-snap-label" style="margin-left:8px">From:</label>
          <input type="date" id="lvFrom" class="day-date-picker" value="${escapeAttr(lvFrom)}">
          <label class="nv-snap-label" style="margin-left:6px">To:</label>
          <input type="date" id="lvTo"   class="day-date-picker" value="${escapeAttr(lvTo)}">
        `}
      </div>

      <div class="lv-body">
        <div class="lv-summary-col">
          <div class="lv-section-title">Summary by Part (${rows.length} rows)</div>
          <table class="nv-data-table lv-summary-table">
            <thead><tr><th>Part No</th><th>Total Qty</th></tr></thead>
            <tbody>${summaryRows || `<tr><td colspan="2" style="opacity:.5">No matching rows</td></tr>`}</tbody>
          </table>
        </div>
        <div class="lv-tx-col">
          <div class="lv-section-title">Transactions${rows.length > 500 ? " (showing first 500)" : ""}</div>
          <div class="lv-tx-scroll">
            <table class="nv-data-table">
              <thead><tr>
                <th>Part</th><th>Date</th><th>Time</th><th>Qty</th>
                ${srcSloc ? "<th>Src SLoc</th>" : ""}
                ${dstSloc ? "<th>Dst SLoc</th>" : ""}
              </tr></thead>
              <tbody>${txRows || `<tr><td colspan="6" style="opacity:.5">No matching rows</td></tr>`}</tbody>
            </table>
          </div>
        </div>
      </div>
    </div>`;
  }

  function bindLvEvents() {
    document.getElementById("lvClose")?.addEventListener("click", closeLinkView);
    overlay.addEventListener("pointerdown", (e) => { if (e.target === overlay) closeLinkView(); });

    overlay.querySelectorAll("[data-lv-mode]").forEach(btn => {
      btn.addEventListener("click", () => { lvMode = btn.dataset.lvMode; rerender(); });
    });

    document.getElementById("lvDate")?.addEventListener("change", e => { lvDate = e.target.value; rerender(); });
    const lvSlider = document.getElementById("lvSlider");
    lvSlider?.addEventListener("input", () => {
      lvSlot = Number(lvSlider.value);
      const el = document.getElementById("lvTimeDisp");
      if (el) el.textContent = slotToTime(lvSlot);
      rerender();
    });
    document.getElementById("lvFrom")?.addEventListener("change", e => { lvFrom = e.target.value; rerender(); });
    document.getElementById("lvTo")?.addEventListener("change",   e => { lvTo   = e.target.value; rerender(); });
  }

  function rerender() {
    overlay.innerHTML = buildLvHTML();
    bindLvEvents();
  }

  overlay.innerHTML = buildLvHTML();
  requestAnimationFrame(() => overlay.classList.add("nv-active"));
  bindLvEvents();
}

function closeLinkView() {
  const overlay = document.getElementById("linkViewOverlay");
  overlay.classList.remove("nv-active");
  setTimeout(() => {
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = "";
  }, 300);
}
