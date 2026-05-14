import Fastify from "fastify";
import cors from "@fastify/cors";
import chokidar from "chokidar";
import fs from "fs/promises";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import type { IncomingMessage, ServerResponse } from "http";

const execFileAsync = promisify(execFile);

const fastify = Fastify({ logger: false });
const PORT = parseInt(process.env.PORT || "3001", 10);
const SCENES_DIR = process.env.SCENES_DIR || "./scenes";
const VAULT_DIR = process.env.VAULT_DIR || "./diagrams-vault";

void fastify.register(cors);

// ─── SSE clients ────────────────────────────────────────────────────────────
type SSEClient = { id: string; res: ServerResponse };
const clients = new Map<string, SSEClient>();

function broadcast(data: object) {
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  clients.forEach(({ res }) => {
    try {
      res.write(msg);
    } catch {
      // client disconnected
    }
  });
}

// ─── File Watchers ───────────────────────────────────────────────────────────
async function ensureScenesDir() {
  await fs.mkdir(SCENES_DIR, { recursive: true });
}

async function ensureVaultDir() {
  await fs.mkdir(VAULT_DIR, { recursive: true });
}

ensureScenesDir().then(() => {
  const watcher = chokidar.watch(SCENES_DIR, {
    ignoreInitial: true,
    persistent: true,
    awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 50 },
  });

  watcher
    .on("add", (p) => {
      const file = path.basename(p);
      if (file.endsWith(".excalidraw")) {
        console.log(`[watch] scene added: ${file}`);
        broadcast({ event: "scene_added", file });
      }
    })
    .on("change", (p) => {
      const file = path.basename(p);
      if (file.endsWith(".excalidraw")) {
        console.log(`[watch] scene changed: ${file}`);
        broadcast({ event: "scene_changed", file });
      }
    })
    .on("unlink", (p) => {
      const file = path.basename(p);
      if (file.endsWith(".excalidraw")) {
        console.log(`[watch] scene removed: ${file}`);
        broadcast({ event: "scene_removed", file });
      }
    });

  console.log(`[bridge] Watching scenes in: ${SCENES_DIR}`);
});

ensureVaultDir().then(() => {
  const watcher = chokidar.watch(VAULT_DIR, {
    ignoreInitial: true,
    persistent: true,
    ignored: /(^|[/\\])\.obsidian[/\\]/,
    awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 50 },
  });

  watcher
    .on("add", (p) => {
      const rel = path.relative(VAULT_DIR, p).replace(/\\/g, "/");
      if (rel.endsWith(".md")) {
        console.log(`[watch] diagram added: ${rel}`);
        broadcast({ event: "diagram_added", path: rel });
      }
    })
    .on("change", (p) => {
      const rel = path.relative(VAULT_DIR, p).replace(/\\/g, "/");
      if (rel.endsWith(".md")) {
        console.log(`[watch] diagram changed: ${rel}`);
        broadcast({ event: "diagram_changed", path: rel });
      }
    })
    .on("unlink", (p) => {
      const rel = path.relative(VAULT_DIR, p).replace(/\\/g, "/");
      if (rel.endsWith(".md")) {
        console.log(`[watch] diagram removed: ${rel}`);
        broadcast({ event: "diagram_removed", path: rel });
      }
    });

  console.log(`[bridge] Watching vault in: ${VAULT_DIR}`);
});

// ─── Routes ──────────────────────────────────────────────────────────────────

fastify.get("/health", async () => {
  return { status: "ok", scenes_dir: SCENES_DIR, vault_dir: VAULT_DIR };
});

// SSE endpoint — browsers connect here for live updates
fastify.get("/events", (request, reply) => {
  const clientId = Date.now().toString(36) + Math.random().toString(36).slice(2);

  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no", // disable nginx buffering for SSE
  });

  reply.raw.write(`data: ${JSON.stringify({ event: "connected", clientId })}\n\n`);

  // Heartbeat every 25s to keep the connection alive
  const heartbeat = setInterval(() => {
    try {
      reply.raw.write(`: heartbeat\n\n`);
    } catch {
      clearInterval(heartbeat);
    }
  }, 25_000);

  clients.set(clientId, { id: clientId, res: reply.raw });
  console.log(`[sse] client connected: ${clientId} (total: ${clients.size})`);

  (request.raw as IncomingMessage).on("close", () => {
    clearInterval(heartbeat);
    clients.delete(clientId);
    console.log(`[sse] client disconnected: ${clientId} (total: ${clients.size})`);
  });

  reply.hijack();
});

