export interface Frontmatter {
  title?: string;
  type?: string;
  status?: "draft" | "in-review" | "stable" | "deprecated" | "example";
  created?: string;
  updated?: string;
  tags?: string[];
  relates_to?: string[];
  owner?: string;
  reviewed_by?: string;
  [key: string]: unknown;
}

export function parseFrontmatter(content: string): { frontmatter: Frontmatter; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: content };
  const frontmatter: Frontmatter = {};
  for (const line of match[1].split("\n")) {
    const [key, ...rest] = line.split(":");
    if (!key?.trim()) continue;
    const val = rest.join(":").trim().replace(/^["']|["']$/g, "");
    if (val.startsWith("[")) {
      try {
        frontmatter[key.trim()] = JSON.parse(val.replace(/'/g, '"'));
      } catch {
        frontmatter[key.trim()] = val;
      }
    } else {
      frontmatter[key.trim()] = val;
    }
  }
  return { frontmatter, body: match[2].trim() };
}

export function serializeFrontmatter(fm: Frontmatter, body: string): string {
  const lines = ["---"];
  for (const [key, val] of Object.entries(fm)) {
    if (Array.isArray(val)) {
      lines.push(`${key}:`);
      for (const item of val) lines.push(`  - "${item}"`);
    } else if (val !== undefined && val !== "") {
      lines.push(`${key}: ${val}`);
    }
  }
  lines.push("---", "", body);
  return lines.join("\n");
}
