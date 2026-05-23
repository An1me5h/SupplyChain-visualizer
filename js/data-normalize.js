// -- Node and link normalization on import

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
    const typeMap   = { "Transit": "transit" };
    const nc = ["source","end","compound","ledger","register","consumption","transit"].includes(node.nodeClass)
      ? node.nodeClass
      : (typeMap[node.type] || "");

    // Migrate old source/end format: matchColumn was the lookup column, nodeCode was the identifier value
    let resolvedNodeCode = node.nodeCode || node.storageLoc || "";
    let extraFilters = Array.isArray(node.extraFilters)
      ? node.extraFilters.filter(f => f && typeof f === "object").map(f => ({ column: String(f.column || ""), value: String(f.value || "") }))
      : [];
    if ((nc === "source" || nc === "end") && node.matchColumn && !extraFilters.length) {
      extraFilters = [{ column: node.matchColumn, value: resolvedNodeCode }];
      resolvedNodeCode = "";
    }

    return {
      id,
      label:           node.label || node.name || id,
      type:            node.type || "Station",
      status:          cssStatus(node.status || "ok"),
      x:               numberValue(node.x, 90 + index * 220),
      y:               numberValue(node.y, 140 + (index % 3) * 150),
      owner:           node.owner || "",
      location:        node.location || "",
      nodeCode:        resolvedNodeCode,
      extraFilters,
      color:           node.color || "",
      defects:         numberValue(node.defects),
      description:     node.description || "",
      initStock,
      rules,
      nodeClass:       nc,
      innerNodes:      Array.isArray(node.innerNodes)  ? node.innerNodes  : [],
      innerLinks:      Array.isArray(node.innerLinks)  ? node.innerLinks  : [],
      innerGroups:     Array.isArray(node.innerGroups) ? node.innerGroups : [],
      ledgerMovCodes:  node.ledgerMovCodes || "",
      ledgerColumns:   Array.isArray(node.ledgerColumns)   ? node.ledgerColumns   : [],
      registerMovCodes:node.registerMovCodes || "",
      registerColumns: Array.isArray(node.registerColumns) ? node.registerColumns : [],
      bomOutputPart:   node.bomOutputPart || "",
      bomMovCodes:     node.bomMovCodes || "",
      bom:             Array.isArray(node.bom) ? node.bom : []
    };
  });
}

function normalizeLinks(links) {
  return links.filter(Boolean).map((link, index) => ({
    id:       link.id || uniqueId("link_" + (index + 1)),
    source:   String(link.source || "").trim(),
    target:   String(link.target || "").trim(),
    label:    link.label || "",
    status:   cssStatus(link.status || "ok"),
    controlX: Number.isFinite(Number(link.controlX)) ? numberValue(link.controlX) : undefined,
    controlY: Number.isFinite(Number(link.controlY)) ? numberValue(link.controlY) : undefined,
    movCode:      link.movCode      || "",
    matchColumn:  link.matchColumn  || "",
    matchValue:   link.matchValue   || "",
    color:        link.color        || "",
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

// -- Raw data utilities

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
  const colRef   = valueRaw.match(/^\[!(.+)\]$/);
  return {
    column:     m[1].trim(),
    isColRef:   !!colRef,
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
