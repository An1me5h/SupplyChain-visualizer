// -- Group bounding box and rendering

function groupBoundingBox(group) {
  const nodes = (group.nodeIds || []).map(nodeById).filter(Boolean);
  if (!nodes.length) return null;
  const PX = 22, PY = 28;
  const xs = nodes.map(n => numberValue(n.x));
  const ys = nodes.map(n => numberValue(n.y));
  const x = Math.min(...xs) - PX;
  const y = Math.min(...ys) - PY;
  const w = Math.max(...xs) + NODE_W  - Math.min(...xs) + PX * 2;
  const h = Math.max(...ys) + NODE_H  - Math.min(...ys) + PY + 22;
  return { x, y, w, h };
}

function renderGroups() {
  if (!state.groups || !state.groups.length) { groupLayer.innerHTML = ""; return; }

  groupLayer.innerHTML = state.groups.map(group => {
    const bbox = groupBoundingBox(group);
    if (!bbox) return "";
    const color    = group.color || "#7fb4ff";
    const labelW   = Math.min(bbox.w - 4, group.label.length * 8 + 20);
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
