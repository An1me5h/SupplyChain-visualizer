// -- Part Journey Traceability ("digital product passport")
//
// NAMING (2026-07-11): user-visible labels say "Journey" and "Flow Stage".
// Internal names (this file, state.lifecycleMode, node.lifecycleStage, lc-*
// CSS classes) intentionally keep the lifecycle* naming -- do NOT rename them,
// saved localStorage data and exports depend on the field names. Same
// precedent as Monitor View keeping state.finalMode. "Lifecycle" as a
// user-facing word is reserved for the planned Product Development Lifecycle
// Board (departments/design gates: DFMEA, GD&T, ... -- see Open/Planned Work).
//
// Theory: every movement row in the uploaded data is a traceability event with
// four dimensions -- WHAT (part + quantity), WHEN (posting date/time),
// WHERE (from node -> to node) and WHY (movement code). The ordered chain of
// these events IS the part's lifecycle record: it travels with the part from
// node to node. Nodes can additionally be tagged with a life stage
// (LIFECYCLE_STAGES in constants.js) so the journey reads as life stages
// (Raw Material -> Production -> ... -> End of Life), not just locations.
//
// Phase 1: computePartJourney() + canvas journey overlay + timeline drawer.
// Phase 2: node.lifecycleStage tag, stage chips, stage breakdown in Stats.

// Look up the stage descriptor { value, label, color } for a stage value string.
function lifecycleStageInfo(stageValue) {
  if (!stageValue) return null;
  const found = LIFECYCLE_STAGES.find(stage => stage.value === stageValue);
  return found || null;
}

// -- Journey engine -----------------------------------------------------------

// Builds the chronological event chain for one part.
// Returns { events, linkIds, unmatched }:
//   events    - [{ rowIndex, date, time, qty, movCode, fromId, toId }] sorted by date+time
//   linkIds   - Set of every link id the part's rows matched (both halves of a
//               transit hop, so the whole visual path can be highlighted)
//   unmatched - count of part rows that matched no link (unmapped movements)
function computePartJourney(part) {
  const journey = { events: [], linkIds: new Set(), unmatched: 0 };
  if (!part || !state.rawData.length || !state.movColumn || !state.partColumn) {
    return journey;
  }

  state.rawData.forEach((row, rowIndex) => {
    const rowPart = String(row[state.partColumn] || "").trim();
    if (rowPart !== part) return;
    if (!rowBeforeOrOnDate(row)) return; // respect the active date/time filter

    const matchingLinks = state.links.filter(link => rowMatchesLink(row, link));
    if (!matchingLinks.length) {
      journey.unmatched += 1;
      return;
    }
    matchingLinks.forEach(link => journey.linkIds.add(link.id));

    // One event per row. A row passing through a transit hub matches two links;
    // resolveRealCounterpart walks through transit so from/to are the real endpoints.
    const firstLink = matchingLinks[0];
    const fromNode = resolveRealCounterpart(row, firstLink, "In");
    const toNode = resolveRealCounterpart(row, firstLink, "Out");

    journey.events.push({
      rowIndex,
      date: state.dateColumn ? String(row[state.dateColumn] || "").trim().slice(0, 10) : "",
      time: state.timeColumn ? normalizeTime(row[state.timeColumn]) : "",
      qty: state.qtyColumn ? (numberValue(row[state.qtyColumn]) || 1) : 1,
      movCode: firstLink.movCode,
      fromId: fromNode ? fromNode.id : firstLink.source,
      toId: toNode ? toNode.id : firstLink.target
    });
  });

  journey.events.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (a.time !== b.time) return a.time < b.time ? -1 : 1;
    return a.rowIndex - b.rowIndex;
  });

  return journey;
}

// Where is the part right now?
// Standard nodes -> stock currently held; End nodes -> total delivered.
// Returns { holding: [{ node, qty }], delivered: [{ node, qty }] }.
function partLocationsNow(part) {
  const result = { holding: [], delivered: [] };
  if (!part || !state.rawData.length || !state.movColumn) return result;

  // nodeInventory() reads the part filter from state, so set it temporarily
  // (same save/restore pattern as renderPartInventoryBreakdown in panel-stats.js).
  const savedPart = state.highlightPart;
  state.highlightPart = part;

  state.nodes.forEach(node => {
    const nc = node.nodeClass || "";
    if (nc === "") {
      const qty = nodeInventory(node);
      if (qty !== 0) result.holding.push({ node, qty });
    } else if (nc === "end") {
      const arrived = nodeInventory(node); // end nodes report "Arrived"
      if (arrived > 0) result.delivered.push({ node, qty: arrived });
    }
  });

  state.highlightPart = savedPart;

  result.holding.sort((a, b) => b.qty - a.qty);
  result.delivered.sort((a, b) => b.qty - a.qty);
  return result;
}

