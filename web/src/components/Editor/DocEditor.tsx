import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import {
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
} from "@blocknote/react";
import {
  BlockNoteEditor,
  BlockNoteSchema,
  defaultBlockSpecs,
  insertOrUpdateBlockForSlashMenu,
  markdownToBlocks,
} from "@blocknote/core";
import type { PartialBlock } from "@blocknote/core";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/shadcn/style.css";

import { useState, useEffect, useCallback } from "react";
import { MermaidBlock } from "./MermaidBlock";
import { AIAssistantBlock, AIAssistantContext } from "./AIAssistantBlock";
import { Frontmatter, serializeFrontmatter, parseFrontmatter } from "../../lib/frontmatter";
import { EditorToolbar } from "./EditorToolbar";
import { FrontmatterPanel } from "./FrontmatterPanel";

// ── Diagram languages ─────────────────────────────────────────────────────────

const DIAGRAM_LANGS = new Set([
  "mermaid",
  "plantuml",
  "graphviz",
  "d2",
  "c4plantuml",
  "erd",
]);

// ── Schema singleton ──────────────────────────────────────────────────────────
// Lazily initialized on first render (browser only — not during SSR module eval)

let _editorSchema: ReturnType<typeof BlockNoteSchema.create> | null = null;

function getEditorSchema() {
  if (!_editorSchema) {
    _editorSchema = BlockNoteSchema.create({
      blockSpecs: {
        ...defaultBlockSpecs,
        mermaid: MermaidBlock,
        aiAssistant: (AIAssistantBlock as any)(),
      },
    });
  }
  return _editorSchema;
}

// ── Block conversion helpers ──────────────────────────────────────────────────

function toDiagramBlocks(blocks: PartialBlock[]): PartialBlock[] {
  return blocks.map((block) => {
    if (block.type === "codeBlock") {
      const lang = (block.props as { language?: string })?.language ?? "";
      if (DIAGRAM_LANGS.has(lang)) {
        const dsl = (Array.isArray(block.content) ? block.content : [])
          .map((c: any) => (c as { text?: string }).text ?? "")
          .join("");
        return {
          id: block.id,
          type: "mermaid",
          props: { dsl, diagramType: lang, viewMode: "split" },
        } as unknown as PartialBlock;
      }
    }
    return block;
  });
}

async function serializeDocBlocks(
  editor: BlockNoteEditor<any>,
  blocks: any[],
): Promise<string> {
  const parts: string[] = [];
  let pending: any[] = [];

  const flush = async () => {
    if (!pending.length) return;
    const md = await editor.blocksToMarkdownLossy(pending);
    if (md.trim()) parts.push(md.trim());
    pending = [];
  };

  for (const block of blocks) {
    if (block.type === "mermaid") {
      await flush();
      const { dsl, diagramType } = block.props as {
        dsl: string;
        diagramType: string;
      };
      parts.push("```" + (diagramType || "mermaid") + "\n" + dsl + "\n```");
    } else if (block.type === "aiAssistant") {
      await flush();
      // AI assistant blocks are transient — skip serialization
    } else {
      pending.push(block);
    }
  }
  await flush();
  return parts.join("\n\n") + "\n";
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FileOps {
  read: (path: string) => Promise<string>;
  write: (path: string, content: string) => Promise<void>;
}

interface LoadState {
  frontmatter: Frontmatter;
  blocks: PartialBlock[];
}

// ── DocEditor (load + parse) ──────────────────────────────────────────────────

export function DocEditor({
  filePath,
  onSaveSuccess,
  onLoad,
  fileOps,
  getStableDocsContext,
  stableCount = 0,
}: {
  filePath: string;
  onSaveSuccess: () => void;
  onLoad?: (frontmatter: Frontmatter) => void;
  fileOps: FileOps;
  getStableDocsContext: () => Promise<string>;
  stableCount?: number;
}) {
  const [loadState, setLoadState] = useState<LoadState | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    setLoadState(null);
    setLoadError("");
    const ctrl = new AbortController();

    fileOps
      .read(filePath)
      .then((content) => {
        if (ctrl.signal.aborted) return;
        const { frontmatter, body } = parseFrontmatter(content);
        const parseEditor = BlockNoteEditor.create({ schema: getEditorSchema() });
        const rawBlocks = markdownToBlocks(body, parseEditor.pmSchema) as PartialBlock[];
        const blocks = toDiagramBlocks(rawBlocks);
        setLoadState({ frontmatter, blocks });
        onLoad?.(frontmatter);
      })
      .catch((err) => {
        if (!ctrl.signal.aborted) setLoadError(String(err));
      });

    return () => ctrl.abort();
  }, [filePath]);

  if (loadError) {
    return (
      <div style={{ padding: 20, color: "#e53935" }}>Error: {loadError}</div>
    );
  }
  if (!loadState) {
    return (
      <div style={{ padding: 20, color: "#999", fontStyle: "italic" }}>
        Loading…
      </div>
    );
  }

  return (
    <EditorInner
      filePath={filePath}
      initialFrontmatter={loadState.frontmatter}
      initialBlocks={loadState.blocks}
      onSaveSuccess={onSaveSuccess}
      fileOps={fileOps}
      getStableDocsContext={getStableDocsContext}
      stableCount={stableCount}
    />
  );
}

