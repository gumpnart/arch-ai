import { useState, useRef, useEffect, useCallback, createContext, useContext } from "react";
import { createPortal } from "react-dom";
import {
  Folder, FolderOpen, FileText, PenNib,
  FilePlus, FolderPlus, PencilSimple, Trash,
  Copy, Files,
} from "@phosphor-icons/react";
import { DocStatusBadge } from "./DocStatusBadge.js";
import type { FileNode } from "../../api/client.js";

// ── Public props ───────────────────────────────────────────────────────────────

export interface FileTreeActions {
  onNewFile?: (parentDir: string | null, name: string) => void;
  onNewDir?: (parentDir: string | null, name: string) => void;
  onRename?: (path: string, newName: string) => void;
  onDelete?: (path: string) => void;
  onMove?: (sourcePaths: string[], targetDir: string | null) => void;
  onCopy?: (path: string, destDir: string | null) => void;
  onDuplicate?: (path: string) => void;
}

interface FileTreeProps extends FileTreeActions {
  tree: FileNode[];
  selectedFile: string | null;
  onSelect: (path: string) => void;
}

// ── Context menu state ─────────────────────────────────────────────────────────

interface CtxMenuState {
  x: number;
  y: number;
  nodePath: string | null;
  nodeType: "file" | "dir" | null;
}

type CreatingType = "md" | "excalidraw" | "dir";

// ── DnD + shared UI context ────────────────────────────────────────────────────

interface DnDCtxValue {
  selectedPaths: Set<string>;
  toggleSelect: (path: string, multi: boolean) => void;
  draggingPaths: string[];
  dropTargetDir: string | null | undefined;
  startDrag: (e: React.DragEvent, path: string) => void;
  endDrag: () => void;
  dirDragOver: (e: React.DragEvent, dir: string | null) => void;
  dirDrop: (e: React.DragEvent, dir: string | null) => void;
  isValidDrop: (dir: string | null) => boolean;
  onMove: FileTreeProps["onMove"];
  // Context menu
  ctxMenu: CtxMenuState | null;
  openCtxMenu: (e: React.MouseEvent, nodePath: string | null, nodeType: "file" | "dir" | null) => void;
  closeCtxMenu: () => void;
  // Inline creating
  creatingAt: { parentDir: string | null; type: CreatingType } | null;
  startCreatingAt: (parentDir: string | null, type: CreatingType) => void;
  clearCreatingAt: () => void;
  // Inline renaming
  renamingPath: string | null;
  startRenaming: (path: string) => void;
  clearRenaming: () => void;
  // Action callbacks (forwarded to context menu)
  onNewFile: FileTreeProps["onNewFile"];
  onNewDir: FileTreeProps["onNewDir"];
  onRename: FileTreeProps["onRename"];
  onDelete: FileTreeProps["onDelete"];
  onCopy: FileTreeProps["onCopy"];
  onDuplicate: FileTreeProps["onDuplicate"];
}

const DnDCtx = createContext<DnDCtxValue | null>(null);
const useDnD = () => useContext(DnDCtx)!;

// ── Helpers ────────────────────────────────────────────────────────────────────

function getParentDir(path: string): string | null {
  const i = path.lastIndexOf("/");
  return i > 0 ? path.substring(0, i) : null;
}

// ── Inline text input ──────────────────────────────────────────────────────────

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
          width: "100%", fontSize: "var(--text-sm)", padding: "2px 6px",
          border: "1px solid var(--accent)", borderRadius: "var(--r-sm)",
          outline: "none", background: "#fff", boxSizing: "border-box",
        }}
      />
    </div>
  );
}

// ── Small icon button ──────────────────────────────────────────────────────────

function IconBtn({ title, onClick, children }: {
  title: string;
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{ background: "none", border: "none", cursor: "pointer", padding: "1px 3px", borderRadius: "var(--r-sm)", fontSize: "var(--text-xs)", color: "var(--text-3)", lineHeight: 1, flexShrink: 0 }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "var(--text-1)")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "var(--text-3)")}
    >
      {children}
    </button>
  );
}

// ── Selection badge ────────────────────────────────────────────────────────────

