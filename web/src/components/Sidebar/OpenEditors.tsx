import { useState, useEffect } from "react";

const LS_KEY = "open-editors-collapsed";

interface OpenEditorsProps {
  openFiles: string[];
  selectedFile: string | null;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
}

export function OpenEditors({
  openFiles,
  selectedFile,
  onSelect,
  onClose,
}: OpenEditorsProps) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(LS_KEY) === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, String(collapsed));
    } catch {}
  }, [collapsed]);

  if (openFiles.length === 0) return null;

  return (
    <div
      style={{
        borderBottom: "1px solid #e0e0e0",
        flexShrink: 0,
      }}
    >
      {/* Section header */}
      <div
        onClick={() => setCollapsed((c) => !c)}
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: "#888",
          padding: "8px 12px 4px",
          letterSpacing: "0.08em",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
          userSelect: "none",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.background = "#f0f0f0";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.background = "transparent";
        }}
      >
        <span>OPEN EDITORS</span>
        <span style={{ fontSize: 9 }}>{collapsed ? "▸" : "▾"}</span>
      </div>

      {/* File list */}
      {!collapsed && (
        <div style={{ paddingBottom: 4 }}>
          {openFiles.map((path) => (
            <OpenEditorRow
              key={path}
              path={path}
              isActive={path === selectedFile}
              onSelect={onSelect}
              onClose={onClose}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Row ───────────────────────────────────────────────────────────────────────

function OpenEditorRow({
  path,
  isActive,
  onSelect,
  onClose,
}: {
  path: string;
  isActive: boolean;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const name = path.split("/").pop() ?? path;

  return (
    <div
      onClick={() => onSelect(path)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={path}
      style={{
        display: "flex",
        alignItems: "center",
        padding: isActive ? "2px 8px 2px 10px" : "2px 8px 2px 12px",
        fontSize: 12,
        cursor: "pointer",
        gap: 6,
        background: isActive ? "#e8f0fe" : hovered ? "#f0f0f0" : "transparent",
        borderLeft: isActive ? "2px solid #2563eb" : "2px solid transparent",
      }}
    >
      <span style={{ fontSize: 12, flexShrink: 0 }}>📄</span>
      <span
        style={{
          flex: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          color: isActive ? "#1a56db" : "#374151",
          fontWeight: isActive ? 600 : 400,
        }}
      >
        {name}
      </span>
      {hovered && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose(path);
          }}
          title="Close"
          style={{
            background: "none",
            border: "none",
            padding: "0 2px",
            fontSize: 11,
            color: "#9ca3af",
            cursor: "pointer",
            lineHeight: 1,
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "#374151";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "#9ca3af";
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
}
