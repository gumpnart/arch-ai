import { useState, useCallback, useEffect } from "react";
import type { FileNode } from "../api/client.js";
import {
  openLocalFolder,
  walkDirectory,
  readLocalFile,
  writeLocalFile,
  createLocalFile,
  createLocalDir,
  deleteLocalEntry,
  renameLocalEntry,
  moveLocalEntryToDir,
} from "../lib/localFs.js";

// ── IndexedDB persistence for FileSystemDirectoryHandle ───────────────────────

const DB_NAME = "arch-doc";
const STORE = "handles";
const HANDLE_KEY = "rootDir";

function openHandleDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveHandle(h: FileSystemDirectoryHandle) {
  const db = await openHandleDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(h, HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadHandle(): Promise<FileSystemDirectoryHandle | null> {
  const db = await openHandleDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(HANDLE_KEY);
    req.onsuccess = () => resolve((req.result as FileSystemDirectoryHandle) ?? null);
    req.onerror = () => reject(req.error);
  });
}

function patchStatus(nodes: FileNode[], path: string, status: string | undefined): FileNode[] {
  return nodes.map((n) => {
    if (n.type === "file" && n.path === path) return { ...n, status };
    if (n.children) return { ...n, children: patchStatus(n.children, path, status) };
    return n;
  });
}

async function clearHandle() {
  const db = await openHandleDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export interface LocalFolderState {
  isOpen: boolean;
  folderName: string;
  tree: FileNode[];
  loading: boolean;
  error: string;
  openFolder: () => Promise<void>;
  closeFolder: () => void;
  reload: () => Promise<void>;
  updateFileStatus: (path: string, status: string | undefined) => void;
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<void>;
  createFile: (parentDir: string | null, name: string, content?: string) => Promise<string>;
  createDir: (parentDir: string | null, name: string) => Promise<string>;
  deleteEntry: (path: string) => Promise<void>;
  renameEntry: (oldPath: string, newName: string) => Promise<string>;
  moveEntryToDir: (srcPath: string, targetDir: string | null) => Promise<string>;
}

export function useLocalFolder(): LocalFolderState {
  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [tree, setTree] = useState<FileNode[]>([]);
  const [folderName, setFolderName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Restore persisted handle on mount
  useEffect(() => {
    loadHandle().then(async (handle) => {
      if (!handle) return;
      const perm = await handle.requestPermission({ mode: "readwrite" });
      if (perm !== "granted") return;
      setDirHandle(handle);
      setFolderName(handle.name);
      setLoading(true);
      try {
        const t = await walkDirectory(handle);
        setTree(t);
      } finally {
        setLoading(false);
      }
    }).catch(() => {});
  }, []);

  const openFolder = useCallback(async () => {
    try {
      const handle = await openLocalFolder();
      await saveHandle(handle);
      setDirHandle(handle);
      setFolderName(handle.name);
      setLoading(true);
      setError("");
      const t = await walkDirectory(handle);
      setTree(t);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError(String(err));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const closeFolder = useCallback(() => {
    clearHandle().catch(() => {});
    setDirHandle(null);
    setTree([]);
    setFolderName("");
    setError("");
  }, []);

  const updateFileStatus = useCallback((path: string, status: string | undefined) => {
    setTree((prev) => patchStatus(prev, path, status));
  }, []);


  const reload = useCallback(async () => {
    if (!dirHandle) return;
    setLoading(true);
    try {
      const t = await walkDirectory(dirHandle);
      setTree(t);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [dirHandle]);

  const readFile = useCallback(
    (path: string) => {
      if (!dirHandle) throw new Error("No folder open");
      return readLocalFile(dirHandle, path);
    },
    [dirHandle]
  );

  const writeFile = useCallback(
    (path: string, content: string) => {
      if (!dirHandle) throw new Error("No folder open");
      return writeLocalFile(dirHandle, path, content);
    },
    [dirHandle]
  );

  const createFile = useCallback(
    async (parentDir: string | null, name: string, content = "") => {
      if (!dirHandle) throw new Error("No folder open");
      const filePath = parentDir ? `${parentDir}/${name}` : name;
      await createLocalFile(dirHandle, filePath, content);
      return filePath;
    },
    [dirHandle]
  );

  const createDir = useCallback(
    async (parentDir: string | null, name: string) => {
      if (!dirHandle) throw new Error("No folder open");
      const dirPath = parentDir ? `${parentDir}/${name}` : name;
      await createLocalDir(dirHandle, dirPath);
      return dirPath;
    },
    [dirHandle]
  );

  const deleteEntry = useCallback(
    (path: string) => {
      if (!dirHandle) throw new Error("No folder open");
      return deleteLocalEntry(dirHandle, path);
    },
    [dirHandle]
  );

  const renameEntry = useCallback(
    (oldPath: string, newName: string) => {
      if (!dirHandle) throw new Error("No folder open");
      return renameLocalEntry(dirHandle, oldPath, newName);
    },
    [dirHandle]
  );

  const moveEntryToDir = useCallback(
    (srcPath: string, targetDir: string | null) => {
      if (!dirHandle) throw new Error("No folder open");
      return moveLocalEntryToDir(dirHandle, srcPath, targetDir);
    },
    [dirHandle]
  );

  return {
    isOpen: !!dirHandle,
    folderName,
    tree,
    loading,
    error,
    openFolder,
    closeFolder,
    reload,
    updateFileStatus,
    readFile,
    writeFile,
    createFile,
    createDir,
    deleteEntry,
    renameEntry,
    moveEntryToDir,
  };
}