// All real (non-transit) nodes reachable one hop downstream from nodeId,
// looking through transit hubs. Used for the "could go next" list.
function lifecycleNextTargets(nodeId, depth = 0) {
  if (depth > 4) return []; // cycle guard for transit loops
  const targets = [];
  const outLinks = state.links.filter(link => link.source === nodeId && link.movCode);
  outLinks.forEach(link => {
    const target = nodeById(link.target);
    if (!target) return;
    if (target.nodeClass === "transit") {
      targets.push(...lifecycleNextTargets(target.id, depth + 1));
    } else {
      targets.push(target);
    }
  });
  return targets;
}

// -- Canvas overlay (badges, chips, link highlighting) ------------------------

let lcOverlayScheduled = false;

// Re-apply the lifecycle overlay on the next animation frame. Called from the
// end of renderNodes()/renderLinks() (canvas-render.js) so that EVERY render
// path refreshes the overlay after the layers were rebuilt via innerHTML.
function scheduleLifecycleOverlay() {
  if (lcOverlayScheduled) return;
  lcOverlayScheduled = true;
  requestAnimationFrame(() => {
    lcOverlayScheduled = false;
    renderLifecycleOverlay();
  });
}

function clearLifecycleDecorations() {
  nodeLayer.querySelectorAll(".lc-step-badge, .lc-now-chip").forEach(el => el.remove());
  linkLayer.querySelectorAll(".link").forEach(el => {
    el.classList.remove("lc-journey-link", "lc-next-link");
  });
}

// Master entry point -- shows/hides everything based on state.lifecycleMode.
function renderLifecycleOverlay() {
  const btn = document.getElementById("lifecycleBtn");
  const drawer = document.getElementById("lifecycleDrawer");
  if (!btn || !drawer) return;

  const hasData = state.rawData.length && state.movColumn && state.partColumn;
  btn.style.display = hasData ? "" : "none";
  btn.classList.toggle("active", state.lifecycleMode);

  const active = state.lifecycleMode && state.highlightPart && hasData;
  if (!active) {
    clearLifecycleDecorations();
    drawer.classList.remove("open");
    drawer.setAttribute("aria-hidden", "true");
    return;
  }

  const journey = computePartJourney(state.highlightPart);
  const locations = partLocationsNow(state.highlightPart);
  applyLifecycleDecorations(journey, locations);
  renderLifecycleDrawer(journey, locations);
}

// Decoration elements are SIBLINGS of the node cards inside nodeLayer (not
// children) because .node has overflow:hidden and would clip them. They use
// the same translate3d(--x,--y) positioning as the cards themselves.
function applyLifecycleDecorations(journey, locations) {
  clearLifecycleDecorations();

  // Which journey steps ARRIVE at each node (step numbers are 1-based).
  const stepsByNode = {};
  journey.events.forEach((event, index) => {
    const stepNo = index + 1;
    if (!stepsByNode[event.toId]) stepsByNode[event.toId] = [];
    stepsByNode[event.toId].push(stepNo);
  });
  const originId = journey.events.length ? journey.events[0].fromId : null;

  function addDecoration(className, html, x, y) {
    const el = document.createElement("div");
    el.className = className;
    el.innerHTML = html;
    el.style.setProperty("--x", x + "px");
    el.style.setProperty("--y", y + "px");
    nodeLayer.appendChild(el);
  }

  state.nodes.forEach(node => {
    const steps = stepsByNode[node.id];
    const isOrigin = node.id === originId;
    if (!steps && !isOrigin) return;

    let badgeText;
    if (steps) {
      const shown = steps.slice(0, 3).join(",");
      badgeText = steps.length > 3 ? shown + "&hellip;" : shown;
    } else {
      badgeText = "Start";
    }
    addDecoration("lc-step-badge", badgeText, numberValue(node.x) - 8, numberValue(node.y) - 12);
  });

  // "Now here" chips on nodes currently holding stock, "delivered" on end nodes.
  locations.holding.forEach(entry => {
    const node = entry.node;
    const chipY = numberValue(node.y) + nodeEffectiveHeight(node) + 4;
    addDecoration("lc-now-chip", "&#9679; " + entry.qty + " here now", numberValue(node.x) + 6, chipY);
  });
  locations.delivered.forEach(entry => {
    const node = entry.node;
    const chipY = numberValue(node.y) + nodeEffectiveHeight(node) + 4;
    addDecoration("lc-now-chip lc-delivered", "&#10003; " + entry.qty + " delivered", numberValue(node.x) + 6, chipY);
  });

  // Links the part actually travelled: solid highlight.
  // Out-links of nodes still holding stock: dashed "could go next" highlight.
  const holdingIds = new Set(locations.holding.map(entry => entry.node.id));
  linkLayer.querySelectorAll(".link").forEach(el => {
    const link = linkById(el.dataset.linkId);
    if (!link) return;
    if (journey.linkIds.has(link.id)) {
      el.classList.add("lc-journey-link");
    } else if (holdingIds.has(link.source) && link.movCode) {
      el.classList.add("lc-next-link");
    }
  });
}

