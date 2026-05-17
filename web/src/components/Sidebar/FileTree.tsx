import { useState, useRef, useEffect } from "react";
import { DocStatusBadge } from "./DocStatusBadge.js";
import type { FileNode } from "../../api/client.js";

export interface FileTreeActions {
  onNewFile?: (parentDir: string | null, name: string) => void;
  onNewDir?: (parentDir: string | null, name: string) => void;
  onRename?: (path: string, newName: string) => void;
  onDelete?: (path: string) => void;
}

interface FileTreeProps extends FileTreeActions {
  tree: FileNode[];
  selectedFile: string | null;
  onSelect: (path: string) => void;
}

// ── Inline text input (new file / rename) ─────────────────────────────────────

function InlineInput({
  defaultValue,
  placeholder,
  depth,
  onConfirm,
  onCancel,
}: {
  defaultValue?: string;
  placeholder?: string;
  depth: number;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const commit = () => {
    const trimmed = value.trim();
    if (trimmed) onConfirm(trimmed);
    else onCancel();
  };

  return (
    <div style={{ paddingLeft: 8 + depth * 12, paddingRight: 8, paddingTop: 2, paddingBottom: 2 }}>
      <input
        ref={inputRef}
        value={value}
        placeholder={placeholder ?? "name.md"}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") onCancel();
        }}
        onBlur={onCancel}
        style={{
          width: "100%",
          fontSize: 12,
          padding: "2px 6px",
          border: "1px solid #2563eb",
          borderRadius: 3,
          outline: "none",
          background: "#fff",
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}

// ── Icon buttons ──────────────────────────────────────────────────────────────

function IconBtn({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: "1px 3px",
        borderRadius: 3,
        fontSize: 11,
        color: "#6b7280",
        lineHeight: 1,
        flexShrink: 0,
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#111")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#6b7280")}
    >
      {children}
    </button>
  );
}

// ── Directory node ────────────────────────────────────────────────────────────

function DirNode({
  node,
  depth,
  selectedFile,
  onSelect,
  onNewFile,
  onNewDir,
  onRename,
  onDelete,
}: {
  node: FileNode;
  depth: number;
  selectedFile: string | null;
  onSelect: (path: string) => void;
} & FileTreeActions) {
  const [expanded, setExpanded] = useState(depth < 2);
  const [hovered, setHovered] = useState(false);
  const [creating, setCreating] = useState<"file" | "dir" | null>(null);
  const [renaming, setRenaming] = useState(false);

  const confirmNew = (raw: string) => {
    const name = creating === "file" && !raw.endsWith(".md") ? `${raw}.md` : raw;
    if (creating === "file") onNewFile?.(node.path, name);
    else onNewDir?.(node.path, name);
    setCreating(null);
    setExpanded(true);
  };

  const confirmRename = (newName: string) => {
    onRename?.(node.path, newName);
    setRenaming(false);
  };

  return (
    <div>
      {/* Row */}
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ display: "flex", alignItems: "center", paddingRight: 4 }}
      >
        {renaming ? (
          <InlineInput
            defaultValue={node.name}
            depth={depth}
            onConfirm={confirmRename}
            onCancel={() => setRenaming(false)}
          />
        ) : (
          <>
            <button
              onClick={() => setExpanded((p) => !p)}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                gap: 4,
                textAlign: "left",
                padding: `4px 0 4px ${8 + depth * 12}px`,
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
                color: "#555",
                minWidth: 0,
              }}
            >
              <span style={{ fontSize: 10, flexShrink: 0 }}>{expanded ? "▾" : "▸"}</span>
              <span style={{ fontSize: 13, flexShrink: 0 }}>📁</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {node.name}
              </span>
            </button>
            {hovered && (
              <span style={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>
                {onNewFile && (
                  <IconBtn title="New file" onClick={(e) => { e.stopPropagation(); setCreating("file"); setExpanded(true); }}>
                    +📄
                  </IconBtn>
                )}
                {onNewDir && (
                  <IconBtn title="New folder" onClick={(e) => { e.stopPropagation(); setCreating("dir"); setExpanded(true); }}>
                    +📁
                  </IconBtn>
                )}
                {onRename && (
                  <IconBtn title="Rename" onClick={(e) => { e.stopPropagation(); setRenaming(true); }}>
                    ✏️
                  </IconBtn>
                )}
                {onDelete && (
                  <IconBtn title="Delete folder" onClick={(e) => { e.stopPropagation(); if (confirm(`Delete folder "${node.name}" and all its contents?`)) onDelete(node.path); }}>
                    🗑️
                  </IconBtn>
                )}
              </span>
            )}
          </>
        )}
      </div>

      {/* Children */}
      {expanded && (
        <>
          {node.children?.map((child) =>
            child.type === "dir" ? (
              <DirNode
                key={child.path}
                node={child}
                depth={depth + 1}
                selectedFile={selectedFile}
                onSelect={onSelect}
                onNewFile={onNewFile}
                onNewDir={onNewDir}
                onRename={onRename}
                onDelete={onDelete}
              />
            ) : (
              <FileNode
                key={child.path}
                node={child}
                depth={depth + 1}
                selectedFile={selectedFile}
                onSelect={onSelect}
                onRename={onRename}
                onDelete={onDelete}
              />
            )
          )}
          {creating && (
            <InlineInput
              depth={depth + 1}
              placeholder={creating === "file" ? "filename.md" : "folder-name"}
              onConfirm={confirmNew}
              onCancel={() => setCreating(null)}
            />
          )}
        </>
      )}
    </div>
  );
}

