const STORAGE_KEY = "supply-chain-visualizer-v2";
    const MAX_HISTORY = 60;
    const history = [];

    const NODE_W = 168;
    const NODE_H = 108;
    const ZOOM_MIN = 0.45;
    const ZOOM_MAX = 2.2;
    const ZOOM_STEP = 0.1;
    const DEFAULT_FINAL_FIELDS = {
      nodeType: true,
      nodeStatus: true,
      nodeWip: true,
      nodeOwner: false,
      nodeLocation: false,
      linkLabel: false
    };

    const LAYOUTS_KEY = "scv-layouts-v1";

    const demoState = {
      nodes: [
        // Suppliers
        { id: "bosch",    label: "Robert Bosch GmbH",    type: "Supplier",  status: "ok",       x: 60,   y: 60,   owner: "Robert Bosch GmbH",    location: "Stuttgart",       inCode: "", outCode: "", defects: 0, description: "Tier-1 supplier of fuel systems and electronics." },
        { id: "zf",       label: "ZF Friedrichshafen",   type: "Supplier",  status: "ok",       x: 60,   y: 230,  owner: "ZF Group",              location: "Friedrichshafen", inCode: "", outCode: "", defects: 0, description: "Transmission and chassis components." },
        { id: "conti",    label: "Continental AG",        type: "Supplier",  status: "warning",  x: 60,   y: 400,  owner: "Continental AG",        location: "Hanover",         inCode: "", outCode: "", defects: 2, description: "Tires, brakes, and powertrain parts." },
        { id: "magna",    label: "Magna International",   type: "Supplier",  status: "ok",       x: 60,   y: 570,  owner: "Magna International",   location: "Aurora, ON",      inCode: "", outCode: "", defects: 0, description: "Body assemblies and seating systems." },
        { id: "denso",    label: "Denso Corporation",     type: "Supplier",  status: "ok",       x: 60,   y: 740,  owner: "Denso Corporation",     location: "Kariya, Aichi",   inCode: "", outCode: "", defects: 0, description: "HVAC units and sensors." },
        // Storage / Flow Locations
        { id: "trns",     label: "In Transit (TRNS)",     type: "Transit",   status: "ok",       x: 360,  y: 400,  owner: "Logistics",             location: "En Route",        inCode: "", outCode: "101", defects: 0, description: "Goods in transit from suppliers to plant." },
        { id: "wh0001",   label: "Warehouse (0001)",       type: "Warehouse", status: "ok",       x: 620,  y: 400,  owner: "Plant Logistics",       location: "Plant A",         inCode: "101", outCode: "311", defects: 0, description: "Unrestricted warehouse stock. Mv101=GR inbound, Mv311=transfer out." },
        { id: "qi01",     label: "Quality Insp. (QI01)",  type: "QA",        status: "warning",  x: 880,  y: 400,  owner: "Quality Control",       location: "Plant A",         inCode: "322", outCode: "321", defects: 4, description: "Quality inspection stock. Mv322=placed into QI, Mv321=released." },
        { id: "line",     label: "Assembly Line (LINE)",  type: "Station",   status: "ok",       x: 1140, y: 220,  owner: "Production Mfg.",       location: "Plant A",         inCode: "311", outCode: "261", defects: 0, description: "Production line. Mv311=parts issued to line, Mv261=GI to production order." },
        { id: "rwrk",     label: "Rework (RWRK)",         type: "Rework",    status: "warning",  x: 1140, y: 430,  owner: "Quality Control",       location: "Plant A",         inCode: "311", outCode: "", defects: 3, description: "Rework area for rejected line parts." },
        { id: "blok",     label: "Blocked (BLOK)",        type: "Blocked",   status: "critical", x: 1140, y: 620,  owner: "Quality Control",       location: "Plant A",         inCode: "344", outCode: "551", defects: 6, description: "Blocked stock pending disposition. Mv344=blocked, Mv551=scrapped." },
        { id: "scrp",     label: "Scrap (SCRP)",          type: "Scrap",     status: "blocked",  x: 1140, y: 800,  owner: "Quality Control",       location: "Plant A",         inCode: "551", outCode: "", defects: 0, description: "Scrapped material. Final destination for Mv551." },
        { id: "fg01",     label: "Finished Goods (FG01)", type: "FG",        status: "ok",       x: 1400, y: 220,  owner: "Outbound Logistics",    location: "Plant A",         inCode: "261", outCode: "601", defects: 0, description: "Finished goods ready for dispatch. Mv601=delivery to customer." },
        // Dealers / Customers
        { id: "autowelt", label: "AutoWelt Stuttgart",    type: "Dealer",    status: "ok",       x: 1660, y: 80,   owner: "AutoWelt GmbH",         location: "Stuttgart",       inCode: "", outCode: "", defects: 0, description: "Key dealer in Baden-Württemberg." },
        { id: "carmax",   label: "CarMax Muenchen",       type: "Dealer",    status: "ok",       x: 1660, y: 260,  owner: "CarMax AG",             location: "Munich",          inCode: "", outCode: "", defects: 0, description: "Bavarian dealership group." },
        { id: "starmot",  label: "StarMotors Berlin",     type: "Dealer",    status: "ok",       x: 1660, y: 440,  owner: "StarMotors KG",         location: "Berlin",          inCode: "", outCode: "", defects: 0, description: "Berlin flagship dealer." }
      ],
      links: [
        { id: "bosch_trns",  source: "bosch",    target: "trns",    label: "GR for PO",          movCode: "101", status: "ok"       },
        { id: "zf_trns",     source: "zf",       target: "trns",    label: "GR for PO",          movCode: "101", status: "ok"       },
        { id: "conti_trns",  source: "conti",    target: "trns",    label: "GR for PO",          movCode: "101", status: "warning"  },
        { id: "magna_trns",  source: "magna",    target: "trns",    label: "GR for PO",          movCode: "101", status: "ok"       },
        { id: "denso_trns",  source: "denso",    target: "trns",    label: "GR for PO",          movCode: "101", status: "ok"       },
        { id: "trns_wh",     source: "trns",     target: "wh0001",  label: "Inbound Receipt",    movCode: "101", status: "ok"       },
        { id: "wh_qi",       source: "wh0001",   target: "qi01",    label: "To QI",              movCode: "322", status: "ok"       },
        { id: "wh_line",     source: "wh0001",   target: "line",    label: "Transfer to Line",   movCode: "311", status: "ok"       },
        { id: "wh_blok",     source: "wh0001",   target: "blok",    label: "To Blocked",         movCode: "344", status: "warning"  },
        { id: "qi_line",     source: "qi01",     target: "line",    label: "QI Released",        movCode: "321", status: "ok"       },
        { id: "qi_rwrk",     source: "qi01",     target: "rwrk",    label: "QI Fail → Rework",   movCode: "311", status: "warning"  },
        { id: "qi_scrp",     source: "qi01",     target: "scrp",    label: "QI Scrapped",        movCode: "551", status: "critical" },
        { id: "qi_trns",     source: "qi01",     target: "trns",    label: "Return to Vendor",   movCode: "122", status: "warning"  },
        { id: "rwrk_line",   source: "rwrk",     target: "line",    label: "Rework Cleared",     movCode: "",    status: "warning"  },
        { id: "blok_scrp",   source: "blok",     target: "scrp",    label: "Scrapped",           movCode: "551", status: "critical" },
        { id: "line_fg",     source: "line",     target: "fg01",    label: "GI to Production",   movCode: "261", status: "ok"       },
        { id: "fg_autowelt", source: "fg01",     target: "autowelt",label: "Delivery",           movCode: "601", status: "ok"       },
        { id: "fg_carmax",   source: "fg01",     target: "carmax",  label: "Delivery",           movCode: "601", status: "ok"       },
        { id: "fg_starmot",  source: "fg01",     target: "starmot", label: "Delivery",           movCode: "601", status: "ok"       }
      ],
      groups: [
        { id: "grp_suppliers", label: "Suppliers",            nodeIds: ["bosch","zf","conti","magna","denso"],                      color: "#5ba4cf" },
        { id: "grp_plant",     label: "Plant (Storage/Flow)", nodeIds: ["trns","wh0001","qi01","line","rwrk","blok","scrp","fg01"], color: "#8ce0c2" },
        { id: "grp_dealers",   label: "Dealers / Customers",  nodeIds: ["autowelt","carmax","starmot"],                              color: "#ffd27a" }
      ]
    };


    const state = {
      nodes: [],
      links: [],
      selectedKind: null,
      selectedId: null,
      tool: "select",
      activeTab: "edit",
      connectionSource: null,
      dragging: null,
      finalMode: false,
      zoom: 1,
      panX: 0,
      panY: 0,
      finalFields: { ...DEFAULT_FINAL_FIELDS },
      nodeViewMode: false,
      nodeViewId: null,
      groups: [],
      multiSelectedIds: [],
      selectedDate: "",
      selectedTimeSlot: 0,
      highlightPart: "",
      initStockMode: false,
      compoundStack: [],
      // Raw data (from uploaded xlsx/csv file)
      rawData: [],
      rawHeaders: [],
      rawFileName: "",
      movColumn: "",
      dateColumn: "",
      qtyColumn: "",
      rawSheets: {},
      rawSheetName: "",
      partColumn: "",
      timeColumn: "",
      srcSlocColumn: "",
      dstSlocColumn: "",
    };

    // ── DOM references ────────────────────────────────────────────────────────
    const app = document.getElementById("app");
    const canvas = document.getElementById("canvas");
    const nodeLayer = document.getElementById("nodeLayer");
    const linkLayer = document.getElementById("linkLayer");
    const groupLayer = document.getElementById("groupLayer");
    const portLayer = document.getElementById("portLayer");
    const panelBody = document.getElementById("panelBody");
    const panelTitle = document.getElementById("panelTitle");
    const panelKicker = document.getElementById("panelKicker");
    const selectionChip = document.getElementById("selectionChip");
    const modeLabel = document.getElementById("modeLabel");
    const saveState = document.getElementById("saveState");
    const toast = document.getElementById("toast");
    const zoomValue = document.getElementById("zoomValue");
