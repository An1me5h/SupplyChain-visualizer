    function applyRawData(headers, rows, filename, { skipDialog = false } = {}) {
      const columnsAlreadyMapped = !!state.movColumn;
      autoDetectColumns(headers);

      function doLoad() {
        rows.sort((a, b) => {
          const da = String(a[state.dateColumn] || "").trim().slice(0, 10);
          const db = String(b[state.dateColumn] || "").trim().slice(0, 10);
          if (da < db) return -1;
          if (da > db) return 1;
          const ta = normalizeTime(state.timeColumn ? a[state.timeColumn] : "");
          const tb = normalizeTime(state.timeColumn ? b[state.timeColumn] : "");
          return ta < tb ? -1 : ta > tb ? 1 : 0;
        });
        state.rawData = rows;
        state.rawHeaders = headers;
        state.rawFileName = filename || "data";
        updateDataStatusChip();
        document.getElementById("openDataView").disabled = false;
        showToast("Data loaded: " + rows.length + " rows." + (columnsAlreadyMapped ? "" : " Adjust column mapping if needed."));
        render();
      }

      doLoad();
      // Show the column mapping dialog only on first load; skip it on refresh/reload
      if (!skipDialog && !columnsAlreadyMapped) {
        openColCfgDialog(headers, filename, doLoad);
      }
    }

    function openColCfgDialog(headers, filename, onConfirm) {
      const overlay = document.getElementById("colCfgOverlay");
      const grid    = document.getElementById("colCfgGrid");
      const fnLabel = document.getElementById("colCfgFilename");
      if (!overlay || !grid) { onConfirm(); return; }

      fnLabel.textContent = filename || "";

      const colDefs = [
        { key: "movColumn",    label: "Movement Code",       required: true  },
        { key: "dateColumn",   label: "Posting Date",        required: true  },
        { key: "timeColumn",   label: "Posting Time",        required: false },
        { key: "qtyColumn",    label: "Quantity",            required: true  },
        { key: "partColumn",   label: "Part / Material No.", required: true  },
        { key: "srcSlocColumn",label: "Source Location (node code)", required: false },
        { key: "dstSlocColumn",label: "Destination Location (node code)", required: false },
      ];

      const none = `<option value="">— not mapped —</option>`;
      grid.innerHTML = colDefs.map(({ key, label, required }) => {
        const opts = headers.map(h =>
          `<option value="${escapeAttr(h)}" ${state[key] === h ? "selected" : ""}>${escapeHtml(h)}</option>`
        ).join("");
        return `
          <div class="colcfg-row">
            <label class="colcfg-label">${escapeHtml(label)}${required ? " <span class='colcfg-req'>*</span>" : ""}</label>
            <select class="colcfg-select" data-col-key="${escapeAttr(key)}">${none}${opts}</select>
          </div>`;
      }).join("");

      overlay.removeAttribute("aria-hidden");

      document.getElementById("colCfgConfirm").onclick = () => {
        overlay.querySelectorAll(".colcfg-select").forEach(sel => {
          state[sel.dataset.colKey] = sel.value;
        });
        overlay.setAttribute("aria-hidden", "true");
        onConfirm();
      };
      document.getElementById("colCfgSkip").onclick = () => {
        overlay.setAttribute("aria-hidden", "true");
        onConfirm();
      };
    }

    function updateDataStatusChip() {
      const chip = document.getElementById("dataStatusChip");
      const txt = document.getElementById("dataStatusText");
      if (!chip || !txt) return;
      if (state.rawData.length) {
        chip.classList.add("loaded");
        txt.textContent = state.rawData.length + " rows · " + (state.rawFileName || "data");
      } else {
        chip.classList.remove("loaded");
        txt.textContent = "No data";
      }
    }

    function parseSheetRows(ws) {
      // header:1 returns a 2D array — guarantees every column is captured even if
      // some header cells are blank or rows have trailing empty cells
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, dateNF: "YYYY-MM-DD", defval: "" });
      if (!raw.length) return { headers: [], rows: [] };
      const headerRow = raw[0] || [];
      const headers = headerRow.map((h, i) => {
        const s = String(h ?? "").trim();
        return s || ("Col_" + (i + 1));
      });
      const rows = raw.slice(1)
        .filter(row => row.some(cell => cell !== "" && cell != null))
        .map(row => {
          const obj = {};
          headers.forEach((h, i) => { obj[h] = String(row[i] ?? ""); });
          return obj;
        });
      return { headers, rows };
    }

    function autoDetectColumns(headers) {
      if (!state.dateColumn) {
        const g = headers.find(h => /posting.date|post.*date|doc.*date|budat/i.test(h))
                || headers.find(h => /date|day/i.test(h));
        if (g) state.dateColumn = g;
      }
      if (!state.movColumn) {
        // Prefer explicit movement-type columns; avoid matching DOC_TYPE
        const g = headers.find(h => /mvt_type|mvt_typ|movement_type|mov_type|bwart/i.test(h))
                || headers.find(h => /^mvt$/i.test(h))
                || headers.find(h => /movement.*code|mov.*code/i.test(h));
        if (g) state.movColumn = g;
      }
      if (!state.qtyColumn) {
        const g = headers.find(h => /^qty$|^quantity$|menge|erfmg/i.test(h))
                || headers.find(h => /qty|quantity|amount|units/i.test(h));
        if (g) state.qtyColumn = g;
      }
      if (!state.partColumn) {
        const g = headers.find(h => /^part_no$|^part_number$|^matnr$|^material_no$/i.test(h))
                || headers.find(h => /part.*no|part.*num|matnr|material/i.test(h));
        if (g) state.partColumn = g;
      }
      if (!state.timeColumn) {
        const g = headers.find(h => /^time$|^posting_time$|^doc_time$|^entry_time$/i.test(h))
                || headers.find(h => /^time/i.test(h));
        if (g) state.timeColumn = g;
      }
      if (!state.srcSlocColumn) {
        const g = headers.find(h => /src.*sloc|source.*sloc|sloc.*from|from.*sloc|lgort_from|lgpla_from|issuing.*sloc|send.*sloc/i.test(h))
                || headers.find(h => /issuing.*loc|source.*loc|from.*location/i.test(h));
        if (g) state.srcSlocColumn = g;
      }
      if (!state.dstSlocColumn) {
        const g = headers.find(h => /dest.*sloc|dst.*sloc|sloc.*to|to.*sloc|recv.*sloc|lgort_to|lgpla_to/i.test(h))
                || headers.find(h => /receiving.*loc|dest.*loc|to.*location/i.test(h));
        if (g) state.dstSlocColumn = g;
      }
    }

    function parseWorkbook(buffer, filename, { silent = false } = {}) {
      if (typeof XLSX === "undefined") {
        showToast("SheetJS library not loaded — check your internet connection.");
        return;
      }
      try {
        const wb = XLSX.read(new Uint8Array(buffer), { type: "array", cellDates: true });
        const firstSheet = wb.SheetNames[0];
        if (!firstSheet) throw new Error("No sheets found in this file.");
        const { headers, rows } = parseSheetRows(wb.Sheets[firstSheet]);
        state.rawSheets = {};
        state.rawSheetName = firstSheet;
        applyRawData(headers, rows, filename || firstSheet, { skipDialog: silent });
        persist();
        if (!silent) openDataView();
      } catch (e) {
        showToast("Could not parse file: " + e.message);
      }
    }

    async function autoLoadDataFile({ isRefresh = false } = {}) {
      try {
        const res = await fetch("/api/rawfile");
        if (!res.ok) throw new Error(res.status);
        const fname = res.headers.get("X-Filename") || "data.xlsx";
        const buf = await res.arrayBuffer();
        parseWorkbook(buf, fname, { silent: isRefresh });
        closeStartupOverlay();
        if (isRefresh) {
          const count = state.rawData.length;
          showToast(`Data refreshed — ${count} row${count !== 1 ? "s" : ""} loaded.`);
        }
      } catch {
        // server not running or file missing — show startup overlay if no data yet
        if (!state.rawData.length) showStartupOverlay();
        if (isRefresh) throw new Error("server not reachable");
      }
    }

    // ── Data Viewer ───────────────────────────────────────────────────────────

    function openDataView() {
      const el = document.getElementById("dataModal");
      if (!el) return;
      el.removeAttribute("aria-hidden");
      el.classList.add("dv-open");
      renderDataView();
    }

    function closeDataView() {
      const el = document.getElementById("dataModal");
      if (!el) return;
      el.classList.remove("dv-open");
      el.setAttribute("aria-hidden", "true");
    }

    function renderDataView() {
      const title = document.getElementById("dvTitle");
      const body = document.getElementById("dvBody");
      const colCfg = document.getElementById("dvColConfig");
      const dvTabs = document.getElementById("dvTabs");
      if (!title || !body || !colCfg) return;

      title.textContent = state.rawFileName || "Data File";

      const headers = state.rawHeaders;
      const colOpt = (selected, label) => `
        <span class="dv-col-label">${label}</span>
        <select class="dv-col-select" data-dv-col="${escapeAttr(label)}">
          <option value="">— none —</option>
          ${headers.map(h => `<option value="${escapeAttr(h)}" ${selected === h ? "selected" : ""}>${escapeHtml(h)}</option>`).join("")}
        </select>
      `;
      colCfg.innerHTML = `
        ${colOpt(state.dateColumn, "Date")}
        ${colOpt(state.timeColumn, "Time")}
        ${colOpt(state.movColumn, "Movement Code")}
        ${colOpt(state.qtyColumn, "Quantity")}
        ${colOpt(state.partColumn, "Part No")}
      `;

      colCfg.querySelectorAll("[data-dv-col]").forEach(sel => {
        sel.addEventListener("change", () => {
          const label = sel.dataset.dvCol;
          if (label === "Date") state.dateColumn = sel.value;
          else if (label === "Time") state.timeColumn = sel.value;
          else if (label === "Movement Code") { state.movColumn = sel.value; render(); }
          else if (label === "Quantity") state.qtyColumn = sel.value;
          else if (label === "Part No") state.partColumn = sel.value;
          persist();
          renderDataTableBody();
        });
      });

      if (dvTabs) dvTabs.innerHTML = "";

      const rows = state.rawData;
      const MAX_ROWS = 2000;
      const visible = rows.slice(0, MAX_ROWS);

      body.innerHTML = `
        <div class="dv-row-count">${rows.length} rows${rows.length > MAX_ROWS ? " (showing first " + MAX_ROWS + ")" : ""} · ${headers.length} columns</div>
        <div class="dv-table-wrap">
          <table class="dv-table" id="dvTable">
            <thead><tr>${headers.map(h => `<th class="${h === state.movColumn ? "dv-col-hi" : ""}">${escapeHtml(h)}</th>`).join("")}</tr></thead>
            <tbody id="dvTableBody"></tbody>
          </table>
        </div>
      `;
      renderDataTableBody(visible);
    }

    function renderDataTableBody(rows) {
      const tbody = document.getElementById("dvTableBody");
      if (!tbody) return;
      const data = rows || state.rawData.slice(0, 2000);
      tbody.innerHTML = data.map(row =>
        `<tr>${state.rawHeaders.map(h =>
          `<td class="${h === state.movColumn ? "dv-col-hi" : ""}">${escapeHtml(String(row[h] ?? ""))}</td>`
        ).join("")}</tr>`
      ).join("");
    }

    document.getElementById("dataModalClose").addEventListener("click", closeDataView);
    document.getElementById("dataModal").addEventListener("pointerdown", (e) => {
      if (e.target === document.getElementById("dataModal")) closeDataView();
    });

    // ── Demo Data Loader ─────────────────────────────────────────────────────

    async function loadDemoData() {
      try {
        const res = await fetch("demo/SAP_FlowOrdered_Log.xlsx");
        if (!res.ok) return;
        if (typeof XLSX === "undefined") return;
        const buf = await res.arrayBuffer();
        const wb = XLSX.read(new Uint8Array(buf), { type: "array", cellDates: true });
        const firstSheet = wb.SheetNames[0];
        if (!firstSheet) return;
        const { headers, rows } = parseSheetRows(wb.Sheets[firstSheet]);
        applyRawData(headers, rows, "Demo Data", { skipDialog: false });
        persist();
      } catch {
        // No demo data bundled — app works without it
      }
    }

    // ── Startup Overlay ───────────────────────────────────────────────────────

    function showStartupOverlay() {
      const el = document.getElementById("startupOverlay");
      if (!el) return;
      el.removeAttribute("aria-hidden");
      el.classList.add("su-open");
    }

    function closeStartupOverlay() {
      const el = document.getElementById("startupOverlay");
      if (!el) return;
      el.classList.remove("su-open");
      el.setAttribute("aria-hidden", "true");
    }

    document.getElementById("startupSkip").addEventListener("click", async () => {
      closeStartupOverlay();
      await loadDemoData();
    });

    function handleFileInput(file) {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => parseWorkbook(e.target.result, file.name);
      reader.readAsArrayBuffer(file);
    }

    document.getElementById("uploadDataStartup").addEventListener("change", (e) => {
      pushHistory();
      state.nodes          = [];
      state.links          = [];
      state.groups         = [];
      state.selectedKind   = null;
      state.selectedId     = null;
      state.multiSelectedIds = [];
      persist();
      handleFileInput(e.target.files[0]);
      closeStartupOverlay();
      e.target.value = "";
    });

    // ── Topbar button listeners ───────────────────────────────────────────────

    document.getElementById("uploadData").addEventListener("change", (e) => {
      handleFileInput(e.target.files[0]);
      e.target.value = "";
    });

    document.getElementById("openDataView").addEventListener("click", () => {
      if (state.rawData.length) openDataView();
      else showToast("No data loaded yet.");
    });

    document.getElementById("openDataViewRail").addEventListener("click", () => {
      if (state.rawData.length) openDataView();
      else showToast("No data loaded yet.");
    });

    document.getElementById("loadDataServer").addEventListener("click", () => {
      if (!['localhost','127.0.0.1'].includes(location.hostname)) {
        showToast("Load Data only works when the app is run locally on your machine.");
        return;
      }
      autoLoadDataFile();
    });
    document.getElementById("openLayoutMgr").addEventListener("click", openLayoutMgr);
