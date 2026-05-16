import { useState, useEffect, useCallback } from "react";
import { getFiles, type FileNode } from "../api/client.js";

export function useVaultFiles() {
  const [tree, setTree] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getFiles();
      setTree(data.tree);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { tree, loading, error, reload };
}
