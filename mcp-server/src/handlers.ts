import { Server } from "@modelcontextprotocol/sdk/server/index.js";
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
const ERASER_API_KEY = process.env.ERASER_API_KEY ?? "";

// ─── Bridge helpers ──────────────────────────────────────────────────────────

async function getScene(name: string): Promise<ExcalidrawScene> {
  const res = await fetch(`${BRIDGE_URL}/scenes/${encodeURIComponent(name)}`);
  if (!res.ok) throw new Error(`Scene "${name}" not found`);
  const scene = await res.json() as ExcalidrawScene;
  scene.files = scene.files ?? {};
  return scene;
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

export function ok(msg: string) {
  return { content: [{ type: "text" as const, text: msg }] };
}

export function err(msg: string) {
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

// ─── Eraser.io helpers ────────────────────────────────────────────────────────

async function renderWithEraser(
  source: string,
  diagramType: string,
  theme: string
): Promise<Buffer> {
  if (!ERASER_API_KEY) {
    throw new Error(
      "ERASER_API_KEY env var is not set — add it to docker-compose.yml and restart the mcp-http container."
    );
  }
  const res = await fetch("https://app.eraser.io/api/render/prompt", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ERASER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: source, diagramType, background: true, theme, scale: 2, returnFile: true }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Eraser.io render failed (${res.status}): ${body}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

function pngDimensions(buf: Buffer): { width: number; height: number } {
  if (buf.length > 24) {
    const w = buf.readUInt32BE(16);
    const h = buf.readUInt32BE(20);
    if (w > 0 && h > 0) {
      const maxDim = 1200;
      if (w > maxDim || h > maxDim) {
        const s = maxDim / Math.max(w, h);
        return { width: Math.round(w * s), height: Math.round(h * s) };
      }
      return { width: w, height: h };
    }
  }
  return { width: 800, height: 600 };
}

// ─── Vault helpers ────────────────────────────────────────────────────────────

function requireVaultPath(): string {
  if (!VAULT_PATH) throw new Error("VAULT_PATH env var is not set.");
  return VAULT_PATH;
}

function buildObsidianMarkdown(fm: DiagramFrontmatter, source: string): string {
  const tags = fm.tags?.length ? `\ntags: [${fm.tags.join(", ")}]` : "";
  const diagramTypeField = fm.diagramType ? `\ndiagramType: ${fm.diagramType}` : "";
  const assetField = fm.asset ? `\nasset: ${fm.asset}` : "";
  const excalidrawFields = fm.scene
    ? `\nscene: ${fm.scene}\nfileId: ${fm.fileId}\nelementId: ${fm.elementId}`
    : "";
  const desc = fm.description ? `\n> ${fm.description}\n` : "";
  // Rendered image embed — only for non-mermaid formats that produce a file asset
  const imageEmbed = fm.asset ? `\n![[${fm.asset}]]\n` : "";
  const codeLabel = fm.format === "eraser" ? "eraser" : fm.format;
  return `---
title: ${fm.title}
format: ${fm.format}${diagramTypeField}${assetField}${excalidrawFields}${tags}
created: ${fm.created}
updated: ${fm.updated}
---

# ${fm.title}
${desc}${imageEmbed}
\`\`\`${codeLabel}
${source.trimEnd()}
\`\`\`
`;
}

async function saveAsset(
  vaultPath: string,
  folder: string,
  name: string,
  data: string | Buffer,
  ext: "svg" | "png"
): Promise<string> {
  const assetsDir = path.join(vaultPath, folder, "Assets");
  await mkdir(assetsDir, { recursive: true });
  const filename = `${name}.${ext}`;
  if (ext === "svg") {
    await writeFile(path.join(assetsDir, filename), data as string, "utf-8");
  } else {
    await writeFile(path.join(assetsDir, filename), data as Buffer);
  }
  return `${folder}/Assets/${filename}`;
}

async function getDiagramEmbed(vaultPath: string, diagramPath: string): Promise<string> {
  const normalized = diagramPath.replace(/\\/g, "/");
  const mdPath = path.join(vaultPath, normalized.endsWith(".md") ? normalized : `${normalized}.md`);
  if (!existsSync(mdPath)) return `<!-- diagram not found: ${diagramPath} -->\n`;
  const content = await readFile(mdPath, "utf-8");
  const { fm, source } = parseFrontmatter(content);
  if (fm.format === "mermaid") return `\`\`\`mermaid\n${source}\n\`\`\`\n`;
  if (fm.asset) return `![[${fm.asset}]]\n`;
  return `[[${normalized}]]\n`;
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

// ─── Tool definitions ─────────────────────────────────────────────────────────

export const TOOLS: Tool[] = [
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
      properties: { name: { type: "string" } },
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
    description: `Create a diagram from source code, store it in the Obsidian vault, and optionally push to an Excalidraw scene for live preview.

Primary output (always): an Obsidian-compatible .md file with the source and a rendered embed.
  • mermaid  → inline \`\`\`mermaid code block (Obsidian renders natively — no asset file)
  • plantuml / graphviz / d2 / etc. → rendered SVG saved to {folder}/Assets/{name}.svg → ![[…]] embed

Secondary output (optional): pass scene to also push to an Excalidraw canvas.

Supported Kroki formats: mermaid, plantuml, graphviz, d2, c4plantuml, structurizr, bpmn, erd, nomnoml, and 15+ more.
Auto-commits and pushes to git if a remote is configured.`,
    inputSchema: {
      type: "object",
      properties: {
        folder: { type: "string", description: "Vault subfolder (e.g. 'Architecture', 'Flows'). Created if absent." },
        name: { type: "string", description: "Diagram filename without .md (e.g. 'system-overview')." },
        title: { type: "string", description: "Human-readable title." },
        format: { type: "string", description: "Kroki format: mermaid | plantuml | graphviz | d2 | c4plantuml | structurizr | bpmn | erd | nomnoml | etc." },
        source: { type: "string", description: "Diagram source code." },
        scene: { type: "string", description: "Optional: Excalidraw scene name for live-preview. Omit to produce Obsidian-only output." },
        description: { type: "string", description: "One-line description written into the .md." },
        tags: { type: "array", items: { type: "string" }, description: "Obsidian tags." },
        x: { type: "number", description: "X position in scene (default 50; only used when scene is set)." },
        y: { type: "number", description: "Y position in scene (default 50; only used when scene is set)." },
      },
      required: ["folder", "name", "title", "format", "source"],
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
  // ─── Project / Obsidian tools ──────────────────────────────────────────────
  {
    name: "init_project",
    description: `Initialise a new Obsidian-compatible project vault under VAULT_PATH.
Creates standard folder structure, README.md, .obsidian config, .gitignore, and an initial git commit.
The resulting directory can be opened directly in Obsidian as a vault.`,
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Project name — becomes the vault directory name and README title." },
        description: { type: "string", description: "Short project description written into README.md." },
        folders: {
          type: "array",
          items: { type: "string" },
          description: "Subfolder list. Defaults to Architecture, Flows, Sequences, Infrastructure, Notes, Assets.",
        },
        git_init: { type: "boolean", description: "Initialise a git repository with an initial commit (default true)." },
      },
      required: ["name"],
    },
  },
  {
    name: "create_document",
    description: `Create an Obsidian document (the primary deliverable in the workflow).

Documents are structured markdown files with YAML frontmatter, an intro body, and named sections.
Each section can contain body text AND/OR a diagram embed — the tool reads the diagram's .md file and
auto-inserts the correct Obsidian embed:
  • mermaid diagrams  → inline \`\`\`mermaid code block
  • SVG/PNG diagrams  → ![[folder/Assets/name.svg|png]]

Typical workflow:
  1. init_project  → create vault
  2. create_diagram / create_eraser_diagram  → create diagrams
  3. create_document  → compose the final document referencing those diagrams`,
    inputSchema: {
      type: "object",
      properties: {
        folder: { type: "string", description: "Vault subfolder (e.g. 'Notes', 'Architecture')." },
        name: { type: "string", description: "Document filename without .md." },
        title: { type: "string", description: "Document title (H1 heading)." },
        body: { type: "string", description: "Introductory markdown content before the first section." },
        tags: { type: "array", items: { type: "string" }, description: "Obsidian tags." },
        sections: {
          type: "array",
          description: "Ordered list of document sections.",
          items: {
            type: "object",
            properties: {
              heading: { type: "string", description: "Section heading (H2)." },
              body: { type: "string", description: "Section body text (markdown)." },
              diagram: { type: "string", description: "Vault-relative path to a diagram .md file to embed (e.g. 'Architecture/system-overview.md')." },
            },
            required: ["heading"],
          },
        },
      },
      required: ["folder", "name", "title"],
    },
  },
  {
    name: "create_eraser_diagram",
    description: `Render a diagram via the Eraser.io API and store it in the Obsidian vault.

Primary output (always): PNG saved to {folder}/Assets/{name}.png + .md source file with ![[…]] embed.
Secondary output (optional): pass scene to also push to an Excalidraw canvas for live preview.

Requires ERASER_API_KEY env var. Source can be Eraser diagram-as-code or a natural-language description.
Supported diagram_type values: flowchart, sequenceDiagram, classDiagram, entityRelationshipDiagram, cloudArchitectureDiagram, mindmap.
Auto-commits and pushes to git if a remote is configured.`,
    inputSchema: {
      type: "object",
      properties: {
        folder: { type: "string", description: "Vault subfolder (e.g. 'Flows', 'Architecture')." },
        name: { type: "string", description: "Diagram filename without .md." },
        title: { type: "string", description: "Human-readable title." },
        source: { type: "string", description: "Eraser diagram-as-code or natural-language prompt." },
        diagram_type: {
          type: "string",
          enum: ["flowchart", "sequenceDiagram", "classDiagram", "entityRelationshipDiagram", "cloudArchitectureDiagram", "mindmap"],
          description: "Eraser diagram type.",
        },
        scene: { type: "string", description: "Optional: Excalidraw scene for live preview. Omit for Obsidian-only output." },
        theme: { type: "string", enum: ["light", "dark"], description: "Diagram colour theme (default light)." },
        description: { type: "string", description: "One-line description written into the .md." },
        tags: { type: "array", items: { type: "string" }, description: "Obsidian tags." },
        x: { type: "number", description: "X position in scene (default 50; only used when scene is set)." },
        y: { type: "number", description: "Y position in scene (default 50; only used when scene is set)." },
      },
      required: ["folder", "name", "title", "source", "diagram_type"],
    },
  },
];

// ─── Tool handlers ────────────────────────────────────────────────────────────

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
  const res = await fetch(`${BRIDGE_URL}/scenes/${encodeURIComponent(name)}`, { method: "DELETE" });
  if (!res.ok) return err(`Scene "${name}" not found`);
  return ok(`Deleted scene: ${name}`);
}

async function handleGetSceneSummary(args: Record<string, unknown>) {
  const name = ensureExt(args.name as string);
  const scene = await getScene(name);
  const typeCounts: Record<string, number> = {};
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const el of scene.elements as Array<{ type: string; x: number; y: number; width: number; height: number }>) {
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
    specs.push({
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
    });
  }

  const { elements, idMap } = buildElements(specs);
  nodes.forEach((node, i) => { nodeElementIds[node.id] = idMap[i]; });

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

    specs.push({
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
    });
  }

  const { elements: allElements } = buildElements(specs);
  scene.elements = [...scene.elements, ...allElements];
  await putScene(name, scene);

  return ok(`Created diagram in "${name}" with ${nodes.length} node(s) and ${connections.length} connection(s).`);
}

