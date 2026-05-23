// â”€â”€ Canvas math helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function nodeCenter(node) {
  if (node.nodeClass === "transit") {
    return { x: numberValue(node.x) + 50, y: numberValue(node.y) + 50 };
  }
  return {
    x: numberValue(node.x) + NODE_W / 2,
    y: numberValue(node.y) + NODE_H / 2
  };
}

function linkControlPoint(link, x1, y1, x2, y2) {
  const fallback = { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
  return {
    x: Number.isFinite(Number(link.controlX)) ? numberValue(link.controlX) : fallback.x,
    y: Number.isFinite(Number(link.controlY)) ? numberValue(link.controlY) : fallback.y
  };
}

// Returns the point where a ray from (cx,cy) in direction (dx,dy) exits a rectangle
// with half-dimensions (hw, hh). Used for precise arrow-to-node edge connection.
function rectEdgePoint(cx, cy, dx, dy, hw, hh) {
  const tx = Math.abs(dx) > 1e-9 ? hw / Math.abs(dx) : Infinity;
  const ty = Math.abs(dy) > 1e-9 ? hh / Math.abs(dy) : Infinity;
  const t = Math.min(tx, ty);
  return { x: cx + dx * t, y: cy + dy * t };
}

// â”€â”€ SVG layer rendering â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function marker(id, color) {
  return `
    <marker id="${id}" markerWidth="8" markerHeight="8" refX="7.3" refY="4" orient="auto" markerUnits="strokeWidth">
      <path d="M 0 0 L 8 4 L 0 8 z" fill="${color}"></path>
    </marker>
  `;
}

function renderLinks() {
  const defs = `
    <defs>
      ${marker("arrow-default", "#8c97a3")}
      ${marker("arrow-ok", "#16805f")}
      ${marker("arrow-warning", "#b46b00")}
      ${marker("arrow-critical", "#c23b3b")}
      ${marker("arrow-blocked", "#7b4ab8")}
    </defs>
  `;

  const links = state.links.map((link) => {
    const source = nodeById(link.source);
    const target = nodeById(link.target);
    if (!source || !target) return "";

    const start = nodeCenter(source);
    const end = nodeCenter(target);
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    let x1, y1, x2, y2;
    if (source.nodeClass === "transit") {
      x1 = start.x + cosA * 50; y1 = start.y + sinA * 50;
    } else {
      const ep = rectEdgePoint(start.x, start.y, cosA, sinA, NODE_W / 2, NODE_H / 2);
      x1 = ep.x; y1 = ep.y;
    }
    if (target.nodeClass === "transit") {
      x2 = end.x - cosA * 50; y2 = end.y - sinA * 50;
    } else {
      const ep = rectEdgePoint(end.x, end.y, -cosA, -sinA, NODE_W / 2, NODE_H / 2);
      x2 = ep.x; y2 = ep.y;
    }
    const control = linkControlPoint(link, x1, y1, x2, y2);
    const status = cssStatus(link.status);
    const selected = state.selectedKind === "link" && state.selectedId === link.id ? " selected" : "";
    const path = `M ${x1} ${y1} Q ${control.x} ${control.y} ${x2} ${y2}`;
    const badgeText = linkBadgeText(link);
    const pillWidth = Math.max(42, badgeText.length * 7 + 14);
    const badgeMidX = 0.25 * x1 + 0.5 * control.x + 0.25 * x2;
    const badgeMidY = 0.25 * y1 + 0.5 * control.y + 0.25 * y2;
    const pillCls = "wip-pill";
    const badge = badgeText ? `
        <g class="${pillCls}" data-wip-link-id="${escapeAttr(link.id)}" transform="translate(${badgeMidX} ${badgeMidY - 10})">
          <rect x="${-pillWidth / 2}" y="-12" width="${pillWidth}" height="24" rx="8"></rect>
          <text x="0" y="1">${escapeHtml(badgeText)}</text>
        </g>
    ` : "";

    return `
      <g class="link" data-link-id="${escapeAttr(link.id)}">
        <path class="link-hit" d="${path}"></path>
        <path class="link-line ${status}${selected}" d="${path}"></path>
        ${badge}
      </g>
    `;
  }).join("");

  linkLayer.innerHTML = defs + links;
}

