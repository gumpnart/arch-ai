import type { FileNode } from "../api/client.js";

export async function openLocalFolder(): Promise<FileSystemDirectoryHandle> {
  return window.showDirectoryPicker({ mode: "readwrite" });
}

async function readFrontmatterStatus(fileHandle: FileSystemFileHandle): Promise<string | undefined> {
  try {
    const file = await fileHandle.getFile();
    const text = await file.text();
    const match = text.match(/^---[\r\n]([\s\S]*?)[\r\n]---/);
    if (!match) return undefined;
    const statusLine = match[1].split("\n").find((l) => l.trimStart().startsWith("status:"));
    return statusLine?.split(":")[1]?.trim() || undefined;
  } catch {
    return undefined;
  }
}

export async function walkDirectory(
  dirHandle: FileSystemDirectoryHandle,
  relativePath = ""
): Promise<FileNode[]> {
  const items: FileNode[] = [];

  // FileSystemDirectoryHandle is async-iterable over [name, handle] pairs
  for await (const [name, handle] of dirHandle as unknown as AsyncIterable<
    [string, FileSystemHandle]
  >) {
    if (name.startsWith(".") || name === "node_modules") continue;
    const itemPath = relativePath ? `${relativePath}/${name}` : name;

    if (handle.kind === "directory") {
      const children = await walkDirectory(
        handle as FileSystemDirectoryHandle,
        itemPath
      );
      items.push({ type: "dir", name, path: itemPath, children });
    } else if (name.endsWith(".md")) {
      const status = await readFrontmatterStatus(handle as FileSystemFileHandle);
      items.push({ type: "file", name, path: itemPath, status });
    }
  }

  return items.sort((a, b) =>
    a.type === b.type
      ? a.name.localeCompare(b.name)
      : a.type === "dir"
        ? -1
        : 1
  );
}

async function resolvePath(
  rootHandle: FileSystemDirectoryHandle,
  filePath: string,
  createDirs = false
): Promise<{ parent: FileSystemDirectoryHandle; name: string }> {
  const parts = filePath.replace(/\\/g, "/").split("/").filter(Boolean);
  const name = parts[parts.length - 1];
  let parent = rootHandle;
  for (let i = 0; i < parts.length - 1; i++) {
    parent = await parent.getDirectoryHandle(parts[i], { create: createDirs });
  }
  return { parent, name };
}

export async function readLocalFile(
  rootHandle: FileSystemDirectoryHandle,
  filePath: string
): Promise<string> {
  const { parent, name } = await resolvePath(rootHandle, filePath);
  const fileHandle = await parent.getFileHandle(name);
  const file = await fileHandle.getFile();
  return file.text();
}

export async function writeLocalFile(
  rootHandle: FileSystemDirectoryHandle,
  filePath: string,
  content: string
): Promise<void> {
  const { parent, name } = await resolvePath(rootHandle, filePath, true);
  const fileHandle = await parent.getFileHandle(name, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}

export async function createLocalFile(
  rootHandle: FileSystemDirectoryHandle,
  filePath: string,
  content = ""
): Promise<void> {
  await writeLocalFile(rootHandle, filePath, content);
}

export async function createLocalDir(
  rootHandle: FileSystemDirectoryHandle,
  dirPath: string
): Promise<void> {
  const { parent, name } = await resolvePath(rootHandle, dirPath, true);
  await parent.getDirectoryHandle(name, { create: true });
}

export async function deleteLocalEntry(
  rootHandle: FileSystemDirectoryHandle,
  entryPath: string
): Promise<void> {
  const { parent, name } = await resolvePath(rootHandle, entryPath);
  await (parent as FileSystemDirectoryHandle & {
    removeEntry(name: string, opts?: { recursive?: boolean }): Promise<void>;
  }).removeEntry(name, { recursive: true });
}

export async function renameLocalEntry(
  rootHandle: FileSystemDirectoryHandle,
  oldPath: string,
  newName: string
): Promise<string> {
  const parts = oldPath.replace(/\\/g, "/").split("/");
  parts[parts.length - 1] = newName;
  const newPath = parts.join("/");
  await moveLocalEntry(rootHandle, oldPath, newPath);
  return newPath;
}

async function getDirHandle(
  rootHandle: FileSystemDirectoryHandle,
  dirPath: string
): Promise<FileSystemDirectoryHandle> {
  const parts = dirPath.replace(/\\/g, "/").split("/").filter(Boolean);
  let dir = rootHandle;
  for (const part of parts) {
    dir = await dir.getDirectoryHandle(part);
  }
  return dir;
}

async function copyDirRecursive(
  rootHandle: FileSystemDirectoryHandle,
  srcDirHandle: FileSystemDirectoryHandle,
  destPath: string
): Promise<void> {
  for await (const [name, handle] of srcDirHandle as unknown as AsyncIterable<
    [string, FileSystemHandle]
  >) {
    const destItemPath = `${destPath}/${name}`;
    if (handle.kind === "directory") {
      await copyDirRecursive(rootHandle, handle as FileSystemDirectoryHandle, destItemPath);
    } else {
      const file = await (handle as FileSystemFileHandle).getFile();
      const content = await file.text();
      await writeLocalFile(rootHandle, destItemPath, content);
    }
  }
}

export async function moveLocalEntry(
  rootHandle: FileSystemDirectoryHandle,
  srcPath: string,
  destPath: string
): Promise<void> {
  const isDir = !srcPath.includes(".") || srcPath.endsWith("/");
  const { parent: srcParent, name: srcName } = await resolvePath(rootHandle, srcPath);

  try {
    if (isDir) {
      const srcDirHandle = await srcParent.getDirectoryHandle(srcName);
      await copyDirRecursive(rootHandle, srcDirHandle, destPath);
    } else {
      const fileHandle = await srcParent.getFileHandle(srcName);
      const file = await fileHandle.getFile();
      const content = await file.text();
      await writeLocalFile(rootHandle, destPath, content);
    }
  } catch (e) {
    // If isDir heuristic was wrong, try the other kind
    if ((e as Error).name === "TypeMismatchError") {
      if (isDir) {
        const fileHandle = await srcParent.getFileHandle(srcName);
        const file = await fileHandle.getFile();
        const content = await file.text();
        await writeLocalFile(rootHandle, destPath, content);
      } else {
        const srcDirHandle = await srcParent.getDirectoryHandle(srcName);
        await copyDirRecursive(rootHandle, srcDirHandle, destPath);
      }
    } else {
      throw e;
    }
  }

  await deleteLocalEntry(rootHandle, srcPath);
}

// Move srcPath into targetDir (keep the same entry name)
export async function moveLocalEntryToDir(
  rootHandle: FileSystemDirectoryHandle,
  srcPath: string,
  targetDir: string | null
): Promise<string> {
  const name = srcPath.replace(/\\/g, "/").split("/").pop()!;
  const destPath = targetDir ? `${targetDir}/${name}` : name;
  await moveLocalEntry(rootHandle, srcPath, destPath);
  return destPath;
}

// Unused but kept for potential direct use
export { getDirHandle };