async function handleCreateDiagram(args: Record<string, unknown>) {
  const vaultPath = requireVaultPath();
  const folder = args.folder as string;
  const name = (args.name as string).replace(/\.md$/, "");
  const title = args.title as string;
  const format = args.format as string;
  const source = args.source as string;
  const sceneName = args.scene ? ensureExt(args.scene as string) : null;
  const description = args.description as string | undefined;
  const tags = args.tags as string[] | undefined;
  const x = (args.x as number | undefined) ?? 50;
  const y = (args.y as number | undefined) ?? 50;
  const now = new Date().toISOString().split("T")[0];

  let assetPath: string | undefined;
  let fileId: string | undefined;
  let elementId: string | undefined;

  if (format === "mermaid") {
    // Mermaid renders natively in Obsidian — no asset file needed.
    // Optionally also push to an Excalidraw scene for live preview.
    if (sceneName) {
      const svg = await renderWithKroki(format, source);
      const { width, height } = extractSvgDimensions(svg);
      fileId = makeFileId();
      elementId = makeElementId();
      const scene = await getScene(sceneName);
      scene.files[fileId] = { mimeType: "image/svg+xml", id: fileId, dataURL: svgToDataUrl(svg), created: Date.now(), lastRetrieved: Date.now() };
      scene.elements = [...scene.elements, makeImageElement(elementId, fileId, x, y, width, height)];
      await putScene(sceneName, scene);
    }
  } else {
    // All other Kroki formats: render SVG → save to {folder}/Assets/{name}.svg
    const svg = await renderWithKroki(format, source);
    const { width, height } = extractSvgDimensions(svg);
    assetPath = await saveAsset(vaultPath, folder, name, svg, "svg");

    if (sceneName) {
      fileId = makeFileId();
      elementId = makeElementId();
      const scene = await getScene(sceneName);
      scene.files[fileId] = { mimeType: "image/svg+xml", id: fileId, dataURL: svgToDataUrl(svg), created: Date.now(), lastRetrieved: Date.now() };
      scene.elements = [...scene.elements, makeImageElement(elementId, fileId, x, y, width, height)];
      await putScene(sceneName, scene);
    }
  }

  const fm: DiagramFrontmatter = {
    title, format, tags, asset: assetPath,
    scene: sceneName ?? undefined, fileId, elementId,
    created: now, updated: now, description,
  };
  const mdContent = buildObsidianMarkdown(fm, source);
  const folderPath = path.join(vaultPath, folder);
  await mkdir(folderPath, { recursive: true });
  await writeFile(path.join(folderPath, `${name}.md`), mdContent, "utf-8");
  const gitResult = await gitCommitAndPush(vaultPath, `add diagram: ${folder}/${name}`);

  return ok([
    `Created diagram "${title}" (${format})`,
    `Vault: ${folder}/${name}.md`,
    assetPath
      ? `Asset: ${assetPath} — embed with ![[${assetPath}]]`
      : `Render: inline \`\`\`mermaid block (Obsidian renders natively)`,
    sceneName
      ? `Excalidraw: ${sceneName} (elementId: ${elementId})`
      : `Excalidraw: (none — omit scene param or add later with render_diagram)`,
    `Git: ${gitResult}`,
  ].join("\n"));
}

