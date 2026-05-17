import { createFileRoute } from "@tanstack/react-router";
import { promises as fs } from "node:fs";
import path from "node:path";

const VAULT_PATH = path.resolve(process.env.VAULT_PATH ?? "../vault");

async function buildTree(dir: string, base: string): Promise<unknown[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const items = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.name !== ".obsidian") continue;
    if (entry.name === "node_modules") continue;
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(base, fullPath);
    if (entry.isDirectory()) {
      items.push({
        type: "dir",
        name: entry.name,
        path: relativePath,
        children: await buildTree(fullPath, base),
      });
    } else if (entry.name.endsWith(".md")) {
      let status = "unknown";
      try {
        const content = await fs.readFile(fullPath, "utf-8");
        const match = content.match(/^status:\s*(\S+)/m);
        if (match) status = match[1].replace(/['"]/g, "");
      } catch {}
      items.push({ type: "file", name: entry.name, path: relativePath, status });
    }
  }
  return items.sort((a, b) =>
    a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1
  );
}

function resolveFilePath(relPath: string) {
  const filePath = path.resolve(VAULT_PATH, relPath);
  if (!filePath.startsWith(VAULT_PATH)) return null;
  return filePath;
}

export const Route = createFileRoute("/api/files")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const relPath = new URL(request.url).searchParams.get("path");
        if (relPath) {
          const filePath = resolveFilePath(relPath);
          if (!filePath)
            return Response.json({ error: "Forbidden" }, { status: 403 });
          try {
            const content = await fs.readFile(filePath, "utf-8");
            return Response.json({ content, path: relPath });
          } catch {
            return Response.json({ error: "File not found" }, { status: 404 });
          }
        }
        try {
          const tree = await buildTree(VAULT_PATH, VAULT_PATH);
          return Response.json({ tree, vault: VAULT_PATH });
        } catch (err) {
          return Response.json({ error: String(err) }, { status: 500 });
        }
      },
      PUT: async ({ request }) => {
        const relPath = new URL(request.url).searchParams.get("path");
        if (!relPath)
          return Response.json({ error: "path required" }, { status: 400 });
        const filePath = resolveFilePath(relPath);
        if (!filePath)
          return Response.json({ error: "Forbidden" }, { status: 403 });
        if (!filePath.endsWith(".md"))
          return Response.json({ error: "Only .md files allowed" }, { status: 400 });
        try {
          await fs.mkdir(path.dirname(filePath), { recursive: true });
          const body = await request.text();
          await fs.writeFile(filePath, body, "utf-8");
          return Response.json({ ok: true, path: relPath });
        } catch (err) {
          return Response.json({ error: String(err) }, { status: 500 });
        }
      },
      POST: async ({ request }) => {
        const { path: relPath, content = "" } = (await request.json()) as {
          path: string;
          content?: string;
        };
        if (!relPath)
          return Response.json({ error: "path required" }, { status: 400 });
        const filePath = resolveFilePath(relPath);
        if (!filePath)
          return Response.json({ error: "Forbidden" }, { status: 403 });
        if (!filePath.endsWith(".md"))
          return Response.json({ error: "Only .md files allowed" }, { status: 400 });
        try {
          await fs.mkdir(path.dirname(filePath), { recursive: true });
          await fs.writeFile(filePath, content, "utf-8");
          return Response.json({ ok: true, path: relPath });
        } catch (err) {
          return Response.json({ error: String(err) }, { status: 500 });
        }
      },
      PATCH: async ({ request }) => {
        const relPath = new URL(request.url).searchParams.get("path");
        if (!relPath)
          return Response.json({ error: "path required" }, { status: 400 });
        const filePath = resolveFilePath(relPath);
        if (!filePath)
          return Response.json({ error: "Forbidden" }, { status: 403 });
        const body = (await request.json()) as { newName?: string; targetDir?: string | null };
        let newRelPath: string;
        if (body.targetDir !== undefined) {
          // Move: keep same filename, place in targetDir (null = vault root)
          const filename = path.basename(relPath);
          newRelPath = body.targetDir ? `${body.targetDir}/${filename}` : filename;
        } else if (body.newName) {
          // Rename in place
          const dir = path.dirname(relPath).replace(/\\/g, "/");
          newRelPath = dir === "." ? body.newName : `${dir}/${body.newName}`;
        } else {
          return Response.json({ error: "newName or targetDir required" }, { status: 400 });
        }
        const newFilePath = resolveFilePath(newRelPath);
        if (!newFilePath)
          return Response.json({ error: "Forbidden" }, { status: 403 });
        // Enforce .md only for files, not directories
        let isFile = true;
        try { isFile = (await fs.stat(filePath)).isFile(); } catch { /* assume file */ }
        if (isFile && !newFilePath.endsWith(".md"))
          return Response.json({ error: "Only .md files allowed" }, { status: 400 });
        try {
          await fs.mkdir(path.dirname(newFilePath), { recursive: true });
          await fs.rename(filePath, newFilePath);
          return Response.json({ ok: true, path: newRelPath });
        } catch (err) {
          return Response.json({ error: String(err) }, { status: 500 });
        }
      },
      DELETE: async ({ request }) => {
        const relPath = new URL(request.url).searchParams.get("path");
        if (!relPath)
          return Response.json({ error: "path required" }, { status: 400 });
        const filePath = resolveFilePath(relPath);
        if (!filePath)
          return Response.json({ error: "Forbidden" }, { status: 403 });
        try {
          await fs.unlink(filePath);
          return Response.json({ ok: true });
        } catch (err) {
          return Response.json({ error: String(err) }, { status: 500 });
        }
      },
    },
  },
});
