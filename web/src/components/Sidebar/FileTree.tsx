import { useState } from "react";
import { DocStatusBadge } from "./DocStatusBadge.js";
import type { FileNode } from "../../api/client.js";

interface FileTreeProps {
  tree: FileNode[];
  selectedFile: string | null;
  onSelect: (path: string) => void;
}

function TreeNode({
  node,
  depth,
  selectedFile,
  onSelect,
}: {
  node: FileNode;
  depth: number;
  selectedFile: string | null;
  onSelect: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 2);

  if (node.type === "dir") {
    return (
      <div>
        <button
          onClick={() => setExpanded((p) => !p)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            width: "100%",
            textAlign: "left",
            padding: `4px 8px 4px ${8 + depth * 12}px`,
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 600,
            color: "#555",
          }}
        >
          <span style={{ fontSize: 10 }}>{expanded ? "▾" : "▸"}</span>
          <span style={{ fontSize: 13 }}>📁</span>
          {node.name}
        </button>
        {expanded && node.children?.map((child) => (
          <TreeNode
            key={child.path}
            node={child}
            depth={depth + 1}
            selectedFile={selectedFile}
            onSelect={onSelect}
          />
        ))}
      </div>
    );
  }

  const isSelected = selectedFile === node.path;
  return (
    <button
      onClick={() => onSelect(node.path)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        width: "100%",
        textAlign: "left",
        padding: `4px 8px 4px ${8 + depth * 12}px`,
        background: isSelected ? "#e8f0fe" : "none",
        border: "none",
        borderLeft: isSelected ? "2px solid #2563eb" : "2px solid transparent",
        cursor: "pointer",
        fontSize: 12,
        color: isSelected ? "#1d4ed8" : "#374151",
      }}
    >
      <span style={{ fontSize: 12 }}>📄</span>
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {node.name.replace(/\.md$/, "")}
      </span>
      <DocStatusBadge status={node.status} />
    </button>
  );
}

export function FileTree({ tree, selectedFile, onSelect }: FileTreeProps) {
  if (!tree.length) {
    return (
      <div style={{ padding: "20px 16px", color: "#9ca3af", fontSize: 12 }}>
        No files found in vault.
      </div>
    );
  }
  return (
    <div style={{ padding: "8px 0" }}>
      {tree.map((node) => (
        <TreeNode
          key={node.path}
          node={node}
          depth={0}
          selectedFile={selectedFile}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