async function handleUpdateDiagram(args: Record<string, unknown>) {
  const vaultPath = requireVaultPath();
  const relPath = (args.path as string).replace(/\\/g, "/");
  const newSource = args.source as string;

  const mdPath = path.join(vaultPath, relPath.endsWith(".md") ? relPath : `${relPath}.md`);
  if (!existsSync(mdPath)) return err(`Diagram not found: ${relPath}`);

  const content = await readFile(mdPath, "utf-8");
  const { fm } = parseFrontmatter(content);
  if (!fm.format) return err("Diagram frontmatter is missing required field: format");

  const now = new Date().toISOString().split("T")[0];
  const lines: string[] = [`Updated diagram: ${relPath}`];

  if (fm.format === "eraser") {
    // Re-render PNG via Eraser.io
    const pngBuf = await renderWithEraser(newSource, fm.diagramType ?? "flowchart", "light");
    if (fm.asset) {
      await writeFile(path.join(vaultPath, fm.asset), pngBuf);
      lines.push(`Asset refreshed: ${fm.asset}`);
    }
    if (fm.scene && fm.fileId) {
      const scene = await getScene(ensureExt(fm.scene));
      if (scene.files[fm.fileId]) {
        scene.files[fm.fileId] = { ...scene.files[fm.fileId], dataURL: `data:image/png;base64,${pngBuf.toString("base64")}`, lastRetrieved: Date.now() };
        await putScene(ensureExt(fm.scene), scene);
        lines.push(`Excalidraw: ${fm.scene} refreshed`);
      }
    }
  } else {
    // Mermaid or any Kroki format
    const svg = await renderWithKroki(fm.format, newSource);
    if (fm.format !== "mermaid" && fm.asset) {
      await writeFile(path.join(vaultPath, fm.asset), svg, "utf-8");
      lines.push(`Asset refreshed: ${fm.asset}`);
    }
    if (fm.scene && fm.fileId) {
      const scene = await getScene(ensureExt(fm.scene));
      if (scene.files[fm.fileId]) {
        scene.files[fm.fileId] = { ...scene.files[fm.fileId], dataURL: svgToDataUrl(svg), lastRetrieved: Date.now() };
        await putScene(ensureExt(fm.scene), scene);
        lines.push(`Excalidraw: ${fm.scene} refreshed`);
      }
    }
  }

  const updatedFm: DiagramFrontmatter = {
    title: fm.title ?? path.basename(relPath, ".md"),
    format: fm.format,
    diagramType: fm.diagramType,
    asset: fm.asset,
    scene: fm.scene,
    fileId: fm.fileId,
    elementId: fm.elementId,
    tags: fm.tags,
    created: fm.created ?? now,
    updated: now,
    description: fm.description,
  };
  await writeFile(mdPath, buildObsidianMarkdown(updatedFm, newSource), "utf-8");
  const gitResult = await gitCommitAndPush(vaultPath, `update diagram: ${relPath}`);
  lines.push(`Git: ${gitResult}`);
  return ok(lines.join("\n"));
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
    return err("Diagram frontmatter is missing required fields (format, scene)");
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
    const [status, remotes] = await Promise.all([git.status(), git.getRemotes(true)]);
    const lines: string[] = [];
    lines.push(`Branch: ${status.current}`);
    lines.push(`Ahead: ${status.ahead}  Behind: ${status.behind}`);
    if (remotes.length === 0) {
      lines.push("Remote: (none configured — run setup-vault.sh)");
    } else {
      for (const r of remotes) lines.push(`Remote: ${r.name} → ${r.refs.push}`);
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

async function handleInitProject(args: Record<string, unknown>) {
  const vaultPath = requireVaultPath();
  const name = args.name as string;
  const description = (args.description as string | undefined) ?? `${name} documentation vault`;
  const gitInit = (args.git_init as boolean | undefined) ?? true;
  const defaultFolders = ["Architecture", "Flows", "Sequences", "Infrastructure", "Notes", "Assets"];
  const folders = (args.folders as string[] | undefined) ?? defaultFolders;

  const projectPath = path.join(vaultPath, name);
  await mkdir(projectPath, { recursive: true });

  for (const folder of folders) {
    const folderPath = path.join(projectPath, folder);
    await mkdir(folderPath, { recursive: true });
    await writeFile(path.join(folderPath, ".gitkeep"), "", "utf-8");
  }

  const obsidianDir = path.join(projectPath, ".obsidian");
  await mkdir(obsidianDir, { recursive: true });
  await writeFile(
    path.join(obsidianDir, "app.json"),
    JSON.stringify(
      { legacyEditor: false, livePreview: true, defaultViewMode: "source", attachmentFolderPath: "Assets", useMarkdownLinks: false },
      null, 2
    ),
    "utf-8"
  );

  const now = new Date().toISOString().split("T")[0];
  const readme = `---
title: ${name}
description: ${description}
created: ${now}
---

# ${name}

${description}

## Vault Structure

${folders.map((f) => `- \`${f}/\` — ${f}`).join("\n")}

## How diagrams are generated

Diagrams are created by the [excalidraw-mcp](https://github.com/gumpnart/excalidraw-mcp) MCP server via Kroki (diagram-as-code) or Eraser.io, then embedded here using Obsidian's \`![[path]]\` syntax.
`;
  await writeFile(path.join(projectPath, "README.md"), readme, "utf-8");
  await writeFile(
    path.join(projectPath, ".gitignore"),
    ".obsidian/workspace.json\n.obsidian/workspace-mobile.json\n.trash/\n.DS_Store\n",
    "utf-8"
  );

  let gitResult = "";
  if (gitInit) {
    try {
      const git = simpleGit(projectPath);
      await git.init();
      await git.add(".");
      await git.commit(`init: ${name} project vault`);
      gitResult = "git repository initialised with initial commit";
    } catch (e) {
      gitResult = `git init skipped: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  return ok(
    `Initialised project vault: ${name}\n` +
    `Path: ${projectPath}\n` +
    `Folders: ${folders.join(", ")}\n` +
    (gitResult ? `Git: ${gitResult}` : "")
  );
}

async function handleCreateDocument(args: Record<string, unknown>) {
  const vaultPath = requireVaultPath();
  const folder = args.folder as string;
  const name = (args.name as string).replace(/\.md$/, "");
  const title = args.title as string;
  const body = (args.body as string | undefined) ?? "";
  const tags = args.tags as string[] | undefined;
  const sections = (args.sections as Array<{
    heading: string;
    body?: string;
    diagram?: string;
  }> | undefined) ?? [];

  const now = new Date().toISOString().split("T")[0];
  const tagsLine = tags?.length ? `\ntags: [${tags.join(", ")}]` : "";

  let content = `---\ntitle: ${title}\ntype: document\ncreated: ${now}\nupdated: ${now}${tagsLine}\n---\n\n# ${title}\n`;
  if (body) content += `\n${body}\n`;

  for (const section of sections) {
    content += `\n## ${section.heading}\n\n`;
    if (section.body) content += `${section.body}\n\n`;
    if (section.diagram) {
      const embed = await getDiagramEmbed(vaultPath, section.diagram);
      content += embed + "\n";
    }
  }

  const folderPath = path.join(vaultPath, folder);
  await mkdir(folderPath, { recursive: true });
  await writeFile(path.join(folderPath, `${name}.md`), content, "utf-8");

  const gitResult = await gitCommitAndPush(vaultPath, `add document: ${folder}/${name}`);
  return ok(`Created document: ${folder}/${name}.md\nGit: ${gitResult}`);
}

async function handleCreateEraserDiagram(args: Record<string, unknown>) {
  const vaultPath = requireVaultPath();
  const folder = args.folder as string;
  const name = (args.name as string).replace(/\.md$/, "");
  const title = args.title as string;
  const source = args.source as string;
  const diagramType = args.diagram_type as string;
  const sceneName = args.scene ? ensureExt(args.scene as string) : null;
  const theme = (args.theme as string | undefined) ?? "light";
  const x = (args.x as number | undefined) ?? 50;
  const y = (args.y as number | undefined) ?? 50;
  const description = args.description as string | undefined;
  const tags = args.tags as string[] | undefined;
  const now = new Date().toISOString().split("T")[0];

  const pngBuf = await renderWithEraser(source, diagramType, theme);
  const { width, height } = pngDimensions(pngBuf);

  // Primary output: save PNG to {folder}/Assets/{name}.png for Obsidian embed
  const assetPath = await saveAsset(vaultPath, folder, name, pngBuf, "png");

  let fileId: string | undefined;
  let elementId: string | undefined;

  if (sceneName) {
    fileId = makeFileId();
    elementId = makeElementId();
    const scene = await getScene(sceneName);
    scene.files[fileId] = { mimeType: "image/png", id: fileId, dataURL: `data:image/png;base64,${pngBuf.toString("base64")}`, created: Date.now(), lastRetrieved: Date.now() };
    scene.elements = [...scene.elements, makeImageElement(elementId, fileId, x, y, width, height)];
    await putScene(sceneName, scene);
  }

  const fm: DiagramFrontmatter = {
    title, format: "eraser", diagramType, tags, asset: assetPath,
    scene: sceneName ?? undefined, fileId, elementId,
    created: now, updated: now, description,
  };
  const mdContent = buildObsidianMarkdown(fm, source);
  const folderPath = path.join(vaultPath, folder);
  await mkdir(folderPath, { recursive: true });
  await writeFile(path.join(folderPath, `${name}.md`), mdContent, "utf-8");

  const gitResult = await gitCommitAndPush(vaultPath, `add eraser diagram: ${folder}/${name}`);
  return ok([
    `Created Eraser.io diagram "${title}" (${diagramType})`,
    `Vault: ${folder}/${name}.md`,
    `Asset: ${assetPath} — embed with ![[${assetPath}]]`,
    sceneName
      ? `Excalidraw: ${sceneName} (elementId: ${elementId}) — Size: ${width}×${height}`
      : `Excalidraw: (none — Obsidian only)`,
    `Git: ${gitResult}`,
  ].join("\n"));
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

export async function handleTool(name: string, args: Record<string, unknown>) {
  switch (name) {
    case "list_scenes":       return handleListScenes();
    case "create_scene":      return handleCreateScene(args);
    case "read_scene":        return handleReadScene(args);
    case "add_elements":      return handleAddElements(args);
    case "update_element":    return handleUpdateElement(args);
    case "delete_element":    return handleDeleteElement(args);
    case "clear_scene":       return handleClearScene(args);
    case "delete_scene":      return handleDeleteScene(args);
    case "get_scene_summary": return handleGetSceneSummary(args);
    case "add_diagram":       return handleAddDiagram(args);
    case "create_diagram":    return handleCreateDiagram(args);
    case "update_diagram":    return handleUpdateDiagram(args);
    case "render_diagram":    return handleRenderDiagram(args);
    case "get_diagram":       return handleGetDiagram(args);
    case "list_diagrams":     return handleListDiagrams(args);
    case "git_log":              return handleGitLog(args);
    case "git_status":           return handleGitStatus();
    case "init_project":          return handleInitProject(args);
    case "create_document":       return handleCreateDocument(args);
    case "create_eraser_diagram": return handleCreateEraserDiagram(args);
    default:                     return err(`Unknown tool: ${name}`);
  }
}

// ─── Server factory ───────────────────────────────────────────────────────────

export function createMcpServer(): Server {
  const server = new Server(
    { name: "excalidraw-mcp", version: "1.4.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;
    try {
      return await handleTool(name, args);
    } catch (e) {
      return err(e instanceof Error ? e.message : String(e));
    }
  });

  return server;
}
