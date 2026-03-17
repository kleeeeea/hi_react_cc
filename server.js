import { readFile, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ratingsFile = path.resolve(__dirname, "data/qualitative/message_ratings.json");

function getArg(flag, fallback) {
  const index = process.argv.indexOf(flag);
  if (index >= 0 && process.argv[index + 1]) {
    return process.argv[index + 1];
  }
  return fallback;
}

async function readRatingsFile() {
  try {
    const content = await readFile(ratingsFile, "utf8");
    return JSON.parse(content);
  } catch {
    return { version: 1, savedAt: null, records: {} };
  }
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

async function handleRatingsApi(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method === "GET") {
    const data = await readRatingsFile();
    res.end(JSON.stringify(data));
    return true;
  }

  if (req.method === "POST") {
    try {
      const body = await readRequestBody(req);
      const payload = JSON.parse(body);
      const nextFile = {
        version: payload.version ?? 1,
        savedAt: payload.savedAt ?? new Date().toISOString(),
        records: payload.records ?? {},
      };
      await writeFile(ratingsFile, JSON.stringify(nextFile, null, 2));
      res.end(JSON.stringify(nextFile));
    } catch {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "Invalid ratings payload" }));
    }
    return true;
  }

  res.statusCode = 405;
  res.end(JSON.stringify({ error: "Method not allowed" }));
  return true;
}

async function start() {
  const host = getArg("--host", process.env.HOST || "127.0.0.1");
  const port = Number(getArg("--port", process.env.API_PORT || process.env.PORT || "5174"));

  const server = http.createServer(async (req, res) => {
    try {
      if (req.url?.startsWith("/api/qualitative-ratings")) {
        await handleRatingsApi(req, res);
        return;
      }
      res.statusCode = 404;
      res.end("Not Found");
    } catch (error) {
      res.statusCode = 500;
      res.end(error.message);
    }
  });

  server.listen(port, host, () => {
    console.log(`API: http://${host}:${port}/api/qualitative-ratings`);
  });
}

start();