function SelectionBadge({ count }: { count: number }) {
  if (count < 2) return null;
  return (
    <span style={{
      fontSize: "var(--text-xs)", fontWeight: 700, padding: "1px 5px", borderRadius: "var(--r-full)",
      background: "var(--accent)", color: "#fff", flexShrink: 0, marginLeft: 4,
    }}>
      {count}
    </span>
  );
}

// ── Context menu ───────────────────────────────────────────────────────────────

function ContextMenu({ state, onClose }: { state: CtxMenuState; onClose: () => void }) {
  const dnd = useDnD();
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: state.x, y: state.y });

  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    let { x, y } = state;
    if (x + rect.width > window.innerWidth - 8) x = window.innerWidth - rect.width - 8;
    if (y + rect.height > window.innerHeight - 8) y = window.innerHeight - rect.height - 8;
    if (x < 8) x = 8;
    if (y < 8) y = 8;
    setPos({ x, y });
  }, [state.x, state.y]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const createParent = state.nodeType === "dir"
    ? state.nodePath
    : state.nodePath ? getParentDir(state.nodePath) : null;

  const nodeName = state.nodePath?.split("/").pop() ?? "";

  type MenuItem =
    | { kind: "action"; label: string; icon: React.ReactNode; action: () => void; danger?: boolean }
    | { kind: "sep" };

  const items: MenuItem[] = [];

  if (dnd.onNewFile) {
    items.push({
      kind: "action", label: "New Markdown File", icon: <FilePlus size={13} />,
      action: () => { dnd.startCreatingAt(createParent, "md"); onClose(); },
    });
    items.push({
      kind: "action", label: "New Drawing", icon: <PenNib size={13} />,
      action: () => { dnd.startCreatingAt(createParent, "excalidraw"); onClose(); },
    });
  }
  if (dnd.onNewDir) {
    items.push({
      kind: "action", label: "New Folder", icon: <FolderPlus size={13} />,
      action: () => { dnd.startCreatingAt(createParent, "dir"); onClose(); },
    });
  }

  if (state.nodePath) {
    items.push({ kind: "sep" });

    if (dnd.onRename) {
      items.push({
        kind: "action", label: "Rename", icon: <PencilSimple size={13} />,
        action: () => { dnd.startRenaming(state.nodePath!); onClose(); },
      });
    }

    if (dnd.onCopy) {
      items.push({
        kind: "action", label: "Copy", icon: <Copy size={13} />,
        action: () => { dnd.onCopy!(state.nodePath!, createParent); onClose(); },
      });
    }

    if (dnd.onDuplicate) {
      items.push({
        kind: "action", label: "Duplicate", icon: <Files size={13} />,
        action: () => { dnd.onDuplicate!(state.nodePath!); onClose(); },
      });
    }

    items.push({ kind: "sep" });

    if (dnd.onDelete) {
      items.push({
        kind: "action", label: "Delete", icon: <Trash size={13} />, danger: true,
        action: () => {
          const label = state.nodeType === "dir"
            ? `folder "${nodeName}" and all its contents`
            : `"${nodeName}"`;
          if (confirm(`Delete ${label}?`)) dnd.onDelete!(state.nodePath!);
          onClose();
        },
      });
    }
  }

  // Remove leading/trailing separators
  while (items.length && items[0].kind === "sep") items.shift();
  while (items.length && items[items.length - 1].kind === "sep") items.pop();

  if (!items.length) return null;

  return createPortal(
    <div
      ref={menuRef}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        zIndex: 9999,
        background: "var(--surface-1, #ffffff)",
        border: "1px solid var(--border-1, #e5e7eb)",
        borderRadius: "var(--r-md, 6px)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
        minWidth: 192,
        padding: "4px 0",
        fontSize: "var(--text-sm, 13px)",
        userSelect: "none",
      }}
    >
      {items.map((item, i) =>
        item.kind === "sep" ? (
          <div key={i} style={{ height: 1, margin: "4px 0", background: "var(--border-1, #e5e7eb)" }} />
        ) : (
          <button
            key={i}
            onMouseDown={(e) => e.preventDefault()}
            onClick={item.action}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              width: "100%", padding: "6px 12px",
              background: "none", border: "none", cursor: "pointer",
              fontSize: "inherit", textAlign: "left",
              color: item.danger ? "var(--danger, #dc2626)" : "var(--text-1, #111827)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                item.danger ? "var(--danger-bg, #fef2f2)" : "var(--hover-bg, #f3f4f6)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "none";
            }}
          >
            <span style={{ color: item.danger ? "var(--danger, #dc2626)" : "var(--text-3, #9ca3af)", flexShrink: 0 }}>
              {item.icon}
            </span>
            {item.label}
          </button>
        )
      )}
    </div>,
    document.body
  );
}

