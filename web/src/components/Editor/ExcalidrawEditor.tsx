import { useState, useEffect, useCallback, useRef, Suspense, lazy } from "react";
import type { ExcalidrawCanvasHandle } from "./ExcalidrawCanvas.js";
import type { FileOps, DocEditorNavProps } from "./DocEditor.js";

// Lazy-load to avoid SSR evaluation of browser-only Excalidraw code
const LazyCanvas = lazy(() =>
  import("./ExcalidrawCanvas.js").then((m) => ({ default: m.ExcalidrawCanvas }))
);

interface ExcalidrawEditorProps extends DocEditorNavProps {
  filePath: string;
  fileOps: FileOps;
  onSaveSuccess?: () => void;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function ExcalidrawEditor({
  filePath,
  fileOps,
  onSaveSuccess,
  folderName,
  canGoBack,
  canGoForward,
  onGoBack,
  onGoForward,
}: ExcalidrawEditorProps) {
  const [initialData, setInitialData] = useState<object | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const canvasRef = useRef<ExcalidrawCanvasHandle>(null);
  const fileName = filePath.split("/").pop() ?? filePath;
  const displayName = fileName.replace(/\.excalidraw$/, "");

  // Load the .excalidraw file on mount / path change
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setIsDirty(false);
    setSaveStatus("idle");

    fileOps
      .read(filePath)
      .then((content) => {
        if (cancelled) return;
        if (content.trim()) {
          try {
            setInitialData(JSON.parse(content));
          } catch {
            setLoadError("Cannot open file — invalid JSON");
          }
        } else {
          // New empty file — Excalidraw starts with a blank canvas
          setInitialData(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setLoadError(String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filePath, fileOps]);

  const handleSave = useCallback(async () => {
    const json = canvasRef.current?.getJSON();
    if (!json) return;
    setSaveStatus("saving");
    try {
      await fileOps.write(filePath, json);
      setIsDirty(false);
      setSaveStatus("saved");
      onSaveSuccess?.();
      setTimeout(() => setSaveStatus((s) => (s === "saved" ? "idle" : s)), 1800);
    } catch (e) {
      setSaveStatus("error");
      console.error("[ExcalidrawEditor] save failed:", e);
    }
  }, [filePath, fileOps, onSaveSuccess]);

  // Ctrl+S / Cmd+S — scoped to this editor instance
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSave]);

  if (loading) {
    return <CenteredMessage>Loading drawing…</CenteredMessage>;
  }

  if (loadError) {
    return <CenteredMessage color="#dc2626">{loadError}</CenteredMessage>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* ── Toolbar ── */}
      <div style={{
        height: "var(--editor-topbar-h)",
        display: "flex",
        alignItems: "center",
        padding: "0 24px",
        gap: 10,
        borderBottom: "1px solid var(--border)",
        background: "var(--editor-bg)",
        flexShrink: 0,
      }}>
        {/* Back / Forward */}
        <ExNavArrow onClick={onGoBack} disabled={!canGoBack} title="Go back (Alt+←)" dir="left" />
        <ExNavArrow onClick={onGoForward} disabled={!canGoForward} title="Go forward (Alt+→)" dir="right" />

        {/* Breadcrumb */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 4, overflow: "hidden", fontSize: 13 }}>
          {folderName && (
            <>
              <span style={{ color: "var(--text-3)", fontSize: 12, whiteSpace: "nowrap" }}>{folderName}</span>
              <span style={{ color: "#d4d4d8", fontSize: 11 }}>›</span>
            </>
          )}
          <span style={{ color: "var(--text-1)", fontWeight: 600, whiteSpace: "nowrap" }}>
            {displayName}
            {isDirty && <span style={{ color: "#f59e0b", marginLeft: 4, fontSize: 10 }}>●</span>}
          </span>
        </div>

        {saveStatus === "error" && (
          <span style={{ color: "#dc2626", fontSize: 12 }}>Save failed!</span>
        )}
        {saveStatus === "saved" && (
          <span style={{ color: "#16a34a", fontSize: 12, fontWeight: 500 }}>Saved</span>
        )}

        <button
          onClick={handleSave}
          disabled={saveStatus === "saving" || (!isDirty && saveStatus !== "error")}
          title="Save (Ctrl+S)"
          style={{
            fontSize: 12,
            padding: "6px 16px",
            background: isDirty || saveStatus === "error" ? "var(--accent)" : "var(--hover-bg)",
            color: isDirty || saveStatus === "error" ? "#fff" : "var(--text-3)",
            border: "none",
            borderRadius: 8,
            cursor: isDirty || saveStatus === "error" ? "pointer" : "default",
            fontWeight: 600,
            fontFamily: "var(--font-sans)",
            boxShadow: isDirty || saveStatus === "error" ? "0 1px 3px rgba(37,99,235,.3)" : "none",
            transition: "background 0.15s",
          }}
        >
          {saveStatus === "saving" ? "Saving…" : "Save"}
        </button>
      </div>

      {/* ── Canvas ── */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <Suspense fallback={<CenteredMessage>Loading Excalidraw…</CenteredMessage>}>
          <LazyCanvas
            ref={canvasRef}
            initialData={initialData}
            onDirtyChange={setIsDirty}
          />
        </Suspense>
      </div>
    </div>
  );
}

function ExNavArrow({
  onClick,
  disabled,
  title,
  dir,
}: {
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  dir: "left" | "right";
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      title={title}
      style={{
        width: 26,
        height: 26,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "none",
        borderRadius: 6,
        background: "none",
        color: disabled ? "var(--border-mid)" : "var(--text-3)",
        cursor: disabled ? "default" : "pointer",
        padding: 0,
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = "var(--hover-bg)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = "none";
      }}
    >
      {dir === "left" ? (
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      ) : (
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M9 18l6-6-6-6" />
        </svg>
      )}
    </button>
  );
}

function CenteredMessage({
  children,
  color = "#9ca3af",
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color,
        fontSize: 14,
      }}
    >
      {children}
    </div>
  );
}
