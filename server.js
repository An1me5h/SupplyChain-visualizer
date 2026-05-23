const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT || 4173);
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const NETWORK_FILE = path.join(DATA_DIR, "network.json");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".tsv": "text/tab-separated-values; charset=utf-8"
};

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": type,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 5_000_000) {
        reject(new Error("Request too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function safeFile(urlPath) {
  const requested = urlPath === "/" ? "/index.html" : urlPath;
  const filePath = path.normalize(path.join(ROOT, requested));
  if (!filePath.startsWith(ROOT)) return null;
  return filePath;
}

function defaultNetwork() {
  return {
    nodes: [],
    links: [],
    tables: [],
    joins: [],
    finalFields: {},
    zoom: 1,
    panX: 0,
    panY: 0
  };
}

function listTables() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  return fs.readdirSync(DATA_DIR)
    .filter((name) => /\.(csv|tsv)$/i.test(name))
    .map((name) => {
      const filePath = path.join(DATA_DIR, name);
      const firstLine = fs.readFileSync(filePath, "utf8").split(/\r?\n/)[0] || "";
      const delimiter = name.toLowerCase().endsWith(".tsv") ? "\t" : ",";
      return {
        name,
        columns: firstLine.split(delimiter).map((column) => column.trim()).filter(Boolean)
      };
    });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") {
      send(res, 204, "");
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname === "/api/network" && req.method === "GET") {
      if (!fs.existsSync(NETWORK_FILE)) {
        send(res, 200, JSON.stringify(defaultNetwork(), null, 2));
        return;
      }
      send(res, 200, fs.readFileSync(NETWORK_FILE, "utf8"));
      return;
    }

    if (url.pathname === "/api/network" && req.method === "POST") {
      const body = await readBody(req);
      const parsed = JSON.parse(body);
      if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.links)) {
        send(res, 400, JSON.stringify({ error: "Network must include nodes and links arrays." }));
        return;
      }
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(NETWORK_FILE, JSON.stringify(parsed, null, 2));
      send(res, 200, JSON.stringify({ ok: true }));
      return;
    }

    // Serve raw xlsx/csv data file for client-side parsing
    if (url.pathname === "/api/rawfile" && req.method === "GET") {
      const xlsxFile = path.join(ROOT, "DummyData_SAP_MultiDay_ECN_Log_Expanded.xlsx");
      if (fs.existsSync(xlsxFile)) {
        const buf = fs.readFileSync(xlsxFile);
        res.writeHead(200, {
          "Content-Type": "application/octet-stream",
          "Access-Control-Allow-Origin": "*",
          "X-Filename": "DummyData_SAP_MultiDay_ECN_Log_Expanded.xlsx"
        });
        res.end(buf);
        return;
      }
      send(res, 404, JSON.stringify({ error: "xlsx file not found in project root." }));
      return;
    }

    if (url.pathname === "/api/tables" && req.method === "GET") {
      send(res, 200, JSON.stringify({ tables: listTables() }, null, 2));
      return;
    }

    const filePath = safeFile(url.pathname);
    if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      send(res, 404, "Not found", "text/plain; charset=utf-8");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    send(res, 200, fs.readFileSync(filePath), MIME[ext] || "application/octet-stream");
  } catch (error) {
    send(res, 500, JSON.stringify({ error: error.message }));
  }
});

server.listen(PORT, () => {
  console.log(`Supply Chain Visualizer backend running at http://localhost:${PORT}`);
});