// ── Directory node ─────────────────────────────────────────────────────────────

function DirNode({
  node, depth, selectedFile, onSelect,
  onNewFile, onNewDir, onRename, onDelete,
}: {
  node: FileNode; depth: number; selectedFile: string | null;
  onSelect: (path: string) => void;
} & FileTreeActions) {
  const dnd = useDnD();
  const storageKey = `sidebar-expanded:${node.path}`;
  const [expanded, setExpanded] = useState(() => {
    const stored = localStorage.getItem(storageKey);
    return stored !== null ? stored === "true" : depth < 2;
  });
  useEffect(() => { localStorage.setItem(storageKey, String(expanded)); }, [expanded, storageKey]);
  const [hovered, setHovered] = useState(false);
  const expandTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isDropTarget = dnd.dropTargetDir === node.path;
  const isDragging = dnd.draggingPaths.includes(node.path);
  const isSelected = dnd.selectedPaths.has(node.path);
  const validDrop = dnd.isValidDrop(node.path);
  const isRenaming = dnd.renamingPath === node.path;
  const pendingCreate = dnd.creatingAt?.parentDir === node.path ? dnd.creatingAt.type : null;

  // Auto-expand when a create is pending inside this dir
  useEffect(() => {
    if (pendingCreate) setExpanded(true);
  }, [pendingCreate]);

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
    background: isDropTarget ? "var(--accent-bg)" : isSelected ? "var(--active-row-bg)" : "none",
    outline: isDropTarget ? "1px solid var(--accent-border)" : "none",
    opacity: isDragging ? 0.4 : 1,
  };

  if (isRenaming) {
    return (
      <div>
        <InlineInput defaultValue={node.name} depth={depth}
          onConfirm={(n) => { onRename?.(node.path, n); dnd.clearRenaming(); }}
          onCancel={dnd.clearRenaming} />
      </div>
    );
  }

  return (
    <div>
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
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); dnd.openCtxMenu(e, node.path, "dir"); }}
        style={rowStyle}
      >
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded((p) => !p); }}
          style={{
            flex: 1, display: "flex", alignItems: "center", gap: 4, textAlign: "left",
            padding: `4px 0 4px ${8 + depth * 12}px`,
            background: "none", border: "none", cursor: "pointer",
            fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-2)", minWidth: 0,
          }}
        >
          <span style={{ fontSize: 10, flexShrink: 0 }}>{expanded ? "▾" : "▸"}</span>
          {expanded
            ? <FolderOpen size={14} weight="fill" style={{ flexShrink: 0, color: "var(--text-3)" }} />
            : <Folder size={14} weight="fill" style={{ flexShrink: 0, color: "var(--text-3)" }} />
          }
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {node.name}
          </span>
          <SelectionBadge count={isSelected ? dnd.selectedPaths.size : 0} />
        </button>
        {hovered && dnd.draggingPaths.length === 0 && (
          <span style={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>
            {onNewFile && <IconBtn title="New file" onClick={(e) => { e.stopPropagation(); dnd.startCreatingAt(node.path, "md"); setExpanded(true); }}><FilePlus size={13} /></IconBtn>}
            {onNewDir && <IconBtn title="New folder" onClick={(e) => { e.stopPropagation(); dnd.startCreatingAt(node.path, "dir"); setExpanded(true); }}><FolderPlus size={13} /></IconBtn>}
            {onRename && <IconBtn title="Rename" onClick={(e) => { e.stopPropagation(); dnd.startRenaming(node.path); }}><PencilSimple size={13} /></IconBtn>}
            {onDelete && <IconBtn title="Delete folder" onClick={(e) => { e.stopPropagation(); if (confirm(`Delete folder "${node.name}" and all its contents?`)) onDelete(node.path); }}><Trash size={13} /></IconBtn>}
          </span>
        )}
      </div>

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
          {pendingCreate && (
            <InlineInput
              defaultValue="untitled"
              depth={depth + 1}
              placeholder={
                pendingCreate === "dir" ? "folder-name"
                : pendingCreate === "excalidraw" ? "untitled.excalidraw"
                : "untitled.md"
              }
              onConfirm={(raw) => {
                if (pendingCreate === "dir") {
                  dnd.onNewDir?.(node.path, raw);
                } else {
                  const ext = pendingCreate === "excalidraw" ? ".excalidraw" : ".md";
                  const name = raw.includes(".") ? raw : raw + ext;
                  dnd.onNewFile?.(node.path, name);
                }
                dnd.clearCreatingAt();
              }}
              onCancel={dnd.clearCreatingAt}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── File node ──────────────────────────────────────────────────────────────────

function FileItem({ node, depth, selectedFile, onSelect, onRename, onDelete }: {
  node: FileNode; depth: number; selectedFile: string | null;
  onSelect: (path: string) => void;
  onRename?: (path: string, newName: string) => void;
  onDelete?: (path: string) => void;
}) {
  const dnd = useDnD();
  const [hovered, setHovered] = useState(false);

  const isSelected = dnd.selectedPaths.has(node.path);
  const isActive = selectedFile === node.path;
  const isDragging = dnd.draggingPaths.includes(node.path);
  const isRenaming = dnd.renamingPath === node.path;

  if (isRenaming) {
    const origExt = node.name.includes(".") ? "." + node.name.split(".").pop() : ".md";
    return (
      <InlineInput defaultValue={node.name} depth={depth}
        onConfirm={(n) => {
          const name = n.includes(".") ? n : n + origExt;
          onRename?.(node.path, name);
          dnd.clearRenaming();
        }}
        onCancel={dnd.clearRenaming} />
    );
  }

  return (
    <div
      draggable
      onDragStart={(e) => dnd.startDrag(e, node.path)}
      onDragEnd={dnd.endDrag}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); dnd.openCtxMenu(e, node.path, "file"); }}
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
        background: isActive ? "var(--active-row-bg)" : isSelected ? "var(--accent-bg)" : hovered ? "var(--hover-bg)" : "none",
        borderLeft: isActive ? "2px solid var(--accent)" : isSelected ? "2px solid var(--accent-border)" : "2px solid transparent",
        paddingRight: 4, cursor: "grab",
        opacity: isDragging ? 0.4 : 1,
        userSelect: "none",
      }}
    >
      <span style={{
        flex: 1, display: "flex", alignItems: "center", gap: 6, minWidth: 0,
        padding: `4px 4px 4px ${8 + depth * 12}px`,
        fontSize: "var(--text-sm)", color: isActive ? "var(--accent)" : "var(--text-2)",
      }}>
        {node.name.endsWith(".excalidraw")
          ? <PenNib size={13} style={{ flexShrink: 0 }} />
          : <FileText size={13} style={{ flexShrink: 0 }} />
        }
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {node.name.replace(/\.(md|excalidraw)$/, "")}
        </span>
        <DocStatusBadge status={node.status} />
        {isSelected && !isActive && <SelectionBadge count={dnd.selectedPaths.size} />}
      </span>
      {hovered && dnd.draggingPaths.length === 0 && (
        <span style={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>
          {onRename && <IconBtn title="Rename" onClick={(e) => { e.stopPropagation(); dnd.startRenaming(node.path); }}><PencilSimple size={13} /></IconBtn>}
          {onDelete && <IconBtn title="Delete" onClick={(e) => { e.stopPropagation(); if (confirm(`Delete "${node.name}"?`)) onDelete(node.path); }}><Trash size={13} /></IconBtn>}
        </span>
      )}
    </div>
  );
}

