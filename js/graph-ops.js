// -- Selection, tool, and graph mutation helpers

function selectItem(kind, id) {
  state.selectedKind = kind;
  state.selectedId   = id;
  if (kind !== "node") state.connectionSource = null;
  render();
}

function clearSelection() {
  state.selectedKind      = null;
  state.selectedId        = null;
  state.connectionSource  = null;
  state.multiSelectedIds  = [];
  render();
}

function setTool(tool) {
  if (state.finalMode && tool !== "select") return;
  state.tool = tool;
  state.connectionSource = null;
  document.querySelectorAll(".tool-btn[data-tool]").forEach((button) => {
    button.classList.toggle("active", button.dataset.tool === tool);
  });
  canvas.className = "network-canvas tool-" + tool;
  renderHeaderState();
}

// -- Node / link creation

function addNodeAt(point) {
  pushHistory();
  const nextNumber = state.nodes.length + 1;
  const id = uniqueId("station_" + nextNumber);
  const node = {
    id,
    label: "New Station " + nextNumber,
    type: "Station",
    status: "ok",
    x: Math.round(point.x - NODE_W / 2),
    y: Math.round(point.y - NODE_H / 2),
    owner: "", location: "", defects: 0, description: "", inCode: "", outCode: "", rules: ""
  };
  state.nodes.push(node);
  state.selectedKind = "node";
  state.selectedId   = id;
  state.activeTab    = "edit";
  persist();
  render();
}

function addCompoundNodeAt(point) {
  pushHistory();
  const nextNumber = state.nodes.length + 1;
  const id = uniqueId("compound_" + nextNumber);
  const node = {
    id,
    label: "Group " + nextNumber,
    type: "Compound",
    status: "ok",
    x: Math.round(point.x - NODE_W / 2),
    y: Math.round(point.y - NODE_H / 2),
    owner: "", location: "", defects: 0, description: "", rules: "",
    nodeClass: "compound",
    innerNodes: [], innerLinks: [], innerGroups: []
  };
  state.nodes.push(node);
  state.selectedKind = "node";
  state.selectedId   = id;
  state.activeTab    = "edit";
  persist();
  render();
  showToast("Compound node created - double-click it to enter the inner workspace.");
}

function addLink(sourceId, targetId) {
  if (!sourceId || !targetId || sourceId === targetId) return;
  const duplicate = state.links.find((link) => link.source === sourceId && link.target === targetId);
  if (duplicate) {
    selectItem("link", duplicate.id);
    showToast("That link already exists.");
    return;
  }
  pushHistory();
  const source = nodeById(sourceId);
  const target = nodeById(targetId);
  const id = uniqueId("link_" + sourceId + "_" + targetId);
  state.links.push({
    id,
    source: sourceId,
    target: targetId,
    label: source.label + " to " + target.label,
    status: "ok"
  });
  state.connectionSource = null;
  state.selectedKind     = "link";
  state.selectedId       = id;
  state.activeTab        = "edit";
  persist();
  render();
}

// -- Deletion

function deleteSelected() {
  if (!state.selectedId) return;
  pushHistory();
  if (state.selectedKind === "node") {
    const id = state.selectedId;
    state.nodes  = state.nodes.filter((node) => node.id !== id);
    state.links  = state.links.filter((link) => link.source !== id && link.target !== id);
    state.groups = (state.groups || []).map(g => ({ ...g, nodeIds: (g.nodeIds || []).filter(nid => nid !== id) }));
  }
  if (state.selectedKind === "link") {
    state.links = state.links.filter((link) => link.id !== state.selectedId);
  }
  if (state.selectedKind === "group") {
    state.groups = (state.groups || []).filter(g => g.id !== state.selectedId);
  }
  state.selectedKind = null;
  state.selectedId   = null;
  persist();
  render();
}

// -- Auto-layout (left-to-right BFS)