// -- Timeline drawer ----------------------------------------------------------

function lcStageChipHtml(node) {
  const stage = node ? lifecycleStageInfo(node.lifecycleStage) : null;
  if (!stage) return "";
  return `<span class="lc-stage-chip" style="background:${stage.color}">${escapeHtml(stage.label)}</span>`;
}

function renderLifecycleDrawer(journey, locations) {
  const drawer = document.getElementById("lifecycleDrawer");
  const body = document.getElementById("lcDrawerBody");
  const sub = document.getElementById("lcDrawerSub");
  if (!drawer || !body) return;

  const dateLabel = state.selectedDate ? "up to " + state.selectedDate : "all dates";
  if (sub) sub.textContent = state.highlightPart + " - " + journey.events.length + " movement(s), " + dateLabel;

  // Summary chips: where it is now, what was delivered, where it could go next.
  const summaryChips = [];
  if (locations.holding.length) {
    locations.holding.forEach(entry => {
      summaryChips.push(`<span class="lc-sum-chip lc-sum-now">&#9679; ${escapeHtml(entry.node.label)}: <strong>${entry.qty}</strong> now</span>`);
    });
  } else {
    summaryChips.push(`<span class="lc-sum-chip">No stock held anywhere right now</span>`);
  }
  locations.delivered.forEach(entry => {
    summaryChips.push(`<span class="lc-sum-chip lc-sum-delivered">&#10003; ${escapeHtml(entry.node.label)}: <strong>${entry.qty}</strong> delivered</span>`);
  });

  const nextSeen = new Set();
  locations.holding.forEach(entry => {
    lifecycleNextTargets(entry.node.id).forEach(target => {
      if (nextSeen.has(target.id) || target.id === entry.node.id) return;
      nextSeen.add(target.id);
      summaryChips.push(`<span class="lc-sum-chip lc-sum-next">&#8594; could go to ${escapeHtml(target.label)}</span>`);
    });
  });

  const unmatchedHtml = journey.unmatched
    ? `<div class="lc-unmatched">&#9888; ${journey.unmatched} row(s) for this part matched no link &mdash; check movement codes / SLoc mappings.</div>`
    : "";

  const rowsHtml = journey.events.map((event, index) => {
    const fromNode = nodeById(event.fromId);
    const toNode = nodeById(event.toId);
    const fromLabel = fromNode ? fromNode.label : event.fromId;
    const toLabel = toNode ? toNode.label : event.toId;
    const when = [event.date, event.time].filter(Boolean).join(" ");
    return `
      <div class="lc-event-row" data-focus-node="${escapeAttr(event.toId)}" title="Click to jump to ${escapeAttr(toLabel)}">
        <span class="lc-event-step">${index + 1}</span>
        <span class="lc-event-when">${escapeHtml(when || "-")}</span>
        <span class="lc-event-route">
          ${escapeHtml(fromLabel)} ${lcStageChipHtml(fromNode)}
          <span class="lc-event-arrow">&#8594;</span>
          ${escapeHtml(toLabel)} ${lcStageChipHtml(toNode)}
        </span>
        <span class="lc-event-mov">Mv${escapeHtml(event.movCode || "?")}</span>
        <span class="lc-event-qty">${event.qty}</span>
      </div>`;
  }).join("");

  const emptyHtml = `<div class="lc-empty">No movements found for this part${state.selectedDate ? " up to " + escapeHtml(state.selectedDate) : ""}.</div>`;

  body.innerHTML = `
    <div class="lc-summary">${summaryChips.join("")}</div>
    ${unmatchedHtml}
    <div class="lc-event-list">${rowsHtml || emptyHtml}</div>
  `;

  body.querySelectorAll(".lc-event-row").forEach(rowEl => {
    rowEl.addEventListener("click", () => lcFocusNode(rowEl.dataset.focusNode));
  });

  drawer.classList.add("open");
  drawer.setAttribute("aria-hidden", "false");
}

