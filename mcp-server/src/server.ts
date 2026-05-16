import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { renderDiagram, SUPPORTED_FORMATS } from "./kroki.js";
import {
  buildDiagramMarkdown,
  buildDocumentMarkdown,
  parseDiagramMarkdown,
  updateDiagramSource,
  writeVaultFile,
  readVaultFile,
  deleteVaultFile,
  listVaultFiles,
  gitStatus,
  gitCommitAndPush,
  initProject,
} from "./vault.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "diagram-mcp",
    version: "1.0.0",
  });

  registerTools(server);
  return server;
}

function ok(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

function registerTools(server: McpServer): void {
  // ── Rendering ──────────────────────────────────────────────────────────────

  server.tool(
    "render_diagram",
    "Render diagram source code to SVG using Kroki. Returns the raw SVG string.",
    {
      format: z
        .string()
        .describe(
          "Diagram format: mermaid | plantuml | graphviz | d2 | c4plantuml | structurizr | bpmn | erd | nomnoml | ditaa | wavedrom | vega | vega-lite | pikchr | dbml"
        ),
      source: z.string().describe("Diagram source code"),
    },
    async ({ format, source }) => {
      const svg = await renderDiagram(format, source);
      return ok(svg);
    }
  );

  server.tool(
    "list_formats",
    "List all diagram formats supported by the Kroki renderer.",
    {},
    async () => {
      const list = SUPPORTED_FORMATS.map((f) => `- ${f}`).join("\n");
      return ok(`Supported formats:\n${list}`);
    }
  );

  // ── Vault CRUD ────────────────────────────────────────────────────────────

  server.tool(
    "create_diagram",
    "Create a new diagram in the vault. Saves a .md file with YAML frontmatter and a code fence. The diagram is immediately editable in the Vault Editor.",
    {
      folder: z
        .string()
        .describe("Vault folder: Architecture | Flows | Sequences | Infrastructure | Notes"),
      name: z.string().describe("File name without extension (e.g. 'system-overview')"),
      title: z.string().describe("Human-readable title"),
      format: z
        .string()
        .describe("Diagram format (mermaid, plantuml, graphviz, d2, c4plantuml, …)"),
      source: z.string().describe("Diagram source code"),
      description: z.string().optional().describe("One-line description (added as blockquote)"),
      tags: z.array(z.string()).optional().describe("Tags for categorisation"),
    },
    async ({ folder, name, title, format, source, description, tags }) => {
      const relativePath = `${folder}/${name}.md`;
      const content = buildDiagramMarkdown({ title, format, source, description, tags });
      await writeVaultFile(relativePath, content);
      return ok(`Created: ${relativePath}`);
    }
  );

  server.tool(
    "update_diagram",
    "Update the source code of an existing diagram in the vault. Preserves frontmatter and updates the 'updated' date.",
    {
      path: z.string().describe("Vault-relative path (e.g. 'Architecture/system-overview.md')"),
      source: z.string().describe("New diagram source code"),
      format: z
        .string()
        .optional()
        .describe("Override format (only needed if changing the diagram language)"),
    },
    async ({ path: relPath, source, format }) => {
      const existing = await readVaultFile(relPath);
      const info = parseDiagramMarkdown(existing, relPath);
      const targetFormat = format ?? info.format;
      const updated = updateDiagramSource(existing, targetFormat, source);
      await writeVaultFile(relPath, updated);
      return ok(`Updated: ${relPath}`);
    }
  );

  server.tool(
    "get_diagram",
    "Read a diagram from the vault. Returns the frontmatter metadata and the source code.",
    {
      path: z.string().describe("Vault-relative path (e.g. 'Architecture/system-overview.md')"),
    },
    async ({ path: relPath }) => {
      const content = await readVaultFile(relPath);
      const info = parseDiagramMarkdown(content, relPath);
      const text = [
        `Title:   ${info.title}`,
        `Format:  ${info.format}`,
        `Tags:    ${info.tags.join(", ") || "—"}`,
        `Created: ${info.created}`,
        `Updated: ${info.updated}`,
        "",
        "Source:",
        "```" + info.format,
        info.source,
        "```",
      ].join("\n");
      return ok(text);
    }
  );

  server.tool(
    "list_diagrams",
    "List all .md files in the vault, optionally filtered to a specific folder.",
    {
      folder: z
        .string()
        .optional()
        .describe("Vault folder to list (omit for all folders)"),
    },
    async ({ folder }) => {
      const files = await listVaultFiles(folder);
      if (!files.length) return ok(folder ? `No diagrams in ${folder}/` : "Vault is empty");
      return ok(files.join("\n"));
    }
  );

  server.tool(
    "delete_diagram",
    "Permanently delete a diagram file from the vault.",
    {
      path: z.string().describe("Vault-relative path to delete"),
    },
    async ({ path: relPath }) => {
      await deleteVaultFile(relPath);
      return ok(`Deleted: ${relPath}`);
    }
  );

  // ── Documents ─────────────────────────────────────────────────────────────

  server.tool(
    "create_document",
    "Create a structured Markdown document in the vault (not a diagram — use for notes, reports, architecture decisions, etc.).",
    {
      folder: z
        .string()
        .describe("Vault folder: Architecture | Flows | Sequences | Infrastructure | Notes"),
      name: z.string().describe("File name without extension"),
      title: z.string().describe("Document title"),
      body: z
        .string()
        .optional()
        .describe("Document body as Markdown text (headings, lists, tables, diagram embeds, etc.)"),
      tags: z.array(z.string()).optional(),
    },
    async ({ folder, name, title, body, tags }) => {
      const relativePath = `${folder}/${name}.md`;
      const content = buildDocumentMarkdown({ title, folder, body, tags });
      await writeVaultFile(relativePath, content);
      return ok(`Created: ${relativePath}`);
    }
  );

  // ── Project scaffolding ───────────────────────────────────────────────────

  server.tool(
    "init_project",
    "Scaffold a new project directory inside the vault: creates Architecture/, Flows/, Sequences/, Infrastructure/, Notes/ folders plus README.md and Obsidian config.",
    {
      name: z.string().describe("Project name (becomes a subfolder in the vault)"),
      description: z.string().optional().describe("Short description for the README"),
    },
    async ({ name, description }) => {
      const created = await initProject(name, description);
      return ok(`Initialised project at: ${created}/`);
    }
  );

  // ── Git ───────────────────────────────────────────────────────────────────

  server.tool(
    "git_status",
    "Show git status of the vault: current branch, remote URL, and count of changed files.",
    {},
    async () => {
      const status = await gitStatus();
      return ok(status);
    }
  );

  server.tool(
    "git_commit",
    "Stage all vault changes, commit with the given message, and push to the configured remote (if any).",
    {
      message: z.string().describe("Commit message"),
    },
    async ({ message }) => {
      const result = await gitCommitAndPush(message);
      return ok(result);
    }
  );
}
