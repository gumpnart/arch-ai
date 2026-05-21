import { useState, useEffect, useCallback } from "react";
import {
  DEFAULTS,
  loadRawSettings,
  decryptSettings,
  saveApiKeySettings,
  clearApiKeySettings,
  buildAIHeaders,
  type ApiKeySettings,
} from "../lib/apiKeys.js";

interface UseApiKeysResult {
  settings: ApiKeySettings;
  headers: Record<string, string>;
  /** True once the initial async decryption pass is complete. */
  isReady: boolean;
  save: (next: Partial<ApiKeySettings>) => Promise<void>;
  clear: () => void;
}

export function useApiKeys(): UseApiKeysResult {
  const [settings, setSettings] = useState<ApiKeySettings>(DEFAULTS);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      const raw = loadRawSettings();
      const decrypted = await decryptSettings(raw);
      if (cancelled) return;
      setSettings(decrypted);
      setIsReady(true);
    }
    init();
    return () => { cancelled = true; };
  }, []);

  const save = useCallback(async (next: Partial<ApiKeySettings>) => {
    await saveApiKeySettings(next, settings);
    const raw = loadRawSettings();
    const decrypted = await decryptSettings(raw);
    setSettings(decrypted);
  }, [settings]);

  const clear = useCallback(() => {
    clearApiKeySettings();
    setSettings(DEFAULTS);
  }, []);

  return {
    settings,
    headers: buildAIHeaders(settings),
    isReady,
    save,
    clear,
  };
}
