import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import { SuggestionMenuController, getDefaultReactSlashMenuItems } from "@blocknote/react";
import { BlockNoteEditor, insertOrUpdateBlockForSlashMenu } from "@blocknote/core";
import type { PartialBlock } from "@blocknote/core";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/shadcn/style.css";

import { markdownToBlocks, blocksToMarkdown } from "../../lib/markdown.js";
import { FrontmatterPanel } from "./FrontmatterPanel.js";
import { EditorToolbar } from "./EditorToolbar.js";
import { useState, useEffect, useCallback } from "react";
import type { Frontmatter } from "../../lib/frontmatter.js";

interface LoadState {
  frontmatter: Frontmatter;
  blocks: PartialBlock[];
}

export function DocEditor({
  filePath,
  onSaveSuccess,
}: {
  filePath: string;
  onSaveSuccess: () => void;
}) {
  const [loadState, setLoadState] = useState<LoadState | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    setLoadState(null);
    setLoadError("");
    const ctrl = new AbortController();
    // Headless editor used only for markdown parsing — avoids needing
    // the rendered editor to exist before content is available.
    const parseEditor = BlockNoteEditor.create();

    fetch(`/api/files?path=${encodeURIComponent(filePath)}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then(async ({ content }: { content: string }) => {
        const result = await markdownToBlocks(content, parseEditor);
        if (!ctrl.signal.aborted) setLoadState(result);
      })
      .catch((err) => {
        if (!ctrl.signal.aborted) setLoadError(String(err));
      });

    return () => ctrl.abort();
  }, [filePath]);

  if (loadError) {
    return <div style={{ padding: 20, color: "#e53935" }}>Error: {loadError}</div>;
  }
  if (!loadState) {
    return (
      <div style={{ padding: 20, color: "#999", fontStyle: "italic" }}>Loading…</div>
    );
  }

  return (
    <EditorInner
      filePath={filePath}
      initialFrontmatter={loadState.frontmatter}
      initialBlocks={loadState.blocks}
      onSaveSuccess={onSaveSuccess}
    />
  );
}

function EditorInner({
  filePath,
  initialFrontmatter,
  initialBlocks,
  onSaveSuccess,
}: {
  filePath: string;
  initialFrontmatter: Frontmatter;
  initialBlocks: PartialBlock[];
  onSaveSuccess: () => void;
}) {
  const [frontmatter, setFrontmatter] = useState<Frontmatter>(initialFrontmatter);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [mounted, setMounted] = useState(false);

  const editor = useCreateBlockNote({ initialContent: initialBlocks });

  useEffect(() => { setMounted(true); }, []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const updatedFm = { ...frontmatter, updated: new Date().toISOString().split("T")[0] };
      const markdown = await blocksToMarkdown(editor.document, updatedFm, editor);
      const res = await fetch(`/api/files?path=${encodeURIComponent(filePath)}`, {
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
          {mounted && (
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
                          type: "codeBlock",
                          props: { language: "mermaid" },
                          content: [{ type: "text", text: "graph TD\n  A --> B", styles: {} }],
                        }),
                      group: "Architecture",
                      icon: <span style={{ fontWeight: 700 }}>⬡</span>,
                    },
                  ].filter((i) => i.title.toLowerCase().includes(query.toLowerCase()))
                }
              />
            </BlockNoteView>
          )}
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