function linkBadgeText(link) {
  const flow = computeLinkFlow(link);
  const parts = [];
  if (flow !== null) parts.push(flow + " units");
  if (state.finalFields.linkLabel && link.label) parts.push(link.label);
  if (!parts.length) return link.movCode ? "Mv" + link.movCode : (link.label || "");
  return parts.join(" Â· ");
}

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
      if (inLinks.some(l => partCodes.has(l.movCode))) {
        hlNodes.add(n.id);
      }
    });
  }
  nodeLayer.innerHTML = state.nodes.map((node) => {
    const selected = state.selectedKind === "node" && state.selectedId === node.id ? " selected" : "";
    const multiSel = state.multiSelectedIds.includes(node.id) ? " multi-selected" : "";
    const source = state.connectionSource === node.id ? " connection-source" : "";
    const partCls = hlNodes ? (hlNodes.has(node.id) ? " part-highlight" : " part-dimmed") : "";
    const isEditable = state.initStockMode ? " init-stock-selectable" : "";
    const ncCls = node.nodeClass ? " nc-" + node.nodeClass : "";
    const status = cssStatus(node.status);
    const meta = nodeMetaText(node);
    const inv = nodeInventory(node);
    const metrics = nodeCardMetrics(node, inv);
    const baseAttrs = `data-node-id="${escapeAttr(node.id)}" style="--x:${numberValue(node.x)}px;--y:${numberValue(node.y)}px"`;

    if (node.nodeClass === "transit") {
      return `
        <div class="node nc-transit ${status}${selected}${multiSel}${source}${partCls}${isEditable}" ${baseAttrs}>
          <span class="status-dot"></span>
          <div class="node-title" title="${escapeAttr(node.label)}">${escapeHtml(node.label)}</div>
          ${inv !== 0 ? `<div class="transit-inv">${inv}</div>` : ""}
        </div>
      `;
    }

    return `
      <div class="node ${status}${selected}${multiSel}${source}${partCls}${isEditable}${ncCls}" ${baseAttrs}>
        <div class="node-top">
          <span class="status-dot"></span>
          <div class="node-title" title="${escapeAttr(node.label)}">${escapeHtml(node.label)}</div>
          ${node.nodeClass === "compound" ? `<span class="nc-badge">&#9654;&#9654;</span>` : ""}
        </div>
        ${meta ? `<div class="node-type">${escapeHtml(meta)}</div>` : ""}
        ${metrics.length ? `<div class="node-metrics">${metrics.map((metric) => `
          <div class="node-metric${metric.neg ? " neg-inv" : ""}${metric.cls ? " " + metric.cls : ""}"><span>${escapeHtml(metric.label)}</span><strong>${escapeHtml(String(metric.value))}</strong></div>
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
  if (!state.finalMode || state.finalFields.nodeType) parts.push(node.type || "Station");
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

  if (nc === "ledger") {
    const vals = nodeLedgerValues(node);
    return Object.entries(vals).map(([k, v]) => ({ label: k, value: v }));
  }

  if (nc === "register") {
    const vals = nodeRegisterValues(node);
    if (!vals) return [{ label: "â€”", value: "No data" }];
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
    const count = (node.innerNodes || []).length;
    return [{ label: "Nodes", value: count }, { label: "Links", value: (node.innerLinks || []).length }];
  }

  if (!state.finalMode) {
    const invVal = inv !== undefined ? inv : nodeInventory(node);
    const chips = [];
    if (invVal !== 0) chips.push({ label: "Inv", value: invVal, neg: invVal < 0 });
    return chips;
  }

  const inv2 = inv !== undefined ? inv : nodeInventory(node);
  const metrics = [];
  if (state.finalFields.nodeWip) metrics.push({ label: "Inv", value: inv2, neg: inv2 < 0 });
  if (state.finalFields.nodeOwner) metrics.push({ label: "Owner", value: node.owner || "-" });
  if (state.finalFields.nodeLocation) metrics.push({ label: "Loc", value: node.location || "-" });
  return metrics;
}

// â”€â”€ Groups â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function groupBoundingBox(group) {
  const nodes = (group.nodeIds || []).map(nodeById).filter(Boolean);
  if (!nodes.length) return null;
  const PX = 22, PY = 28;
  const xs = nodes.map(n => numberValue(n.x));
  const ys = nodes.map(n => numberValue(n.y));
  const x = Math.min(...xs) - PX;
  const y = Math.min(...ys) - PY;
  const w = Math.max(...xs) + NODE_W - Math.min(...xs) + PX * 2;
  const h = Math.max(...ys) + NODE_H - Math.min(...ys) + PY + 22;
  return { x, y, w, h };
}

function renderGroups() {
  if (!state.groups || !state.groups.length) { groupLayer.innerHTML = ""; return; }
  groupLayer.innerHTML = state.groups.map(group => {
    const bbox = groupBoundingBox(group);
    if (!bbox) return "";
    const color = group.color || "#7fb4ff";
    const labelW = Math.min(bbox.w - 4, (group.label.length) * 8 + 20);
    const isSelected = state.selectedKind === "group" && state.selectedId === group.id;
    return `
      <g class="group-box" data-group-id="${escapeAttr(group.id)}">
        <rect x="${bbox.x}" y="${bbox.y}" width="${bbox.w}" height="${bbox.h}" rx="12"
          fill="${color}1a" stroke="${color}" stroke-width="${isSelected ? 3 : 2}" stroke-dasharray="8 4"/>
        <rect x="${bbox.x + 2}" y="${bbox.y - 1}" width="${labelW}" height="20" rx="5" fill="${color}dd"/>
        <text class="group-label" x="${bbox.x + 10}" y="${bbox.y + 13}">${escapeHtml(group.label)}</text>
      </g>
    `;
  }).join("");

  groupLayer.querySelectorAll(".group-box").forEach(el => {
    el.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      if (state.tool === "delete") {
        state.groups = state.groups.filter(g => g.id !== el.dataset.groupId);
        persist(); render(); return;
      }
      selectItem("group", el.dataset.groupId);
    });
  });
}

