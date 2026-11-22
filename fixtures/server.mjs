import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROUTE_ROOTS = {
  "/info": path.join(__dirname, "information-site"),
  "/search": path.join(__dirname, "search-site"),
  "/form": path.join(__dirname, "form-site"),
  "/adversarial": path.join(__dirname, "adversarial-site"),
};

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

const INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><title>AdaptUI Local Test Fixtures</title></head>
<body style="font-family:system-ui,sans-serif;max-width:720px;margin:32px auto;padding:0 16px;">
  <main>
    <h1>AdaptUI Fixture Websites</h1>
    <p>Deterministic local websites for development, accessibility testing, and MVP demonstrations.</p>
    <nav aria-label="Available fixtures">
      <ul>
        <li><a href="/info/index.html">Workflow A: Civic Accessibility Research Center (Information Retrieval)</a></li>
        <li><a href="/search/index.html">Workflow B: Open Access Knowledge Hub (Search &amp; Navigation)</a></li>
        <li><a href="/form/index.html">Workflow C: Community Accessibility Clinic (Form Interaction)</a></li>
        <li><a href="/adversarial/index.html">Security Test: Adversarial Prompt-Injection &amp; Safety Page</a></li>
      </ul>
    </nav>
  </main>
</body>
</html>`;

export function createFixtureServer() {
  return http.createServer((req, res) => {
    const reqUrl = new URL(req.url || "/", "http://127.0.0.1");
    const pathname = reqUrl.pathname;

    if (pathname === "/" || pathname === "/index.html") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(INDEX_HTML);
      return;
    }

    for (const [prefix, dir] of Object.entries(ROUTE_ROOTS)) {
      if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
        const rel = pathname.slice(prefix.length).replace(/^\/+/, "") || "index.html";
        const resolved = path.resolve(dir, rel);
        if (!resolved.startsWith(path.resolve(dir))) {
          res.writeHead(403, { "Content-Type": "text/plain" });
          res.end("Forbidden");
          return;
        }
        if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
          const ext = path.extname(resolved).toLowerCase();
          res.writeHead(200, {
            "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
            "Cache-Control": "no-store",
          });
          fs.createReadStream(resolved).pipe(res);
          return;
        }
      }
    }

    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(`Not found: ${pathname}`);
  });
}

export async function startFixtureServer(port = 0) {
  const server = createFixtureServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  const addr = server.address();
  const actualPort = typeof addr === "object" && addr ? addr.port : port;
  return {
    server,
    port: actualPort,
    baseUrl: `http://127.0.0.1:${actualPort}`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const port = Number(process.env.FIXTURE_PORT || 4179);
  startFixtureServer(port).then(({ baseUrl }) => {
    console.log(`AdaptUI fixture server listening at ${baseUrl}`);
  });
}
