"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const chokidar_1 = __importDefault(require("chokidar"));
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const fastify = (0, fastify_1.default)({ logger: false });
const PORT = parseInt(process.env.PORT || "3001", 10);
const SCENES_DIR = process.env.SCENES_DIR || "./scenes";
const VAULT_DIR = process.env.VAULT_DIR || "./diagrams-vault";
void fastify.register(cors_1.default);
const clients = new Map();
function broadcast(data) {
    const msg = `data: ${JSON.stringify(data)}\n\n`;
    clients.forEach(({ res }) => {
        try {
            res.write(msg);
        }
        catch {
            // client disconnected
        }
    });
}
// ─── File Watchers ───────────────────────────────────────────────────────────
async function ensureScenesDir() {
    await promises_1.default.mkdir(SCENES_DIR, { recursive: true });
}
async function ensureVaultDir() {
    await promises_1.default.mkdir(VAULT_DIR, { recursive: true });
}
ensureScenesDir().then(() => {
    const watcher = chokidar_1.default.watch(SCENES_DIR, {
        ignoreInitial: true,
        persistent: true,
        awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 50 },
    });
    watcher
        .on("add", (p) => {
        const file = path_1.default.basename(p);
        if (file.endsWith(".excalidraw")) {
            console.log(`[watch] scene added: ${file}`);
            broadcast({ event: "scene_added", file });
        }
    })
        .on("change", (p) => {
        const file = path_1.default.basename(p);
        if (file.endsWith(".excalidraw")) {
            console.log(`[watch] scene changed: ${file}`);
            broadcast({ event: "scene_changed", file });
        }
    })
        .on("unlink", (p) => {
        const file = path_1.default.basename(p);
        if (file.endsWith(".excalidraw")) {
            console.log(`[watch] scene removed: ${file}`);
            broadcast({ event: "scene_removed", file });
        }
    });
    console.log(`[bridge] Watching scenes in: ${SCENES_DIR}`);
});
ensureVaultDir().then(() => {
    const watcher = chokidar_1.default.watch(VAULT_DIR, {
        ignoreInitial: true,
        persistent: true,
        ignored: /(^|[/\\])\.obsidian[/\\]/,
        awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 50 },
    });
    watcher
        .on("add", (p) => {
        const rel = path_1.default.relative(VAULT_DIR, p).replace(/\\/g, "/");
        if (rel.endsWith(".md")) {
            console.log(`[watch] diagram added: ${rel}`);
            broadcast({ event: "diagram_added", path: rel });
        }
    })
        .on("change", (p) => {
        const rel = path_1.default.relative(VAULT_DIR, p).replace(/\\/g, "/");
        if (rel.endsWith(".md")) {
            console.log(`[watch] diagram changed: ${rel}`);
            broadcast({ event: "diagram_changed", path: rel });
        }
    })
        .on("unlink", (p) => {
        const rel = path_1.default.relative(VAULT_DIR, p).replace(/\\/g, "/");
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
        }
        catch {
            clearInterval(heartbeat);
        }
    }, 25000);
    clients.set(clientId, { id: clientId, res: reply.raw });
    console.log(`[sse] client connected: ${clientId} (total: ${clients.size})`);
    request.raw.on("close", () => {
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
        const files = await promises_1.default.readdir(SCENES_DIR);
        return files.filter((f) => f.endsWith(".excalidraw")).sort();
    }
    catch (err) {
        reply.status(500).send({ error: String(err) });
    }
});
fastify.get("/scenes/:name", async (request, reply) => {
    try {
        const name = sanitizeName(request.params.name);
        const filePath = path_1.default.join(SCENES_DIR, name);
        const content = await promises_1.default.readFile(filePath, "utf-8");
        return JSON.parse(content);
    }
    catch {
        reply.status(404).send({ error: "Scene not found" });
    }
});
fastify.put("/scenes/:name", async (request, reply) => {
    try {
        await ensureScenesDir();
        const name = sanitizeName(request.params.name);
        const filePath = path_1.default.join(SCENES_DIR, name);
        await promises_1.default.writeFile(filePath, JSON.stringify(request.body, null, 2), "utf-8");
        return { success: true, file: name };
    }
    catch (err) {
        reply.status(500).send({ error: String(err) });
    }
});
fastify.delete("/scenes/:name", async (request, reply) => {
    try {
        const name = sanitizeName(request.params.name);
        const filePath = path_1.default.join(SCENES_DIR, name);
        await promises_1.default.unlink(filePath);
        return { success: true };
    }
    catch {
        reply.status(404).send({ error: "Scene not found" });
    }
});
fastify.post("/scenes/:name/rename", async (request, reply) => {
    try {
        const oldName = sanitizeName(request.params.name);
        const newName = sanitizeName(request.body.newName);
        const oldPath = path_1.default.join(SCENES_DIR, oldName);
        const newPath = path_1.default.join(SCENES_DIR, newName);
        await promises_1.default.rename(oldPath, newPath);
        return { success: true, file: newName };
    }
    catch (err) {
        reply.status(500).send({ error: String(err) });
    }
});
// ─── Diagram routes ───────────────────────────────────────────────────────────
fastify.get("/diagrams", async (_request, reply) => {
    try {
        await ensureVaultDir();
        const results = [];
        await walkDir(VAULT_DIR, VAULT_DIR, results);
        return results.sort();
    }
    catch (err) {
        reply.status(500).send({ error: String(err) });
    }
});
fastify.get("/diagrams/*", async (request, reply) => {
    try {
        const relPath = sanitizeDiagramPath(request.params["*"]);
        const filePath = path_1.default.join(VAULT_DIR, relPath);
        const content = await promises_1.default.readFile(filePath, "utf-8");
        return { path: relPath, content };
    }
    catch {
        reply.status(404).send({ error: "Diagram not found" });
    }
});
fastify.put("/diagrams/*", async (request, reply) => {
    try {
        const relPath = sanitizeDiagramPath(request.params["*"]);
        const filePath = path_1.default.join(VAULT_DIR, relPath);
        await promises_1.default.mkdir(path_1.default.dirname(filePath), { recursive: true });
        await promises_1.default.writeFile(filePath, request.body.content, "utf-8");
        return { success: true, path: relPath };
    }
    catch (err) {
        reply.status(500).send({ error: String(err) });
    }
});
fastify.delete("/diagrams/*", async (request, reply) => {
    try {
        const relPath = sanitizeDiagramPath(request.params["*"]);
        const filePath = path_1.default.join(VAULT_DIR, relPath);
        await promises_1.default.unlink(filePath);
        return { success: true };
    }
    catch {
        reply.status(404).send({ error: "Diagram not found" });
    }
});
// ─── Helpers ─────────────────────────────────────────────────────────────────
function sanitizeName(name) {
    const base = path_1.default.basename(name);
    return base.endsWith(".excalidraw") ? base : `${base}.excalidraw`;
}
function sanitizeDiagramPath(rawPath) {
    const normalized = path_1.default.normalize(rawPath).replace(/\\/g, "/");
    if (normalized.startsWith("..") || normalized.includes("/../")) {
        throw new Error("Invalid path: directory traversal not allowed");
    }
    const segments = normalized.split("/").filter(Boolean);
    for (const seg of segments) {
        if (!/^[\w\-. ]+$/.test(seg))
            throw new Error(`Invalid path segment: "${seg}"`);
    }
    const joined = path_1.default.join(...segments);
    return joined.endsWith(".md") ? joined : `${joined}.md`;
}
async function walkDir(baseDir, dir, results) {
    const entries = await promises_1.default.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.name.startsWith("."))
            continue;
        const full = path_1.default.join(dir, entry.name);
        if (entry.isDirectory()) {
            await walkDir(baseDir, full, results);
        }
        else if (entry.name.endsWith(".md")) {
            results.push(path_1.default.relative(baseDir, full).replace(/\\/g, "/"));
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
