import { useState, useCallback } from "react";
import { FileTree } from "./components/Sidebar/FileTree.js";
import { DocEditor, type FileOps } from "./components/Editor/DocEditor.js";
import { useLocalFolder } from "./hooks/useLocalFolder.js";

const DEFAULT_MD = (name: string) => {
  const title = name.replace(/\.md$/, "");
  const today = new Date().toISOString().split("T")[0];
  return `---\ntitle: ${title}\nstatus: draft\ncreated: ${today}\nupdated: ${today}\n---\n\n# ${title}\n`;
};

export default function App() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const local = useLocalFolder();

  const handleNewFile = useCallback(async (parentDir: string | null, name: string) => {
    const filePath = await local.createFile(parentDir, name, DEFAULT_MD(name));
    await local.reload();
    setSelectedFile(filePath);
  }, [local]);

  const handleNewDir = useCallback(async (parentDir: string | null, name: string) => {
    await local.createDir(parentDir, name);
    await local.reload();
  }, [local]);

  const handleRename = useCallback(async (oldPath: string, newName: string) => {
    const newPath = await local.renameEntry(oldPath, newName);
    await local.reload();
    if (selectedFile === oldPath) setSelectedFile(newPath);
  }, [local, selectedFile]);

  const handleDelete = useCallback(async (path: string) => {
    await local.deleteEntry(path);
    await local.reload();
    if (selectedFile === path) setSelectedFile(null);
  }, [local, selectedFile]);

  const handleMove = useCallback(async (sourcePaths: string[], targetDir: string | null) => {
    const pathMap: Record<string, string> = {};
    for (const src of sourcePaths) {
      const newPath = await local.moveEntryToDir(src, targetDir);
      pathMap[src] = newPath;
    }
    await local.reload();
    if (selectedFile && pathMap[selectedFile]) setSelectedFile(pathMap[selectedFile]);
  }, [local, selectedFile]);

  const handleOpenFolder = useCallback(async () => {
    await local.openFolder();
    setSelectedFile(null);
  }, [local]);

  const fileOps: FileOps = { read: local.readFile, write: local.writeFile };

  const folderOpen = local.isOpen;

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "system-ui, sans-serif" }}>
      {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
      <aside
        style={{
          width: 260,
          borderRight: "1px solid #e0e0e0",
          background: "#fafafa",
          overflow: "auto",
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "12px 12px 8px",
            borderBottom: "1px solid #e0e0e0",
            flexShrink: 0,
          }}
        >
          {/* Title row */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#333", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {folderOpen ? `📂 ${local.folderName}` : "No folder open"}
            </span>
          </div>

          {/* Action row */}
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            <SidebarBtn onClick={handleOpenFolder} title="Open a local folder (File System Access API)">
              📂 Open Folder
            </SidebarBtn>
            {folderOpen && (
              <>
                <SidebarBtn onClick={() => handleNewFile(null, "untitled.md")} title="New file at root">
                  +📄
                </SidebarBtn>
                <SidebarBtn onClick={() => handleNewDir(null, "new-folder")} title="New folder at root">
                  +📁
                </SidebarBtn>
              </>
            )}
          </div>
        </div>

        {/* Tree */}
        <div style={{ flex: 1, overflow: "auto" }}>
          <FileTree
            tree={local.tree}
            selectedFile={selectedFile}
            onSelect={setSelectedFile}
            onNewFile={handleNewFile}
            onNewDir={handleNewDir}
            onRename={handleRename}
            onDelete={handleDelete}
            onMove={handleMove}
          />
        </div>
      </aside>

      {/* ── Editor ───────────────────────────────────────────────────────────── */}
      <main style={{ flex: 1, overflow: "hidden" }}>
        {selectedFile ? (
          <DocEditor
            key={selectedFile}
            filePath={selectedFile}
            onSaveSuccess={local.reload}
            onLoad={(fm) => local.updateFileStatus(selectedFile, fm.status)}
            fileOps={fileOps}
          />
        ) : (
          <EmptyState folderOpen={folderOpen} onOpenFolder={handleOpenFolder} />
        )}
      </main>
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function SidebarBtn({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        fontSize: 11,
        padding: "3px 8px",
        background: "#fff",
        border: "1px solid #d1d5db",
        borderRadius: 4,
        cursor: "pointer",
        color: "#374151",
        whiteSpace: "nowrap",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = "#f3f4f6";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = "#fff";
      }}
    >
      {children}
    </button>
  );
}

function EmptyState({
  folderOpen,
  onOpenFolder,
}: {
  folderOpen: boolean;
  onOpenFolder: () => void;
}) {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        color: "#999",
        gap: 12,
      }}
    >
      <div style={{ fontSize: 48 }}>📂</div>
      <div style={{ fontSize: 14 }}>
        {folderOpen ? "Select a document from the sidebar" : "Open a local folder to get started"}
      </div>
      {!folderOpen && (
        <button
          onClick={onOpenFolder}
          style={{
            fontSize: 13,
            padding: "8px 16px",
            background: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            marginTop: 4,
          }}
        >
          📂 Open Local Folder
        </button>
      )}
      <div style={{ fontSize: 11, color: "#bbb" }}>
        Tip: type <code>/diagram</code> in the editor to insert a diagram block
      </div>
    </div>
  );
}
