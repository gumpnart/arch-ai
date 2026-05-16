import { useState, useCallback } from "react";
import { getFile, saveFile } from "../api/client.js";

export function useVaultFile(filePath: string | null) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isDirty, setIsDirty] = useState(false);

  const load = useCallback(async (path: string) => {
    setLoading(true);
    setError("");
    setIsDirty(false);
    try {
      const data = await getFile(path);
      setContent(data.content);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const save = useCallback(async (path: string, newContent: string) => {
    try {
      await saveFile(path, newContent);
      setContent(newContent);
      setIsDirty(false);
      return true;
    } catch (err) {
      setError(String(err));
      return false;
    }
  }, []);

  return { content, loading, error, isDirty, setIsDirty, load, save };
}
