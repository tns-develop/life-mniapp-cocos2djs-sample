/**
 * scripts/dev-proxy.js
 *
 * 開発時に frontend を配信しつつ、/iap/* と /me だけバックエンド(server)へ
 * 透過プロキシする超軽量サーバー。これによりフロントとサーバーが同一オリジンに
 * なるので、ngrokを1本立てるだけで実機テストできる。
 *
 * 起動例:
 *   FRONT_DIR=frontend BACKEND=http://localhost:4000 PORT=3000 node scripts/dev-proxy.js
 *
 * デフォルト:
 *   FRONT_DIR = frontend
 *   BACKEND   = http://localhost:4000
 *   PORT      = 3000
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const FRONT_DIR = path.resolve(process.env.FRONT_DIR || "frontend");
const BACKEND = process.env.BACKEND || "http://localhost:4000";
const PORT = Number(process.env.PORT || 3000);

const PROXY_PREFIXES = ["/iap/", "/me"];

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif":  "image/gif",
  ".svg":  "image/svg+xml",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf":  "font/ttf",
  ".plist": "application/xml; charset=utf-8",
  ".fnt":  "text/plain; charset=utf-8",
};

function shouldProxy(pathname) {
  return PROXY_PREFIXES.some((p) =>
    p.endsWith("/") ? pathname.startsWith(p) : pathname === p || pathname.startsWith(p + "?")
  );
}

function proxy(req, res) {
  const backendUrl = new URL(req.url, BACKEND);
  const opts = {
    method: req.method,
    headers: { ...req.headers, host: backendUrl.host },
  };
  const proxyReq = http.request(backendUrl, opts, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });
  proxyReq.on("error", (e) => {
    res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    res.end("Bad gateway: " + e.message);
  });
  req.pipe(proxyReq);
}

function serveStatic(req, res) {
  const u = new URL(req.url, "http://localhost");
  let p = decodeURIComponent(u.pathname);
  if (p === "/" || p === "") p = "/index.html";

  // ディレクトリトラバーサル防止
  const filePath = path.normalize(path.join(FRONT_DIR, p));
  if (!filePath.startsWith(FRONT_DIR)) {
    res.writeHead(403); res.end("Forbidden"); return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("Not found: " + p);
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "content-type": MIME[ext] || "application/octet-stream",
      "cache-control": "no-store",
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const pathname = req.url.split("?")[0];
  if (shouldProxy(pathname)) {
    proxy(req, res);
  } else {
    serveStatic(req, res);
  }
});

server.listen(PORT, () => {
  console.log(`dev-proxy listening on http://localhost:${PORT}`);
  console.log(`  static: ${FRONT_DIR}`);
  console.log(`  proxy : ${PROXY_PREFIXES.join(", ")} -> ${BACKEND}`);
});
