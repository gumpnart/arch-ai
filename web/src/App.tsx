import { useState, useCallback, useEffect } from "react";
import { FileTree } from "./components/Sidebar/FileTree.js";
import { DocEditor } from "./components/Editor/DocEditor.js";
import { ExcalidrawEditor } from "./components/Editor/ExcalidrawEditor.js";
import { SearchPalette } from "./components/Search/SearchPalette.js";
import { ContentSearchPanel } from "./components/Search/ContentSearchPanel.js";
import { OpenEditors } from "./components/Sidebar/OpenEditors.js";
import { TemplateModal } from "./components/TemplateModal/TemplateModal.js";
import { SectionLabel } from "./components/ui/SectionLabel.js";
import { useLocalFolder } from "./hooks/useLocalFolder.js";
import { useFileHistory } from "./hooks/useFileHistory.js";
import { useOpenEditors } from "./hooks/useOpenEditors.js";
import { useStableDocuments } from "./hooks/useStableDocuments.js";

const DEFAULT_MD = (name: string) => {
  const title = name.replace(/\.md$/, "");
  const today = new Date().toISOString().split("T")[0];
  return `---\ntitle: ${title}\nstatus: draft\ncreated: ${today}\nupdated: ${today}\n---\n\n# ${title}\n`;
};

const EMPTY_EXCALIDRAW = JSON.stringify(
  {
    type: "excalidraw",
    version: 2,
    source: "arch-doc-web",
    elements: [],
    appState: { gridSize: null, viewBackgroundColor: "#ffffff" },
    files: {},
  },
  null,
  2
);

type RailView = "explorer" | "search";

