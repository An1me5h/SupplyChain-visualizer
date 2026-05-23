    function exportJson() {
      const payload = JSON.stringify(networkPayload(), null, 2);
      downloadFile("supply-chain-network.json", payload, "application/json");
    }

    function exportCsv() {
      downloadFile("nodes.csv", nodesCsv(), "text/csv");
      setTimeout(() => downloadFile("links.csv", linksCsv(), "text/csv"), 120);
    }

    function nodesCsv() {
      const columns = ["id", "label", "type", "status", "x", "y", "owner", "location", "description"];
      const rows = state.nodes.map((node) => columns.map((column) => node[column] ?? ""));
      return makeCsv(columns, rows);
    }

    function linksCsv() {
      const columns = ["id", "source", "target", "label", "movCode", "linkType", "status", "controlX", "controlY"];
      const rows = state.links.map((link) => columns.map((column) => link[column] ?? ""));
      return makeCsv(columns, rows);
    }

    function makeCsv(columns, rows) {
      return [columns, ...rows]
        .map((row) => row.map((value) => csvEscape(value)).join(","))
        .join("\n");
    }

    function csvEscape(value) {
      const text = String(value ?? "");
      if (/[",\n\r]/.test(text)) return '"' + text.replace(/"/g, '""') + '"';
      return text;
    }

    function downloadFile(filename, content, type) {
      const blob = new Blob([content], { type });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
    }

    async function copyText(text, message) {
      try {
        await navigator.clipboard.writeText(text);
        showToast(message);
      } catch (error) {
        showToast("Clipboard permission was blocked.");
      }
    }

    function importJson(event) {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result);
          applyNetworkPayload(parsed);
          showToast("JSON imported.");
        } catch (error) {
          showToast("Could not import that JSON file.");
        }
      };
      reader.readAsText(file);
      event.target.value = "";
    }

    async function loadFromBackend() {
      try {
        const response = await fetch("/api/network");
        if (!response.ok) throw new Error("Backend returned " + response.status);
        const payload = await response.json();
        const hasPositions = Array.isArray(payload.nodes) &&
          payload.nodes.some(n => Number.isFinite(n.x) && Number.isFinite(n.y));
        applyNetworkPayload(payload);
        if (!hasPositions) autoLayout();
        showToast("Loaded from backend.");
      } catch (error) {
        showToast("Backend is not running. Start it with node server.js.");
      }
    }

    async function saveToBackend() {
      try {
        const response = await fetch("/api/network", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(networkPayload())
        });
        if (!response.ok) throw new Error("Backend returned " + response.status);
        showToast("Saved to backend.");
      } catch (error) {
        showToast("Backend is not running. Start it with node server.js.");
      }
    }

    function importCsvFile(event, kind) {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const rows = parseDelimited(reader.result);
          if (!rows.length) throw new Error("Empty table");
          const objects = rowsToObjects(rows);
          if (kind === "nodes") {
            state.nodes = normalizeNodes(objects);
            autoPlaceMissingNodes();
            state.links = state.links.filter((link) => nodeById(link.source) && nodeById(link.target));
          } else {
            state.links = normalizeLinks(objects).filter((link) => nodeById(link.source) && nodeById(link.target));
          }
          state.selectedKind = null;
          state.selectedId = null;
          persist();
          render();
          showToast(kind === "nodes" ? "Nodes table imported." : "Links table imported.");
        } catch (error) {
          showToast("Could not import that table.");
        }
      };
      reader.readAsText(file);
      event.target.value = "";
    }

    function rowsToObjects(rows) {
      const headers = rows[0].map((header) => String(header).trim());
      return rows.slice(1).map((row) => {
        const object = {};
        headers.forEach((header, index) => {
          object[header] = row[index] ?? "";
        });
        return object;
      });
    }

    function parseDelimited(text) {
      const delimiter = text.includes("\t") && !text.includes(",") ? "\t" : ",";
      const rows = [];
      let row = [];
      let current = "";
      let quoted = false;

      for (let i = 0; i < text.length; i += 1) {
        const char = text[i];
        const next = text[i + 1];

        if (char === '"' && quoted && next === '"') {
          current += '"';
          i += 1;
        } else if (char === '"') {
          quoted = !quoted;
        } else if (char === delimiter && !quoted) {
          row.push(current);
          current = "";
        } else if ((char === "\n" || char === "\r") && !quoted) {
          if (char === "\r" && next === "\n") i += 1;
          row.push(current);
          rows.push(row);
          row = [];
          current = "";
        } else {
          current += char;
        }
      }

      if (current || row.length) {
        row.push(current);
        rows.push(row);
      }

      const filtered = rows.filter((item) => item.some((cell) => String(cell).trim() !== ""));
      if (!filtered.length) return [];
      const headers = filtered[0].map((header) => String(header).trim());
      return filtered.map((row) => {
        while (row.length < headers.length) row.push("");
        return row;
      });
    }
