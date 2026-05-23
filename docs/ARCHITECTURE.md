# Architecture

The app is plain HTML + CSS + JavaScript — no bundler, no framework.  
All scripts are loaded as globals in a single HTML page.  
The Node.js `server.js` is only used for the optional local file backend.

---

## Script load order (`index.html`)

Scripts must load in this order because later files call functions defined in earlier ones.

```
js/constants.js       Global state object, DOM element refs, app constants, demo data
js/history.js         Undo/redo stack, clone(), persist(), compound node navigation
js/helpers.js         nodeById, linkById, escapeHtml, cssStatus, uniqueId, showToast, ...
js/viewport.js        canvasPoint, applyViewport, setZoom, setZoomAt
js/graph-ops.js       selectItem, addNodeAt, addLink, deleteSelected, autoLayout, ...
js/canvas-math.js     nodeCenter, nodeOutPort, nodeInPort, linkControlPoint, rectEdgePoint
js/canvas-render.js   renderLinks, renderNodes, nodeCardMetrics, linkBadgeText
js/canvas-groups.js   groupBoundingBox, renderGroups
js/canvas-events.js   All pointer/drag/wheel event handlers for the canvas
js/data-rows.js       Row filter helpers: rowMatchesDate, rowMatchesLink, resolveRealCounterpart
js/data-node.js       nodeInventory, nodeReturnQty, nodeConsumptionValues, nodeInventoryTimeSeries
js/data-graph.js      getPartsAtNode, getDataDates, computeLinkFlow
js/data-normalize.js  normalizeNodes, normalizeLinks, parseRuleLines
js/panel-edit.js      renderPanel, renderNodeEdit, renderLinkEdit, renderGroupEdit, ...
js/panel-stats.js     renderNodeStats, renderLinkStats, renderConsumptionStats, form helpers
js/panel-bind.js      bindPanelEvents, render() master function, refreshAfterFieldEdit
js/node-view.js       openNodeView, closeNodeView, drawTimeSeriesChart
js/link-view.js       openLinkView, closeLinkView, getLinkRows
js/layout.js          Layout manager (save/load named layouts)
js/io-network.js      importJson, exportJson, exportCsv, importCsvFile, loadFromBackend, saveToBackend
js/io-data.js         parseWorkbook, autoDetectColumns, openDataView, autoLoadDataFile
js/toolbar-events.js  Tool button clicks, keyboard shortcuts, date/time filter, Init Stock popup
app.js                Entry point: loadInitialState → normalizeNodes/Links → render
```

---

## State object (`js/constants.js`)

All mutable app state lives in the single `state` object:

| Field | Type | Description |
|---|---|---|
| `nodes` | `Node[]` | All nodes in the current network |
| `links` | `Link[]` | All links in the current network |
| `groups` | `Group[]` | Visual grouping overlays |
| `selectedKind` | `"node" \| "link" \| "group" \| null` | What is currently selected |
| `selectedId` | `string \| null` | ID of the selected item |
| `multiSelectedIds` | `string[]` | IDs selected via Ctrl+click |
| `tool` | `string` | Active tool: `"select"`, `"add"`, `"connect"`, `"pan"`, `"delete"` |
| `finalMode` | `boolean` | Presentation mode toggle |
| `zoom` | `number` | Current canvas zoom level |
| `panX` / `panY` | `number` | Canvas pan offset in pixels |
| `rawData` | `object[]` | Parsed rows from the uploaded data file |
| `rawHeaders` | `string[]` | Column headers from the uploaded data file |
| `movColumn` | `string` | Header mapped to movement type |
| `dateColumn` | `string` | Header mapped to posting date |
| `timeColumn` | `string` | Header mapped to entry time |
| `qtyColumn` | `string` | Header mapped to quantity |
| `partColumn` | `string` | Header mapped to part/material number |
| `srcSlocColumn` | `string` | Header mapped to source storage location |
| `dstSlocColumn` | `string` | Header mapped to destination storage location |
| `selectedDate` | `string` | Current date filter (`YYYY-MM-DD`) |
| `selectedTimeSlot` | `number` | Time slider position (0–47, each = 30 min) |
| `highlightPart` | `string` | Part number to highlight across the network |

---

## Node data model

```js
{
  id:             string,   // unique, slug-like
  label:          string,
  type:           string,   // display label (e.g. "Warehouse")
  status:         "ok" | "warning" | "critical" | "blocked",
  nodeClass:      "" | "source" | "transit" | "ledger" | "register" | "consumption" | "compound",
  nodeCode:       string,   // SLoc code that matches rows in the data file
  matchColumn:    string,   // override which column to use for SLoc matching
  x:              number,   // canvas position (world coordinates)
  y:              number,
  owner:          string,
  location:       string,
  defects:        number,
  description:    string,
  initStock:      { [partNumber]: number },   // starting inventory per part
  rules:          string,   // routing rule text (future feature)
  // Ledger-class specific:
  ledgerMovCodes: string,
  ledgerColumns:  string[],
  // Register-class specific:
  registerMovCodes: string,
  registerColumns:  string[],
  // Consumption-class specific:
  bomOutputPart:  string,
  bomMovCodes:    string,
  bom:            { inputPart: string, qty: number }[]
}
```

---

## Link data model

```js
{
  id:       string,
  source:   string,   // node ID
  target:   string,   // node ID
  label:    string,
  status:   "ok" | "warning" | "critical" | "blocked",
  movCode:  string,   // movement type code this link represents
  linkType: "movement" | "transit",
  controlX: number | undefined,   // bezier curve control point (user-dragged)
  controlY: number | undefined
}
```

---

## Canvas rendering

The canvas has three stacked SVG/div layers:

```
<div class="network-canvas">
  <svg  id="groupLayer">  <!-- group bounding boxes -->
  <svg  id="linkLayer">   <!-- bezier link paths + WIP badges -->
  <div  id="nodeLayer">   <!-- absolutely-positioned node cards -->
```

Layers are scaled via CSS `transform: matrix(zoom, 0, 0, zoom, panX, panY)`.

**Fixed connection ports** (since v7):  
Every standard node connects on its **right edge midpoint** (outgoing) and **left edge midpoint** (incoming).  
Transit nodes use a center + angular offset to simulate a circle edge.

---

## Data file pipeline

```
Upload (.xlsx/.csv)
  → parseWorkbook (js/io-data.js)
  → applyRawData  (sets state.rawData, state.rawHeaders)
  → autoDetectColumns (guesses column roles by header name pattern)
  → openColCfgDialog (user confirms/adjusts mapping)
  → render()
```

Once `state.rawData` is populated, every `render()` call re-computes flows, inventory,
and highlights live — there is no separate "recalculate" step.

---

## Persistence

| Storage | Used for |
|---|---|
| `localStorage` (key `supply-chain-visualizer-v2`) | Auto-save of the current network after every change |
| `localStorage` (key `scv-layouts-v1`) | Named layout snapshots |
| `data/network.json` (via Node.js backend) | Shared / persistent storage across browser sessions |
