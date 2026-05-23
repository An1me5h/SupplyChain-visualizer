// ── Row filter helpers ────────────────────────────────────────────────────────

function rowTimeOk(row) {
  if (!state.timeColumn) return true;
  const rowTime = normalizeTime(row[state.timeColumn]);
  if (!rowTime) return true;
  return rowTime <= slotToTime(state.selectedTimeSlot);
}

function rowMatchesDate(row) {
  if (!state.dateColumn || !state.selectedDate) return true;
  const raw = String(row[state.dateColumn] || "").trim().slice(0, 10);
  if (raw !== state.selectedDate) return false;
  return rowTimeOk(row);
}

function rowBeforeOrOnDate(row) {
  if (!state.dateColumn || !state.selectedDate) return true;
  const raw = String(row[state.dateColumn] || "").trim().slice(0, 10);
  if (!raw) return true;
  if (raw < state.selectedDate) return true;
  if (raw > state.selectedDate) return false;
  return rowTimeOk(row);
}

function rowMatchesPart(row) {
  if (!state.highlightPart || !state.partColumn) return true;
  return String(row[state.partColumn] || "").trim() === state.highlightPart;
}

// ── Node stock / inventory helpers ───────────────────────────────────────────

function nodeInitStock(node) {
  const map = node.initStock || {};
  if (state.highlightPart && state.partColumn) {
    return numberValue(map[state.highlightPart]) || 0;
  }
  return Object.values(map).reduce((s, v) => s + numberValue(v), 0);
}

function rowMatchesLink(row, link) {
  const code = String(row[state.movColumn] || "").trim();
  if (code !== link.movCode) return false;
  // Match source node — transit nodes are transparent (they have no SLoc of their own)
  const srcNode = nodeById(link.source);
  if (srcNode && srcNode.nodeClass !== "transit") {
    const srcColName = srcNode.matchColumn || state.srcSlocColumn;
    if (srcColName) {
      const nodeCode = (srcNode.nodeCode || "").trim();
      const rowSrc   = String(row[srcColName] || "").trim();
      if (nodeCode) {
        if (rowSrc !== nodeCode) return false;
      } else {
        const otherCodes = new Set(
          state.nodes.filter(n => n.id !== link.source && n.nodeCode && n.nodeClass !== "transit")
                     .map(n => n.nodeCode.trim())
        );
        if (otherCodes.has(rowSrc)) return false;
      }
    }
  }
  // Match target node — transit nodes are transparent
  const dstNode = nodeById(link.target);
  if (dstNode && dstNode.nodeClass !== "transit") {
    const dstColName = dstNode.matchColumn || state.dstSlocColumn;
    if (dstColName) {
      const nodeCode = (dstNode.nodeCode || "").trim();
      const rowDst   = String(row[dstColName] || "").trim();
      if (nodeCode) {
        if (rowDst !== nodeCode) return false;
      } else {
        const otherCodes = new Set(
          state.nodes.filter(n => n.id !== link.target && n.nodeCode && n.nodeClass !== "transit")
                     .map(n => n.nodeCode.trim())
        );
        if (otherCodes.has(rowDst)) return false;
      }
    }
  }
  return true;
}

function resolveRealCounterpart(row, link, dir, depth = 0) {
  if (depth > 10) return null; // cycle guard
  const nodeId = dir === "In" ? link.source : link.target;
  const node   = nodeById(nodeId);
  if (!node || node.nodeClass !== "transit") return node;
  // Node is transit — follow the chain one more hop in the same direction
  const nextLinks = dir === "In"
    ? state.links.filter(l => l.target === nodeId && l.movCode === link.movCode)
    : state.links.filter(l => l.source === nodeId && l.movCode === link.movCode);
  const nextLink = nextLinks.find(l => rowMatchesLink(row, l));
  if (!nextLink) return node; // no further link found — fall back to transit label
  return resolveRealCounterpart(row, nextLink, dir, depth + 1);
}

function nodeInventory(node) {
  const inLinks  = state.links.filter(l => l.target === node.id && l.movCode);
  const outLinks = state.links.filter(l => l.source === node.id && l.movCode);
  const base = nodeInitStock(node);
  if (!state.rawData.length || !state.movColumn || (!inLinks.length && !outLinks.length)) return base;
  let inv = base;
  state.rawData.forEach(row => {
    if (!rowBeforeOrOnDate(row)) return;
    if (!rowMatchesPart(row)) return;
    const qty = state.qtyColumn ? (numberValue(row[state.qtyColumn]) || 1) : 1;
    for (const l of inLinks)  { if (rowMatchesLink(row, l)) { inv += qty; break; } }
    for (const l of outLinks) { if (rowMatchesLink(row, l)) { inv -= qty; break; } }
  });
  // Source node: always show as positive (they push out, so raw value is negative)
  if (node.nodeClass === "source") return Math.abs(inv);
  return inv;
}

