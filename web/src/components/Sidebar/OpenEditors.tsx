import { useState } from "react";
import { SectionLabel } from "../ui/SectionLabel.js";

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
  if (openFiles.length === 0) return null;

  return (
    <div style={{ flexShrink: 0 }}>
      <SectionLabel>Open</SectionLabel>

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
  );
}

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
  const isDrawing = name.endsWith(".excalidraw");

  return (
    <div
      onClick={() => onSelect(path)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={path}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        margin: "1px 4px",
        borderRadius: 6,
        fontSize: 12,
        cursor: "pointer",
        background: isActive ? "var(--active-row-bg)" : hovered ? "var(--hover-bg)" : "transparent",
        color: isActive ? "var(--accent)" : "var(--text-2)",
        userSelect: "none",
      }}
    >
      {/* File icon */}
      <svg
        width="12" height="12" fill="none"
        stroke={isActive ? "var(--accent)" : "currentColor"}
        strokeWidth="2" viewBox="0 0 24 24"
        style={{ flexShrink: 0 }}
      >
        {isDrawing ? (
          <path d="M12 19l7-7 3 3-7 7-3-3z M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z M2 2l7.586 7.586M11 11l-4 4" />
        ) : (
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        )}
      </svg>

      <span style={{
        flex: 1,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        fontWeight: isActive ? 500 : 400,
      }}>
        {name}
      </span>

      {hovered && (
        <button
          onClick={(e) => { e.stopPropagation(); onClose(path); }}
          title="Close"
          style={{
            background: "none",
            border: "none",
            padding: "0 2px",
            fontSize: 11,
            color: "var(--text-3)",
            cursor: "pointer",
            lineHeight: 1,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text-1)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text-3)";
          }}
        >
          <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
