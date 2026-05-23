// -- Graph traversal helpers and link flow computation

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

// -- Link flow (sum of qty for matching rows on the current date/part filter)

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
