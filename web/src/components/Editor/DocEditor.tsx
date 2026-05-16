import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { SuggestionMenuController, getDefaultReactSlashMenuItems } from "@blocknote/react";
import { insertOrUpdateBlockForSlashMenu } from "@blocknote/core";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

import { schema, markdownToBlocks, blocksToMarkdown } from "../../lib/markdown.js";
import { FrontmatterPanel } from "./FrontmatterPanel.js";
import { EditorToolbar } from "./EditorToolbar.js";
import { MermaidBlock } from "./MermaidBlock.js";
import { useState, useEffect, useCallback } from "react";
import type { Frontmatter } from "../../lib/frontmatter.js";

const editorSchema = schema;

export function DocEditor({
  filePath,
  onSaveSuccess,
}: {
  filePath: string;
  onSaveSuccess: () => void;
}) {
  const [frontmatter, setFrontmatter] = useState<Frontmatter>({});
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const editor = useCreateBlockNote({ schema: editorSchema });

  useEffect(() => {
    setLoadError("");
    fetch(`/api/files/${encodeURIComponent(filePath)}`)
      .then((r) => r.json())
      .then(async ({ content }: { content: string }) => {
        const { frontmatter: fm, blocks } = await markdownToBlocks(content, editor);
        setFrontmatter(fm);
        editor.replaceBlocks(editor.document, blocks);
        setIsDirty(false);
      })
      .catch((err) => setLoadError(String(err)));
  }, [filePath]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const updatedFm = { ...frontmatter, updated: new Date().toISOString().split("T")[0] };
      const markdown = await blocksToMarkdown(editor.document, updatedFm, editor);
      const res = await fetch(`/api/files/${encodeURIComponent(filePath)}`, {
        method: "PUT",
        headers: { "Content-Type": "text/plain" },
        body: markdown,
      });
      if (res.ok) {
        setIsDirty(false);
        setFrontmatter(updatedFm);
        onSaveSuccess();
      }
    } finally {
      setIsSaving(false);
    }
  }, [filePath, frontmatter, editor, onSaveSuccess]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSave]);

  if (loadError) {
    return <div style={{ padding: 20, color: "#e53935" }}>Error: {loadError}</div>;
  }

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <EditorToolbar
          filePath={filePath}
          status={frontmatter.status}
          isDirty={isDirty}
          isSaving={isSaving}
          onSave={handleSave}
          onStatusChange={(status) => {
            setFrontmatter((p) => ({ ...p, status }));
            setIsDirty(true);
          }}
        />
        <div style={{ flex: 1, overflow: "auto", padding: "20px 40px" }}>
          <BlockNoteView
            editor={editor}
            onChange={() => setIsDirty(true)}
            theme="light"
            slashMenu={false}
          >
            <SuggestionMenuController
              triggerCharacter="/"
              getItems={async (query) =>
                [
                  ...getDefaultReactSlashMenuItems(editor),
                  {
                    title: "Diagram",
                    subtext: "Insert a Mermaid / C4 / PlantUML diagram block",
                    onItemClick: () =>
                      insertOrUpdateBlockForSlashMenu(editor, {
                        type: "paragraph",
                        content: [{ type: "text", text: "```mermaid\ngraph TD\n  A --> B\n```", styles: {} }],
                      }),
                    group: "Architecture",
                    icon: <span>D</span>,
                  },
                ].filter((i) => i.title.toLowerCase().includes(query.toLowerCase()))
              }
            />
          </BlockNoteView>
        </div>
      </div>
      <FrontmatterPanel
        frontmatter={frontmatter}
        onChange={(fm) => {
          setFrontmatter(fm);
          setIsDirty(true);
        }}
      />
    </div>
  );
}