// ── File node ─────────────────────────────────────────────────────────────────

function FileNode({
  node,
  depth,
  selectedFile,
  onSelect,
  onRename,
  onDelete,
}: {
  node: FileNode;
  depth: number;
  selectedFile: string | null;
  onSelect: (path: string) => void;
  onRename?: (path: string, newName: string) => void;
  onDelete?: (path: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const isSelected = selectedFile === node.path;

  if (renaming) {
    return (
      <InlineInput
        defaultValue={node.name}
        depth={depth}
        onConfirm={(newName) => {
          const n = newName.endsWith(".md") ? newName : `${newName}.md`;
          onRename?.(node.path, n);
          setRenaming(false);
        }}
        onCancel={() => setRenaming(false)}
      />
    );
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        background: isSelected ? "#e8f0fe" : hovered ? "#f3f4f6" : "none",
        borderLeft: isSelected ? "2px solid #2563eb" : "2px solid transparent",
        paddingRight: 4,
      }}
    >
      <button
        onClick={() => onSelect(node.path)}
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          gap: 6,
          textAlign: "left",
          padding: `4px 4px 4px ${8 + depth * 12}px`,
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: 12,
          color: isSelected ? "#1d4ed8" : "#374151",
          minWidth: 0,
        }}
      >
        <span style={{ fontSize: 12, flexShrink: 0 }}>📄</span>
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {node.name.replace(/\.md$/, "")}
        </span>
        <DocStatusBadge status={node.status} />
      </button>
      {hovered && (
        <span style={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>
          {onRename && (
            <IconBtn title="Rename" onClick={(e) => { e.stopPropagation(); setRenaming(true); }}>
              ✏️
            </IconBtn>
          )}
          {onDelete && (
            <IconBtn title="Delete" onClick={(e) => { e.stopPropagation(); if (confirm(`Delete "${node.name}"?`)) onDelete(node.path); }}>
              🗑️
            </IconBtn>
          )}
        </span>
      )}
    </div>
  );
}

// ── FileTree root ─────────────────────────────────────────────────────────────

export function FileTree({
  tree,
  selectedFile,
  onSelect,
  onNewFile,
  onNewDir,
  onRename,
  onDelete,
}: FileTreeProps) {
  const [creatingAtRoot, setCreatingAtRoot] = useState<"file" | "dir" | null>(null);

  if (!tree.length && !creatingAtRoot) {
    return (
      <div style={{ padding: "12px 16px", color: "#9ca3af", fontSize: 12 }}>
        <div>No files found.</div>
        {onNewFile && (
          <button
            onClick={() => setCreatingAtRoot("file")}
            style={{ marginTop: 8, fontSize: 12, color: "#2563eb", background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            + New file
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: "8px 0" }}>
      {tree.map((node) =>
        node.type === "dir" ? (
          <DirNode
            key={node.path}
            node={node}
            depth={0}
            selectedFile={selectedFile}
            onSelect={onSelect}
            onNewFile={onNewFile}
            onNewDir={onNewDir}
            onRename={onRename}
            onDelete={onDelete}
          />
        ) : (
          <FileNode
            key={node.path}
            node={node}
            depth={0}
            selectedFile={selectedFile}
            onSelect={onSelect}
            onRename={onRename}
            onDelete={onDelete}
          />
        )
      )}
      {creatingAtRoot && (
        <InlineInput
          depth={0}
          placeholder={creatingAtRoot === "file" ? "filename.md" : "folder-name"}
          onConfirm={(raw) => {
            const name = creatingAtRoot === "file" && !raw.endsWith(".md") ? `${raw}.md` : raw;
            if (creatingAtRoot === "file") onNewFile?.(null, name);
            else onNewDir?.(null, name);
            setCreatingAtRoot(null);
          }}
          onCancel={() => setCreatingAtRoot(null)}
        />
      )}
    </div>
  );
}
