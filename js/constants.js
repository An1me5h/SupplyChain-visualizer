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
        { id: "bosch",      label: "Robert Bosch GmbH",    type: "Supplier",  status: "ok",      x: -328, y: 272,  owner: "Robert Bosch GmbH",   location: "Stuttgart",       nodeCode: "", extraFilters: [{ column: "Supplier_ID", value: "V200001" }], color: "",       defects: 0, description: "Tier-1 supplier of fuel systems and electronics.", initStock: {}, rules: "", nodeClass: "source",  innerNodes: [], innerLinks: [], innerGroups: [] },
        { id: "zf",         label: "ZF Friedrichshafen",   type: "Supplier",  status: "ok",      x: -323, y: 388,  owner: "ZF Group",            location: "Friedrichshafen", nodeCode: "", extraFilters: [{ column: "Supplier_ID", value: "V200002" }], color: "",       defects: 0, description: "Transmission and chassis components.",               initStock: {}, rules: "", nodeClass: "source",  innerNodes: [], innerLinks: [], innerGroups: [] },
        { id: "conti",      label: "Continental AG",        type: "Supplier",  status: "ok",      x: -328, y: 498,  owner: "Continental AG",      location: "Hanover",         nodeCode: "", extraFilters: [{ column: "Supplier_ID", value: "V200003" }], color: "",       defects: 2, description: "Tires, brakes, and powertrain parts.",               initStock: {}, rules: "", nodeClass: "source",  innerNodes: [], innerLinks: [], innerGroups: [] },
        { id: "magna",      label: "Magna International",   type: "Supplier",  status: "ok",      x: -331, y: 620,  owner: "Magna International", location: "Aurora, ON",      nodeCode: "", extraFilters: [{ column: "Supplier_ID", value: "V200004" }], color: "",       defects: 0, description: "Body assemblies and seating systems.",               initStock: {}, rules: "", nodeClass: "source",  innerNodes: [], innerLinks: [], innerGroups: [] },
        { id: "denso",      label: "Denso Corporation",     type: "Supplier",  status: "ok",      x: -320, y: 748,  owner: "Denso Corporation",   location: "Kariya, Aichi",   nodeCode: "", extraFilters: [{ column: "Supplier_ID", value: "V200005" }], color: "",       defects: 0, description: "HVAC units and sensors.",                            initStock: {}, rules: "", nodeClass: "source",  innerNodes: [], innerLinks: [], innerGroups: [] },
        { id: "trns",       label: "Supplier Transit",      type: "Transit",   status: "ok",      x:  102, y:  89,  owner: "Logistics",           location: "En Route",        nodeCode: "", extraFilters: [],                                            color: "",       defects: 0, description: "Goods in transit from suppliers to plant.",           initStock: {}, rules: "", nodeClass: "transit", innerNodes: [], innerLinks: [], innerGroups: [] },
        { id: "wh0001",     label: "Warehouse (0001)",       type: "Warehouse", status: "ok",      x:  458, y:  97,  owner: "Plant Logistics",     location: "Plant A",         nodeCode: "0001",  extraFilters: [],                                      color: "#8a8fa8",defects: 0, description: "Unrestricted warehouse stock. Mv101=GR inbound, Mv311=transfer out.", initStock: {}, rules: "", nodeClass: "",        innerNodes: [], innerLinks: [], innerGroups: [] },
        { id: "qi01",       label: "Quality Insp. (QI01)",  type: "QA",        status: "ok",      x:  442, y: 566,  owner: "Quality Control",     location: "Plant A",         nodeCode: "QI01",  extraFilters: [],                                      color: "",       defects: 4, description: "Quality inspection stock. Mv322=placed into QI, Mv321=released.", initStock: {}, rules: "", nodeClass: "",        innerNodes: [], innerLinks: [], innerGroups: [] },
        { id: "line",       label: "Assembly Line (LINE)",  type: "Station",   status: "ok",      x:  785, y: 103,  owner: "Production Mfg.",     location: "Plant A",         nodeCode: "LINE",  extraFilters: [],                                      color: "",       defects: 0, description: "Production line. Mv311=parts issued to line, Mv261=GI to production order.", initStock: {}, rules: "", nodeClass: "",        innerNodes: [], innerLinks: [], innerGroups: [] },
        { id: "rwrk",       label: "Rework (RWRK)",         type: "Rework",    status: "warning", x:  769, y: 267,  owner: "Quality Control",     location: "Plant A",         nodeCode: "RWRK",  extraFilters: [],                                      color: "",       defects: 3, description: "Rework area for rejected line parts.",               initStock: {}, rules: "", nodeClass: "",        innerNodes: [], innerLinks: [], innerGroups: [] },
        { id: "blok",       label: "Blocked (BLOK)",        type: "Blocked",   status: "ok",      x:  780, y: 401,  owner: "Quality Control",     location: "Plant A",         nodeCode: "BLOK",  extraFilters: [],                                      color: "",       defects: 6, description: "Blocked stock pending disposition. Mv344=blocked, Mv551=scrapped.", initStock: {}, rules: "", nodeClass: "",        innerNodes: [], innerLinks: [], innerGroups: [] },
        { id: "scrp",       label: "Scrap (SCRP)",          type: "Scrap",     status: "blocked", x: 1102, y: 674,  owner: "Quality Control",     location: "Plant A",         nodeCode: "SCRP",  extraFilters: [],                                      color: "",       defects: 0, description: "Scrapped material. Final destination for Mv551.",    initStock: {}, rules: "", nodeClass: "",        innerNodes: [], innerLinks: [], innerGroups: [] },
        { id: "fg01",       label: "Finished Goods (FG01)", type: "FG",        status: "ok",      x: 1099, y:  99,  owner: "Outbound Logistics",  location: "Plant A",         nodeCode: "FG01",  extraFilters: [],                                      color: "",       defects: 0, description: "Finished goods ready for dispatch. Mv601=delivery to customer.", initStock: {}, rules: "", nodeClass: "",        innerNodes: [], innerLinks: [], innerGroups: [] },
        { id: "autowelt",   label: "AutoWelt Stuttgart",    type: "Dealer",    status: "ok",      x: 1638, y:  12,  owner: "AutoWelt GmbH",       location: "Stuttgart",       nodeCode: "", extraFilters: [{ column: "Customer_ID", value: "C50001" }], color: "",       defects: 0, description: "Key dealer in Baden-Wuerttemberg.",                  initStock: {}, rules: "", nodeClass: "end",     innerNodes: [], innerLinks: [], innerGroups: [] },
        { id: "carmax",     label: "CarMax Muenchen",       type: "Dealer",    status: "ok",      x: 1642, y: 130,  owner: "CarMax AG",           location: "Munich",          nodeCode: "", extraFilters: [{ column: "Customer_ID", value: "C50002" }], color: "",       defects: 0, description: "Bavarian dealership group.",                         initStock: {}, rules: "", nodeClass: "",        innerNodes: [], innerLinks: [], innerGroups: [] },
        { id: "starmot",    label: "StarMotors Berlin",     type: "Dealer",    status: "ok",      x: 1641, y: 251,  owner: "StarMotors KG",       location: "Berlin",          nodeCode: "", extraFilters: [{ column: "Customer_ID", value: "C50003" }], color: "",       defects: 0, description: "Berlin flagship dealer.",                            initStock: {}, rules: "", nodeClass: "",        innerNodes: [], innerLinks: [], innerGroups: [] },
        { id: "station_17", label: "Transit Dealers",       type: "Station",   status: "ok",      x: 1354, y: 109,  owner: "",                    location: "",                nodeCode: "", extraFilters: [],                                            color: "",       defects: 0, description: "",                                                   initStock: {}, rules: "", nodeClass: "transit", innerNodes: [], innerLinks: [], innerGroups: [] }
      ],
      links: [
        { id: "bosch_trns",              source: "bosch",      target: "trns",       label: "GR for PO",                               movCode: "101", status: "ok",       matchColumn: "", matchValue: "", color: "", linkType: "movement" },
        { id: "zf_trns",                 source: "zf",         target: "trns",       label: "GR for PO",                               movCode: "101", status: "ok",       matchColumn: "", matchValue: "", color: "", linkType: "movement" },
        { id: "conti_trns",              source: "conti",      target: "trns",       label: "GR for PO",                               movCode: "101", status: "warning",  matchColumn: "", matchValue: "", color: "", linkType: "movement" },
        { id: "magna_trns",              source: "magna",      target: "trns",       label: "GR for PO",                               movCode: "101", status: "ok",       matchColumn: "", matchValue: "", color: "", linkType: "movement" },
        { id: "denso_trns",              source: "denso",      target: "trns",       label: "GR for PO",                               movCode: "101", status: "ok",       matchColumn: "", matchValue: "", color: "", linkType: "movement" },
        { id: "trns_wh",                 source: "trns",       target: "wh0001",     label: "Inbound Receipt",                         movCode: "101", status: "ok",       matchColumn: "", matchValue: "", color: "", linkType: "movement" },
        { id: "wh_qi",                   source: "wh0001",     target: "qi01",       label: "To QI",                                   movCode: "322", status: "ok",       matchColumn: "", matchValue: "", color: "", linkType: "movement" },
        { id: "wh_line",                 source: "wh0001",     target: "line",       label: "Transfer to Line",                        movCode: "311", status: "ok",       matchColumn: "", matchValue: "", color: "", linkType: "movement" },
        { id: "wh_blok",                 source: "wh0001",     target: "blok",       label: "To Blocked",                              movCode: "344", status: "warning",  matchColumn: "", matchValue: "", color: "", linkType: "movement" },
        { id: "qi_scrp",                 source: "qi01",       target: "scrp",       label: "QI Scrapped",                             movCode: "551", status: "critical", matchColumn: "", matchValue: "", color: "", linkType: "movement" },
        { id: "qi_trns",                 source: "qi01",       target: "trns",       label: "Return to Vendor",                        movCode: "122", status: "ok",       matchColumn: "", matchValue: "", color: "", linkType: "movement" },
        { id: "blok_scrp",               source: "blok",       target: "scrp",       label: "Scrapped",                                movCode: "551", status: "critical", matchColumn: "", matchValue: "", color: "", linkType: "movement" },
        { id: "line_fg",                 source: "line",       target: "fg01",       label: "GI to Production",                        movCode: "261", status: "ok",       matchColumn: "", matchValue: "", color: "", linkType: "movement" },
        { id: "link_line_rwrk",          source: "line",       target: "rwrk",       label: "Assembly Line (LINE) to Rework (RWRK)",   movCode: "311", status: "ok",       matchColumn: "", matchValue: "", color: "", linkType: "movement" },
        { id: "link_trns_bosch",         source: "trns",       target: "bosch",      label: "In Transit to Robert Bosch GmbH",         movCode: "122", status: "ok",       matchColumn: "", matchValue: "", color: "", linkType: "movement" },
        { id: "link_trns_zf",            source: "trns",       target: "zf",         label: "In Transit to ZF Friedrichshafen",        movCode: "122", status: "ok",       matchColumn: "", matchValue: "", color: "", linkType: "movement" },
        { id: "link_trns_conti",         source: "trns",       target: "conti",      label: "In Transit to Continental AG",            movCode: "122", status: "ok",       matchColumn: "", matchValue: "", color: "", linkType: "movement" },
        { id: "link_trns_magna",         source: "trns",       target: "magna",      label: "In Transit to Magna International",       movCode: "122", status: "ok",       matchColumn: "", matchValue: "", color: "", linkType: "movement" },
        { id: "link_trns_denso",         source: "trns",       target: "denso",      label: "In Transit to Denso Corporation",         movCode: "122", status: "ok",       matchColumn: "", matchValue: "", color: "", linkType: "movement" },
        { id: "link_rwrk_wh0001",        source: "rwrk",       target: "wh0001",     label: "Rework (RWRK) to Warehouse (0001)",       movCode: "311", status: "ok",       matchColumn: "", matchValue: "", color: "", linkType: "movement" },
        { id: "link_qi01_wh0001",        source: "qi01",       target: "wh0001",     label: "Quality Insp. (QI01) to Warehouse (0001)",movCode: "321", status: "ok",       matchColumn: "", matchValue: "", color: "", linkType: "movement" },
        { id: "link_rwrk_scrp",          source: "rwrk",       target: "scrp",       label: "Rework (RWRK) to Scrap (SCRP)",           movCode: "551", status: "ok",       matchColumn: "", matchValue: "", color: "", linkType: "movement" },
        { id: "link_fg01_station_17",    source: "fg01",       target: "station_17", label: "Finished Goods (FG01) to Transit Dealers",movCode: "601", status: "ok",       matchColumn: "", matchValue: "", color: "", linkType: "movement" },
        { id: "link_station_17_autowelt",source: "station_17", target: "autowelt",   label: "Transit Dealers to AutoWelt Stuttgart",   movCode: "601", status: "ok",       matchColumn: "", matchValue: "", color: "", linkType: "movement" },
        { id: "link_station_17_carmax",  source: "station_17", target: "carmax",     label: "Transit Dealers to CarMax Muenchen",      movCode: "601", status: "ok",       matchColumn: "", matchValue: "", color: "", linkType: "movement" },
        { id: "link_station_17_starmot", source: "station_17", target: "starmot",    label: "Transit Dealers to StarMotors Berlin",    movCode: "601", status: "ok",       matchColumn: "", matchValue: "", color: "", linkType: "movement" }
      ],
      groups: [
        { id: "grp_suppliers", label: "Suppliers",            nodeIds: ["bosch","zf","conti","magna","denso"],                               color: "#5ba4cf" },
        { id: "grp_plant",     label: "Plant (Storage/Flow)", nodeIds: ["trns","wh0001","qi01","line","rwrk","blok","scrp","fg01"],           color: "#8ce0c2" },
        { id: "grp_dealers",   label: "Dealers / Customers",  nodeIds: ["autowelt","carmax","starmot","station_17"],                          color: "#ffd27a" }
      ],
      finalFields: { nodeType: true, nodeStatus: true, nodeWip: true, nodeOwner: false, nodeLocation: false, linkLabel: false },
      zoom: 0.77, panX: 405, panY: 319,
      movColumn: "Mvt_Type", dateColumn: "Posting_Date", qtyColumn: "Quantity",
      partColumn: "Part_No",  timeColumn: "Time"
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
