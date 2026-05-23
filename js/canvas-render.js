// -- SVG arrow markers

function marker(id, color) {
  return `
    <marker id="${id}" markerWidth="5" markerHeight="5" refX="4.5" refY="2.5" orient="auto" markerUnits="strokeWidth">
      <path d="M 0 0 L 5 2.5 L 0 5 z" fill="${color}"></path>
    </marker>
  `;
}

// -- Link rendering
// All nodes use fixed connection ports:
//   source -> right edge midpoint (nodeOutPort)
//   target -> left  edge midpoint (nodeInPort)

const PALETTE_COLORS = [
  "#e05252","#f47a30","#e6a817","#3aaf74","#1ab3a8",
  "#4a9ede","#5a72d4","#8a6de9","#d966a8","#8a8fa8"
];

function renderLinks() {
  const defs = `
    <defs>
      ${marker("arrow-default", "#8c97a3")}
      ${marker("arrow-ok",      "#16805f")}
      ${marker("arrow-warning", "#b46b00")}
      ${marker("arrow-critical","#c23b3b")}
      ${marker("arrow-blocked", "#7b4ab8")}
      ${PALETTE_COLORS.map(c => marker("arrow-" + c.slice(1), c)).join("")}
    </defs>
  `;

  const links = state.links.map((link) => {
    const source = nodeById(link.source);
    const target = nodeById(link.target);
    if (!source || !target) return "";

    const p1 = linkPortOut(link);
    const p2 = linkPortIn(link);
    if (!p1 || !p2) return "";

    const x1 = p1.x, y1 = p1.y;
    const x2 = p2.x, y2 = p2.y;

    const offX = link.curveOffX || 0;
    const offY = link.curveOffY || 0;
    const handleLen = bezierHandleLen(x1, y1, x2, y2);
    const cx1 = x1 + handleLen + offX, cy1 = y1 + offY;
    const cx2 = (p2.isRightIncoming ? x2 + handleLen : x2 - handleLen) + offX, cy2 = y2 + offY;

    const status  = cssStatus(link.status);
    const selected = state.selectedKind === "link" && state.selectedId === link.id ? " selected" : "";
    const path = `M ${x1} ${y1} C ${cx1} ${cy1} ${cx2} ${cy2} ${x2} ${y2}`;
    const customColor = link.color && PALETTE_COLORS.includes(link.color) ? link.color : null;
    const colorStyle  = customColor ? ` style="stroke:${customColor};marker-end:url(#arrow-${customColor.slice(1)})"` : "";

    const badgeText  = linkBadgeText(link);
    const pillWidth  = Math.max(42, badgeText.length * 7 + 14);
    const badgeMidX  = (x1 + 3 * cx1 + 3 * cx2 + x2) / 8;
    const badgeMidY  = (y1 + 3 * cy1 + 3 * cy2 + y2) / 8;
    const badge = badgeText ? `
      <g class="wip-pill" data-wip-link-id="${escapeAttr(link.id)}" transform="translate(${badgeMidX} ${badgeMidY - 10})">
        <rect x="${-pillWidth / 2}" y="-12" width="${pillWidth}" height="24" rx="8"></rect>
        <text x="0" y="1">${escapeHtml(badgeText)}</text>
      </g>
    ` : "";

    return `
      <g class="link" data-link-id="${escapeAttr(link.id)}">
        <path class="link-hit" d="${path}"></path>
        <path class="link-line ${customColor ? "" : status}${selected}" d="${path}"${colorStyle}></path>
        ${badge}
      </g>
    `;
  }).join("");

  linkLayer.innerHTML = defs + links;
  renderPorts();
}

function linkBadgeText(link) {
  const flow = computeLinkFlow(link);
  const parts = [];
  if (flow !== null) parts.push(flow + " units");
  if (state.finalFields.linkLabel && link.label) parts.push(link.label);
  if (!parts.length) return link.movCode ? "Mv" + link.movCode : (link.label || "");
  return parts.join(" - ");
}