function nodeReturnQty(node) {
  if (node.nodeClass !== "source") return 0;
  const inLinks = state.links.filter(l => l.target === node.id && l.movCode);
  if (!inLinks.length || !state.rawData.length || !state.movColumn) return 0;
  let total = 0;
  state.rawData.forEach(row => {
    if (!rowBeforeOrOnDate(row)) return;
    if (!rowMatchesPart(row)) return;
    for (const l of inLinks) {
      if (rowMatchesLink(row, l)) { total += state.qtyColumn ? (numberValue(row[state.qtyColumn]) || 1) : 1; break; }
    }
  });
  return total;
}

function nodeConsumptionValues(node) {
  if (node.nodeClass !== "consumption") return { produced: 0, consumed: {}, remaining: {} };
  const movCodes  = node.bomMovCodes ? node.bomMovCodes.split(",").map(s => s.trim()).filter(Boolean) : [];
  const outputPart = (node.bomOutputPart || "").trim();
  const bom = Array.isArray(node.bom) ? node.bom : [];
  if (!movCodes.length || !outputPart || !state.rawData.length || !state.movColumn) {
    return { produced: 0, consumed: {}, remaining: {} };
  }
  const codeSet = new Set(movCodes);
  let produced = 0;
  state.rawData.forEach(row => {
    if (!rowBeforeOrOnDate(row)) return;
    const code = String(row[state.movColumn] || "").trim();
    if (!codeSet.has(code)) return;
    if (state.partColumn && String(row[state.partColumn] || "").trim() !== outputPart) return;
    produced += state.qtyColumn ? (numberValue(row[state.qtyColumn]) || 1) : 1;
  });
  const consumed = {}, remaining = {};
  bom.forEach(({ inputPart, qty }) => {
    if (!inputPart) return;
    const bomQty = numberValue(qty) || 1;
    const used   = produced * bomQty;
    const init   = numberValue((node.initStock || {})[inputPart]) || 0;
    consumed[inputPart]  = used;
    remaining[inputPart] = init - used;
  });
  return { produced, consumed, remaining };
}

function nodeLedgerValues(node) {
  if (node.nodeClass !== "ledger") return {};
  const codes = node.ledgerMovCodes ? node.ledgerMovCodes.split(",").map(s => s.trim()).filter(Boolean) : [];
  const cols  = Array.isArray(node.ledgerColumns) ? node.ledgerColumns : [];
  if (!codes.length || !cols.length || !state.rawData.length || !state.movColumn) return {};
  const codeSet = new Set(codes);
  const totals = {};
  cols.forEach(c => { totals[c] = 0; });
  state.rawData.forEach(row => {
    if (!rowBeforeOrOnDate(row)) return;
    if (!rowMatchesPart(row)) return;
    const code = String(row[state.movColumn] || "").trim();
    if (!codeSet.has(code)) return;
    cols.forEach(c => { totals[c] += numberValue(row[c]) || 0; });
  });
  return totals;
}

function nodeRegisterValues(node) {
  if (node.nodeClass !== "register") return null;
  const codes = node.registerMovCodes ? node.registerMovCodes.split(",").map(s => s.trim()).filter(Boolean) : [];
  const cols  = Array.isArray(node.registerColumns) ? node.registerColumns : [];
  if (!codes.length || !cols.length || !state.rawData.length || !state.movColumn) return null;
  const codeSet = new Set(codes);
  let latest = null;
  // rawData is sorted by date+time — last matching row is the latest
  state.rawData.forEach(row => {
    if (!rowBeforeOrOnDate(row)) return;
    const code = String(row[state.movColumn] || "").trim();
    if (!codeSet.has(code)) return;
    latest = row;
  });
  if (!latest) return null;
  const result = {};
  cols.forEach(c => { result[c] = latest[c] ?? "—"; });
  return result;
}