// ── FileTree root ──────────────────────────────────────────────────────────────

export function FileTree({
  tree, selectedFile, onSelect,
  onNewFile, onNewDir, onRename, onDelete, onMove,
  onCopy, onDuplicate,
}: FileTreeProps) {
  const [selectedPaths, setSelectedPaths] = useState(new Set<string>());
  const [draggingPaths, setDraggingPaths] = useState<string[]>([]);
  const [dropTargetDir, setDropTargetDir] = useState<string | null | undefined>(undefined);
  const [ctxMenu, setCtxMenu] = useState<CtxMenuState | null>(null);
  const [creatingAt, setCreatingAt] = useState<{ parentDir: string | null; type: CreatingType } | null>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
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

  const openCtxMenu = useCallback((e: React.MouseEvent, nodePath: string | null, nodeType: "file" | "dir" | null) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, nodePath, nodeType });
  }, []);

  const closeCtxMenu = useCallback(() => setCtxMenu(null), []);
  const startCreatingAt = useCallback((parentDir: string | null, type: CreatingType) => setCreatingAt({ parentDir, type }), []);
  const clearCreatingAt = useCallback(() => setCreatingAt(null), []);
  const startRenaming = useCallback((path: string) => setRenamingPath(path), []);
  const clearRenaming = useCallback(() => setRenamingPath(null), []);

  const ctx: DnDCtxValue = {
    selectedPaths, toggleSelect,
    draggingPaths, dropTargetDir,
    startDrag, endDrag, dirDragOver, dirDrop, isValidDrop,
    onMove,
    ctxMenu, openCtxMenu, closeCtxMenu,
    creatingAt, startCreatingAt, clearCreatingAt,
    renamingPath, startRenaming, clearRenaming,
    onNewFile, onNewDir, onRename, onDelete, onCopy, onDuplicate,
  };

  const rootIsDropTarget = dropTargetDir === null && draggingPaths.length > 0;
  const rootPendingCreate = creatingAt?.parentDir === null ? creatingAt.type : null;

  if (!tree.length && !rootPendingCreate) {
    return (
      <DnDCtx.Provider value={ctx}>
        <div style={{ padding: "12px 16px", color: "#9ca3af", fontSize: 12 }}>
          <div>No files found.</div>
          {onNewFile && (
            <button onClick={() => startCreatingAt(null, "md")}
              style={{ marginTop: 8, fontSize: 12, color: "#2563eb", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              + New file
            </button>
          )}
        </div>
        {ctxMenu && <ContextMenu state={ctxMenu} onClose={closeCtxMenu} />}
      </DnDCtx.Provider>
    );
  }

  return (
    <DnDCtx.Provider value={ctx}>
      <div
        style={{ padding: "8px 0" }}
        onDragOver={(e) => { e.preventDefault(); dirDragOver(e, null); }}
        onDrop={(e) => dirDrop(e, null)}
        onDragLeave={(e) => {
          const el = e.currentTarget as Element;
          if (!el.contains(e.relatedTarget as Node)) endDrag();
        }}
        onContextMenu={(e) => { e.preventDefault(); openCtxMenu(e, null, null); }}
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

        {rootPendingCreate && (
          <InlineInput
            defaultValue="untitled"
            depth={0}
            placeholder={
              rootPendingCreate === "dir" ? "folder-name"
              : rootPendingCreate === "excalidraw" ? "untitled.excalidraw"
              : "untitled.md"
            }
            onConfirm={(raw) => {
              if (rootPendingCreate === "dir") {
                onNewDir?.(null, raw);
              } else {
                const ext = rootPendingCreate === "excalidraw" ? ".excalidraw" : ".md";
                const name = raw.includes(".") ? raw : raw + ext;
                onNewFile?.(null, name);
              }
              clearCreatingAt();
            }}
            onCancel={clearCreatingAt}
          />
        )}

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

      {ctxMenu && <ContextMenu state={ctxMenu} onClose={closeCtxMenu} />}
    </DnDCtx.Provider>
  );
}
