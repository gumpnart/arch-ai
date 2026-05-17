const BASE = "/api";

export async function getFiles() {
  const res = await fetch(`${BASE}/files`);
  if (!res.ok) throw new Error(`GET /files failed: ${res.statusText}`);
  return res.json() as Promise<{ tree: FileNode[]; vault: string }>;
}

export async function getFile(filePath: string) {
  const res = await fetch(`${BASE}/files?path=${encodeURIComponent(filePath)}`);
  if (!res.ok) throw new Error(`GET /files?path=${filePath} failed: ${res.statusText}`);
  return res.json() as Promise<{ content: string; path: string }>;
}

export async function saveFile(filePath: string, content: string) {
  const res = await fetch(`${BASE}/files?path=${encodeURIComponent(filePath)}`, {
    method: "PUT",
    headers: { "Content-Type": "text/plain" },
    body: content,
  });
  if (!res.ok) throw new Error(`PUT /files?path=${filePath} failed: ${res.statusText}`);
  return res.json() as Promise<{ ok: boolean; path: string }>;
}

export async function createFile(filePath: string, content = "") {
  const res = await fetch(`${BASE}/files`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: filePath, content }),
  });
  if (!res.ok) throw new Error(`POST /files failed: ${res.statusText}`);
  return res.json() as Promise<{ ok: boolean; path: string }>;
}

export async function renderKroki(diagramType: string, dsl: string, format = "svg") {
  const res = await fetch(`${BASE}/kroki/render`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ diagramType, dsl, format }),
  });
  if (!res.ok) throw new Error(`Kroki render failed: ${res.statusText}`);
  return res.text();
}

export interface FileNode {
  type: "file" | "dir";
  name: string;
  path: string;
  status?: string;
  children?: FileNode[];
}