// Compute inventory time series for one part on one date (48 half-hour slots)
function nodeInventoryTimeSeries(node, part, date) {
  if (!state.rawData.length || !state.movColumn || !date) return Array(48).fill(0);
  const inLinks  = state.links.filter(l => l.target === node.id && l.movCode);
  const outLinks = state.links.filter(l => l.source === node.id && l.movCode);
  const initVal  = numberValue((node.initStock || {})[part]) || 0;

  function matchesPart(row) {
    if (!part || !state.partColumn) return true;
    return String(row[state.partColumn] || "").trim() === part;
  }

  // Base: cumulative from all rows BEFORE the target date
  let base = initVal;
  state.rawData.forEach(row => {
    const d = String(row[state.dateColumn] || "").trim().slice(0, 10);
    if (!d || d >= date) return;
    if (!matchesPart(row)) return;
    const qty = state.qtyColumn ? (numberValue(row[state.qtyColumn]) || 1) : 1;
    for (const l of inLinks)  { if (rowMatchesLink(row, l)) { base += qty; break; } }
    for (const l of outLinks) { if (rowMatchesLink(row, l)) { base -= qty; break; } }
  });

  // Rows for target date that match this node, sorted by time
  const dayRows = state.rawData
    .filter(row => {
      const d = String(row[state.dateColumn] || "").trim().slice(0, 10);
      if (d !== date || !matchesPart(row)) return false;
      return inLinks.some(l => rowMatchesLink(row, l)) || outLinks.some(l => rowMatchesLink(row, l));
    })
    .sort((a, b) => {
      const ta = normalizeTime(state.timeColumn ? a[state.timeColumn] : "");
      const tb = normalizeTime(state.timeColumn ? b[state.timeColumn] : "");
      return ta < tb ? -1 : ta > tb ? 1 : 0;
    });

  const series = Array(48).fill(0);
  let running = base;
  let ri = 0;
  for (let slot = 0; slot < 48; slot++) {
    const slotTime = slotToTime(slot);
    while (ri < dayRows.length) {
      const row = dayRows[ri];
      const rt = normalizeTime(state.timeColumn ? row[state.timeColumn] : "");
      if (rt && rt > slotTime) break;
      const qty = state.qtyColumn ? (numberValue(row[state.qtyColumn]) || 1) : 1;
      for (const l of inLinks)  { if (rowMatchesLink(row, l)) { running += qty; break; } }
      for (const l of outLinks) { if (rowMatchesLink(row, l)) { running -= qty; break; } }
      ri++;
    }
    series[slot] = running;
  }
  return series;
}

// ── Node graph helpers ────────────────────────────────────────────────────────

function getPartsAtNode(node) {
  if (!state.rawData.length || !state.movColumn || !state.partColumn) return [];
  const inLinks  = state.links.filter(l => l.target === node.id && l.movCode);
  const outLinks = state.links.filter(l => l.source === node.id && l.movCode);
  if (!inLinks.length && !outLinks.length) return [];
  const parts = new Set();
  state.rawData.forEach(row => {
    const matched = inLinks.some(l => rowMatchesLink(row, l)) || outLinks.some(l => rowMatchesLink(row, l));
    if (!matched) return;
    const part = String(row[state.partColumn] || "").trim();
    if (part) parts.add(part);
  });
  return Array.from(parts).sort();
}

function getNodePredecessors(nodeId) {
  return state.links
    .filter(l => l.target === nodeId)
    .map(l => nodeById(l.source))
    .filter(Boolean);
}

function getNodeSuccessors(nodeId) {
  return state.links
    .filter(l => l.source === nodeId)
    .map(l => nodeById(l.target))
    .filter(Boolean);
}

// ── Data list helpers ─────────────────────────────────────────────────────────

function getPartsList() {
  if (!state.rawData.length || !state.partColumn) return [];
  const seen = new Set();
  state.rawData.forEach(row => {
    const v = String(row[state.partColumn] || "").trim();
    if (v) seen.add(v);
  });
  return Array.from(seen).sort().map(v => ({ value: v, label: v }));
}

function getDataDates() {
  if (!state.rawData.length || !state.dateColumn) return [];
  const seen = new Set();
  state.rawData.forEach(row => {
    const d = String(row[state.dateColumn] || "").trim().slice(0, 10);
    if (d) seen.add(d);
  });
  return Array.from(seen).sort();
}

// ── Node/link normalization ───────────────────────────────────────────────────

