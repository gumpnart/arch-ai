import { useState, useCallback, useEffect, useRef } from 'react';
import Sidebar from './Sidebar';
import Editor, { type EditorHandle } from './Editor';
import GitModal from './GitModal';
import NewFileModal from './NewFileModal';
import DiagramModal from './DiagramModal';
import Toast, { type ToastMessage } from './Toast';
import { api } from '../lib/api';
import { useSSE } from '../hooks/useSSE';

type SSEStatus = 'connecting' | 'live' | 'disconnected';

export default function App() {
  const [files, setFiles] = useState<string[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  const [showGit, setShowGit] = useState(false);
  const [showNewFile, setShowNewFile] = useState(false);
  const [showDiagram, setShowDiagram] = useState(false);

  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [sseStatus, setSseStatus] = useState<SSEStatus>('connecting');

  const editorRef = useRef<EditorHandle>(null);

  // ── File loading ──────────────────────────────────────────────────────────

  const loadFiles = useCallback(async () => {
    try {
      const list = await api.listFiles();
      setFiles(list);
    } catch {
      pushToast('Failed to load files', 'error');
    }
  }, []);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  // ── SSE real-time updates ──────────────────────────────────────────────────

  useSSE({
    onMessage: (event) => {
      if (['diagram_added', 'diagram_removed', 'diagram_changed'].includes(event.event)) {
        loadFiles();
      }
    },
    onStatus: setSseStatus,
  });

  // ── Toast helper ──────────────────────────────────────────────────────────

  const pushToast = useCallback((message: string, type: ToastMessage['type']) => {
    setToast({ id: Date.now(), message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // ── File operations ───────────────────────────────────────────────────────

  const openFile = useCallback(async (path: string) => {
    try {
      const content = await api.readFile(path);
      setFileContent(content);
      setActiveFile(path);
      setIsDirty(false);
    } catch {
      pushToast('Failed to open file', 'error');
    }
  }, [pushToast]);

  const saveFile = useCallback(async (markdown: string) => {
    if (!activeFile) return;
    try {
      await api.writeFile(activeFile, markdown);
      setIsDirty(false);
      pushToast('Saved', 'success');
    } catch {
      pushToast('Save failed', 'error');
    }
  }, [activeFile, pushToast]);

  const deleteFile = useCallback(async (path: string) => {
    if (!window.confirm(`Delete "${path}"?`)) return;
    try {
      await api.deleteFile(path);
      if (path === activeFile) {
        setActiveFile(null);
        setFileContent('');
        setIsDirty(false);
      }
      await loadFiles();
      pushToast('Deleted', 'success');
    } catch {
      pushToast('Delete failed', 'error');
    }
  }, [activeFile, loadFiles, pushToast]);

  const createFile = useCallback(async (path: string, content: string) => {
    await api.writeFile(path, content);
    await loadFiles();
    await openFile(path);
    pushToast('File created', 'success');
  }, [loadFiles, openFile, pushToast]);

  // ── Diagram insertion ─────────────────────────────────────────────────────

  const handleDiagramInsert = useCallback((embedCode: string) => {
    editorRef.current?.insertContent(embedCode);
    setShowDiagram(false);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="app">
      {/* ── Topbar ── */}
      <header className="topbar">
        <div className="topbar-brand">
          <span className="topbar-logo">✦</span>
          <span className="topbar-title">Vault Editor</span>
        </div>
        {activeFile && isDirty && (
          <span className="topbar-dirty" title="Unsaved changes">●</span>
        )}
        <nav className="topbar-nav">
          <button className="btn btn-topbar" onClick={() => setShowGit(true)} title="Git operations">
            ⎇ Git
          </button>
          <button className="btn btn-topbar" onClick={() => setShowNewFile(true)} title="New file">
            + New
          </button>
          {activeFile && (
            <button
              className="btn btn-topbar btn-danger"
              onClick={() => deleteFile(activeFile)}
              title="Delete current file"
            >
              Delete
            </button>
          )}
        </nav>
      </header>

      {/* ── Workspace ── */}
      <div className="workspace">
        <Sidebar
          files={files}
          activeFile={activeFile}
          onFileSelect={openFile}
          onDelete={deleteFile}
        />

        <main className="main-area">
          {activeFile ? (
            <Editor
              key={activeFile}
              ref={editorRef}
              initialContent={fileContent}
              filePath={activeFile}
              onChange={() => setIsDirty(true)}
              onSave={saveFile}
              onInsertDiagram={() => setShowDiagram(true)}
            />
          ) : (
            <div className="empty-state">
              <div className="empty-icon">✦</div>
              <h2>Vault Editor</h2>
              <p>Select a file from the sidebar or create a new one.</p>
              <button className="btn btn-primary" onClick={() => setShowNewFile(true)}>
                + New File
              </button>
            </div>
          )}
        </main>
      </div>

      {/* ── Status bar ── */}
      <footer className="statusbar">
        <span className={`sse-dot sse-${sseStatus}`} title={`SSE: ${sseStatus}`} />
        <span className="statusbar-text">{sseStatus}</span>
        {activeFile && (
          <>
            <span className="statusbar-sep">|</span>
            <span className="statusbar-file">{activeFile}</span>
          </>
        )}
        {isDirty && <span className="statusbar-dirty">— unsaved</span>}
      </footer>

      {/* ── Modals ── */}
      {showGit && (
        <GitModal
          onClose={() => setShowGit(false)}
          onCloned={loadFiles}
          onToast={pushToast}
        />
      )}
      {showNewFile && (
        <NewFileModal
          onClose={() => setShowNewFile(false)}
          onCreate={createFile}
        />
      )}
      {showDiagram && (
        <DiagramModal
          onClose={() => setShowDiagram(false)}
          onInsert={handleDiagramInsert}
          onToast={pushToast}
        />
      )}

      {/* ── Toast ── */}
      {toast && <Toast message={toast} />}
    </div>
  );
}
