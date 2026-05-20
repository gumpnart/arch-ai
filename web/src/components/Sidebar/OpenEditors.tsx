import { useState } from "react";
import { FileText, PenNib, X } from "@phosphor-icons/react";
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
    <div data-testid="open-editors" style={{ flexShrink: 0 }}>
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
      data-testid="open-editor-row"
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
      {isDrawing
        ? <PenNib size={12} style={{ flexShrink: 0 }} />
        : <FileText size={12} style={{ flexShrink: 0 }} />
      }

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
          data-testid="open-editor-close-btn"
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
          <X size={10} weight="bold" />
        </button>
      )}
    </div>
  );
}
