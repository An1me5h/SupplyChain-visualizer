# Supply Chain Visualizer

An interactive, browser-based supply chain network editor and flow visualizer.  
No build tools, no dependencies beyond a local Node.js server for file persistence.

# My Vision
I built this tool to solve a simple daily frustration: finding out where stock actually is right now required digging through SAP and exporting data manually. This program reads a standard Excel export from SAP and instantly shows me the current stock position — no login, no navigation, no waiting.

The bigger vision is to grow this into a full product lifecycle tracker. In the future it should show the complete pipeline — not just where inventory sits today, but how a product evolves: design revisions, engineering changes, quality defects caught in production, and complaints that come in from customers. The goal is one view that tells the whole story of a product from design to delivery, with every deviation and complaint tied back to the right version of the product at the right point in time.

For now it starts simple: an Excel file in, a clear picture out.

---

## Features

- **Visual network editor** — drag nodes, draw links, pan and zoom an infinite canvas
- **SAP data integration** — upload `.xlsx` / `.csv` exports; flows animate on links in real time
- **Date + time slider** — step through any day at 30-minute resolution
- **Node classes** — Standard, Source, In-Transit, Ledger, Register, Consumption
- **Transaction log** — per-node and per-link drill-down overlays with date range filtering
- **Part filter** — highlight the path of any part number through the network
- **Groups** — visually cluster related nodes with a colour-coded bounding box
- **Layout manager** — save and restore named network snapshots (stored in `localStorage`)
- **Final View** — presentation-clean mode that hides the editing toolbar
- **Undo / redo** — Ctrl+Z / Ctrl+Y

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or later (only needed for the local backend)
- A modern browser (Chrome, Edge, Firefox)

### Run locally

```bash
# Clone or download the repository
git clone https://github.com/An1me5h/SupplyChainVisualizer.git
cd SupplyChainVisualizer

# Start the backend server (serves files and saves the network to data/)
node server.js
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

The server watches `data/network.json` — any changes made in the UI and saved via
**Save Backend** are written there.

### Without the server

Open `index.html` directly in a browser.  State is stored in `localStorage` automatically.
Import/export JSON manually via the toolbar buttons.

---

## Toolbar Quick Reference

| Button | Action |
|---|---|
| **Select** | Click to select; drag to move nodes |
| **Node** | Click on the canvas to place a new station |
| **Link** | Click source node, then target node |
| **Pan** | Drag to pan; also Ctrl+drag anywhere |
| **Erase** | Click a node or link to delete it |
| **Layout** | Auto-arrange nodes left-to-right |
| **Reset** | Restore the last saved layout |
| **Undo** | Ctrl+Z |
| **Import JSON** | Load a previously exported network file |
| **Nodes CSV / Links CSV** | Bulk-import from CSV |
| **Export CSV** | Download nodes + links as two CSV files |
| **Export JSON** | Download the full network as JSON |
| **Upload Data** | Load an SAP `.xlsx` or `.csv` export |
| **Load / Save Backend** | Sync with the local Node.js server |
| **Init Stock** | Set starting inventory per node per part |
| **Layouts** | Open the named-layout manager |
| **Final View** | Toggle presentation mode |

---

## Data File Format

The visualizer expects a flat tabular file (CSV or Excel) with one movement per row.
Typical SAP MM columns:

| Column | Purpose |
|---|---|
| Movement Type | Mapped as **Movement Code** |
| Posting Date | Mapped as **Date** |
| Entry Time | Mapped as **Time** (optional) |
| Quantity | Mapped as **Quantity** |
| Material | Mapped as **Part No** (optional) |
| Stor. Location | Mapped as **Source SLoc** or **Destination SLoc** |

Column mapping is auto-detected on upload and can be adjusted in the **Map Data Columns** dialog.

---

## Network JSON Schema

```json
{
  "nodes": [
    {
      "id": "warehouse_01",
      "label": "Central Warehouse",
      "type": "Station",
      "status": "ok",
      "nodeClass": "",
      "nodeCode": "WH01",
      "x": 400, "y": 200
    }
  ],
  "links": [
    {
      "id": "link_supplier_warehouse",
      "source": "supplier_01",
      "target": "warehouse_01",
      "label": "Delivery",
      "movCode": "101",
      "status": "ok"
    }
  ],
  "groups": []
}
```

### Node classes

| `nodeClass` | Description |
|---|---|
| *(empty)* | Standard station — tracks inventory via inbound minus outbound movements |
| `source` | Supplier / external source — always shows as positive "Sent" quantity |
| `transit` | In-Transit hub — transparent pass-through, no SLoc of its own |
| `ledger` | Accumulates totals for selected columns across matching movement codes |
| `register` | Shows latest values from the most recent matching row |
| `consumption` | BOM-based production node — tracks produced quantity and input consumption |

---

## Project Structure

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for a full file-by-file breakdown.

---

## License

MIT