function renderPorts() {
  const dots = state.nodes.flatMap(node => {
    const nid = escapeAttr(node.id);
    const outDots = getNodeOutPorts(node).map(p => {
      const pk = escapeAttr(portKey(p));
      const draggable = node.collapsed ? "" : ` data-node-id="${nid}" data-side="out" data-port-key="${pk}"`;
      const dotClass = p.isReturn ? "port-return" : "port-out";
      return `<circle class="port-dot ${dotClass}${node.collapsed ? " port-collapsed" : ""}" cx="${p.x}" cy="${p.y}" r="${PORT_R}"${draggable}/>`;
    });
    const nc = node.nodeClass || "";
    if (nc === "source") return outDots;
    const inDots = getNodeInPorts(node).map(p => {
      const pk = escapeAttr(portKey(p));
      const draggable = node.collapsed ? "" : ` data-node-id="${nid}" data-side="in" data-port-key="${pk}"`;
      return `<circle class="port-dot port-in${node.collapsed ? " port-collapsed" : ""}" cx="${p.x}" cy="${p.y}" r="${PORT_R}"${draggable}/>`;
    });
    return [...inDots, ...outDots];
  });
  portLayer.innerHTML = dots.join("");
}

// -- Node rendering

function renderNodes() {
  const hlPart = state.highlightPart;
  let hlNodes = null;
  if (hlPart && state.rawData.length && state.partColumn && state.movColumn) {
    const partCodes = new Set();
    state.rawData.forEach(row => {
      if (String(row[state.partColumn] || "").trim() !== hlPart) return;
      const code = String(row[state.movColumn] || "").trim();
      if (code) partCodes.add(code);
    });
    hlNodes = new Set();
    state.nodes.forEach(n => {
      const inLinks = state.links.filter(l => l.target === n.id && l.movCode);
      if (inLinks.some(l => partCodes.has(l.movCode))) hlNodes.add(n.id);
    });
  }

  // Render collapsed nodes first so uncollapsed nodes always appear on top.
  const renderOrder = [...state.nodes].sort((a, b) => (a.collapsed ? -1 : 0) - (b.collapsed ? -1 : 0));
  nodeLayer.innerHTML = renderOrder.map((node) => {
    const selected   = state.selectedKind === "node" && state.selectedId === node.id ? " selected" : "";
    const multiSel   = state.multiSelectedIds.includes(node.id) ? " multi-selected" : "";
    const connSrc    = state.connectionSource === node.id ? " connection-source" : "";
    const partCls    = hlNodes ? (hlNodes.has(node.id) ? " part-highlight" : " part-dimmed") : "";
    const isEditable = state.initStockMode ? " init-stock-selectable" : "";
    const ncCls      = node.nodeClass ? " nc-" + node.nodeClass : "";
    const status     = cssStatus(node.status);
    const meta       = nodeMetaText(node);
    const inv        = nodeInventory(node);
    const chips      = nodeCardMetrics(node, inv);
    const nodeColorStyle = node.color ? `;border-color:${node.color}` : "";
    const eff_h = nodeEffectiveHeight(node);
    const heightStyle = eff_h > NODE_H ? `;height:${eff_h}px` : "";
    const collapsedCls = node.collapsed ? " nc-collapsed" : "";
    const collapseIcon = node.collapsed ? "&#9654;" : "&#9660;";
    const collapseTitle = node.collapsed ? "Expand" : "Collapse";
    const collapseBtn = `<button class="node-collapse-btn" data-node-id="${escapeAttr(node.id)}" title="${collapseTitle}">${collapseIcon}</button>`;
    const baseAttrs  = `data-node-id="${escapeAttr(node.id)}" style="--x:${numberValue(node.x)}px;--y:${numberValue(node.y)}px${nodeColorStyle}${heightStyle}"`;

    return `
      <div class="node ${status}${selected}${multiSel}${connSrc}${partCls}${isEditable}${ncCls}${collapsedCls}" ${baseAttrs}>
        <div class="node-top">
          <span class="status-dot"></span>
          <div class="node-title" title="${escapeAttr(node.label)}">${escapeHtml(node.label)}</div>
          ${node.nodeClass === "compound" ? `<span class="nc-badge">&#9654;&#9654;</span>` : collapseBtn}
        </div>
        ${meta ? `<div class="node-type">${escapeHtml(meta)}</div>` : ""}
        ${chips.length ? `<div class="node-metrics">${chips.map((m) => `
          <div class="node-metric${m.neg ? " neg-inv" : ""}${m.cls ? " " + m.cls : ""}">
            <span>${escapeHtml(m.label)}</span><strong>${escapeHtml(String(m.value))}</strong>
          </div>
        `).join("")}</div>` : ""}
      </div>
    `;
  }).join("");

  if (hlNodes) {
    linkLayer.querySelectorAll(".link").forEach(el => {
      const link = linkById(el.dataset.linkId);
      if (!link) return;
      const relevant = hlNodes.has(link.source) && hlNodes.has(link.target);
      el.classList.toggle("part-highlight-link", relevant);
      el.classList.toggle("part-dimmed-link", !relevant);
    });
  } else {
    linkLayer.querySelectorAll(".link").forEach(el => {
      el.classList.remove("part-highlight-link", "part-dimmed-link");
    });
  }
}

function nodeMetaText(node) {
  const parts = [];
  if (!state.finalMode || state.finalFields.nodeType)   parts.push(node.type || "Station");
  if (!state.finalMode || state.finalFields.nodeStatus) parts.push(statusLabel(node.status));
  return parts.join(" / ");
}

function nodeCardMetrics(node, inv) {
  const nc = node.nodeClass || "";

  if (nc === "source") {
    const sent = inv !== undefined ? inv : nodeInventory(node);
    const ret  = nodeReturnQty(node);
    const chips = [];
    if (sent !== 0) chips.push({ label: "Sent", value: sent, neg: false });
    if (ret  !== 0) chips.push({ label: "Returns", value: ret, cls: "return-chip" });
    return chips;
  }

  if (nc === "end") {
    const arrived = inv !== undefined ? inv : nodeInventory(node);
    if (arrived !== 0) return [{ label: "Arrived", value: arrived }];
    return [];
  }

  if (nc === "ledger") {
    const vals = nodeLedgerValues(node);
    return Object.entries(vals).map(([k, v]) => ({ label: k, value: v }));
  }

  if (nc === "register") {
    const vals = nodeRegisterValues(node);
    if (!vals) return [{ label: "-", value: "No data" }];
    return Object.entries(vals).map(([k, v]) => ({ label: k, value: String(v) }));
  }

  if (nc === "consumption") {
    const { produced, remaining } = nodeConsumptionValues(node);
    const chips = [];
    if (node.bomOutputPart) chips.push({ label: node.bomOutputPart, value: produced + " made" });
    Object.entries(remaining).slice(0, 3).forEach(([part, qty]) => {
      chips.push({ label: part, value: qty, neg: qty < 0 });
    });
    return chips;
  }

  if (nc === "compound") {
    return [
      { label: "Nodes", value: (node.innerNodes || []).length },
      { label: "Links", value: (node.innerLinks || []).length }
    ];
  }

  if (!state.finalMode) {
    const invVal = inv !== undefined ? inv : nodeInventory(node);
    if (invVal !== 0) return [{ label: "Inv", value: invVal, neg: invVal < 0 }];
    return [];
  }

  const inv2 = inv !== undefined ? inv : nodeInventory(node);
  const result = [];
  if (state.finalFields.nodeWip)      result.push({ label: "Inv",   value: inv2,              neg: inv2 < 0 });
  if (state.finalFields.nodeOwner)    result.push({ label: "Owner", value: node.owner    || "-" });
  if (state.finalFields.nodeLocation) result.push({ label: "Loc",   value: node.location || "-" });
  return result;
}
