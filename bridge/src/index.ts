import express, { Request, Response } from "express";
import cors from "cors";
import chokidar from "chokidar";
import fs from "fs/promises";
import path from "path";

const app = express();
const PORT = parseInt(process.env.PORT || "3001", 10);
const SCENES_DIR = process.env.SCENES_DIR || "./scenes";
const VAULT_DIR = process.env.VAULT_DIR || "./diagrams-vault";

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// ─── SSE clients ────────────────────────────────────────────────────────────
type SSEClient = { id: string; res: Response };
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

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", scenes_dir: SCENES_DIR, vault_dir: VAULT_DIR });
});

// SSE endpoint — browsers connect here for live updates
app.get("/events", (req: Request, res: Response) => {
  const clientId = Date.now().toString(36) + Math.random().toString(36).slice(2);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering for SSE
  res.flushHeaders();

  res.write(`data: ${JSON.stringify({ event: "connected", clientId })}\n\n`);

  // Heartbeat every 25s to keep the connection alive
  const heartbeat = setInterval(() => {
    try {
      res.write(`: heartbeat\n\n`);
    } catch {
      clearInterval(heartbeat);
    }
  }, 25_000);

  clients.set(clientId, { id: clientId, res });
  console.log(`[sse] client connected: ${clientId} (total: ${clients.size})`);

  req.on("close", () => {
    clearInterval(heartbeat);
    clients.delete(clientId);
    console.log(`[sse] client disconnected: ${clientId} (total: ${clients.size})`);
  });
});

// ─── Scene routes ─────────────────────────────────────────────────────────────

app.get("/scenes", async (_req, res) => {
  try {
    await ensureScenesDir();
    const files = await fs.readdir(SCENES_DIR);
    const scenes = files.filter((f) => f.endsWith(".excalidraw")).sort();
    res.json(scenes);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get("/scenes/:name", async (req, res) => {
  try {
    const name = sanitizeName(req.params.name);
    const filePath = path.join(SCENES_DIR, name);
    const content = await fs.readFile(filePath, "utf-8");
    res.json(JSON.parse(content));
  } catch {
    res.status(404).json({ error: "Scene not found" });
  }
});

app.put("/scenes/:name", async (req, res) => {
  try {
    await ensureScenesDir();
    const name = sanitizeName(req.params.name);
    const filePath = path.join(SCENES_DIR, name);
    await fs.writeFile(filePath, JSON.stringify(req.body, null, 2), "utf-8");
    res.json({ success: true, file: name });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.delete("/scenes/:name", async (req, res) => {
  try {
    const name = sanitizeName(req.params.name);
    const filePath = path.join(SCENES_DIR, name);
    await fs.unlink(filePath);
    res.json({ success: true });
  } catch {
    res.status(404).json({ error: "Scene not found" });
  }
});

app.post("/scenes/:name/rename", async (req, res) => {
  try {
    const oldName = sanitizeName(req.params.name);
    const newName = sanitizeName(req.body.newName);
    const oldPath = path.join(SCENES_DIR, oldName);
    const newPath = path.join(SCENES_DIR, newName);
    await fs.rename(oldPath, newPath);
    res.json({ success: true, file: newName });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ─── Diagram routes ───────────────────────────────────────────────────────────

// List all .md files in vault (recursive)
app.get("/diagrams", async (_req, res) => {
  try {
    await ensureVaultDir();
    const results: string[] = [];
    await walkDir(VAULT_DIR, VAULT_DIR, results);
    res.json(results.sort());
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Get diagram source by relative path
app.get("/diagrams/*", async (req, res) => {
  try {
    const relPath = sanitizeDiagramPath(req.params[0]);
    const filePath = path.join(VAULT_DIR, relPath);
    const content = await fs.readFile(filePath, "utf-8");
    res.json({ path: relPath, content });
  } catch {
    res.status(404).json({ error: "Diagram not found" });
  }
});

// Create or update diagram source
app.put("/diagrams/*", async (req, res) => {
  try {
    const relPath = sanitizeDiagramPath(req.params[0]);
    const filePath = path.join(VAULT_DIR, relPath);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, req.body.content as string, "utf-8");
    res.json({ success: true, path: relPath });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Delete diagram source
app.delete("/diagrams/*", async (req, res) => {
  try {
    const relPath = sanitizeDiagramPath(req.params[0]);
    const filePath = path.join(VAULT_DIR, relPath);
    await fs.unlink(filePath);
    res.json({ success: true });
  } catch {
    res.status(404).json({ error: "Diagram not found" });
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
app.listen(PORT, "0.0.0.0", () => {
  console.log(`[bridge] Listening on port ${PORT}`);
});
