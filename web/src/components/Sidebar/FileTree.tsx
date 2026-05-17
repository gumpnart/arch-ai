import { useState, useRef, useEffect, useCallback, createContext, useContext } from "react";
import { DocStatusBadge } from "./DocStatusBadge.js";
import type { FileNode } from "../../api/client.js";

// ── Public props ──────────────────────────────────────────────────────────────

export interface FileTreeActions {
  onNewFile?: (parentDir: string | null, name: string) => void;
  onNewDir?: (parentDir: string | null, name: string) => void;
  onRename?: (path: string, newName: string) => void;
  onDelete?: (path: string) => void;
  onMove?: (sourcePaths: string[], targetDir: string | null) => void;
}

interface FileTreeProps extends FileTreeActions {
  tree: FileNode[];
  selectedFile: string | null;
  onSelect: (path: string) => void;
}

// ── DnD context (shared across all recursive nodes) ───────────────────────────

interface DnDCtxValue {
  // Selection
  selectedPaths: Set<string>;
  toggleSelect: (path: string, multi: boolean) => void;
  // Drag state
  draggingPaths: string[];
  dropTargetDir: string | null | undefined; // undefined = not dragging
  // Handlers used by every node
  startDrag: (e: React.DragEvent, path: string) => void;
  endDrag: () => void;
  dirDragOver: (e: React.DragEvent, dir: string | null) => void;
  dirDrop: (e: React.DragEvent, dir: string | null) => void;
  isValidDrop: (dir: string | null) => boolean;
  // Move callback
  onMove: FileTreeProps["onMove"];
}

const DnDCtx = createContext<DnDCtxValue | null>(null);
const useDnD = () => useContext(DnDCtx)!;

// ── Inline text input ─────────────────────────────────────────────────────────

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
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);

  const commit = () => {
    const t = value.trim();
    if (t) onConfirm(t); else onCancel();
  };

  return (
    <div style={{ paddingLeft: 8 + depth * 12, paddingRight: 8, paddingTop: 2, paddingBottom: 2 }}>
      <input
        ref={ref}
        value={value}
        placeholder={placeholder ?? "name.md"}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") onCancel(); }}
        onBlur={onCancel}
        style={{
          width: "100%", fontSize: 12, padding: "2px 6px",
          border: "1px solid #2563eb", borderRadius: 3,
          outline: "none", background: "#fff", boxSizing: "border-box",
        }}
      />
    </div>
  );
}

// ── Small icon button ─────────────────────────────────────────────────────────

function IconBtn({ title, onClick, children }: {
  title: string;
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{ background: "none", border: "none", cursor: "pointer", padding: "1px 3px", borderRadius: 3, fontSize: 11, color: "#6b7280", lineHeight: 1, flexShrink: 0 }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#111")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#6b7280")}
    >
      {children}
    </button>
  );
}

// ── Selection badge (shown during drag) ───────────────────────────────────────

function SelectionBadge({ count }: { count: number }) {
  if (count < 2) return null;
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 8,
      background: "#2563eb", color: "#fff", flexShrink: 0, marginLeft: 4,
    }}>
      {count}
    </span>
  );
}

// ── Directory node ────────────────────────────────────────────────────────────

