import fs from "node:fs/promises";
import path from "node:path";
import type { Dirent } from "node:fs";
import { simpleGit } from "simple-git";

const VAULT_PATH = path.resolve(process.env.VAULT_PATH ?? "./diagrams-vault");

// ── Path safety ──────────────────────────────────────────────────────────────

export function safePath(relativePath: string): string {
  // Normalize separators, then resolve against vault root
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\//, "");
  const abs = path.resolve(VAULT_PATH, normalized);
  if (!abs.startsWith(VAULT_PATH + path.sep) && abs !== VAULT_PATH) {
    throw new Error(`Path "${relativePath}" escapes the vault`);
  }
  return abs;
}

export function vaultRelative(absPath: string): string {
  return path.relative(VAULT_PATH, absPath).replace(/\\/g, "/");
}

// ── Markdown helpers ─────────────────────────────────────────────────────────

function isoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function buildDiagramMarkdown(opts: {
  title: string;
  format: string;
  source: string;
  description?: string;
  tags?: string[];
  created?: string;
}): string {
  const date = isoDate();
  const tags = opts.tags?.length ? `[${opts.tags.join(", ")}]` : "[]";
  let md =
    `---\ntitle: ${opts.title}\nformat: ${opts.format}\ntags: ${tags}\n` +
    `created: ${opts.created ?? date}\nupdated: ${date}\n---\n\n` +
    `# ${opts.title}\n\n`;
  if (opts.description) md += `> ${opts.description}\n\n`;
  md += `\`\`\`${opts.format}\n${opts.source.trim()}\n\`\`\`\n`;
  return md;
}

export function buildDocumentMarkdown(opts: {
  title: string;
  folder: string;
  tags?: string[];
  body?: string;
}): string {
  const date = isoDate();
  const tags = opts.tags?.length ? `[${opts.tags.join(", ")}]` : "[]";
  let md =
    `---\ntitle: ${opts.title}\ntype: document\nfolder: ${opts.folder}\ntags: ${tags}\n` +
    `created: ${date}\nupdated: ${date}\n---\n\n` +
    `# ${opts.title}\n\n`;
  if (opts.body) md += opts.body.trim() + "\n";
  return md;
}

export interface DiagramInfo {
  path: string;
  title: string;
  format: string;
  source: string;
  tags: string[];
  created: string;
  updated: string;
}

export function parseDiagramMarkdown(content: string, relativePath: string): DiagramInfo {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) throw new Error("No YAML frontmatter found");

  const fm: Record<string, string> = {};
  for (const line of fmMatch[1].split("\n")) {
    const colon = line.indexOf(":");
    if (colon > 0) {
      fm[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
    }
  }

  const format = fm.format ?? "mermaid";
  // Match the first code fence with the expected format language
  const codeRe = new RegExp("```" + format + "\\n([\\s\\S]*?)\\n```");
  const codeMatch = content.match(codeRe);
  const source = codeMatch ? codeMatch[1] : "";

  const rawTags = (fm.tags ?? "[]").replace(/[\[\]]/g, "");
  const tags = rawTags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  return {
    path: relativePath,
    title: fm.title ?? "Untitled",
    format,
    source,
    tags,
    created: fm.created ?? "",
    updated: fm.updated ?? "",
  };
}

export function updateDiagramSource(
  content: string,
  format: string,
  newSource: string
): string {
  const date = isoDate();
  // Update the 'updated' frontmatter field
  let updated = content.replace(/^(updated:\s*).*$/m, `$1${date}`);
  // Replace the code fence body
  const codeRe = new RegExp("(```" + format + "\\n)[\\s\\S]*?(\\n```)", "m");
  if (codeRe.test(updated)) {
    updated = updated.replace(codeRe, `$1${newSource.trim()}$2`);
  } else {
    // Append new fence if not found
    updated = updated.trimEnd() + `\n\n\`\`\`${format}\n${newSource.trim()}\n\`\`\`\n`;
  }
  return updated;
}

// ── File operations ───────────────────────────────────────────────────────────

export async function writeVaultFile(
  relativePath: string,
  content: string
): Promise<string> {
  const abs = safePath(relativePath);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content, "utf-8");
  return relativePath;
}

export async function readVaultFile(relativePath: string): Promise<string> {
  return fs.readFile(safePath(relativePath), "utf-8");
}

export async function deleteVaultFile(relativePath: string): Promise<void> {
  await fs.unlink(safePath(relativePath));
}

export async function listVaultFiles(folder?: string): Promise<string[]> {
  const base = folder ? safePath(folder) : VAULT_PATH;
  const files: string[] = [];

  async function walk(dir: string): Promise<void> {
    let entries: Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith(".") || e.name === "Assets") continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        await walk(full);
      } else if (e.name.endsWith(".md")) {
        files.push(vaultRelative(full));
      }
    }
  }

  await walk(base);
  return files.sort();
}

// ── Git ───────────────────────────────────────────────────────────────────────

export async function gitStatus(): Promise<string> {
  const git = simpleGit(VAULT_PATH);
  try {
    const status = await git.status();
    const remote = await git.remote(["get-url", "origin"]).catch(() => "(no remote)");
    const branch = status.current ?? "unknown";
    const changed = status.files.length;
    return `Branch: ${branch}\nRemote: ${String(remote).trim()}\nChanged files: ${changed}`;
  } catch (err) {
    return `Git error: ${(err as Error).message}`;
  }
}

export async function gitCommitAndPush(message: string): Promise<string> {
  const git = simpleGit(VAULT_PATH);
  try {
    await git.add(".");
    const result = await git.commit(message);
    const sha = result.commit;
    if (!sha) return "Nothing to commit";
    await git.push().catch(() => {/* silent — no remote is fine */ });
    return `Committed ${sha}: ${message}`;
  } catch (err) {
    return `Git error: ${(err as Error).message}`;
  }
}

// ── Project scaffolding ───────────────────────────────────────────────────────

const VAULT_FOLDERS = ["Architecture", "Flows", "Sequences", "Infrastructure", "Notes"];

export async function initProject(name: string, description?: string): Promise<string> {
  const projectPath = path.join(VAULT_PATH, name);
  await fs.mkdir(projectPath, { recursive: true });

  for (const folder of VAULT_FOLDERS) {
    await fs.mkdir(path.join(projectPath, folder), { recursive: true });
  }

  const readme = [
    `# ${name}`,
    "",
    description ?? "Diagram-as-code project",
    "",
    "## Folders",
    VAULT_FOLDERS.map((f) => `- **${f}/**`).join("\n"),
    "",
  ].join("\n");

  await fs.writeFile(path.join(projectPath, "README.md"), readme, "utf-8");

  const obsidianConfig = {
    defaultViewMode: "source",
    alwaysUpdateLinks: true,
    showUnsupportedFiles: false,
  };
  const obsidianDir = path.join(projectPath, ".obsidian");
  await fs.mkdir(obsidianDir, { recursive: true });
  await fs.writeFile(
    path.join(obsidianDir, "app.json"),
    JSON.stringify(obsidianConfig, null, 2),
    "utf-8"
  );

  const gitignore = ".obsidian/workspace\n.obsidian/workspace.json\n";
  await fs.writeFile(path.join(projectPath, ".gitignore"), gitignore, "utf-8");

  return vaultRelative(projectPath);
}