// Pan the canvas so the node sits in the centre, then flash it briefly.
function lcFocusNode(nodeId) {
  const node = nodeById(nodeId);
  if (!node) return;
  const rect = canvas.getBoundingClientRect();
  state.panX = rect.width / 2 - (numberValue(node.x) + NODE_W / 2) * state.zoom;
  state.panY = rect.height / 2 - (numberValue(node.y) + NODE_H / 2) * state.zoom;
  applyViewport();
  persist();
  const el = nodeLayer.querySelector(`.node[data-node-id="${CSS.escape(nodeId)}"]`);
  if (el) {
    el.classList.add("lc-flash");
    setTimeout(() => el.classList.remove("lc-flash"), 900);
  }
}

// -- Stats panel: inventory by life stage (Phase 2) ---------------------------

// Returns an HTML block for the network Stats tab, or "" when nothing to show.
// Respects the active part filter and date filter (via nodeInventory).
function renderLifecycleStageStats() {
  if (!state.rawData.length || !state.movColumn) return "";

  // Standard nodes contribute stock held; end nodes contribute delivered qty.
  // Source nodes are skipped: their "Sent" figure is outflow, not stock.
  const taggedNodes = state.nodes.filter(node => {
    const nc = node.nodeClass || "";
    return node.lifecycleStage && (nc === "" || nc === "end");
  });
  if (!taggedNodes.length) return "";

  const totalsByStage = {};
  taggedNodes.forEach(node => {
    const qty = nodeInventory(node);
    if (!qty) return;
    totalsByStage[node.lifecycleStage] = (totalsByStage[node.lifecycleStage] || 0) + qty;
  });

  const stageRows = LIFECYCLE_STAGES
    .filter(stage => totalsByStage[stage.value])
    .map(stage => ({ stage, qty: totalsByStage[stage.value] }));
  if (!stageRows.length) return "";

  const maxQty = Math.max(...stageRows.map(row => Math.abs(row.qty)));
  const title = state.highlightPart
    ? "Flow Stage Breakdown - " + state.highlightPart
    : "Inventory by Flow Stage";

  return `
    <div class="section-title" style="margin-top:12px">${escapeHtml(title)}</div>
    <div class="part-inv-list">
      ${stageRows.map(row => {
        const pct = maxQty > 0 ? Math.round((Math.abs(row.qty) / maxQty) * 100) : 0;
        return `
          <div class="part-inv-row">
            <span class="part-inv-label">${escapeHtml(row.stage.label)}</span>
            <div class="part-inv-bar-wrap">
              <div class="part-inv-bar" style="width:${pct}%;background:${row.stage.color}"></div>
            </div>
            <span class="part-inv-qty${row.qty < 0 ? " neg-val" : ""}">${row.qty}</span>
          </div>`;
      }).join("")}
    </div>`;
}

// -- Edit panel: lifecycle stage dropdown (Phase 2) ---------------------------

// Form field for renderNodeEdit (panel-edit.js). Uses data-field so the
// existing [data-field] input binding in panel-bind.js persists the value.
function lifecycleStageSelectField(value) {
  const options = LIFECYCLE_STAGES.map(stage => {
    const selected = value === stage.value ? " selected" : "";
    return `<option value="${escapeAttr(stage.value)}"${selected}>${escapeHtml(stage.label)}</option>`;
  }).join("");
  return `
    <div class="field">
      <label for="field-lifecycleStage">Flow Stage</label>
      <select id="field-lifecycleStage" data-field="lifecycleStage">
        <option value="">- not set -</option>
        ${options}
      </select>
    </div>
  `;
}

// -- One-time event bindings (scripts sit at the end of <body>, DOM is ready) --

(function bindLifecycleEvents() {
  const btn = document.getElementById("lifecycleBtn");
  if (btn) {
    btn.addEventListener("click", () => {
      if (!state.highlightPart) {
        showToast("Pick a part in the part filter first.");
        return;
      }
      state.lifecycleMode = !state.lifecycleMode;
      renderLifecycleOverlay();
    });
  }

  const closeBtn = document.getElementById("lcDrawerClose");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      state.lifecycleMode = false;
      renderLifecycleOverlay();
    });
  }
})();