// ─── Scene routes ─────────────────────────────────────────────────────────────

fastify.get("/scenes", async (_request, reply) => {
  try {
    await ensureScenesDir();
    const files = await fs.readdir(SCENES_DIR);
    return files.filter((f) => f.endsWith(".excalidraw")).sort();
  } catch (err) {
    reply.status(500).send({ error: String(err) });
  }
});

fastify.get<{ Params: { name: string } }>("/scenes/:name", async (request, reply) => {
  try {
    const name = sanitizeName(request.params.name);
    const filePath = path.join(SCENES_DIR, name);
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content) as unknown;
  } catch {
    reply.status(404).send({ error: "Scene not found" });
  }
});

fastify.put<{ Params: { name: string }; Body: unknown }>("/scenes/:name", async (request, reply) => {
  try {
    await ensureScenesDir();
    const name = sanitizeName(request.params.name);
    const filePath = path.join(SCENES_DIR, name);
    await fs.writeFile(filePath, JSON.stringify(request.body, null, 2), "utf-8");
    return { success: true, file: name };
  } catch (err) {
    reply.status(500).send({ error: String(err) });
  }
});

fastify.delete<{ Params: { name: string } }>("/scenes/:name", async (request, reply) => {
  try {
    const name = sanitizeName(request.params.name);
    const filePath = path.join(SCENES_DIR, name);
    await fs.unlink(filePath);
    return { success: true };
  } catch {
    reply.status(404).send({ error: "Scene not found" });
  }
});

fastify.post<{ Params: { name: string }; Body: { newName: string } }>(
  "/scenes/:name/rename",
  async (request, reply) => {
    try {
      const oldName = sanitizeName(request.params.name);
      const newName = sanitizeName(request.body.newName);
      const oldPath = path.join(SCENES_DIR, oldName);
      const newPath = path.join(SCENES_DIR, newName);
      await fs.rename(oldPath, newPath);
      return { success: true, file: newName };
    } catch (err) {
      reply.status(500).send({ error: String(err) });
    }
  }
);

// ─── Diagram routes ───────────────────────────────────────────────────────────

fastify.get("/diagrams", async (_request, reply) => {
  try {
    await ensureVaultDir();
    const results: string[] = [];
    await walkDir(VAULT_DIR, VAULT_DIR, results);
    return results.sort();
  } catch (err) {
    reply.status(500).send({ error: String(err) });
  }
});

fastify.get<{ Params: { "*": string } }>("/diagrams/*", async (request, reply) => {
  try {
    const relPath = sanitizeDiagramPath(request.params["*"]);
    const filePath = path.join(VAULT_DIR, relPath);
    const content = await fs.readFile(filePath, "utf-8");
    return { path: relPath, content };
  } catch {
    reply.status(404).send({ error: "Diagram not found" });
  }
});

fastify.put<{ Params: { "*": string }; Body: { content: string } }>(
  "/diagrams/*",
  async (request, reply) => {
    try {
      const relPath = sanitizeDiagramPath(request.params["*"]);
      const filePath = path.join(VAULT_DIR, relPath);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, request.body.content, "utf-8");
      return { success: true, path: relPath };
    } catch (err) {
      reply.status(500).send({ error: String(err) });
    }
  }
);

fastify.delete<{ Params: { "*": string } }>("/diagrams/*", async (request, reply) => {
  try {
    const relPath = sanitizeDiagramPath(request.params["*"]);
    const filePath = path.join(VAULT_DIR, relPath);
    await fs.unlink(filePath);
    return { success: true };
  } catch {
    reply.status(404).send({ error: "Diagram not found" });
  }
});

// ─── Git routes ───────────────────────────────────────────────────────────────

fastify.get("/git/status", async (_request, reply) => {
  try {
    const { stdout } = await execFileAsync("git", ["-C", VAULT_DIR, "status", "--porcelain"]);
    return { status: stdout.trim() };
  } catch (err) {
    reply.status(500).send({ error: String(err) });
  }
});

