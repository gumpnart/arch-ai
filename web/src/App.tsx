import { useState, useCallback } from "react";
import { FileTree } from "./components/Sidebar/FileTree.js";
import { DocEditor, type FileOps } from "./components/Editor/DocEditor.js";
import { useVaultFiles } from "./hooks/useVaultFiles.js";
import { useLocalFolder } from "./hooks/useLocalFolder.js";
import { createFile, deleteFile, renameFile } from "./api/client.js";

const DEFAULT_MD = (name: string) => {
  const title = name.replace(/\.md$/, "");
  const today = new Date().toISOString().split("T")[0];
  return `---\ntitle: ${title}\nstatus: draft\ncreated: ${today}\nupdated: ${today}\n---\n\n# ${title}\n`;
};

export default function App() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [mode, setMode] = useState<"vault" | "local">("vault");

  // ── Vault mode ───────────────────────────────────────────────────────────────
  const { tree: vaultTree, reload: reloadVault } = useVaultFiles();

  const handleVaultNewFile = useCallback(async (parentDir: string | null, name: string) => {
    const filePath = parentDir ? `${parentDir}/${name}` : name;
    await createFile(filePath, DEFAULT_MD(name));
    await reloadVault();
    setSelectedFile(filePath);
  }, [reloadVault]);

  const handleVaultNewDir = useCallback(async (_parentDir: string | null, _name: string) => {
    // Vault dirs are created implicitly when a file is created inside them
    alert("Create a file inside the folder to create the folder.");
  }, []);

  const handleVaultRename = useCallback(async (path: string, newName: string) => {
    const res = await renameFile(path, newName);
    await reloadVault();
    if (selectedFile === path) setSelectedFile(res.path);
  }, [reloadVault, selectedFile]);

  const handleVaultDelete = useCallback(async (path: string) => {
    await deleteFile(path);
    await reloadVault();
    if (selectedFile === path) setSelectedFile(null);
  }, [reloadVault, selectedFile]);

  // ── Local folder mode ────────────────────────────────────────────────────────
  const local = useLocalFolder();

  const handleLocalNewFile = useCallback(async (parentDir: string | null, name: string) => {
    const filePath = await local.createFile(parentDir, name, DEFAULT_MD(name));
    await local.reload();
    setSelectedFile(filePath);
  }, [local]);

  const handleLocalNewDir = useCallback(async (parentDir: string | null, name: string) => {
    await local.createDir(parentDir, name);
    await local.reload();
  }, [local]);

  const handleLocalRename = useCallback(async (oldPath: string, newName: string) => {
    const newPath = await local.renameEntry(oldPath, newName);
    await local.reload();
    if (selectedFile === oldPath) setSelectedFile(newPath);
  }, [local, selectedFile]);

  const handleLocalDelete = useCallback(async (path: string) => {
    await local.deleteEntry(path);
    await local.reload();
    if (selectedFile === path) setSelectedFile(null);
  }, [local, selectedFile]);

  const handleOpenFolder = useCallback(async () => {
    await local.openFolder();
    setMode("local");
    setSelectedFile(null);
  }, [local]);

  const handleCloseFolder = useCallback(() => {
    local.closeFolder();
    setMode("vault");
    setSelectedFile(null);
  }, [local]);

  // ── Active mode values ───────────────────────────────────────────────────────
  const isLocal = mode === "local";
  const tree = isLocal ? local.tree : vaultTree;
  const reload = isLocal ? local.reload : reloadVault;

  const fileOps: FileOps | undefined = isLocal
    ? { read: local.readFile, write: local.writeFile }
    : undefined;

  const treeActions = isLocal
    ? {
        onNewFile: handleLocalNewFile,
        onNewDir: handleLocalNewDir,
        onRename: handleLocalRename,
        onDelete: handleLocalDelete,
      }
    : {
        onNewFile: handleVaultNewFile,
        onNewDir: handleVaultNewDir,
        onRename: handleVaultRename,
        onDelete: handleVaultDelete,
      };

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
              {isLocal ? `📂 ${local.folderName}` : "Vault"}
            </span>
            <span
              style={{
                fontSize: 9,
                padding: "1px 5px",
                borderRadius: 8,
                background: isLocal ? "#d1fae5" : "#e0e7ff",
                color: isLocal ? "#065f46" : "#3730a3",
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              {isLocal ? "LOCAL" : "VAULT"}
            </span>
          </div>

          {/* Action row */}
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {!isLocal && (
              <SidebarBtn
                onClick={handleOpenFolder}
                title="Open a local folder (File System Access API)"
              >
                📂 Open Folder
              </SidebarBtn>
            )}
            {isLocal && (
              <>
                <SidebarBtn onClick={handleCloseFolder} title="Return to vault">
                  ← Vault
                </SidebarBtn>
                <SidebarBtn onClick={() => handleLocalNewFile(null, "untitled.md")} title="New file at root">
                  +📄
                </SidebarBtn>
                <SidebarBtn onClick={() => handleLocalNewDir(null, "new-folder")} title="New folder at root">
                  +📁
                </SidebarBtn>
              </>
            )}
            {!isLocal && (
              <SidebarBtn onClick={() => handleVaultNewFile(null, "untitled.md")} title="New file in vault root">
                +📄
              </SidebarBtn>
            )}
          </div>
        </div>

        {/* Tree */}
        <div style={{ flex: 1, overflow: "auto" }}>
          <FileTree
            tree={tree}
            selectedFile={selectedFile}
            onSelect={setSelectedFile}
            {...treeActions}
          />
        </div>
      </aside>

      {/* ── Editor ───────────────────────────────────────────────────────────── */}
      <main style={{ flex: 1, overflow: "hidden" }}>
        {selectedFile ? (
          <DocEditor
            key={selectedFile}
            filePath={selectedFile}
            onSaveSuccess={reload}
            fileOps={fileOps}
          />
        ) : (
          <EmptyState isLocal={isLocal} onOpenFolder={handleOpenFolder} />
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
  isLocal,
  onOpenFolder,
}: {
  isLocal: boolean;
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
      <div style={{ fontSize: 48 }}>{isLocal ? "📂" : "D"}</div>
      <div style={{ fontSize: 14 }}>Select a document from the sidebar</div>
      {!isLocal && (
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
