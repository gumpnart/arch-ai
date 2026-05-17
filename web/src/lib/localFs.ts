import type { FileNode } from "../api/client.js";

export async function openLocalFolder(): Promise<FileSystemDirectoryHandle> {
  return window.showDirectoryPicker({ mode: "readwrite" });
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
      items.push({ type: "file", name, path: itemPath });
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
  const content = await readLocalFile(rootHandle, oldPath);
  const parts = oldPath.replace(/\\/g, "/").split("/");
  parts[parts.length - 1] = newName;
  const newPath = parts.join("/");
  await writeLocalFile(rootHandle, newPath, content);
  await deleteLocalEntry(rootHandle, oldPath);
  return newPath;
}