export default function App() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [railView, setRailView] = useState<RailView>("explorer");
  const local = useLocalFolder();
  const history = useFileHistory();
  const openEditors = useOpenEditors();
  const { getContext: getStableDocsContext, stableCount } = useStableDocuments(
    local.tree,
    local.readFile
  );

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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "p" && !e.shiftKey) {
        e.preventDefault();
        if (local.isOpen) setPaletteOpen(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "F") {
        e.preventDefault();
        if (local.isOpen) setRailView("search");
      }
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

  useEffect(() => {
    if (!local.isOpen) {
      openEditors.reset();
      setSelectedFile(null);
      setRailView("explorer");
    }
  }, [local.isOpen]);

  const handleNewFile = useCallback(
    async (parentDir: string | null, name: string) => {
      const content = name.endsWith(".excalidraw") ? EMPTY_EXCALIDRAW : DEFAULT_MD(name);
      const filePath = await local.createFile(parentDir, name, content);
      await local.reload();
      openFile(filePath);
    },
    [local, openFile]
  );

  const handleNewExcalidraw = useCallback(
    async (parentDir: string | null = null) => {
      const filePath = await local.createFile(parentDir, "untitled.excalidraw", EMPTY_EXCALIDRAW);
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
    async (files: Record<string, string>, projectName: string, location: "subfolder" | "current") => {
      for (const [relativePath, content] of Object.entries(files)) {
        await local.createFile(location === "subfolder" ? projectName : null, relativePath, content);
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

  const fileOps = { read: local.readFile, write: local.writeFile };
  const folderOpen = local.isOpen;

  // Workspace initial — first letter of folder name
  const wsInitial = (local.folderName || "?")[0].toUpperCase();

  const navProps = {
    folderName: local.folderName,
    canGoBack: history.canGoBack,
    canGoForward: history.canGoForward,
    onGoBack: handleGoBack,
    onGoForward: handleGoForward,
  };

  return (
    <div style={{
      display: "flex",
      height: "100vh",
      fontFamily: "var(--font-sans)",
      background: "var(--editor-bg)",
      WebkitFontSmoothing: "antialiased",
    }}>

      {/* ── Icon Rail ──────────────────────────────────────────────────────── */}
      <nav style={{
        width: "var(--rail-width)",
        background: "var(--rail-bg)",
        borderRight: `1px solid var(--rail-border)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "10px 0",
        gap: 2,
        flexShrink: 0,
        userSelect: "none",
      }}>
        <RailIcon
          active={railView === "explorer"}
          title="Explorer"
          onClick={() => setRailView("explorer")}
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </RailIcon>

        <RailIcon
          active={railView === "search"}
          title="Search (Ctrl+Shift+F)"
          onClick={() => { if (folderOpen) setRailView("search"); }}
          muted={!folderOpen}
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        </RailIcon>

        <RailIcon
          title="Templates"
          onClick={() => { if (folderOpen) setTemplateModalOpen(true); }}
          muted={!folderOpen}
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
          </svg>
        </RailIcon>

        <div style={{ width: 24, height: 1, background: "var(--rail-border)", margin: "4px 0" }} />

        <RailIcon
          title="Quick open (Ctrl+P)"
          onClick={() => { if (folderOpen) setPaletteOpen(true); }}
          muted={!folderOpen}
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M12 2a4 4 0 0 1 4 4v2h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2V6a4 4 0 0 1 4-4z" />
            <circle cx="12" cy="16" r="1.5" fill="currentColor" />
          </svg>
        </RailIcon>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* New file / folder actions */}
        {folderOpen && (
          <>
            <RailIcon title="New markdown file" onClick={() => handleNewFile(null, "untitled.md")}>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <line x1="12" y1="11" x2="12" y2="17" />
                <line x1="9" y1="14" x2="15" y2="14" />
              </svg>
            </RailIcon>
            <RailIcon title="New drawing" onClick={() => handleNewExcalidraw(null)}>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M12 19l7-7 3 3-7 7-3-3z" />
                <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
              </svg>
            </RailIcon>
          </>
        )}

        <RailIcon title="Open folder" onClick={handleOpenFolder}>
          <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
        </RailIcon>

        {/* Avatar */}
        <div style={{
          width: 28,
          height: 28,
          background: "var(--accent)",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontSize: 11,
          fontWeight: 700,
          marginBottom: 4,
          marginTop: 4,
          flexShrink: 0,
        }}>
          {wsInitial}
        </div>
      </nav>

      {/* ── File Panel ─────────────────────────────────────────────────────── */}
      <div style={{
        width: "var(--panel-width)",
        background: "var(--panel-bg)",
        borderRight: "1px solid var(--panel-border)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        flexShrink: 0,
      }}>
        {/* Panel header */}
        <div style={{
          padding: "14px 14px 10px",
          borderBottom: "1px solid var(--panel-border)",
          flexShrink: 0,
        }}>
          {folderOpen ? (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 10,
            }}>
              <div style={{
                width: 20,
                height: 20,
                background: "var(--accent)",
                borderRadius: 5,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: 10,
                fontWeight: 800,
                flexShrink: 0,
              }}>
                {wsInitial}
              </div>
              <span style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--text-1)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                flex: 1,
              }}>
                {local.folderName}
              </span>
            </div>
          ) : (
            <div style={{ marginBottom: 10, height: 20 }} />
          )}

          {/* Search input */}
          <input
            placeholder="Search files…"
            onFocus={() => { if (folderOpen) setRailView("search"); }}
            readOnly={!folderOpen}
            style={{
              width: "100%",
              background: "#f4f4f5",
              border: "none",
              borderRadius: 6,
              padding: "6px 10px",
              fontSize: 12,
              color: "var(--text-2)",
              fontFamily: "var(--font-sans)",
              outline: "none",
              cursor: folderOpen ? "text" : "not-allowed",
            }}
          />
        </div>

        {/* Explorer view */}
        {railView === "explorer" && (
          <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
            {folderOpen ? (
              <>
                {openEditors.openFiles.length > 0 && (
                  <OpenEditors
                    openFiles={openEditors.openFiles}
                    selectedFile={selectedFile}
                    onSelect={openFile}
                    onClose={handleCloseOpenEditor}
                  />
                )}

                <SectionLabel>Files</SectionLabel>

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
            ) : (
              <PanelEmptyState onOpenFolder={handleOpenFolder} />
            )}
          </div>
        )}

        {/* Search view */}
        {railView === "search" && (
          <ContentSearchPanel
            tree={local.tree}
            readFile={local.readFile}
            selectedFile={selectedFile}
            onSelect={openFile}
            autoFocus={railView === "search"}
          />
        )}
      </div>

      {/* ── Editor Area ────────────────────────────────────────────────────── */}
      <main style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {selectedFile ? (
          selectedFile.endsWith(".excalidraw") ? (
            <ExcalidrawEditor
              key={selectedFile}
              filePath={selectedFile}
              fileOps={fileOps}
              onSaveSuccess={local.reload}
              {...navProps}
            />
          ) : (
            <DocEditor
              key={selectedFile}
              filePath={selectedFile}
              onSaveSuccess={local.reload}
              onLoad={(fm) => local.updateFileStatus(selectedFile, fm.status)}
              fileOps={fileOps}
              getStableDocsContext={getStableDocsContext}
              stableCount={stableCount}
              {...navProps}
            />
          )
        ) : (
          <EditorEmptyState folderOpen={folderOpen} onOpenFolder={handleOpenFolder} />
        )}
      </main>

      {/* ── Command palette ─────────────────────────────────────────────────── */}
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

// ── Rail icon button ──────────────────────────────────────────────────────────

function RailIcon({
  children,
  active,
  muted,
  title,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  muted?: boolean;
  title?: string;
  onClick?: () => void;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        width: 36,
        height: 36,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 8,
        border: "none",
        background: active ? "var(--rail-active-bg)" : "none",
        color: active
          ? "var(--rail-active-color)"
          : muted
          ? "#3f3f46"
          : "var(--rail-icon)",
        cursor: muted ? "not-allowed" : "pointer",
        flexShrink: 0,
        transition: "background 0.1s, color 0.1s",
        padding: 0,
      }}
      onMouseEnter={(e) => {
        if (!active && !muted)
          (e.currentTarget as HTMLButtonElement).style.background = "#27272a";
        if (!active && !muted)
          (e.currentTarget as HTMLButtonElement).style.color = "var(--rail-icon-hover)";
      }}
      onMouseLeave={(e) => {
        if (!active)
          (e.currentTarget as HTMLButtonElement).style.background = "none";
        if (!active && !muted)
          (e.currentTarget as HTMLButtonElement).style.color = "var(--rail-icon)";
      }}
    >
      {children}
    </button>
  );
}

// ── Empty states ──────────────────────────────────────────────────────────────

function PanelEmptyState({ onOpenFolder }: { onOpenFolder: () => void }) {
  return (
    <div style={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
      gap: 12,
    }}>
      <svg width="32" height="32" fill="none" stroke="var(--text-3)" strokeWidth="1.5" viewBox="0 0 24 24">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
      <p style={{ fontSize: 12, color: "var(--text-3)", textAlign: "center", lineHeight: 1.5 }}>
        No folder open
      </p>
      <button
        onClick={onOpenFolder}
        style={{
          fontSize: 12,
          padding: "6px 14px",
          background: "var(--accent)",
          color: "#fff",
          border: "none",
          borderRadius: 6,
          cursor: "pointer",
          fontFamily: "var(--font-sans)",
          fontWeight: 500,
        }}
      >
        Open Folder
      </button>
    </div>
  );
}

function EditorEmptyState({
  folderOpen,
  onOpenFolder,
}: {
  folderOpen: boolean;
  onOpenFolder: () => void;
}) {
  return (
    <div style={{
      flex: 1,
      height: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 16,
    }}>
      <svg width="48" height="48" fill="none" stroke="var(--border-mid)" strokeWidth="1.2" viewBox="0 0 24 24">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
      <p style={{ fontSize: 14, color: "var(--text-3)" }}>
        {folderOpen ? "Select a document from the panel" : "Open a local folder to get started"}
      </p>
      {!folderOpen && (
        <button
          onClick={onOpenFolder}
          style={{
            fontSize: 13,
            padding: "8px 20px",
            background: "var(--accent)",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            fontFamily: "var(--font-sans)",
            fontWeight: 600,
            boxShadow: "0 1px 3px rgba(37,99,235,.3)",
          }}
        >
          Open Local Folder
        </button>
      )}
      <p style={{ fontSize: 11, color: "var(--text-3)" }}>
        <kbd style={{ padding: "1px 5px", background: "var(--hover-bg)", borderRadius: 4, border: "1px solid var(--border-mid)", fontFamily: "var(--font-mono)", fontSize: 10 }}>Ctrl+P</kbd>
        {" "}quick open{" · "}
        <kbd style={{ padding: "1px 5px", background: "var(--hover-bg)", borderRadius: 4, border: "1px solid var(--border-mid)", fontFamily: "var(--font-mono)", fontSize: 10 }}>Ctrl+Shift+F</kbd>
        {" "}search
      </p>
    </div>
  );
}
