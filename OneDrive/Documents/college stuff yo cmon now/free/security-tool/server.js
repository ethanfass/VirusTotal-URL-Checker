import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getQuotaSnapshot, triageIndicator } from "./lib/triage.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicRoot = path.join(__dirname, "public");
const port = Number(process.env.PORT || 5173);

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".ico", "image/x-icon"]
]);

const server = createServer(async (req, res) => {
  try {
    if (req.method === "POST" && req.url === "/api/triage") {
      const body = await readJsonBody(req);
      const result = await triageIndicator(body);
      return sendJson(res, result);
    }

    if (req.method === "GET" && req.url === "/api/quota") {
      return sendJson(res, getQuotaSnapshot());
    }

    if (req.method !== "GET") {
      return sendJson(res, { error: "Method not allowed" }, 405);
    }

    return serveStatic(req, res);
  } catch (error) {
    return sendError(res, error);
  }
});

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  server.listen(port, () => {
    console.log(`Office Threat Desk is running at http://localhost:${port}`);
  });
}

async function serveStatic(req, res) {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const requestedPath = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
  const decodedPath = decodeURIComponent(requestedPath);
  const filePath = path.normalize(path.join(publicRoot, decodedPath));

  if (filePath !== publicRoot && !filePath.startsWith(`${publicRoot}${path.sep}`)) {
    return sendJson(res, { error: "Invalid file path." }, 400);
  }

  try {
    const contents = await readFile(filePath);
    res.writeHead(200, {
      "Content-Type": mimeTypes.get(path.extname(filePath)) || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    res.end(contents);
  } catch {
    sendJson(res, { error: "Not found." }, 404);
  }
}

async function readJsonBody(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 1_000_000) {
      const error = new Error("Request body is too large.");
      error.status = 413;
      throw error;
    }
  }

  try {
    return body ? JSON.parse(body) : {};
  } catch {
    const error = new Error("Request body must be valid JSON.");
    error.status = 400;
    throw error;
  }
}

function sendError(res, error) {
  const status = error.status || 500;
  const message = status === 500 ? "The desk hit a server-side snag." : error.message;
  return sendJson(res, { error: message, details: error.details || null }, status);
}

function sendJson(res, data, status = 200) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(data));
}

export { server };
