import { BlockNoteEditor, BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core";
import { parseFrontmatter, serializeFrontmatter, type Frontmatter } from "./frontmatter.js";

export const schema = BlockNoteSchema.create({
  blockSpecs: { ...defaultBlockSpecs },
});

export async function markdownToBlocks(
  content: string,
  editor: BlockNoteEditor<typeof schema.blockSpecs>
) {
  const { frontmatter, body } = parseFrontmatter(content);
  const blocks = await editor.tryParseMarkdownToBlocks(body);
  return { frontmatter, blocks };
}

export async function blocksToMarkdown(
  blocks: any[],
  frontmatter: Frontmatter,
  editor: BlockNoteEditor<typeof schema.blockSpecs>
): Promise<string> {
  const md = await editor.blocksToMarkdownLossy(blocks);
  return serializeFrontmatter(frontmatter, md);
}
