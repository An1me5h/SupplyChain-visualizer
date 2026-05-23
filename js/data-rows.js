// -- Row filter helpers (date, time, part, movement code matching)

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

// -- Movement code and storage location matching

function rowMatchesLink(row, link) {
  const code = String(row[state.movColumn] || "").trim();
  if (code !== link.movCode) return false;

  // Source node -- transit nodes are transparent (no SLoc of their own)
  const srcNode = nodeById(link.source);
  if (srcNode && srcNode.nodeClass !== "transit") {
    const nodeCode = (srcNode.nodeCode || "").trim();
    if (nodeCode) {
      if (state.srcSlocColumn) {
        if (String(row[state.srcSlocColumn] || "").trim() !== nodeCode) return false;
      }
    } else {
      const filters = srcNode.extraFilters || [];
      const hasFilters = filters.some(f => f.column && f.value);
      if (hasFilters) {
        for (const f of filters) {
          if (!f.column || !f.value) continue;
          if (String(row[f.column] || "").trim() !== f.value.trim()) return false;
        }
      } else if (state.srcSlocColumn) {
        const rowSrc = String(row[state.srcSlocColumn] || "").trim();
        const otherCodes = new Set(
          state.nodes.filter(n => n.id !== link.source && n.nodeCode && n.nodeClass !== "transit")
                     .map(n => n.nodeCode.trim())
        );
        if (otherCodes.has(rowSrc)) return false;
      }
    }
  }

  // Target node -- transit nodes are transparent
  const dstNode = nodeById(link.target);
  if (dstNode && dstNode.nodeClass !== "transit") {
    const nodeCode = (dstNode.nodeCode || "").trim();
    if (nodeCode) {
      if (state.dstSlocColumn) {
        if (String(row[state.dstSlocColumn] || "").trim() !== nodeCode) return false;
      }
    } else {
      const filters = dstNode.extraFilters || [];
      const hasFilters = filters.some(f => f.column && f.value);
      if (hasFilters) {
        for (const f of filters) {
          if (!f.column || !f.value) continue;
          if (String(row[f.column] || "").trim() !== f.value.trim()) return false;
        }
      } else if (state.dstSlocColumn) {
        const rowDst = String(row[state.dstSlocColumn] || "").trim();
        const otherCodes = new Set(
          state.nodes.filter(n => n.id !== link.target && n.nodeCode && n.nodeClass !== "transit")
                     .map(n => n.nodeCode.trim())
        );
        if (otherCodes.has(rowDst)) return false;
      }
    }
  }
  // Link-level extra filter: if matchColumn + matchValue are set, row must match
  if (link.matchColumn && link.matchValue) {
    const rowVal = String(row[link.matchColumn] || "").trim();
    if (rowVal !== link.matchValue.trim()) return false;
  }

  return true;
}

// Follows transit hops to find the real origin/destination node.
// dir "In"  -> walk backwards through transit to find the real source
// dir "Out" -> walk forwards through transit to find the real target
function resolveRealCounterpart(row, link, dir, depth = 0) {
  if (depth > 10) return null; // cycle guard
  const nodeId = dir === "In" ? link.source : link.target;
  const node   = nodeById(nodeId);
  if (!node || node.nodeClass !== "transit") return node;

  const nextLinks = dir === "In"
    ? state.links.filter(l => l.target === nodeId && l.movCode === link.movCode)
    : state.links.filter(l => l.source === nodeId && l.movCode === link.movCode);

  const nextLink = nextLinks.find(l => rowMatchesLink(row, l));
  if (!nextLink) return node;
  return resolveRealCounterpart(row, nextLink, dir, depth + 1);
}