function DirNode({
  node, depth, selectedFile, onSelect,
  onNewFile, onNewDir, onRename, onDelete,
}: {
  node: FileNode; depth: number; selectedFile: string | null;
  onSelect: (path: string) => void;
} & FileTreeActions) {
  const dnd = useDnD();
  const [expanded, setExpanded] = useState(depth < 2);
  const [hovered, setHovered] = useState(false);
  const [creating, setCreating] = useState<"file" | "dir" | null>(null);
  const [renaming, setRenaming] = useState(false);
  const expandTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isDropTarget = dnd.dropTargetDir === node.path;
  const isDragging = dnd.draggingPaths.includes(node.path);
  const isSelected = dnd.selectedPaths.has(node.path);
  const validDrop = dnd.isValidDrop(node.path);

  // Auto-expand collapsed dir on sustained hover during drag
  const onDragEnter = () => {
    if (!expanded && dnd.draggingPaths.length > 0) {
      expandTimer.current = setTimeout(() => setExpanded(true), 600);
    }
  };
  const clearExpandTimer = () => {
    if (expandTimer.current) { clearTimeout(expandTimer.current); expandTimer.current = null; }
  };

  const rowStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", paddingRight: 4,
    background: isDropTarget ? "#eff6ff" : isSelected ? "#f0f7ff" : "none",
    outline: isDropTarget ? "1px solid #93c5fd" : "none",
    opacity: isDragging ? 0.4 : 1,
  };

  if (renaming) {
    return (
      <div>
        <InlineInput defaultValue={node.name} depth={depth}
          onConfirm={(n) => { onRename?.(node.path, n); setRenaming(false); }}
          onCancel={() => setRenaming(false)} />
      </div>
    );
  }

  return (
    <div>
      {/* Dir header row — drop target + draggable */}
      <div
        draggable
        onDragStart={(e) => dnd.startDrag(e, node.path)}
        onDragEnd={dnd.endDrag}
        onDragEnter={onDragEnter}
        onDragLeave={clearExpandTimer}
        onDragOver={(e) => { e.stopPropagation(); if (validDrop) dnd.dirDragOver(e, node.path); else e.preventDefault(); }}
        onDrop={(e) => { e.stopPropagation(); clearExpandTimer(); dnd.dirDrop(e, node.path); }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={(e) => { if (e.ctrlKey || e.metaKey) { e.stopPropagation(); dnd.toggleSelect(node.path, true); } }}
        style={rowStyle}
      >
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded((p) => !p); }}
          style={{
            flex: 1, display: "flex", alignItems: "center", gap: 4, textAlign: "left",
            padding: `4px 0 4px ${8 + depth * 12}px`,
            background: "none", border: "none", cursor: "pointer",
            fontSize: 12, fontWeight: 600, color: "#555", minWidth: 0,
          }}
        >
          <span style={{ fontSize: 10, flexShrink: 0 }}>{expanded ? "▾" : "▸"}</span>
          <span style={{ fontSize: 13, flexShrink: 0 }}>📁</span>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {node.name}
          </span>
          <SelectionBadge count={isSelected ? dnd.selectedPaths.size : 0} />
        </button>
        {hovered && dnd.draggingPaths.length === 0 && (
          <span style={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>
            {onNewFile && <IconBtn title="New file" onClick={(e) => { e.stopPropagation(); setCreating("file"); setExpanded(true); }}>+📄</IconBtn>}
            {onNewDir && <IconBtn title="New folder" onClick={(e) => { e.stopPropagation(); setCreating("dir"); setExpanded(true); }}>+📁</IconBtn>}
            {onRename && <IconBtn title="Rename" onClick={(e) => { e.stopPropagation(); setRenaming(true); }}>✏️</IconBtn>}
            {onDelete && <IconBtn title="Delete folder" onClick={(e) => { e.stopPropagation(); if (confirm(`Delete folder "${node.name}" and all its contents?`)) onDelete(node.path); }}>🗑️</IconBtn>}
          </span>
        )}
      </div>

      {/* Children — also a drop target for this dir (catches events from files inside) */}
      {expanded && (
        <div
          onDragOver={(e) => { e.stopPropagation(); if (validDrop) dnd.dirDragOver(e, node.path); else e.preventDefault(); }}
          onDrop={(e) => { e.stopPropagation(); clearExpandTimer(); dnd.dirDrop(e, node.path); }}
        >
          {node.children?.map((child) =>
            child.type === "dir" ? (
              <DirNode key={child.path} node={child} depth={depth + 1}
                selectedFile={selectedFile} onSelect={onSelect}
                onNewFile={onNewFile} onNewDir={onNewDir} onRename={onRename} onDelete={onDelete} />
            ) : (
              <FileItem key={child.path} node={child} depth={depth + 1}
                selectedFile={selectedFile} onSelect={onSelect} onRename={onRename} onDelete={onDelete} />
            )
          )}
          {creating && (
            <InlineInput depth={depth + 1}
              placeholder={creating === "file" ? "filename.md" : "folder-name"}
              onConfirm={(raw) => {
                const name = creating === "file" && !raw.endsWith(".md") ? `${raw}.md` : raw;
                if (creating === "file") onNewFile?.(node.path, name);
                else onNewDir?.(node.path, name);
                setCreating(null);
              }}
              onCancel={() => setCreating(null)} />
          )}
        </div>
      )}
    </div>
  );
}

// ── File node ─────────────────────────────────────────────────────────────────

