import { useState, useCallback } from "react";
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
} from "../lib/localFs.js";

export interface LocalFolderState {
  isOpen: boolean;
  folderName: string;
  tree: FileNode[];
  loading: boolean;
  error: string;
  openFolder: () => Promise<void>;
  closeFolder: () => void;
  reload: () => Promise<void>;
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<void>;
  createFile: (parentDir: string | null, name: string, content?: string) => Promise<string>;
  createDir: (parentDir: string | null, name: string) => Promise<string>;
  deleteEntry: (path: string) => Promise<void>;
  renameEntry: (oldPath: string, newName: string) => Promise<string>;
}

export function useLocalFolder(): LocalFolderState {
  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [tree, setTree] = useState<FileNode[]>([]);
  const [folderName, setFolderName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const openFolder = useCallback(async () => {
    try {
      const handle = await openLocalFolder();
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
    setDirHandle(null);
    setTree([]);
    setFolderName("");
    setError("");
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

  return {
    isOpen: !!dirHandle,
    folderName,
    tree,
    loading,
    error,
    openFolder,
    closeFolder,
    reload,
    readFile,
    writeFile,
    createFile,
    createDir,
    deleteEntry,
    renameEntry,
  };
}