fastify.post<{ Body: { message?: string } }>("/git/commit", async (request, reply) => {
  const message = (request.body?.message ?? "docs: update vault").replace(/\n/g, " ").slice(0, 200);
  try {
    await execFileAsync("git", ["-C", VAULT_DIR, "add", "."]);
    const { stdout } = await execFileAsync("git", ["-C", VAULT_DIR, "commit", "-m", message]);
    try {
      await execFileAsync("git", ["-C", VAULT_DIR, "push"]);
    } catch {
      // push is optional — no remote is fine
    }
    return { success: true, output: stdout.trim() };
  } catch (err) {
    reply.status(400).send({ error: String(err) });
  }
});

fastify.post<{ Body: { url?: string; branch?: string } }>("/git/clone", async (request, reply) => {
  const { url, branch } = request.body ?? {};
  if (!url) {
    return reply.status(400).send({ error: "url is required" });
  }
  // Basic URL sanity — only allow git/https/ssh schemes
  if (!/^(https?:\/\/|git@|git:\/\/)/.test(url)) {
    return reply.status(400).send({ error: "Invalid repository URL" });
  }
  try {
    // Clone into a temp dir then replace vault contents
    const tmpDir = `${VAULT_DIR}.__clone_tmp__`;
    await fs.rm(tmpDir, { recursive: true, force: true });
    const cloneArgs = ["clone", "--depth", "1"];
    if (branch) cloneArgs.push("--branch", branch);
    cloneArgs.push(url, tmpDir);
    await execFileAsync("git", cloneArgs, { timeout: 60_000 });
    // Swap: remove old vault, rename tmp to vault
    await fs.rm(VAULT_DIR, { recursive: true, force: true });
    await fs.rename(tmpDir, VAULT_DIR);
    console.log(`[bridge] vault replaced by clone of ${url}`);
    return { success: true };
  } catch (err) {
    reply.status(500).send({ error: String(err) });
  }
});

// ─── Diagram render (Kroki proxy) ────────────────────────────────────────────

const KROKI_URL = process.env.KROKI_URL || "http://kroki:8000";

fastify.post<{ Body: { format?: string; source?: string } }>("/diagrams/render", async (request, reply) => {
  const { format, source } = request.body ?? {};
  if (!format || !source) {
    return reply.status(400).send({ error: "format and source are required" });
  }
  const allowed = ["mermaid", "plantuml", "graphviz", "d2", "c4plantuml", "erd", "nomnoml", "structurizr", "bpmn"];
  if (!allowed.includes(format)) {
    return reply.status(400).send({ error: `Unsupported format: ${format}` });
  }
  try {
    const encoded = Buffer.from(source, "utf-8").toString("base64");
    const res = await fetch(`${KROKI_URL}/${format}/svg/${encoded}`);
    if (!res.ok) {
      const body = await res.text();
      return reply.status(422).send({ error: `Kroki error: ${body.slice(0, 200)}` });
    }
    const svg = await res.text();
    return { svg };
  } catch (err) {
    reply.status(500).send({ error: String(err) });
  }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sanitizeName(name: string): string {
  const base = path.basename(name);
  return base.endsWith(".excalidraw") ? base : `${base}.excalidraw`;
}

function sanitizeDiagramPath(rawPath: string): string {
  const normalized = path.normalize(rawPath).replace(/\\/g, "/");
  if (normalized.startsWith("..") || normalized.includes("/../")) {
    throw new Error("Invalid path: directory traversal not allowed");
  }
  const segments = normalized.split("/").filter(Boolean);
  for (const seg of segments) {
    if (!/^[\w\-. ]+$/.test(seg)) throw new Error(`Invalid path segment: "${seg}"`);
  }
  const joined = path.join(...segments);
  return joined.endsWith(".md") ? joined : `${joined}.md`;
}

async function walkDir(baseDir: string, dir: string, results: string[]) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkDir(baseDir, full, results);
    } else if (entry.name.endsWith(".md")) {
      results.push(path.relative(baseDir, full).replace(/\\/g, "/"));
    }
  }
}

// ─── Start ───────────────────────────────────────────────────────────────────

fastify.listen({ port: PORT, host: "0.0.0.0" }, (err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`[bridge] Listening on port ${PORT}`);
});
