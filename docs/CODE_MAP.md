# Code Map

Whenever I looked at the SAP Excel sheet, it took too long to understand where all the parts were in the plant and how they were moving. I am not a programmer, but I had the idea to turn that raw data into a visual map — so anyone on the team could see the supply chain at a glance without digging through rows and columns.

Quick reference: what lives where, so you know exactly which file to open when you need to change something.

---

## Canvas

| File | What it contains |
|---|---|
| `js/canvas-math.js` | Pure geometry helpers: `nodeCenter`, `nodeOutPort`, `nodeInPort`, `linkControlPoint`, `rectEdgePoint` |
| `js/canvas-render.js` | DOM output: `renderLinks` (SVG bezier paths + WIP badges), `renderNodes` (node cards), `nodeCardMetrics`, `linkBadgeText` |
| `js/canvas-groups.js` | Group overlay rendering: `groupBoundingBox`, `renderGroups` |
| `js/canvas-events.js` | All pointer/wheel/keyboard events on the canvas: drag, pan, zoom, click-to-select, connect tool, WIP-pill drag |

**When to edit:**
- Arrow positions or port logic → `canvas-math.js`
- How nodes look on the canvas → `canvas-render.js`
- How links are drawn → `canvas-render.js`
- Group boxes → `canvas-groups.js`
- Mouse/touch interaction → `canvas-events.js`

---

## Data Calculations

| File | What it contains |
|---|---|
| `js/data-rows.js` | Row-level filters: `rowMatchesDate`, `rowMatchesLink`, `resolveRealCounterpart` |
| `js/data-node.js` | Per-node calculations: `nodeInventory`, `nodeReturnQty`, `nodeConsumptionValues`, `nodeLedgerValues`, `nodeRegisterValues`, `nodeInventoryTimeSeries` |
| `js/data-graph.js` | Graph-level queries: `getPartsAtNode`, `getDataDates`, `computeLinkFlow` |
| `js/data-normalize.js` | State normalisation on load: `normalizeNodes`, `normalizeLinks`, `parseRuleLines` |

**When to edit:**
- Inventory or flow number is wrong → `data-node.js` or `data-rows.js`
- Link badge (WIP quantity) is wrong → `data-graph.js` (`computeLinkFlow`)
- Data import / column mapping → `js/io-data.js`

---

## Panels (Right sidebar)

| File | What it contains |
|---|---|
| `js/panel-edit.js` | Edit-tab HTML: `renderNodeEdit`, `renderLinkEdit`, `renderNodeClassConfig`, `renderSLocWarning` |
| `js/panel-stats.js` | Stats-tab HTML: `renderNodeStats`, `renderLinkStats`, `renderConsumptionStats`, transaction-log table builder |
| `js/panel-bind.js` | Event bindings for the panel, the master `render()` function, `refreshAfterFieldEdit` |

**When to edit:**
- A field in the edit form → `panel-edit.js`
- The stats / transaction log layout → `panel-stats.js`
- Panel tab switching, field-change handlers → `panel-bind.js`

---

## Overlays

| File | What it contains |
|---|---|
| `js/node-view.js` | Full-screen node view: `openNodeView`, `closeNodeView`, `drawTimeSeriesChart` |
| `js/link-view.js` | Link transaction log overlay: `openLinkView`, `closeLinkView`, `getLinkRows` |

---

## Toolbar & I/O

| File | What it contains |
|---|---|
| `js/toolbar-events.js` | Button click handlers, keyboard shortcuts, date/time filter, Init Stock popup |
| `js/io-network.js` | Network import/export: `importJson`, `exportJson`, `exportCsv`, `importCsvFile`, backend load/save |
| `js/io-data.js` | Data-file pipeline: `parseWorkbook`, `autoDetectColumns`, `openDataView`, `autoLoadDataFile` |
| `js/layout.js` | Named layout manager: save/load/delete layout snapshots from `localStorage` |

---

## Core / Bootstrap