function FileItem({ node, depth, selectedFile, onSelect, onRename, onDelete }: {
  node: FileNode; depth: number; selectedFile: string | null;
  onSelect: (path: string) => void;
  onRename?: (path: string, newName: string) => void;
  onDelete?: (path: string) => void;
}) {
  const dnd = useDnD();
  const [hovered, setHovered] = useState(false);
  const [renaming, setRenaming] = useState(false);

  const isSelected = dnd.selectedPaths.has(node.path);
  const isActive = selectedFile === node.path;
  const isDragging = dnd.draggingPaths.includes(node.path);

  if (renaming) {
    return (
      <InlineInput defaultValue={node.name} depth={depth}
        onConfirm={(n) => { const name = n.endsWith(".md") ? n : `${n}.md`; onRename?.(node.path, name); setRenaming(false); }}
        onCancel={() => setRenaming(false)} />
    );
  }

  return (
    <div
      draggable
      onDragStart={(e) => dnd.startDrag(e, node.path)}
      onDragEnd={dnd.endDrag}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={(e) => {
        if (e.ctrlKey || e.metaKey) {
          dnd.toggleSelect(node.path, true);
        } else {
          dnd.toggleSelect(node.path, false);
          onSelect(node.path);
        }
      }}
      style={{
        display: "flex", alignItems: "center",
        background: isActive ? "#e8f0fe" : isSelected ? "#eff6ff" : hovered ? "#f3f4f6" : "none",
        borderLeft: isActive ? "2px solid #2563eb" : isSelected ? "2px solid #93c5fd" : "2px solid transparent",
        paddingRight: 4, cursor: "grab",
        opacity: isDragging ? 0.4 : 1,
        userSelect: "none",
      }}
    >
      <span style={{
        flex: 1, display: "flex", alignItems: "center", gap: 6, minWidth: 0,
        padding: `4px 4px 4px ${8 + depth * 12}px`,
        fontSize: 12, color: isActive ? "#1d4ed8" : "#374151",
      }}>
        <span style={{ fontSize: 12, flexShrink: 0 }}>📄</span>
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {node.name.replace(/\.md$/, "")}
        </span>
        <DocStatusBadge status={node.status} />
        {isSelected && !isActive && <SelectionBadge count={dnd.selectedPaths.size} />}
      </span>
      {hovered && dnd.draggingPaths.length === 0 && (
        <span style={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>
          {onRename && <IconBtn title="Rename" onClick={(e) => { e.stopPropagation(); setRenaming(true); }}>✏️</IconBtn>}
          {onDelete && <IconBtn title="Delete" onClick={(e) => { e.stopPropagation(); if (confirm(`Delete "${node.name}"?`)) onDelete(node.path); }}>🗑️</IconBtn>}
        </span>
      )}
    </div>
  );
}

// ── FileTree root ─────────────────────────────────────────────────────────────

export function FileTree({
  tree, selectedFile, onSelect,
  onNewFile, onNewDir, onRename, onDelete, onMove,
}: FileTreeProps) {
  const [selectedPaths, setSelectedPaths] = useState(new Set<string>());
  const [draggingPaths, setDraggingPaths] = useState<string[]>([]);
  const [dropTargetDir, setDropTargetDir] = useState<string | null | undefined>(undefined);
  const [creatingAtRoot, setCreatingAtRoot] = useState<"file" | "dir" | null>(null);
  const lastDropDir = useRef<string | null | undefined>(undefined);

  const toggleSelect = useCallback((path: string, multi: boolean) => {
    setSelectedPaths((prev) => {
      if (multi) {
        const next = new Set(prev);
        if (next.has(path)) next.delete(path); else next.add(path);
        return next;
      }
      return new Set([path]);
    });
  }, []);

  const isValidDrop = useCallback((dir: string | null) => {
    if (draggingPaths.length === 0) return false;
    if (dir === null) return true;
    return !draggingPaths.some((src) => dir === src || dir.startsWith(`${src}/`));
  }, [draggingPaths]);

  const startDrag = useCallback((e: React.DragEvent, path: string) => {
    const paths = selectedPaths.has(path) ? [...selectedPaths] : [path];
    setDraggingPaths(paths);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", JSON.stringify(paths));

    if (paths.length > 1) {
      const ghost = document.createElement("div");
      ghost.textContent = `📦 ${paths.length} items`;
      Object.assign(ghost.style, {
        position: "fixed", left: "-9999px", top: "-9999px",
        background: "#2563eb", color: "#fff",
        padding: "4px 10px", borderRadius: "4px",
        fontSize: "12px", fontFamily: "system-ui", whiteSpace: "nowrap",
      });
      document.body.appendChild(ghost);
      e.dataTransfer.setDragImage(ghost, 0, 0);
      requestAnimationFrame(() => document.body.removeChild(ghost));
    }
  }, [selectedPaths]);

  const endDrag = useCallback(() => {
    setDraggingPaths([]);
    setDropTargetDir(undefined);
    lastDropDir.current = undefined;
  }, []);

  const dirDragOver = useCallback((e: React.DragEvent, dir: string | null) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (lastDropDir.current !== dir) {
      setDropTargetDir(dir);
      lastDropDir.current = dir;
    }
  }, []);

  const dirDrop = useCallback((e: React.DragEvent, dir: string | null) => {
    e.preventDefault();
    if (!isValidDrop(dir)) return;
    let paths: string[];
    try { paths = JSON.parse(e.dataTransfer.getData("text/plain")); }
    catch { paths = draggingPaths; }
    if (paths.length) onMove?.(paths, dir);
    setDraggingPaths([]);
    setDropTargetDir(undefined);
    setSelectedPaths(new Set());
    lastDropDir.current = undefined;
  }, [isValidDrop, draggingPaths, onMove]);

  const ctx: DnDCtxValue = {
    selectedPaths, toggleSelect,
    draggingPaths, dropTargetDir,
    startDrag, endDrag, dirDragOver, dirDrop, isValidDrop,
    onMove,
  };

  const rootIsDropTarget = dropTargetDir === null && draggingPaths.length > 0;

  if (!tree.length && !creatingAtRoot) {
    return (
      <div style={{ padding: "12px 16px", color: "#9ca3af", fontSize: 12 }}>
        <div>No files found.</div>
        {onNewFile && (
          <button onClick={() => setCreatingAtRoot("file")}
            style={{ marginTop: 8, fontSize: 12, color: "#2563eb", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            + New file
          </button>
        )}
      </div>
    );
  }

  return (
    <DnDCtx.Provider value={ctx}>
      <div
        style={{ padding: "8px 0" }}
        onDragOver={(e) => { e.preventDefault(); dirDragOver(e, null); }}
        onDrop={(e) => dirDrop(e, null)}
        onDragLeave={(e) => {
          const tree = e.currentTarget as Element;
          if (!tree.contains(e.relatedTarget as Node)) endDrag();
        }}
      >
        {tree.map((node) =>
          node.type === "dir" ? (
            <DirNode key={node.path} node={node} depth={0} selectedFile={selectedFile} onSelect={onSelect}
              onNewFile={onNewFile} onNewDir={onNewDir} onRename={onRename} onDelete={onDelete} />
          ) : (
            <FileItem key={node.path} node={node} depth={0} selectedFile={selectedFile} onSelect={onSelect}
              onRename={onRename} onDelete={onDelete} />
          )
        )}

        {creatingAtRoot && (
          <InlineInput depth={0} placeholder={creatingAtRoot === "file" ? "filename.md" : "folder-name"}
            onConfirm={(raw) => {
              const name = creatingAtRoot === "file" && !raw.endsWith(".md") ? `${raw}.md` : raw;
              if (creatingAtRoot === "file") onNewFile?.(null, name); else onNewDir?.(null, name);
              setCreatingAtRoot(null);
            }}
            onCancel={() => setCreatingAtRoot(null)} />
        )}

        {/* Root drop zone — shown only during a drag */}
        {draggingPaths.length > 0 && (
          <div style={{
            margin: "6px 8px 2px",
            padding: "6px 8px",
            border: `2px dashed ${rootIsDropTarget ? "#2563eb" : "#d1d5db"}`,
            borderRadius: 4,
            textAlign: "center",
            fontSize: 11,
            color: rootIsDropTarget ? "#2563eb" : "#9ca3af",
            transition: "all 0.1s",
            pointerEvents: "none",
          }}>
            {rootIsDropTarget ? "⬇ Drop here to move to root" : "Drop into a folder or here for root"}
          </div>
        )}
      </div>
    </DnDCtx.Provider>
  );
}
