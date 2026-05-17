import { BlockNoteEditor } from "@blocknote/core";
import { parseFrontmatter, serializeFrontmatter, type Frontmatter } from "./frontmatter.js";

export async function markdownToBlocks(content: string, editor: BlockNoteEditor) {
  const { frontmatter, body } = parseFrontmatter(content);
  const blocks = await editor.tryParseMarkdownToBlocks(body);
  return { frontmatter, blocks };
}

export async function blocksToMarkdown(
  blocks: any[],
  frontmatter: Frontmatter,
  editor: BlockNoteEditor
): Promise<string> {
  const md = await editor.blocksToMarkdownLossy(blocks);
  return serializeFrontmatter(frontmatter, md);
}