| File | What it contains |
|---|---|
| `js/constants.js` | The `state` object, DOM element refs, `NODE_W`/`NODE_H` constants, demo network data |
| `js/history.js` | Undo/redo stack (`pushHistory`, `undo`, `redo`), `clone()`, `persist()` |
| `js/helpers.js` | Utility functions: `nodeById`, `linkById`, `escapeHtml`, `cssStatus`, `uniqueId`, `showToast` |
| `js/viewport.js` | Zoom and pan: `canvasPoint`, `applyViewport`, `setZoom`, `setZoomAt` |
| `js/graph-ops.js` | Graph mutations: `addNodeAt`, `addLink`, `deleteSelected`, `autoLayout`, `selectItem`, `setTool` |
| `app.js` | Entry point: calls `loadInitialState` → `normalizeNodes`/`Links` → `render()` |

---

## Styles & HTML

| File | What it contains |
|---|---|
| `styles.css` | All CSS — canvas, nodes, links, panels, overlays, toolbar |
| `index.html` | Single HTML page — all markup and `<script>` load order |

**Node class CSS selectors:**
- `.nc-source` — Source node (teal/green tint)
- `.nc-transit` — In-Transit node (blue tint, rectangular)
- `.nc-ledger` — Ledger node (amber tint)
- `.nc-register` — Register node (purple tint)
- `.nc-consumption` — Consumption/BOM node (green tint)

---

## Server

| File | What it contains |
|---|---|
| `server.js` | Minimal Node.js HTTP server for local file persistence (`data/network.json`) |

---

## Future Features & Ideas

Everything listed here is planned but not yet built. The UI already shows "Future" / "Soon" badges where relevant.

### Node Classes (advanced)

| Node Class | Idea |
|---|---|
| **Ledger** | Accumulates running totals for any selected SAP columns (e.g. total GR quantity, total GI quantity) filtered by movement codes. Good for summary KPI boxes on the canvas. |
| **Register** | Shows the latest value from the most recent matching row — like a live display panel for a single field (e.g. last posted quantity, last entry time). |
| **Consumption / BOM** | Tracks a production station: you define the Bill of Materials (input parts + quantities per output unit), and the node calculates how much of each input has been consumed and what stock remains. |
| **Compound** | A node that contains its own inner network — double-click to zoom into a sub-canvas. Useful for representing a factory section or a building that itself has multiple internal locations. |

### Link Types

| Link Type | Idea |
|---|---|
| **Transit / Delivery Time** | A link that carries a transit duration (hours or days). The canvas would show the goods "in flight" between two nodes with a countdown or progress bar on the link. |

### Routing Rules

A text-based rule engine on each node. The idea is:
```
IF [Material_Group] IS_EQUAL_TO "RAW" THEN "Warehouse A"
IF [Plant] IS_EQUAL_TO "1000" THEN "Plant Store"
```
When a data row arrives at a node, the rules decide which outgoing link it should follow. This would let the visualizer simulate routing logic without manually tagging every row.

### Canvas & Interaction

- **Smart arrow routing** — links that automatically bend around other nodes instead of drawing a straight bezier through them. Important when In-Transit nodes have many connections and arrows overlap.
- **Transit look-through in transaction log** — when viewing the stats of a node connected through an In-Transit hub, the NODE column in the transaction table should show the real origin/destination, not "In Transit". (The helper `resolveRealCounterpart` in `data-rows.js` is already written for this.)
- **Multi-link between same two nodes** — currently two nodes can only have one visible link; future version should support parallel links (e.g. movement 101 and movement 122 as separate arrows).
- **Link animation** — animate a moving dot along the bezier path to show live flow direction.

### Data & Reporting

- **Date range summary** — instead of a single date filter, select a FROM and TO date to see cumulative flows over a period.
- **Export to image / PDF** — snapshot the canvas as a PNG or PDF for reports and presentations.
- **Alert rules** — define thresholds (e.g. "inventory below 50 → turn node red") that trigger status changes automatically when data is loaded.
- **Multi-file data merge** — load more than one SAP export at once and merge them by date range.
