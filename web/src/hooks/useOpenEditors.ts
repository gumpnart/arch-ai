import { useState, useCallback } from "react";

const MAX_OPEN = 20;

export interface UseOpenEditorsReturn {
  openFiles: string[];
  add: (path: string) => void;
  close: (path: string) => void;
  reset: () => void;
  isOpen: (path: string) => boolean;
}

export function useOpenEditors(): UseOpenEditorsReturn {
  const [openFiles, setOpenFiles] = useState<string[]>([]);

  const add = useCallback((path: string) => {
    setOpenFiles((prev) => {
      const without = prev.filter((p) => p !== path);
      const next = [...without, path];
      return next.length > MAX_OPEN ? next.slice(next.length - MAX_OPEN) : next;
    });
  }, []);

  const close = useCallback((path: string) => {
    setOpenFiles((prev) => prev.filter((p) => p !== path));
  }, []);

  const reset = useCallback(() => {
    setOpenFiles([]);
  }, []);

  const isOpen = useCallback(
    (path: string) => openFiles.includes(path),
    [openFiles]
  );

  return { openFiles, add, close, reset, isOpen };
}
