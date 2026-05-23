// -- Core lookup and utility helpers

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2200);
}

function nodeById(id) {
  return state.nodes.find((node) => node.id === id);
}

function linkById(id) {
  return state.links.find((link) => link.id === id);
}

function selectedItem() {
  if (state.selectedKind === "node") return nodeById(state.selectedId);
  if (state.selectedKind === "link") return linkById(state.selectedId);
  return null;
}

function groupById(id) {
  return (state.groups || []).find(g => g.id === id);
}

function cssStatus(status) {
  return ["ok", "warning", "critical", "blocked"].includes(status) ? status : "ok";
}

function statusLabel(status) {
  const labels = { ok: "OK", warning: "Watch", critical: "Critical", blocked: "Blocked" };
  return labels[status] || "OK";
}

function uniqueId(base) {
  const clean = String(base || "node")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "node";
  let id = clean;
  let index = 2;
  while (nodeById(id) || linkById(id)) {
    id = clean + "_" + index;
    index += 1;
  }
  return id;
}

function numberValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

// -- HTML escaping

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
