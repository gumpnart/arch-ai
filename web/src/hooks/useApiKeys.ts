import { useState, useEffect, useCallback } from "react";
import {
  DEFAULTS,
  fetchApiKeyStatus,
  saveApiKeySettings,
  clearApiKeySettings,
  type ApiKeyStatus,
  type SaveSettingsPatch,
} from "../lib/apiKeys.js";

export interface UseApiKeysResult {
  settings: ApiKeyStatus;
  isReady: boolean;
  save: (patch: SaveSettingsPatch) => Promise<void>;
  clear: () => Promise<void>;
}

export function useApiKeys(): UseApiKeysResult {
  const [settings, setSettings] = useState<ApiKeyStatus>(DEFAULTS);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    fetchApiKeyStatus().then((s) => {
      setSettings(s);
      setIsReady(true);
    });
  }, []);

  const save = useCallback(async (patch: SaveSettingsPatch) => {
    await saveApiKeySettings(patch);
    const updated = await fetchApiKeyStatus();
    setSettings(updated);
  }, []);

  const clear = useCallback(async () => {
    await clearApiKeySettings();
    setSettings(DEFAULTS);
  }, []);

  return { settings, isReady, save, clear };
}