function autoLayout() {
  pushHistory();
  const incoming = new Map(state.nodes.map((node) => [node.id, 0]));
  state.links.forEach((link) => incoming.set(link.target, (incoming.get(link.target) || 0) + 1));

  const levels  = new Map();
  const visited = new Set();
  const roots   = state.nodes.filter((node) => (incoming.get(node.id) || 0) === 0);
  const queue   = (roots.length ? roots : state.nodes.slice(0, 1)).map((node) => ({ id: node.id, level: 0 }));

  while (queue.length) {
    const current = queue.shift();
    if (visited.has(current.id)) continue;
    visited.add(current.id);
    levels.set(current.id, current.level);
    state.links
      .filter((link) => link.source === current.id && !visited.has(link.target))
      .forEach((link) => queue.push({ id: link.target, level: current.level + 1 }));
  }

  state.nodes.forEach((node) => { if (!levels.has(node.id)) levels.set(node.id, 0); });

  const grouped = new Map();
  state.nodes.forEach((node) => {
    const level = levels.get(node.id);
    if (!grouped.has(level)) grouped.set(level, []);
    grouped.get(level).push(node);
  });

  Array.from(grouped.keys()).sort((a, b) => a - b).forEach((level) => {
    grouped.get(level).forEach((node, row) => {
      node.x = 90 + level * 250;
      node.y = 120 + row * 165;
    });
  });

  state.links.forEach((link) => { delete link.controlX; delete link.controlY; });

  persist();
  render();
  showToast("Layout arranged.");
}

// -- Reset / restore demo

function resetDemo() {
  const layouts = getSavedLayouts();
  const latest  = layouts[layouts.length - 1];
  const label   = latest ? `"${latest.name}"` : "the demo network";
  if (!window.confirm(`Restore ${label}? Your current network will be replaced.`)) return;
  pushHistory();
  if (latest) {
    applyLayoutToState(clone(latest));
  } else {
    state.nodes       = clone(demoState.nodes);
    state.links       = clone(demoState.links);
    state.groups      = clone(demoState.groups || []);
    state.finalFields = { ...DEFAULT_FINAL_FIELDS };
    state.zoom  = 1;
    state.panX  = 0;
    state.panY  = 0;
  }
  state.multiSelectedIds = [];
  state.selectedKind     = null;
  state.selectedId       = null;
  state.connectionSource = null;
  state.activeTab        = "edit";
  persist();
  render();
}

// -- Network metrics summary

function metrics() {
  const nodeWip = state.nodes.reduce((sum, node) => sum + nodeInventory(node), 0);
  const defects = state.nodes.reduce((sum, node) => sum + numberValue(node.defects), 0);
  const critical = state.nodes.filter((node) => node.status === "critical" || node.status === "blocked").length;
  return { nodes: state.nodes.length, links: state.links.length, wip: nodeWip, defects, critical };
}

// -- Header / mode chip

function renderHeaderState() {
  const toolNames = {
    select:  "Select",
    add:     "Add Node",
    compound:"Add Compound",
    connect: state.connectionSource
      ? "Connect From " + nodeById(state.connectionSource)?.label
      : "Connect",
    pan:     "Pan",
    delete:  "Erase"
  };
  modeLabel.textContent = state.finalMode ? "Monitor View" : (toolNames[state.tool] || "Select");

  if (state.multiSelectedIds.length > 0) {
    selectionChip.textContent = state.multiSelectedIds.length + " nodes selected  |  drag to move  |  Ctrl+G to group";
  } else if (state.selectedKind === "group") {
    const grp = groupById(state.selectedId);
    selectionChip.textContent = grp ? "Group: " + grp.label : "Group";
  } else {
    const selected = selectedItem();
    if (!selected) {
      selectionChip.textContent = "No selection";
    } else if (state.selectedKind === "node") {
      selectionChip.textContent = "Node: " + selected.label;
    } else {
      const src = nodeById(selected.source)?.label || selected.source;
      const tgt = nodeById(selected.target)?.label || selected.target;
      selectionChip.textContent = "Link: " + src + " -> " + tgt;
    }
  }
}
