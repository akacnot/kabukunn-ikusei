const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT || 4175);
const ROOT = __dirname;
const DB_PATH = path.join(ROOT, "server-data.json");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

function loadDb() {
  if (!fs.existsSync(DB_PATH)) return { profiles: {}, requests: [] };
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
  } catch {
    return { profiles: {}, requests: [] };
  }
}

function saveDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function sendJson(res, data, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function publicProfile(profile) {
  if (!profile) return null;
  return {
    code: profile.code,
    coins: profile.coins || 0,
    friendship: profile.friendship || 1,
    updatedAt: profile.updatedAt || 0
  };
}

async function handleApi(req, res) {
  const db = loadDb();
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === "POST" && url.pathname === "/api/profile") {
    const body = await readBody(req);
    if (!/^\d{12}$/.test(body.code || "")) return sendJson(res, { error: "invalid_code" }, 400);
    db.profiles[body.code] = {
      ...(db.profiles[body.code] || {}),
      code: body.code,
      coins: Number(body.coins || 0),
      friendship: Number(body.friendship || 1),
      updatedAt: Date.now()
    };
    saveDb(db);
    return sendJson(res, { profile: publicProfile(db.profiles[body.code]) });
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/friends/")) {
    const code = decodeURIComponent(url.pathname.replace("/api/friends/", ""));
    const profile = db.profiles[code];
    const friendCodes = profile?.friends || [];
    const incoming = db.requests.filter((request) => request.to === code);
    const outgoing = db.requests.filter((request) => request.from === code);
    return sendJson(res, {
      profile: publicProfile(profile),
      friends: friendCodes.map((friendCode) => publicProfile(db.profiles[friendCode])).filter(Boolean),
      incoming,
      outgoing
    });
  }

  if (req.method === "POST" && url.pathname === "/api/friend-request") {
    const body = await readBody(req);
    if (!/^\d{12}$/.test(body.from || "") || !/^\d{12}$/.test(body.to || "")) {
      return sendJson(res, { error: "invalid_code" }, 400);
    }
    if (body.from === body.to) return sendJson(res, { error: "same_code" }, 400);
    db.profiles[body.from] = db.profiles[body.from] || { code: body.from, coins: 0, friendship: 1, friends: [] };
    db.profiles[body.to] = db.profiles[body.to] || { code: body.to, coins: 0, friendship: 1, friends: [] };
    const exists = db.requests.some((request) => request.from === body.from && request.to === body.to);
    if (!exists) db.requests.push({ from: body.from, to: body.to, createdAt: Date.now() });
    saveDb(db);
    return sendJson(res, { ok: true });
  }

  if (req.method === "POST" && url.pathname === "/api/friend-approve") {
    const body = await readBody(req);
    const owner = db.profiles[body.owner];
    const requester = db.profiles[body.requester];
    if (!owner || !requester) return sendJson(res, { error: "not_found" }, 404);
    owner.friends = Array.from(new Set([...(owner.friends || []), requester.code]));
    requester.friends = Array.from(new Set([...(requester.friends || []), owner.code]));
    db.requests = db.requests.filter((request) => !(request.from === requester.code && request.to === owner.code));
    saveDb(db);
    return sendJson(res, { ok: true });
  }

  return sendJson(res, { error: "not_found" }, 404);
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const requested = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = path.normalize(path.join(ROOT, requested));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      return res.end("Not found");
    }
    res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream" });
    res.end(data);
  });
}

http
  .createServer((req, res) => {
    if (req.url.startsWith("/api/")) return handleApi(req, res);
    serveStatic(req, res);
  })
  .listen(PORT, "127.0.0.1", () => {
    console.log(`Kabukun server: http://127.0.0.1:${PORT}/`);
  });
