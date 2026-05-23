// -- Node inventory and special-class calculation helpers

function nodeInitStock(node) {
  const map = node.initStock || {};
  if (state.highlightPart && state.partColumn) {
    return numberValue(map[state.highlightPart]) || 0;
  }
  return Object.values(map).reduce((s, v) => s + numberValue(v), 0);
}

function nodeInventory(node) {
  const inLinks  = state.links.filter(l => l.target === node.id && l.movCode);
  const outLinks = state.links.filter(l => l.source === node.id && l.movCode);
  const base = nodeInitStock(node);
  if (!state.rawData.length || !state.movColumn || (!inLinks.length && !outLinks.length)) return base;

  if (node.nodeClass === "source") {
    let sent = 0;
    state.rawData.forEach(row => {
      if (!rowBeforeOrOnDate(row)) return;
      if (!rowMatchesPart(row)) return;
      const qty = state.qtyColumn ? (numberValue(row[state.qtyColumn]) || 1) : 1;
      for (const l of outLinks) { if (rowMatchesLink(row, l)) { sent += qty; break; } }
    });
    return sent;
  }

  if (node.nodeClass === "end") {
    let arrived = 0;
    state.rawData.forEach(row => {
      if (!rowBeforeOrOnDate(row)) return;
      if (!rowMatchesPart(row)) return;
      const qty = state.qtyColumn ? (numberValue(row[state.qtyColumn]) || 1) : 1;
      for (const l of inLinks) { if (rowMatchesLink(row, l)) { arrived += qty; break; } }
    });
    return arrived;
  }

  let inv = base;
  state.rawData.forEach(row => {
    if (!rowBeforeOrOnDate(row)) return;
    if (!rowMatchesPart(row)) return;
    const qty = state.qtyColumn ? (numberValue(row[state.qtyColumn]) || 1) : 1;
    for (const l of inLinks)  { if (rowMatchesLink(row, l)) { inv += qty; break; } }
    for (const l of outLinks) { if (rowMatchesLink(row, l)) { inv -= qty; break; } }
  });
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
  const movCodes   = node.bomMovCodes ? node.bomMovCodes.split(",").map(s => s.trim()).filter(Boolean) : [];
  const outputPart = (node.bomOutputPart || "").trim();
  const bom        = Array.isArray(node.bom) ? node.bom : [];
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
  state.rawData.forEach(row => {
    if (!rowBeforeOrOnDate(row)) return;
    const code = String(row[state.movColumn] || "").trim();
    if (!codeSet.has(code)) return;
    latest = row;
  });
  if (!latest) return null;
  const result = {};
  cols.forEach(c => { result[c] = latest[c] ?? "-"; });
  return result;
}

// Inventory time series for one part on one date (48 half-hour slots)
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

  // Rows for target date sorted by time
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
      const rt  = normalizeTime(state.timeColumn ? row[state.timeColumn] : "");
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
