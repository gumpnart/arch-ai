import { useState, useEffect, useCallback, useRef, Suspense, lazy } from "react";
import type { ExcalidrawCanvasHandle } from "./ExcalidrawCanvas.js";
import type { FileOps } from "./DocEditor.js";

// Lazy-load to avoid SSR evaluation of browser-only Excalidraw code
const LazyCanvas = lazy(() =>
  import("./ExcalidrawCanvas.js").then((m) => ({ default: m.ExcalidrawCanvas }))
);

interface ExcalidrawEditorProps {
  filePath: string;
  fileOps: FileOps;
  onSaveSuccess?: () => void;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function ExcalidrawEditor({
  filePath,
  fileOps,
  onSaveSuccess,
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
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 12px",
          borderBottom: "1px solid #e0e0e0",
          background: "#fafafa",
          flexShrink: 0,
          fontSize: 13,
        }}
      >
        <span style={{ flex: 1, fontWeight: 500, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          🎨 {displayName}
        </span>

        {saveStatus === "error" && (
          <span style={{ color: "#dc2626", fontSize: 12 }}>Save failed!</span>
        )}
        {isDirty && saveStatus !== "error" && (
          <span style={{ color: "#6b7280", fontSize: 12 }}>● Unsaved</span>
        )}
        {saveStatus === "saved" && (
          <span style={{ color: "#16a34a", fontSize: 12 }}>Saved ✓</span>
        )}

        <button
          onClick={handleSave}
          disabled={saveStatus === "saving" || (!isDirty && saveStatus !== "error")}
          title="Save (Ctrl+S)"
          style={{
            fontSize: 12,
            padding: "4px 12px",
            background: isDirty || saveStatus === "error" ? "#2563eb" : "#e5e7eb",
            color: isDirty || saveStatus === "error" ? "#fff" : "#9ca3af",
            border: "none",
            borderRadius: 4,
            cursor: isDirty || saveStatus === "error" ? "pointer" : "default",
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
