// -- Canvas math helpers

function nodeCenter(node) {
  return { x: numberValue(node.x) + NODE_W / 2, y: numberValue(node.y) + NODE_H / 2 };
}

function linkControlPoint(link, x1, y1, x2, y2) {
  const fallback = { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
  return {
    x: Number.isFinite(Number(link.controlX)) ? numberValue(link.controlX) : fallback.x,
    y: Number.isFinite(Number(link.controlY)) ? numberValue(link.controlY) : fallback.y
  };
}

function rectEdgePoint(cx, cy, dx, dy, hw, hh) {
  const tx = Math.abs(dx) > 1e-9 ? hw / Math.abs(dx) : Infinity;
  const ty = Math.abs(dy) > 1e-9 ? hh / Math.abs(dy) : Infinity;
  const t = Math.min(tx, ty);
  return { x: cx + dx * t, y: cy + dy * t };
}

// -- Port system

const PORT_SPACING = 24;
const PORT_R = 5;
const COLLAPSED_H = 36;

// portKey includes an "r:" prefix for return-side ports on source nodes so they
// stay distinct from same-movCode outgoing ports.
function portKey(port) {
  const prefix = port.isReturn ? 'r:' : '';
  return prefix + (port.movCode ? 'mc:' + port.movCode : 'id:' + port.linkIds[0]);
}

function groupLinksByPort(links) {
  const seen = new Map();
  const groups = [];
  links.forEach(link => {
    const key = link.movCode ? 'mc:' + link.movCode : 'id:' + link.id;
    if (!seen.has(key)) {
      const g = { movCode: link.movCode || null, linkIds: [] };
      seen.set(key, g);
      groups.push(g);
    }
    seen.get(key).linkIds.push(link.id);
  });
  return groups;
}

function sortPortGroups(groups, portOrder) {
  if (!portOrder || !portOrder.length) return groups;
  const ordered = [];
  portOrder.forEach(key => {
    const g = groups.find(g => portKey(g) === key);
    if (g) ordered.push(g);
  });
  groups.forEach(g => {
    if (!portOrder.includes(portKey(g))) ordered.push(g);
  });
  return ordered;
}

// Count distinct port slots on the busiest side (for height computation).
function portCountForHeight(node) {
  if (node.collapsed) return 1;
  const nc = node.nodeClass || "";
  const outLinks = state.links.filter(l => l.source === node.id);
  if (nc === "source") {
    const retLinks = state.links.filter(l => l.target === node.id);
    // Out and return groups are kept separate — count them independently.
    return Math.max(groupLinksByPort(outLinks).length + groupLinksByPort(retLinks).length, 1);
  }
  const inLinks = state.links.filter(l => l.target === node.id);
  return Math.max(
    groupLinksByPort(outLinks).length,
    groupLinksByPort(inLinks).length,
    1
  );
}

function nodeEffectiveHeight(node) {
  if (node.collapsed) return COLLAPSED_H;
  const n = portCountForHeight(node);
  return Math.max(NODE_H, (n - 1) * PORT_SPACING + 32);
}

// Right edge midpoint — fallback when there are no outgoing links.
function nodeOutPort(node) {
  const eff_h = nodeEffectiveHeight(node);
  return { x: numberValue(node.x) + NODE_W, y: numberValue(node.y) + eff_h / 2 };
}

// Left edge midpoint — fallback when there are no incoming links.
function nodeInPort(node) {
  const eff_h = nodeEffectiveHeight(node);
  return { x: numberValue(node.x), y: numberValue(node.y) + eff_h / 2 };
}

// Right-side ports for source nodes: out-groups first, then return-groups.
// Each group is tagged with isReturn so rendering and hit-testing can tell them apart.
function getNodeRightPorts(node) {
  const outLinks = state.links.filter(l => l.source === node.id);
  const retLinks = state.links.filter(l => l.target === node.id);
  if (!outLinks.length && !retLinks.length) return [];

  const eff_h = nodeEffectiveHeight(node);
  const nx = numberValue(node.x) + NODE_W;
  const ny = numberValue(node.y) + eff_h / 2;

  if (node.collapsed) {
    const allIds = [...outLinks, ...retLinks].map(l => l.id);
    return [{ movCode: null, linkIds: allIds, isReturn: false, x: nx, y: ny }];
  }

  const outGroups = groupLinksByPort(outLinks).map(g => ({ ...g, isReturn: false }));
  const retGroups = groupLinksByPort(retLinks).map(g => ({ ...g, isReturn: true }));
  let groups = sortPortGroups([...outGroups, ...retGroups], node.portOrderOut);

  const totalH = (groups.length - 1) * PORT_SPACING;
  const startY = ny - totalH / 2;
  return groups.map((g, i) => ({
    movCode: g.movCode, linkIds: g.linkIds, isReturn: g.isReturn,
    x: nx, y: startY + i * PORT_SPACING
  }));
}

function getNodeOutPorts(node) {
  if ((node.nodeClass || "") === "source") return getNodeRightPorts(node);
  const outLinks = state.links.filter(l => l.source === node.id);
  if (!outLinks.length) return [];
  const eff_h = nodeEffectiveHeight(node);
  const nx = numberValue(node.x) + NODE_W;
  const ny = numberValue(node.y) + eff_h / 2;
  if (node.collapsed) {
    return [{ movCode: null, linkIds: outLinks.map(l => l.id), x: nx, y: ny }];
  }
  let groups = groupLinksByPort(outLinks);
  groups = sortPortGroups(groups, node.portOrderOut);
  const totalH = (groups.length - 1) * PORT_SPACING;
  const startY = ny - totalH / 2;
  return groups.map((g, i) => ({ movCode: g.movCode, linkIds: g.linkIds, x: nx, y: startY + i * PORT_SPACING }));
}

function getNodeInPorts(node) {
  const nc = node.nodeClass || "";
  if (nc === "source") return [];
  const inLinks = state.links.filter(l => l.target === node.id);
  if (!inLinks.length) return [];
  const eff_h = nodeEffectiveHeight(node);
  const nx = numberValue(node.x);
  const ny = numberValue(node.y) + eff_h / 2;
  if (node.collapsed) {
    return [{ movCode: null, linkIds: inLinks.map(l => l.id), x: nx, y: ny }];
  }
  let groups = groupLinksByPort(inLinks);
  groups = sortPortGroups(groups, node.portOrderIn);
  const totalH = (groups.length - 1) * PORT_SPACING;
  const startY = ny - totalH / 2;
  return groups.map((g, i) => ({ movCode: g.movCode, linkIds: g.linkIds, x: nx, y: startY + i * PORT_SPACING }));
}

function linkPortOut(link) {
  const source = nodeById(link.source);
  if (!source) return null;
  const ports = getNodeOutPorts(source);
  if (!ports.length) return nodeOutPort(source);
  if (source.collapsed) return ports[0];
  // For source nodes, out-ports are tagged isReturn:false — skip return ports.
  return ports.find(p =>
    !p.isReturn &&
    ((link.movCode && p.movCode === link.movCode) ||
     (!link.movCode && p.linkIds.includes(link.id)))
  ) || ports.find(p => !p.isReturn) || nodeOutPort(source);
}

function linkPortIn(link) {
  const target = nodeById(link.target);
  if (!target) return null;
  // Source nodes have no left-side ports; return links arrive at the right side.
  // isRightIncoming:true tells the renderer to flip the bezier approach direction.
  if ((target.nodeClass || "") === "source") {
    const ports = getNodeRightPorts(target);
    if (!ports.length) return { ...nodeOutPort(target), isRightIncoming: true };
    if (target.collapsed) return { ...ports[0], isRightIncoming: true };
    const found = ports.find(p =>
      p.isReturn &&
      ((link.movCode && p.movCode === link.movCode) ||
       (!link.movCode && p.linkIds.includes(link.id)))
    ) || ports.find(p => p.isReturn) || nodeOutPort(target);
    return { ...found, isRightIncoming: true };
  }
  const ports = getNodeInPorts(target);
  if (!ports.length) return nodeInPort(target);
  if (target.collapsed) return ports[0];
  return ports.find(p =>
    (link.movCode && p.movCode === link.movCode) ||
    (!link.movCode && p.linkIds.includes(link.id))
  ) || nodeInPort(target);
}

// Cubic bezier handle length for S-curve — proportional to distance, clamped.
function bezierHandleLen(x1, y1, x2, y2) {
  const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  return Math.max(50, Math.min(dist * 0.4, 240));
}