function normalizeNodes(nodes) {
  return nodes.filter(Boolean).map((node, index) => {
    const id = node.id ? String(node.id).trim() : uniqueId("node_" + (index + 1));
    let rules = "";
    if (typeof node.rules === "string") {
      rules = node.rules;
    } else if (Array.isArray(node.rules) && node.rules.length) {
      rules = node.rules
        .filter(r => r.filterCol && r.filterValue && r.targetNode)
        .map(r => `IF [!${r.filterCol}] IS_EQUAL_TO ${r.filterValue} THEN "${r.targetNode}"`)
        .join("\n");
    }
    const initStock = (node.initStock && typeof node.initStock === "object") ? node.initStock : {};
    const typeMap = { "Transit": "transit" };
    const nc = ["source","compound","ledger","register","consumption","transit"].includes(node.nodeClass)
      ? node.nodeClass
      : (typeMap[node.type] || "");
    return {
      id,
      label: node.label || node.name || id,
      type: node.type || "Station",
      status: cssStatus(node.status || "ok"),
      x: numberValue(node.x, 90 + index * 220),
      y: numberValue(node.y, 140 + (index % 3) * 150),
      owner: node.owner || "",
      location: node.location || "",
      nodeCode: node.nodeCode || node.storageLoc || "",
      matchColumn: node.matchColumn || "",
      defects: numberValue(node.defects),
      description: node.description || "",
      initStock,
      rules,
      nodeClass: nc,
      innerNodes: Array.isArray(node.innerNodes) ? node.innerNodes : [],
      innerLinks: Array.isArray(node.innerLinks) ? node.innerLinks : [],
      innerGroups: Array.isArray(node.innerGroups) ? node.innerGroups : [],
      ledgerMovCodes: node.ledgerMovCodes || "",
      ledgerColumns: Array.isArray(node.ledgerColumns) ? node.ledgerColumns : [],
      registerMovCodes: node.registerMovCodes || "",
      registerColumns: Array.isArray(node.registerColumns) ? node.registerColumns : [],
      bomOutputPart: node.bomOutputPart || "",
      bomMovCodes: node.bomMovCodes || "",
      bom: Array.isArray(node.bom) ? node.bom : []
    };
  });
}

function normalizeLinks(links) {
  return links.filter(Boolean).map((link, index) => ({
    id: link.id || uniqueId("link_" + (index + 1)),
    source: String(link.source || "").trim(),
    target: String(link.target || "").trim(),
    label: link.label || "",
    status: cssStatus(link.status || "ok"),
    controlX: Number.isFinite(Number(link.controlX)) ? numberValue(link.controlX) : undefined,
    controlY: Number.isFinite(Number(link.controlY)) ? numberValue(link.controlY) : undefined,
    movCode: link.movCode || "",
    linkType: link.linkType === "transit" ? "transit" : "movement"
  })).filter((link) => link.source && link.target);
}

function autoPlaceMissingNodes() {
  state.nodes.forEach((node, index) => {
    if (!Number.isFinite(Number(node.x)) || !Number.isFinite(Number(node.y))) {
      node.x = 90 + index * 220;
      node.y = 140 + (index % 3) * 150;
    }
  });
}

// ── HTML escaping ─────────────────────────────────────────────────────────────

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

// ── Raw data helpers ──────────────────────────────────────────────────────────

function uniqueMovCodes() {
  if (!state.rawData.length || !state.movColumn) return [];
  const codes = new Set();
  state.rawData.forEach(r => {
    const v = String(r[state.movColumn] || "").trim();
    if (v) codes.add(v);
  });
  return Array.from(codes).sort();
}

function parseRuleLines(text) {
  return (text || "").split("\n")
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith("//") && !line.startsWith("#"));
}

function parseRuleLine(line) {
  const m = line.match(/^IF\s+\[!(.+?)\]\s+IS_EQUAL_TO\s+(.+?)\s+THEN\s+"(.+?)"$/i);
  if (!m) return null;
  const valueRaw = m[2].trim();
  const colRef = valueRaw.match(/^\[!(.+)\]$/);
  return {
    column: m[1].trim(),
    isColRef: !!colRef,
    compareCol: colRef ? colRef[1].trim() : null,
    compareVal: colRef ? null : valueRaw.replace(/^"|"$/g, ""),
    targetNode: m[3].trim()
  };
}

function evaluateRuleLine(line, row) {
  const rule = parseRuleLine(line);
  if (!rule) return null;
  const lhs = String(row[rule.column] || "").trim();
  const rhs = rule.isColRef
    ? String(row[rule.compareCol] || "").trim()
    : rule.compareVal;
  if (lhs !== rhs) return null;
  return rule.targetNode;
}

function computeLinkFlow(link) {
  if (!state.rawData.length || !state.movColumn || !link.movCode) return null;
  let total = 0;
  state.rawData.forEach(row => {
    if (!rowMatchesDate(row)) return;
    if (!rowMatchesPart(row)) return;
    if (!rowMatchesLink(row, link)) return;
    const qty = state.qtyColumn ? (numberValue(row[state.qtyColumn]) || 1) : 1;
    total += qty;
  });
  return total > 0 ? total : null;
}
