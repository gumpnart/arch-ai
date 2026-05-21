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
  /**
   * True when persistent encrypted data was found but the session key was
   * missing (tab restarted). The affected secrets were cleared; user must
   * re-enter them via the settings modal.
   */
  wasLocked: boolean;
  save: (next: Partial<ApiKeySettings>) => Promise<void>;
  clear: () => void;
}

export function useApiKeys(): UseApiKeysResult {
  const [settings, setSettings] = useState<ApiKeySettings>(DEFAULTS);
  const [isReady, setIsReady] = useState(false);
  const [wasLocked, setWasLocked] = useState(false);

  // Decrypt on mount — async because Web Crypto API is always async.
  useEffect(() => {
    let cancelled = false;
    async function init() {
      const raw = loadRawSettings();
      const { settings: decrypted, wasLocked: locked } = await decryptSettings(raw);
      if (cancelled) return;
      setSettings(decrypted);
      setWasLocked(locked);
      setIsReady(true);
    }
    init();
    return () => { cancelled = true; };
  }, []);

  const save = useCallback(async (next: Partial<ApiKeySettings>) => {
    await saveApiKeySettings(next, settings);
    // Re-decrypt immediately so in-memory state reflects the saved plaintext.
    const raw = loadRawSettings();
    const { settings: decrypted } = await decryptSettings(raw);
    setSettings(decrypted);
    setWasLocked(false);
  }, [settings]);

  const clear = useCallback(() => {
    clearApiKeySettings();
    setSettings(DEFAULTS);
    setWasLocked(false);
  }, []);

  return {
    settings,
    headers: buildAIHeaders(settings),
    isReady,
    wasLocked,
    save,
    clear,
  };
}
