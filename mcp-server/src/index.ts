#!/usr/bin/env node
/**
 * Excalidraw MCP Server
 * Exposes Excalidraw scene manipulation as Claude tools via MCP protocol.
 * Communicates with the bridge server over HTTP.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { readFile, writeFile, mkdir, readdir } from "fs/promises";
import { existsSync } from "fs";
import { randomBytes } from "crypto";
import path from "path";
import simpleGit from "simple-git";
import { buildElements } from "./builder.js";
import type {
  ExcalidrawScene,
  ExcalidrawFileEntry,
  ImageElement,
  ElementSpec,
  DiagramFrontmatter,
} from "./types.js";

const BRIDGE_URL = process.env.BRIDGE_URL ?? "http://localhost:3001";
const KROKI_URL = process.env.KROKI_URL ?? "http://localhost:8000";
const VAULT_PATH = process.env.VAULT_PATH ?? "";

// ─── Bridge helpers ──────────────────────────────────────────────────────────

async function getScene(name: string): Promise<ExcalidrawScene> {
  const res = await fetch(`${BRIDGE_URL}/scenes/${encodeURIComponent(name)}`);
  if (!res.ok) throw new Error(`Scene "${name}" not found`);
  return res.json() as Promise<ExcalidrawScene>;
}

async function putScene(name: string, scene: ExcalidrawScene): Promise<void> {
  const res = await fetch(`${BRIDGE_URL}/scenes/${encodeURIComponent(name)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(scene),
  });
  if (!res.ok) throw new Error(`Failed to save scene "${name}"`);
}

async function listScenes(): Promise<string[]> {
  const res = await fetch(`${BRIDGE_URL}/scenes`);
  if (!res.ok) throw new Error("Failed to list scenes");
  return res.json() as Promise<string[]>;
}

function emptyScene(): ExcalidrawScene {
  return {
    type: "excalidraw",
    version: 2,
    source: "excalidraw-mcp",
    elements: [],
    appState: { gridSize: null, viewBackgroundColor: "#ffffff" },
    files: {},
  };
}

function ensureExt(name: string): string {
  return name.endsWith(".excalidraw") ? name : `${name}.excalidraw`;
}

function ok(msg: string) {
  return { content: [{ type: "text" as const, text: msg }] };
}

function err(msg: string) {
  return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true };
}

// ─── Kroki helpers ────────────────────────────────────────────────────────────

async function renderWithKroki(format: string, source: string): Promise<string> {
  const res = await fetch(`${KROKI_URL}/${format}/svg`, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: source,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Kroki render failed (${res.status}): ${body}`);
  }
  return res.text();
}

function extractSvgDimensions(svg: string): { width: number; height: number } {
  const viewBox = svg.match(/viewBox="([^"]+)"/);
  if (viewBox) {
    const parts = viewBox[1].trim().split(/\s+/);
    if (parts.length === 4) {
      const w = parseFloat(parts[2]);
      const h = parseFloat(parts[3]);
      if (w > 0 && h > 0) return { width: w, height: h };
    }
  }
  const wMatch = svg.match(/\bwidth="([\d.]+)(?:px)?"/);
  const hMatch = svg.match(/\bheight="([\d.]+)(?:px)?"/);
  if (wMatch && hMatch) {
    const w = parseFloat(wMatch[1]);
    const h = parseFloat(hMatch[1]);
    if (w > 0 && h > 0) return { width: w, height: h };
  }
  return { width: 800, height: 400 };
}

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function makeFileId(): string {
  return randomBytes(10).toString("hex");
}

function makeElementId(): string {
  return randomBytes(8).toString("hex");
}

function randomInt(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

// ─── Vault helpers ────────────────────────────────────────────────────────────

function requireVaultPath(): string {
  if (!VAULT_PATH) throw new Error("VAULT_PATH env var is not set. Add it to Claude Desktop config.");
  return VAULT_PATH;
}

function buildMarkdown(
  fm: DiagramFrontmatter,
  source: string
): string {
  const tags = fm.tags?.length ? `\ntags: [${fm.tags.join(", ")}]` : "";
  const desc = fm.description ? `\n> ${fm.description}\n` : "";
  return `---
title: ${fm.title}
format: ${fm.format}
scene: ${fm.scene}
fileId: ${fm.fileId}
elementId: ${fm.elementId}${tags}
created: ${fm.created}
updated: ${fm.updated}
---

# ${fm.title}
${desc}
\`\`\`${fm.format}
${source.trimEnd()}
\`\`\`
`;
}

function parseFrontmatter(content: string): { fm: Partial<DiagramFrontmatter>; source: string } {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  const fm: Partial<DiagramFrontmatter> = {};

  if (fmMatch) {
    for (const line of fmMatch[1].split("\n")) {
      const [key, ...rest] = line.split(": ");
      if (!key || !rest.length) continue;
      const val = rest.join(": ").trim();
      const k = key.trim() as keyof DiagramFrontmatter;
      if (k === "tags") {
        (fm as Record<string, unknown>).tags = val
          .replace(/^\[/, "").replace(/\]$/, "")
          .split(",").map((s) => s.trim()).filter(Boolean);
      } else {
        (fm as Record<string, unknown>)[k] = val;
      }
    }
  }

  // Extract the fenced code block source
  const codeMatch = content.match(/```[\w]*\n([\s\S]*?)```/);
  const source = codeMatch ? codeMatch[1].trimEnd() : "";

  return { fm, source };
}

async function walkVault(dir: string, base: string, results: string[]) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkVault(full, base, results);
    } else if (entry.name.endsWith(".md")) {
      results.push(path.relative(base, full).replace(/\\/g, "/"));
    }
  }
}

async function gitCommitAndPush(vaultPath: string, message: string): Promise<string> {
  try {
    const git = simpleGit(vaultPath);
    await git.add(".");
    await git.commit(message);
    try {
      const remotes = await git.getRemotes(true);
      if (remotes.length > 0) {
        await git.push();
        return "committed and pushed";
      }
      return "committed (no remote configured)";
    } catch {
      return "committed (push failed — check remote config)";
    }
  } catch (e) {
    return `git skipped: ${e instanceof Error ? e.message : String(e)}`;
  }
}

// ─── Image element factory ────────────────────────────────────────────────────

function makeImageElement(
  elementId: string,
  fileId: string,
  x: number,
  y: number,
  width: number,
  height: number
): ImageElement {
  return {
    id: elementId,
    type: "image",
    x,
    y,
    width,
    height,
    angle: 0,
    strokeColor: "transparent",
    backgroundColor: "transparent",
    fillStyle: "hachure",
    strokeWidth: 1,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: null,
    seed: randomInt(),
    version: 1,
    versionNonce: randomInt(),
    isDeleted: false,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    status: "saved",
    fileId,
    scale: [1, 1],
  };
}

// ─── Tool definitions ────────────────────────────────────────────────────────

const TOOLS: Tool[] = [
  {
    name: "list_scenes",
    description: "List all Excalidraw scene files available.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "create_scene",
    description: "Create a new empty Excalidraw scene file.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Scene name (without .excalidraw extension)." },
        background: { type: "string", description: "Background color hex (default #ffffff)." },
      },
      required: ["name"],
    },
  },
  {
    name: "read_scene",
    description: "Read and return the full JSON content of an Excalidraw scene, including all elements and their IDs.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Scene name (with or without .excalidraw)." },
      },
      required: ["name"],
    },
  },
  {
    name: "add_elements",
    description: `Add one or more elements to an Excalidraw scene.
Each element spec supports:
- type: rectangle | ellipse | diamond | line | arrow | text
- x, y: position (required)
- width, height: size (default 200×100 for shapes)
- text: text content (for text type) or label on shapes
- strokeColor: hex color (default #1e1e1e)
- backgroundColor: hex or "transparent"
- fillStyle: solid | hachure | cross-hatch | dots | none
- strokeWidth: 1–4
- strokeStyle: solid | dashed | dotted
- roughness: 0 (clean) | 1 (normal) | 2 (sketchy)
- opacity: 0–100
- rounded: true/false (rounded corners)
- fontSize: for text (default 20)
- fontFamily: 1=handwritten | 2=normal | 3=monospace
- textAlign: left | center | right
- points: [[x,y],...] for line/arrow (relative to x,y origin)
- startArrowhead / endArrowhead: arrow | bar | dot | triangle | null
- startBindingId / endBindingId: element ID to connect arrow ends to

Returns the IDs of all created elements.`,
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Scene name." },
        elements: {
          type: "array",
          description: "Array of element specs to add.",
          items: { type: "object" },
        },
      },
      required: ["name", "elements"],
    },
  },
  {
    name: "update_element",
    description: "Update properties of an existing element by its ID.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Scene name." },
        id: { type: "string", description: "Element ID to update." },
        changes: {
          type: "object",
          description: "Key-value pairs of properties to update (e.g. strokeColor, text, x, y, width, height).",
        },
      },
      required: ["name", "id", "changes"],
    },
  },
  {
    name: "delete_element",
    description: "Delete one or more elements from a scene by ID.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Scene name." },
        ids: {
          type: "array",
          items: { type: "string" },
          description: "Array of element IDs to delete.",
        },
      },
      required: ["name", "ids"],
    },
  },
  {
    name: "clear_scene",
    description: "Remove ALL elements from a scene, leaving it blank.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Scene name." },
      },
      required: ["name"],
    },
  },
  {
    name: "delete_scene",
    description: "Permanently delete a scene file.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Scene name." },
      },
      required: ["name"],
    },
  },
  {
    name: "get_scene_summary",
    description: "Get a high-level summary of a scene: element count, types, and bounding box.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
      },
      required: ["name"],
    },
  },
  {
    name: "add_diagram",
    description: `High-level helper: create an architecture or flow diagram in one call.
Accepts a list of nodes (boxes with labels) and connections (arrows between them).
Claude should use this for diagrams rather than calling add_elements manually.`,
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Scene name." },
        nodes: {
          type: "array",
          description: "Array of node objects.",
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "Unique node ID (used in connections)." },
              label: { type: "string", description: "Text label inside the box." },
              x: { type: "number" },
              y: { type: "number" },
              width: { type: "number", description: "Default 160" },
              height: { type: "number", description: "Default 70" },
              shape: { type: "string", enum: ["rectangle", "ellipse", "diamond"], description: "Default rectangle" },
              backgroundColor: { type: "string" },
              strokeColor: { type: "string" },
            },
            required: ["id", "label", "x", "y"],
          },
        },
        connections: {
          type: "array",
          description: "Arrows between nodes.",
          items: {
            type: "object",
            properties: {
              from: { type: "string", description: "Source node ID." },
              to: { type: "string", description: "Target node ID." },
              label: { type: "string", description: "Optional label on the arrow." },
              style: { type: "string", enum: ["solid", "dashed", "dotted"], description: "Default solid" },
            },
            required: ["from", "to"],
          },
        },
        clear: { type: "boolean", description: "Clear the scene before adding (default false)." },
      },
      required: ["name", "nodes"],
    },
  },
  // ─── Diagram-as-code tools ─────────────────────────────────────────────────
  {
    name: "create_diagram",
    description: `Write diagram source code to the Obsidian vault, render via Kroki, and place the SVG as an image element in an Excalidraw scene.
Supported formats: mermaid, plantuml, graphviz, d2, c4plantuml, structurizr, bpmn, erd, nomnoml, and more.
Auto-commits and pushes to git if a remote is configured.`,
    inputSchema: {
      type: "object",
      properties: {
        folder: { type: "string", description: "Vault subfolder (e.g. 'Architecture', 'Flows'). Created if it doesn't exist." },
        name: { type: "string", description: "Diagram filename without .md (e.g. 'system-overview')." },
        title: { type: "string", description: "Human-readable title." },
        format: { type: "string", description: "Kroki diagram format: mermaid | plantuml | graphviz | d2 | c4plantuml | structurizr | bpmn | erd | nomnoml | etc." },
        source: { type: "string", description: "Diagram source code." },
        scene: { type: "string", description: "Excalidraw scene name to place the image in." },
        description: { type: "string", description: "Optional one-line description." },
        tags: { type: "array", items: { type: "string" }, description: "Optional tags for Obsidian." },
        x: { type: "number", description: "X position in scene (default 50)." },
        y: { type: "number", description: "Y position in scene (default 50)." },
      },
      required: ["folder", "name", "title", "format", "source", "scene"],
    },
  },
  {
    name: "update_diagram",
    description: `Edit diagram source code in the vault, re-render via Kroki, and update the SVG in the Excalidraw scene in-place (same position and size).
Auto-commits and pushes to git if a remote is configured.`,
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative path within the vault (e.g. 'Architecture/system-overview.md')." },
        source: { type: "string", description: "New diagram source code." },
      },
      required: ["path", "source"],
    },
  },
  {
    name: "render_diagram",
    description: "Re-render an existing vault diagram into a scene (useful after a scene is cleared). Adds a fresh image element at the given position.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative path within the vault (e.g. 'Architecture/system-overview.md')." },
        scene: { type: "string", description: "Target scene name (overrides the scene stored in frontmatter if provided)." },
        x: { type: "number", description: "X position (default 50)." },
        y: { type: "number", description: "Y position (default 50)." },
      },
      required: ["path"],
    },
  },
  {
    name: "get_diagram",
    description: "Read the source code and metadata of a diagram from the vault.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative path within the vault (e.g. 'Architecture/system-overview.md')." },
      },
      required: ["path"],
    },
  },
  {
    name: "list_diagrams",
    description: "List all diagram files in the vault, optionally filtered by subfolder.",
    inputSchema: {
      type: "object",
      properties: {
        folder: { type: "string", description: "Optional subfolder to filter by (e.g. 'Architecture')." },
      },
    },
  },
  {
    name: "git_log",
    description: "Show the git commit history for the diagrams vault.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Number of commits to show (default 10)." },
      },
    },
  },
  {
    name: "git_status",
    description: "Show the git status of the diagrams vault including remote configuration.",
    inputSchema: { type: "object", properties: {} },
  },
];

// ─── Scene tool handlers ──────────────────────────────────────────────────────

async function handleListScenes() {
  const scenes = await listScenes();
  return ok(scenes.length > 0 ? scenes.join("\n") : "(no scenes yet)");
}

async function handleCreateScene(args: Record<string, unknown>) {
  const name = ensureExt(args.name as string);
  const bg = (args.background as string | undefined) ?? "#ffffff";
  const scene = emptyScene();
  scene.appState.viewBackgroundColor = bg;
  await putScene(name, scene);
  return ok(`Created scene: ${name}`);
}

async function handleReadScene(args: Record<string, unknown>) {
  const name = ensureExt(args.name as string);
  const scene = await getScene(name);
  return ok(JSON.stringify(scene, null, 2));
}

async function handleAddElements(args: Record<string, unknown>) {
  const name = ensureExt(args.name as string);
  const specs = args.elements as ElementSpec[];
  const scene = await getScene(name);
  const { elements, idMap } = buildElements(specs);
  scene.elements = [...scene.elements, ...elements];
  await putScene(name, scene);
  const ids = Object.values(idMap);
  return ok(`Added ${elements.length} element(s) to ${name}.\nIDs: ${ids.join(", ")}`);
}

async function handleUpdateElement(args: Record<string, unknown>) {
  const name = ensureExt(args.name as string);
  const id = args.id as string;
  const changes = args.changes as Record<string, unknown>;
  const scene = await getScene(name);
  const idx = scene.elements.findIndex((e) => (e as { id: string }).id === id);
  if (idx === -1) return err(`Element "${id}" not found in scene "${name}"`);
  scene.elements[idx] = { ...scene.elements[idx], ...changes, updated: Date.now() };
  await putScene(name, scene);
  return ok(`Updated element ${id} in ${name}`);
}

async function handleDeleteElement(args: Record<string, unknown>) {
  const name = ensureExt(args.name as string);
  const ids = new Set(args.ids as string[]);
  const scene = await getScene(name);
  const before = scene.elements.length;
  scene.elements = scene.elements.filter((e) => !ids.has((e as { id: string }).id));
  const removed = before - scene.elements.length;
  await putScene(name, scene);
  return ok(`Removed ${removed} element(s) from ${name}`);
}

async function handleClearScene(args: Record<string, unknown>) {
  const name = ensureExt(args.name as string);
  const scene = await getScene(name);
  const count = scene.elements.length;
  scene.elements = [];
  await putScene(name, scene);
  return ok(`Cleared ${count} element(s) from ${name}`);
}

async function handleDeleteScene(args: Record<string, unknown>) {
  const name = ensureExt(args.name as string);
  const res = await fetch(`${BRIDGE_URL}/scenes/${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
  if (!res.ok) return err(`Scene "${name}" not found`);
  return ok(`Deleted scene: ${name}`);
}

async function handleGetSceneSummary(args: Record<string, unknown>) {
  const name = ensureExt(args.name as string);
  const scene = await getScene(name);
  const typeCounts: Record<string, number> = {};
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const el of scene.elements as Array<{
    type: string; x: number; y: number; width: number; height: number
  }>) {
    typeCounts[el.type] = (typeCounts[el.type] ?? 0) + 1;
    minX = Math.min(minX, el.x);
    minY = Math.min(minY, el.y);
    maxX = Math.max(maxX, el.x + el.width);
    maxY = Math.max(maxY, el.y + el.height);
  }

  const summary = {
    name,
    totalElements: scene.elements.length,
    byType: typeCounts,
    boundingBox: scene.elements.length > 0
      ? { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
      : null,
    background: scene.appState.viewBackgroundColor,
  };
  return ok(JSON.stringify(summary, null, 2));
}

async function handleAddDiagram(args: Record<string, unknown>) {
  const name = ensureExt(args.name as string);
  const nodes = args.nodes as Array<{
    id: string; label: string; x: number; y: number;
    width?: number; height?: number; shape?: string;
    backgroundColor?: string; strokeColor?: string;
  }>;
  const connections = (args.connections ?? []) as Array<{
    from: string; to: string; label?: string; style?: string;
  }>;
  const clear = (args.clear as boolean | undefined) ?? false;

  const scene = clear ? emptyScene() : await getScene(name);

  const nodeElementIds: Record<string, string> = {};
  const specs: ElementSpec[] = [];

  for (const node of nodes) {
    const spec: ElementSpec = {
      type: (node.shape as ElementSpec["type"]) ?? "rectangle",
      x: node.x,
      y: node.y,
      width: node.width ?? 160,
      height: node.height ?? 70,
      text: node.label,
      backgroundColor: node.backgroundColor ?? "#dbeafe",
      strokeColor: node.strokeColor ?? "#3b82f6",
      strokeWidth: 2,
      roughness: 0,
      rounded: true,
      fillStyle: "solid",
      fontSize: 16,
      fontFamily: 2,
      textAlign: "center",
    };
    specs.push(spec);
  }

  const { elements, idMap } = buildElements(specs);

  nodes.forEach((node, i) => {
    nodeElementIds[node.id] = idMap[i];
  });

  for (const conn of connections) {
    const fromId = nodeElementIds[conn.from];
    const toId = nodeElementIds[conn.to];
    if (!fromId || !toId) continue;

    const fromNode = nodes.find((n) => n.id === conn.from)!;
    const toNode = nodes.find((n) => n.id === conn.to)!;
    const fromW = fromNode.width ?? 160;
    const fromH = fromNode.height ?? 70;
    const toW = toNode.width ?? 160;
    const toH = toNode.height ?? 70;

    const startX = fromNode.x + fromW / 2;
    const startY = fromNode.y + fromH / 2;
    const endX = toNode.x + toW / 2;
    const endY = toNode.y + toH / 2;

    const arrowSpec: ElementSpec = {
      type: "arrow",
      x: startX,
      y: startY,
      width: Math.abs(endX - startX),
      height: Math.abs(endY - startY),
      points: [[0, 0], [endX - startX, endY - startY]],
      strokeColor: "#64748b",
      strokeWidth: 2,
      strokeStyle: (conn.style as ElementSpec["strokeStyle"]) ?? "solid",
      roughness: 0,
      endArrowhead: "arrow",
      startBindingId: fromId,
      endBindingId: toId,
    };
    specs.push(arrowSpec);
  }

  const { elements: allElements } = buildElements(specs);
  scene.elements = [...scene.elements, ...allElements];
  await putScene(name, scene);

  return ok(`Created diagram in "${name}" with ${nodes.length} node(s) and ${connections.length} connection(s).`);
}

// ─── Diagram-as-code tool handlers ────────────────────────────────────────────

async function handleCreateDiagram(args: Record<string, unknown>) {
  const vaultPath = requireVaultPath();
  const folder = args.folder as string;
  const name = (args.name as string).replace(/\.md$/, "");
  const title = args.title as string;
  const format = args.format as string;
  const source = args.source as string;
  const sceneName = ensureExt(args.scene as string);
  const description = args.description as string | undefined;
  const tags = args.tags as string[] | undefined;
  const x = (args.x as number | undefined) ?? 50;
  const y = (args.y as number | undefined) ?? 50;

  // Render via Kroki
  const svg = await renderWithKroki(format, source);
  const { width, height } = extractSvgDimensions(svg);
  const dataUrl = svgToDataUrl(svg);

  const fileId = makeFileId();
  const elementId = makeElementId();
  const now = new Date().toISOString().split("T")[0];

  // Add image to scene
  const scene = await getScene(sceneName);
  const fileEntry: ExcalidrawFileEntry = {
    mimeType: "image/svg+xml",
    id: fileId,
    dataURL: dataUrl,
    created: Date.now(),
    lastRetrieved: Date.now(),
  };
  scene.files[fileId] = fileEntry;
  scene.elements = [...scene.elements, makeImageElement(elementId, fileId, x, y, width, height)];
  await putScene(sceneName, scene);

  // Write .md to vault
  const fm: DiagramFrontmatter = {
    title,
    format,
    scene: sceneName,
    fileId,
    elementId,
    tags,
    created: now,
    updated: now,
    description,
  };
  const mdContent = buildMarkdown(fm, source);
  const folderPath = path.join(vaultPath, folder);
  await mkdir(folderPath, { recursive: true });
  const mdPath = path.join(folderPath, `${name}.md`);
  await writeFile(mdPath, mdContent, "utf-8");

  const gitResult = await gitCommitAndPush(vaultPath, `add diagram: ${folder}/${name}`);

  return ok(
    `Created diagram "${title}" (${format})\n` +
    `Vault: ${folder}/${name}.md\n` +
    `Scene: ${sceneName} (elementId: ${elementId}, fileId: ${fileId})\n` +
    `Size: ${Math.round(width)}×${Math.round(height)}\n` +
    `Git: ${gitResult}`
  );
}

async function handleUpdateDiagram(args: Record<string, unknown>) {
  const vaultPath = requireVaultPath();
  const relPath = (args.path as string).replace(/\\/g, "/");
  const newSource = args.source as string;

  const mdPath = path.join(vaultPath, relPath.endsWith(".md") ? relPath : `${relPath}.md`);
  if (!existsSync(mdPath)) return err(`Diagram not found: ${relPath}`);

  const content = await readFile(mdPath, "utf-8");
  const { fm } = parseFrontmatter(content);

  if (!fm.format || !fm.scene || !fm.fileId) {
    return err(`Diagram frontmatter is missing required fields (format, scene, fileId)`);
  }

  const sceneName = ensureExt(fm.scene);

  // Re-render
  const svg = await renderWithKroki(fm.format, newSource);
  const dataUrl = svgToDataUrl(svg);

  // Update scene files entry (image element position/size unchanged)
  const scene = await getScene(sceneName);
  if (!scene.files[fm.fileId]) {
    return err(`fileId "${fm.fileId}" not found in scene "${sceneName}". Use render_diagram to re-add it.`);
  }
  scene.files[fm.fileId] = {
    ...scene.files[fm.fileId],
    dataURL: dataUrl,
    lastRetrieved: Date.now(),
  };
  await putScene(sceneName, scene);

  // Rewrite .md with updated source and timestamp
  const now = new Date().toISOString().split("T")[0];
  const updatedFm: DiagramFrontmatter = {
    title: fm.title ?? path.basename(relPath, ".md"),
    format: fm.format,
    scene: fm.scene,
    fileId: fm.fileId,
    elementId: fm.elementId ?? "",
    tags: fm.tags,
    created: fm.created ?? now,
    updated: now,
    description: fm.description,
  };
  await writeFile(mdPath, buildMarkdown(updatedFm, newSource), "utf-8");

  const gitResult = await gitCommitAndPush(vaultPath, `update diagram: ${relPath}`);

  return ok(
    `Updated diagram: ${relPath}\n` +
    `Scene: ${sceneName} (fileId: ${fm.fileId})\n` +
    `Git: ${gitResult}`
  );
}

async function handleRenderDiagram(args: Record<string, unknown>) {
  const vaultPath = requireVaultPath();
  const relPath = (args.path as string).replace(/\\/g, "/");
  const x = (args.x as number | undefined) ?? 50;
  const y = (args.y as number | undefined) ?? 50;

  const mdPath = path.join(vaultPath, relPath.endsWith(".md") ? relPath : `${relPath}.md`);
  if (!existsSync(mdPath)) return err(`Diagram not found: ${relPath}`);

  const content = await readFile(mdPath, "utf-8");
  const { fm, source } = parseFrontmatter(content);

  if (!fm.format || !fm.scene) {
    return err(`Diagram frontmatter is missing required fields (format, scene)`);
  }

  const sceneName = ensureExt((args.scene as string | undefined) ?? fm.scene);

  const svg = await renderWithKroki(fm.format, source);
  const { width, height } = extractSvgDimensions(svg);
  const dataUrl = svgToDataUrl(svg);

  const fileId = makeFileId();
  const elementId = makeElementId();

  const scene = await getScene(sceneName);
  scene.files[fileId] = {
    mimeType: "image/svg+xml",
    id: fileId,
    dataURL: dataUrl,
    created: Date.now(),
    lastRetrieved: Date.now(),
  };
  scene.elements = [...scene.elements, makeImageElement(elementId, fileId, x, y, width, height)];
  await putScene(sceneName, scene);

  return ok(
    `Rendered "${relPath}" into "${sceneName}"\n` +
    `elementId: ${elementId}, fileId: ${fileId}\n` +
    `Size: ${Math.round(width)}×${Math.round(height)}`
  );
}

async function handleGetDiagram(args: Record<string, unknown>) {
  const vaultPath = requireVaultPath();
  const relPath = (args.path as string).replace(/\\/g, "/");

  const mdPath = path.join(vaultPath, relPath.endsWith(".md") ? relPath : `${relPath}.md`);
  if (!existsSync(mdPath)) return err(`Diagram not found: ${relPath}`);

  const content = await readFile(mdPath, "utf-8");
  return ok(content);
}

async function handleListDiagrams(args: Record<string, unknown>) {
  const vaultPath = requireVaultPath();
  const folder = args.folder as string | undefined;

  const baseDir = folder ? path.join(vaultPath, folder) : vaultPath;
  if (!existsSync(baseDir)) return ok(`(folder "${folder}" not found in vault)`);

  const results: string[] = [];
  await walkVault(baseDir, vaultPath, results);

  if (results.length === 0) return ok("(no diagrams found)");
  return ok(results.join("\n"));
}

async function handleGitLog(args: Record<string, unknown>) {
  const vaultPath = requireVaultPath();
  const limit = (args.limit as number | undefined) ?? 10;

  try {
    const git = simpleGit(vaultPath);
    const log = await git.log({ maxCount: limit });
    if (log.all.length === 0) return ok("(no commits yet)");
    const lines = log.all.map(
      (c) => `${c.hash.slice(0, 7)} ${c.date.split("T")[0]} ${c.message}`
    );
    return ok(lines.join("\n"));
  } catch (e) {
    return err(`git log failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function handleGitStatus() {
  const vaultPath = requireVaultPath();

  try {
    const git = simpleGit(vaultPath);
    const [status, remotes] = await Promise.all([
      git.status(),
      git.getRemotes(true),
    ]);

    const lines: string[] = [];
    lines.push(`Branch: ${status.current}`);
    lines.push(`Ahead: ${status.ahead}  Behind: ${status.behind}`);
    if (remotes.length === 0) {
      lines.push("Remote: (none configured — run setup-vault.sh)");
    } else {
      for (const r of remotes) {
        lines.push(`Remote: ${r.name} → ${r.refs.push}`);
      }
    }
    if (status.files.length > 0) {
      lines.push(`\nUncommitted changes (${status.files.length}):`);
      for (const f of status.files) lines.push(`  ${f.index}${f.working_dir} ${f.path}`);
    } else {
      lines.push("\nWorking tree clean.");
    }

    return ok(lines.join("\n"));
  } catch (e) {
    return err(`git status failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// ─── Server setup ─────────────────────────────────────────────────────────────

const server = new Server(
  { name: "excalidraw-mcp", version: "1.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    switch (name) {
      case "list_scenes":         return handleListScenes();
      case "create_scene":        return handleCreateScene(args);
      case "read_scene":          return handleReadScene(args);
      case "add_elements":        return handleAddElements(args);
      case "update_element":      return handleUpdateElement(args);
      case "delete_element":      return handleDeleteElement(args);
      case "clear_scene":         return handleClearScene(args);
      case "delete_scene":        return handleDeleteScene(args);
      case "get_scene_summary":   return handleGetSceneSummary(args);
      case "add_diagram":         return handleAddDiagram(args);
      case "create_diagram":      return handleCreateDiagram(args);
      case "update_diagram":      return handleUpdateDiagram(args);
      case "render_diagram":      return handleRenderDiagram(args);
      case "get_diagram":         return handleGetDiagram(args);
      case "list_diagrams":       return handleListDiagrams(args);
      case "git_log":             return handleGitLog(args);
      case "git_status":          return handleGitStatus();
      default:
        return err(`Unknown tool: ${name}`);
    }
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
});

// ─── Start ───────────────────────────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `[excalidraw-mcp] Server running. Bridge: ${BRIDGE_URL} | Kroki: ${KROKI_URL} | Vault: ${VAULT_PATH || "(not set)"}`
  );
}

main().catch((e) => {
  console.error("[excalidraw-mcp] Fatal:", e);
  process.exit(1);
});
