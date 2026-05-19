import { useCallback, useMemo } from "react";
import type { FileNode } from "../api/client.js";
import { parseFrontmatter } from "../lib/frontmatter.js";

function flattenFiles(nodes: FileNode[]): FileNode[] {
  const out: FileNode[] = [];
  for (const n of nodes) {
    if (n.type === "file") out.push(n);
    else if (n.children) out.push(...flattenFiles(n.children));
  }
  return out;
}

export function useStableDocuments(
  tree: FileNode[],
  readFile: (path: string) => Promise<string>
) {
  const stableNodes = useMemo(
    () => flattenFiles(tree).filter((n) => n.status === "stable"),
    [tree]
  );

  const getContext = useCallback(async (): Promise<string> => {
    if (stableNodes.length === 0) return "";
    const parts: string[] = [];
    for (const node of stableNodes) {
      try {
        const content = await readFile(node.path);
        const { frontmatter, body } = parseFrontmatter(content);
        const title = (frontmatter.title as string | undefined) ?? node.name;
        parts.push(`## ${title} (${node.path})\n\n${body}`);
      } catch {
        // skip unreadable files silently
      }
    }
    return parts.join("\n\n---\n\n");
  }, [stableNodes, readFile]);

  return { getContext, stableCount: stableNodes.length };
}
