import { useState, useCallback, useEffect } from "react";
import { FileTree } from "./components/Sidebar/FileTree.js";
import { DocEditor, type FileOps } from "./components/Editor/DocEditor.js";
import { NavBar } from "./components/NavBar/NavBar.js";
import { SearchPalette } from "./components/Search/SearchPalette.js";
import { ContentSearchPanel } from "./components/Search/ContentSearchPanel.js";
import { OpenEditors } from "./components/Sidebar/OpenEditors.js";
import { TemplateModal } from "./components/TemplateModal/TemplateModal.js";
import { useLocalFolder } from "./hooks/useLocalFolder.js";
import { useFileHistory } from "./hooks/useFileHistory.js";
import { useOpenEditors } from "./hooks/useOpenEditors.js";

const DEFAULT_MD = (name: string) => {
  const title = name.replace(/\.md$/, "");
  const today = new Date().toISOString().split("T")[0];
  return `---\ntitle: ${title}\nstatus: draft\ncreated: ${today}\nupdated: ${today}\n---\n\n# ${title}\n`;
};

type SidebarView = "explorer" | "search";

export default function App() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [sidebarView, setSidebarView] = useState<SidebarView>("explorer");
  const local = useLocalFolder();
  const history = useFileHistory();
  const openEditors = useOpenEditors();

  // Central handler for opening a file — updates all state at once
  const openFile = useCallback(
    (path: string) => {
      setSelectedFile(path);
      history.push(path);
      openEditors.add(path);
    },
    [history, openEditors]
  );

  const handleGoBack = useCallback(() => {
    const path = history.goBack();
    if (path) setSelectedFile(path);
  }, [history]);

  const handleGoForward = useCallback(() => {
    const path = history.goForward();
    if (path) setSelectedFile(path);
  }, [history]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+P — command palette
      if ((e.ctrlKey || e.metaKey) && e.key === "p" && !e.shiftKey) {
        e.preventDefault();
        if (local.isOpen) setPaletteOpen(true);
      }
      // Ctrl+Shift+F — content search panel
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "F") {
        e.preventDefault();
        if (local.isOpen) setSidebarView("search");
      }
      // Alt+← / Alt+→ — history navigation
      if (e.altKey && e.key === "ArrowLeft") {
        e.preventDefault();
        handleGoBack();
      }
      if (e.altKey && e.key === "ArrowRight") {
        e.preventDefault();
        handleGoForward();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [local.isOpen, handleGoBack, handleGoForward]);

  // Reset open editors when folder closes
  useEffect(() => {
    if (!local.isOpen) {
      openEditors.reset();
      setSelectedFile(null);
      setSidebarView("explorer");
    }
  }, [local.isOpen]);

  const handleNewFile = useCallback(
    async (parentDir: string | null, name: string) => {
      const filePath = await local.createFile(parentDir, name, DEFAULT_MD(name));
      await local.reload();
      openFile(filePath);
    },
    [local, openFile]
  );

  const handleNewDir = useCallback(
    async (parentDir: string | null, name: string) => {
      await local.createDir(parentDir, name);
      await local.reload();
    },
    [local]
  );

  const handleNewFromTemplate = useCallback(
    async (files: Record<string, string>, projectName: string) => {
      for (const [relativePath, content] of Object.entries(files)) {
        await local.createFile(projectName, relativePath, content);
      }
      await local.reload();
    },
    [local]
  );

  const handleRename = useCallback(
    async (oldPath: string, newName: string) => {
      const newPath = await local.renameEntry(oldPath, newName);
      await local.reload();
      if (selectedFile === oldPath) setSelectedFile(newPath);
    },
    [local, selectedFile]
  );

  const handleDelete = useCallback(
    async (path: string) => {
      await local.deleteEntry(path);
      await local.reload();
      if (selectedFile === path) setSelectedFile(null);
      openEditors.close(path);
    },
    [local, selectedFile, openEditors]
  );

  const handleMove = useCallback(
    async (sourcePaths: string[], targetDir: string | null) => {
      const pathMap: Record<string, string> = {};
      for (const src of sourcePaths) {
        const newPath = await local.moveEntryToDir(src, targetDir);
        pathMap[src] = newPath;
      }
      await local.reload();
      if (selectedFile && pathMap[selectedFile])
        setSelectedFile(pathMap[selectedFile]);
    },
    [local, selectedFile]
  );

  const handleOpenFolder = useCallback(async () => {
    await local.openFolder();
    setSelectedFile(null);
  }, [local]);

  const handleCloseOpenEditor = useCallback(
    (path: string) => {
      openEditors.close(path);
      if (selectedFile === path) setSelectedFile(null);
    },
    [openEditors, selectedFile]
  );

  const fileOps: FileOps = { read: local.readFile, write: local.writeFile };
  const folderOpen = local.isOpen;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* ── Top navigation bar ───────────────────────────────────────────────── */}
      <NavBar
        selectedFile={selectedFile}
        folderName={local.folderName}
        canGoBack={history.canGoBack}
        canGoForward={history.canGoForward}
        onGoBack={handleGoBack}
        onGoForward={handleGoForward}
        onOpenPalette={() => setPaletteOpen(true)}
      />

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* ── Sidebar ────────────────────────────────────────────────────────── */}
        <aside
          style={{
            width: 260,
            borderRight: "1px solid #e0e0e0",
            background: "#fafafa",
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Sidebar header */}
          <div
            style={{
              padding: "10px 12px 8px",
              borderBottom: "1px solid #e0e0e0",
              flexShrink: 0,
            }}
          >
            {/* Title row with view toggle */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 6,
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#333",
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {sidebarView === "search"
                  ? "SEARCH"
                  : folderOpen
                  ? `📂 ${local.folderName}`
                  : "No folder open"}
              </span>

              {/* View toggle tabs */}
              <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                <ViewTab
                  active={sidebarView === "explorer"}
                  onClick={() => setSidebarView("explorer")}
                  title="Explorer"
                  label="📁"
                />
                <ViewTab
                  active={sidebarView === "search"}
                  onClick={() => setSidebarView("search")}
                  title="Search (Ctrl+Shift+F)"
                  label="🔍"
                />
              </div>
            </div>

            {/* Action row — only in explorer view */}
            {sidebarView === "explorer" && (
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                <SidebarBtn
                  onClick={handleOpenFolder}
                  title="Open a local folder (File System Access API)"
                >
                  📂 Open Folder
                </SidebarBtn>
                {folderOpen && (
                  <>
                    <SidebarBtn
                      onClick={() => handleNewFile(null, "untitled.md")}
                      title="New file at root"
                    >
                      +📄
                    </SidebarBtn>
                    <SidebarBtn
                      onClick={() => handleNewDir(null, "new-folder")}
                      title="New folder at root"
                    >
                      +📁
                    </SidebarBtn>
                    <SidebarBtn
                      onClick={() => setTemplateModalOpen(true)}
                      title="New project from template"
                    >
                      📋 Template
                    </SidebarBtn>
                    <SidebarBtn
                      onClick={() => setPaletteOpen(true)}
                      title="Quick open (Ctrl+P)"
                    >
                      Ctrl+P
                    </SidebarBtn>
                  </>
                )}
              </div>
            )}
          </div>

          {/* ── Explorer view ── */}
          {sidebarView === "explorer" && (
            <>
              {folderOpen && (
                <OpenEditors
                  openFiles={openEditors.openFiles}
                  selectedFile={selectedFile}
                  onSelect={openFile}
                  onClose={handleCloseOpenEditor}
                />
              )}
              <div style={{ flex: 1, overflow: "auto" }}>
                <FileTree
                  tree={local.tree}
                  selectedFile={selectedFile}
                  onSelect={openFile}
                  onNewFile={handleNewFile}
                  onNewDir={handleNewDir}
                  onRename={handleRename}
                  onDelete={handleDelete}
                  onMove={handleMove}
                />
              </div>
            </>
          )}

          {/* ── Search view ── */}
          {sidebarView === "search" && (
            <ContentSearchPanel
              tree={local.tree}
              readFile={local.readFile}
              selectedFile={selectedFile}
              onSelect={openFile}
              autoFocus={sidebarView === "search"}
            />
          )}
        </aside>

        {/* ── Editor ─────────────────────────────────────────────────────────── */}
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

      {/* ── Command palette overlay ─────────────────────────────────────────── */}
      {paletteOpen && (
        <SearchPalette
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          tree={local.tree}
          selectedFile={selectedFile}
          recentFiles={[...openEditors.openFiles].reverse()}
          onSelect={(path) => {
            openFile(path);
            setPaletteOpen(false);
          }}
          readFile={local.readFile}
        />
      )}

      {/* ── Template modal ──────────────────────────────────────────────────── */}
      <TemplateModal
        open={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        onConfirm={handleNewFromTemplate}
      />
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function ViewTab({
  active,
  onClick,
  title,
  label,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        fontSize: 13,
        padding: "2px 6px",
        background: active ? "#e8f0fe" : "none",
        border: active ? "1px solid #bfdbfe" : "1px solid transparent",
        borderRadius: 4,
        cursor: "pointer",
        color: active ? "#2563eb" : "#9ca3af",
      }}
      onMouseEnter={(e) => {
        if (!active)
          (e.currentTarget as HTMLButtonElement).style.background = "#f3f4f6";
      }}
      onMouseLeave={(e) => {
        if (!active)
          (e.currentTarget as HTMLButtonElement).style.background = "none";
      }}
    >
      {label}
    </button>
  );
}

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
        {folderOpen
          ? "Select a document from the sidebar"
          : "Open a local folder to get started"}
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
      <div style={{ fontSize: 11, color: "#bbb", textAlign: "center" }}>
        <code>Ctrl+P</code> quick open · <code>Ctrl+Shift+F</code> search content
      </div>
    </div>
  );
}
