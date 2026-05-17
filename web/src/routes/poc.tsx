import { createFileRoute } from "@tanstack/react-router";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import "@blocknote/shadcn/style.css";
import { BlockNoteEditor } from "@blocknote/core";
import type { PartialBlock } from "@blocknote/core";
import "@blocknote/core/fonts/inter.css";
// Intentionally NOT importing @blocknote/shadcn/style.css here — isolate if that import causes issues
import { useState, useEffect, Component, type ReactNode } from "react";

export const Route = createFileRoute("/poc")({ component: PocPage });

// ── Test cases ────────────────────────────────────────────────────────────────
const TESTS: Record<string, string> = {
  "Empty":         "",
  "Paragraph":     "Hello world. Just a plain paragraph.",
  "Heading":       "# Heading 1\n\n## Heading 2",
  "Bullet list":   "- Item 1\n- Item 2",
  "Numbered list": "1. First\n2. Second",
  "Checklist":     "- [ ] Todo\n- [x] Done",
  "Blockquote":    "> This is a quote",
  "Code (js)":     "```javascript\nconsole.log('hello');\n```",
  "Code (mermaid)":"```mermaid\nflowchart TB\n  A --> B\n```",
  "Table":         "| Name | Value |\n|---|---|\n| Foo | Bar |",
  "Mixed":         "# Title\n\nParagraph text.\n\n- item\n\n| A | B |\n|---|---|\n| 1 | 2 |",
};

async function parseMarkdown(md: string): Promise<{ blocks: PartialBlock[]; json: string }> {
  const editor = BlockNoteEditor.create();
  const blocks = await editor.tryParseMarkdownToBlocks(md);
  return { blocks, json: JSON.stringify(blocks, null, 2) };
}

// ── Error boundary ────────────────────────────────────────────────────────────
class EditorBoundary extends Component<{ children: ReactNode; onCrash: (e: string) => void }, { error: string | null }> {
  state = { error: null };
  static getDerivedStateFromError(e: Error) { return { error: e.message }; }
  componentDidCatch(e: Error) { this.props.onCrash(e.message); }
  render() {
    if (this.state.error) {
      return <div style={{ padding: 16, background: "#ffebee", borderRadius: 6, fontSize: 12, color: "#c62828" }}>
        <strong>Editor crashed:</strong> {this.state.error}
      </div>;
    }
    return this.props.children;
  }
}

// ── Isolated editor — remounts fresh on key change ────────────────────────────
// `mounted` guard ensures BlockNoteView only renders after client-side hydration.
function EditorView({ blocks }: { blocks: PartialBlock[] }) {
  const [mounted, setMounted] = useState(false);
  const editor = useCreateBlockNote({ initialContent: blocks });

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) {
    return <div style={{ padding: 16, color: "#999", fontSize: 12 }}>Mounting editor…</div>;
  }
  return (
    <BlockNoteView
      editor={editor}
      theme="light"
      formattingToolbar={false}
      slashMenu={false}
      sideMenu={false}
    />
  );
}

// ── Main POC page ─────────────────────────────────────────────────────────────
function PocPage() {
  const [active, setActive]         = useState<string | null>(null);
  const [editorKey, setEditorKey]   = useState(0);
  const [blocks, setBlocks]         = useState<PartialBlock[]>([]);
  const [blocksJson, setBlocksJson] = useState("");
  const [parseOk, setParseOk]       = useState(false);
  const [parseError, setParseError] = useState("");
  const [renderError, setRenderError] = useState("");
  const [loading, setLoading]       = useState(false);

  const runTest = async (label: string, md: string) => {
    setActive(label);
    setParseOk(false);
    setParseError("");
    setRenderError("");
    setBlocksJson("");
    setLoading(true);
    try {
      const { blocks: parsed, json } = await parseMarkdown(md);
      setBlocksJson(json);
      setBlocks(parsed);
      setEditorKey((k) => k + 1);
      setParseOk(true);
    } catch (e: any) {
      setParseError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>BlockNote POC — block type tester</h1>
      <p style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>
        Using <code>@blocknote/shadcn</code> BlockNoteView, with <code>mounted</code> guard.
        Open DevTools → Console to see all errors.
      </p>
      <p style={{ fontSize: 11, color: "#e65100", marginBottom: 20, background: "#fff3e0", padding: "6px 10px", borderRadius: 4 }}>
        ⚠ If "SES Removing unpermitted intrinsics" appears in the console, test in an Incognito window first
        (MetaMask/SES can break ProseMirror array access).
      </p>

      {/* Test buttons */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        {Object.entries(TESTS).map(([label, md]) => (
          <button key={label} onClick={() => runTest(label, md)} disabled={loading}
            style={{
              padding: "7px 14px", fontSize: 12, cursor: "pointer",
              border: "1px solid " + (active === label ? "#1976d2" : "#ccc"),
              borderRadius: 4,
              background: active === label ? "#e3f2fd" : "#fff",
              color: active === label ? "#1565c0" : "#333",
              fontWeight: active === label ? 600 : 400,
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* Status */}
      {loading && <div style={S.info}>Parsing…</div>}
      {parseOk && !loading && (
        <div style={S.success}>
          Parse OK — {blocks.length} block(s): [{blocks.map(b => b.type).join(", ")}]
        </div>
      )}
      {parseError && <div style={S.warn}>Parse error: {parseError}</div>}
      {renderError && <div style={S.error}>Render crash: {renderError}</div>}
      {!renderError && parseOk && !loading && (
        <div style={{ ...S.success, background: "#c8e6c9", borderColor: "#66bb6a" }}>
          ✓ Editor rendered OK — no crash
        </div>
      )}

      {/* Split view */}
      {blocksJson && (
        <div style={{ display: "flex", gap: 16, marginTop: 16 }}>
          <div style={{ flex: "0 0 380px" }}>
            <div style={S.label}>Parsed blocks (JSON)</div>
            <pre style={{ background: "#f5f5f5", border: "1px solid #e0e0e0", borderRadius: 6, padding: 12, fontSize: 11, overflow: "auto", maxHeight: 480, margin: 0 }}>
              {blocksJson}
            </pre>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={S.label}>BlockNote editor (@blocknote/shadcn BlockNoteView, mounted guard)</div>
            <div style={{ border: "1px solid #e0e0e0", borderRadius: 6, overflow: "hidden" }}>
              <EditorBoundary key={editorKey} onCrash={msg => setRenderError(msg)}>
                <EditorView key={editorKey} blocks={blocks} />
              </EditorBoundary>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const S = {
  success: { padding: "8px 12px", marginBottom: 8, background: "#e8f5e9", border: "1px solid #a5d6a7", borderRadius: 4, fontSize: 12, color: "#2e7d32" },
  warn:    { padding: "8px 12px", marginBottom: 8, background: "#fff3e0", border: "1px solid #ffb74d", borderRadius: 4, fontSize: 12, color: "#e65100" },
  error:   { padding: "8px 12px", marginBottom: 8, background: "#ffebee", border: "1px solid #ef9a9a", borderRadius: 4, fontSize: 12, color: "#c62828" },
  info:    { padding: "8px 12px", marginBottom: 8, background: "#e8eaf6", border: "1px solid #9fa8da", borderRadius: 4, fontSize: 12, color: "#3949ab" },
  label:   { fontSize: 11, fontWeight: 600, color: "#666", marginBottom: 6, textTransform: "uppercase" as const, letterSpacing: "0.05em" },
};
