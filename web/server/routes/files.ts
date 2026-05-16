import { Router, Request, Response } from "express";
import { promises as fs } from "node:fs";
import path from "node:path";

export const filesRouter = Router();

async function buildTree(dir: string, base: string): Promise<any[]> {
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

filesRouter.get("/", async (req: Request, res: Response) => {
  const vaultPath = (req as any).vaultPath as string;
  try {
    res.json({ tree: await buildTree(vaultPath, vaultPath), vault: vaultPath });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

filesRouter.get("/:filePath(*)", async (req: Request, res: Response) => {
  const vaultPath = (req as any).vaultPath as string;
  const filePath = path.join(vaultPath, req.params.filePath);
  if (!filePath.startsWith(path.resolve(vaultPath)))
    return void res.status(403).json({ error: "Forbidden" });
  try {
    res.json({ content: await fs.readFile(filePath, "utf-8"), path: req.params.filePath });
  } catch {
    res.status(404).json({ error: "File not found" });
  }
});

filesRouter.put("/:filePath(*)", async (req: Request, res: Response) => {
  const vaultPath = (req as any).vaultPath as string;
  const filePath = path.join(vaultPath, req.params.filePath);
  if (!filePath.startsWith(path.resolve(vaultPath)))
    return void res.status(403).json({ error: "Forbidden" });
  if (!filePath.endsWith(".md"))
    return void res.status(400).json({ error: "Only .md files allowed" });
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, req.body as string, "utf-8");
    res.json({ ok: true, path: req.params.filePath });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

filesRouter.post("/", async (req: Request, res: Response) => {
  const vaultPath = (req as any).vaultPath as string;
  const { path: relPath, content = "" } = req.body as { path: string; content?: string };
  if (!relPath) return void res.status(400).json({ error: "path required" });
  const filePath = path.join(vaultPath, relPath);
  if (!filePath.startsWith(path.resolve(vaultPath)))
    return void res.status(403).json({ error: "Forbidden" });
  if (!filePath.endsWith(".md"))
    return void res.status(400).json({ error: "Only .md files allowed" });
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, "utf-8");
    res.json({ ok: true, path: relPath });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
