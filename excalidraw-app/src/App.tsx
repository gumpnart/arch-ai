import { useState, useEffect, useCallback, useRef } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types/types";

// Bridge URL: nginx proxies /api → bridge:3001 inside Docker
const BRIDGE = "/api";

interface SceneFile {
  type: "excalidraw";
  version: 2;
  elements: readonly unknown[];
  appState: Record<string, unknown>;
  files: Record<string, unknown>;
}

type Status = "idle" | "loading" | "saving" | "error";

export default function App() {
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [scenes, setScenes] = useState<string[]>([]);
  const [current, setCurrent] = useState<string>("");
  const [status, setStatus] = useState<Status>("idle");
  const [notification, setNotification] = useState<string>("");
  const [sseStatus, setSseStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const currentRef = useRef("");
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);

  // Keep refs in sync
  useEffect(() => { currentRef.current = current; }, [current]);
  useEffect(() => { apiRef.current = api; }, [api]);

  const notify = (msg: string, ms = 2500) => {
    setNotification(msg);
    setTimeout(() => setNotification(""), ms);
  };

  // ── Scene list ────────────────────────────────────────────────────────────
  const fetchScenes = useCallback(async () => {
    try {
      const res = await fetch(`${BRIDGE}/scenes`);
      const list: string[] = await res.json();
      setScenes(list);
    } catch {
      // bridge not ready yet
    }
  }, []);

  // ── Load a scene into Excalidraw ──────────────────────────────────────────
  const loadScene = useCallback(async (name: string, quiet = false) => {
    const canvas = apiRef.current;
    if (!canvas || !name) return;
    if (!quiet) setStatus("loading");
    try {
      const res = await fetch(`${BRIDGE}/scenes/${name}`);
      if (!res.ok) throw new Error("not found");
      const data: SceneFile = await res.json();
      canvas.updateScene({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        elements: data.elements as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        appState: data.appState as any,
      });
      if (data.files && Object.keys(data.files).length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        canvas.addFiles(Object.values(data.files) as any);
      }
      setCurrent(name);
      if (!quiet) notify(`✅ Loaded ${name}`);
    } catch {
      if (!quiet) notify("❌ Failed to load scene");
    } finally {
      setStatus("idle");
    }
  }, []);

  // ── Save current scene back to bridge ────────────────────────────────────
  const saveScene = useCallback(async () => {
    const canvas = apiRef.current;
    const name = currentRef.current;
    if (!canvas || !name) return;
    setStatus("saving");
    try {
      const elements = canvas.getSceneElements();
      const appState = canvas.getAppState();
      const scene: SceneFile = {
        type: "excalidraw",
        version: 2,
        elements,
        appState: {
          gridSize: appState.gridSize ?? null,
          viewBackgroundColor: appState.viewBackgroundColor,
        },
        files: {},
      };
      const res = await fetch(`${BRIDGE}/scenes/${name}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scene),
      });
      if (!res.ok) throw new Error("save failed");
      notify("💾 Saved");
    } catch {
      notify("❌ Save failed");
    } finally {
      setStatus("idle");
    }
  }, []);

  // ── Create new scene ──────────────────────────────────────────────────────
  const createScene = useCallback(async () => {
    const name = prompt("Scene name (without .excalidraw):");
    if (!name?.trim()) return;
    const file = name.trim().replace(/\.excalidraw$/, "") + ".excalidraw";
    const empty: SceneFile = {
      type: "excalidraw",
      version: 2,
      elements: [],
      appState: { gridSize: null, viewBackgroundColor: "#ffffff" },
      files: {},
    };
    await fetch(`${BRIDGE}/scenes/${file}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(empty),
    });
    await fetchScenes();
    await loadScene(file);
  }, [fetchScenes, loadScene]);

  // ── Delete current scene ──────────────────────────────────────────────────
  const deleteScene = useCallback(async () => {
    const name = currentRef.current;
    if (!name) return;
    if (!confirm(`Delete ${name}?`)) return;
    await fetch(`${BRIDGE}/scenes/${name}`, { method: "DELETE" });
    setCurrent("");
    apiRef.current?.updateScene({ elements: [] });
    await fetchScenes();
    notify(`🗑 Deleted ${name}`);
  }, [fetchScenes]);

  // ── SSE live-reload ───────────────────────────────────────────────────────
  useEffect(() => {
    fetchScenes();

    let es: EventSource;
    let retryTimer: ReturnType<typeof setTimeout>;

    function connect() {
      setSseStatus("connecting");
      es = new EventSource(`${BRIDGE}/events`);

      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data) as { event: string; file?: string };
          if (data.event === "connected") {
            setSseStatus("connected");
            return;
          }
          if (data.event === "scene_added" || data.event === "scene_removed") {
            fetchScenes();
          }
          if (data.event === "scene_changed" && data.file === currentRef.current) {
            // Auto-reload if Claude changed the current scene
            loadScene(data.file, true);
            notify("🔄 Scene updated by Claude");
          }
        } catch {/* ignore */}
      };

      es.onerror = () => {
        setSseStatus("disconnected");
        es.close();
        retryTimer = setTimeout(connect, 3000);
      };
    }

    connect();

    return () => {
      clearTimeout(retryTimer);
      es?.close();
    };
  }, [fetchScenes, loadScene]);

  // ── Keyboard shortcut: Ctrl+S / Cmd+S ────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        saveScene();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [saveScene]);

  // ─────────────────────────────────────────────────────────────────────────
  const sseColor = { connecting: "#f59e0b", connected: "#10b981", disconnected: "#ef4444" }[sseStatus];
  const sseLabel = { connecting: "connecting…", connected: "live", disconnected: "reconnecting…" }[sseStatus];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", fontFamily: "system-ui, sans-serif" }}>
      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "6px 14px",
        background: "#1a1b26",
        color: "#c0caf5",
        fontSize: 13,
        zIndex: 100,
        borderBottom: "1px solid #2a2b3d",
        minHeight: 42,
        flexShrink: 0,
      }}>
        <span style={{ fontWeight: 700, fontSize: 15, color: "#7aa2f7", letterSpacing: "-0.3px" }}>
          ✏️ Excalidraw MCP
        </span>

        <div style={{ width: 1, height: 20, background: "#2a2b3d" }} />

        {/* Scene selector */}
        <select
          value={current}
          onChange={(e) => e.target.value && loadScene(e.target.value)}
          style={{
            background: "#24253a", color: "#c0caf5", border: "1px solid #2a2b3d",
            borderRadius: 6, padding: "3px 8px", fontSize: 13, cursor: "pointer", maxWidth: 220,
          }}
        >
          <option value="">— select scene —</option>
          {scenes.map((s) => (
            <option key={s} value={s}>{s.replace(".excalidraw", "")}</option>
          ))}
        </select>

        <Btn onClick={createScene} color="#7aa2f7">＋ New</Btn>

        {current && (
          <>
            <Btn onClick={saveScene} color="#9ece6a" disabled={status === "saving"}>
              {status === "saving" ? "Saving…" : "💾 Save"}
            </Btn>
            <Btn onClick={deleteScene} color="#f7768e">🗑</Btn>
          </>
        )}

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          {/* SSE indicator */}
          <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#565f89" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: sseColor, display: "inline-block" }} />
            {sseLabel}
          </span>

          {current && (
            <span style={{ fontSize: 11, color: "#565f89" }}>
              {current.replace(".excalidraw", "")}
            </span>
          )}
        </div>

        {/* Notification toast */}
        {notification && (
          <div style={{
            position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
            background: "#1a1b26", color: "#c0caf5", border: "1px solid #2a2b3d",
            borderRadius: 8, padding: "8px 18px", fontSize: 13, zIndex: 9999,
            boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
          }}>
            {notification}
          </div>
        )}
      </div>

      {/* ── Canvas ──────────────────────────────────────────────────── */}
      <div style={{ flex: 1, position: "relative" }}>
        <Excalidraw
          excalidrawAPI={(a) => setApi(a)}
          theme="dark"
          UIOptions={{
            canvasActions: {
              export: false,
              loadScene: false,
              saveToActiveFile: false,
              saveAsImage: true,
              toggleTheme: true,
            },
          }}
        />

        {/* Empty state hint */}
        {!current && (
          <div style={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center",
            justifyContent: "center", pointerEvents: "none", zIndex: 10,
          }}>
            <div style={{
              background: "rgba(26,27,38,0.85)", backdropFilter: "blur(8px)",
              border: "1px solid #2a2b3d", borderRadius: 12,
              padding: "20px 32px", textAlign: "center", color: "#565f89",
            }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>✏️</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#c0caf5", marginBottom: 4 }}>
                No scene selected
              </div>
              <div style={{ fontSize: 12 }}>
                Select or create a scene above, or ask Claude to create one.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Btn({
  onClick, color, children, disabled,
}: {
  onClick: () => void;
  color?: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: "transparent",
        border: `1px solid ${color ?? "#2a2b3d"}`,
        color: color ?? "#c0caf5",
        borderRadius: 6,
        padding: "3px 10px",
        fontSize: 12,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "all 0.15s",
      }}
      onMouseEnter={(e) => { if (!disabled) (e.target as HTMLButtonElement).style.background = `${color ?? "#fff"}22`; }}
      onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.background = "transparent"; }}
    >
      {children}
    </button>
  );
}