// ── EditorInner (render + save) ───────────────────────────────────────────────

function EditorInner({
  filePath,
  initialFrontmatter,
  initialBlocks,
  onSaveSuccess,
  fileOps,
  getStableDocsContext,
  stableCount,
}: {
  filePath: string;
  initialFrontmatter: Frontmatter;
  initialBlocks: PartialBlock[];
  onSaveSuccess: () => void;
  fileOps: FileOps;
  getStableDocsContext: () => Promise<string>;
  stableCount: number;
}) {
  const [frontmatter, setFrontmatter] =
    useState<Frontmatter>(initialFrontmatter);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [mounted, setMounted] = useState(false);

  const editor = useCreateBlockNote({
    schema: getEditorSchema(),
    initialContent: initialBlocks,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const updatedFm = {
        ...frontmatter,
        updated: new Date().toISOString().split("T")[0],
      };
      const body = await serializeDocBlocks(
        editor as BlockNoteEditor<any>,
        editor.document,
      );
      const markdown = serializeFrontmatter(updatedFm, body);
      await fileOps.write(filePath, markdown);
      setIsDirty(false);
      setFrontmatter(updatedFm);
      onSaveSuccess();
    } finally {
      setIsSaving(false);
    }
  }, [filePath, frontmatter, editor, onSaveSuccess, fileOps]);

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
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
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
            <AIAssistantContext.Provider
              value={{ getStableDocsContext, stableCount }}
            >
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
                        subtext:
                          "Insert a Mermaid / C4 / PlantUML diagram block",
                        onItemClick: () =>
                          insertOrUpdateBlockForSlashMenu(
                            editor as any,
                            {
                              type: "mermaid",
                              props: {
                                dsl: "graph LR\n  A --> B",
                                diagramType: "mermaid",
                                viewMode: "split",
                              },
                            } as any,
                          ),
                        group: "Architecture",
                        icon: <span style={{ fontWeight: 700 }}>⬡</span>,
                      },
                      {
                        title: "AI Assistant",
                        subtext:
                          "Generate content with AI — optionally uses stable docs as context",
                        onItemClick: () =>
                          insertOrUpdateBlockForSlashMenu(
                            editor as any,
                            {
                              type: "aiAssistant",
                              props: {
                                prompt: "",
                                useStableDocs: "false",
                                generatedText: "",
                              },
                            } as any,
                          ),
                        group: "Architecture",
                        icon: <span style={{ fontWeight: 700 }}>✦</span>,
                      },
                    ].filter((i) =>
                      i.title.toLowerCase().includes(query.toLowerCase()),
                    )
                  }
                />
              </BlockNoteView>
            </AIAssistantContext.Provider>
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
