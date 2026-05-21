import { createContext, useContext } from "react";
import { useApiKeys } from "../hooks/useApiKeys.js";
import type { ApiKeyStatus, SaveSettingsPatch } from "../lib/apiKeys.js";

export interface ApiKeysContextValue {
  settings: ApiKeyStatus;
  isReady: boolean;
  save: (patch: SaveSettingsPatch) => Promise<void>;
  clear: () => Promise<void>;
}

export const ApiKeysContext = createContext<ApiKeysContextValue | null>(null);

export function ApiKeysProvider({ children }: { children: React.ReactNode }) {
  const value = useApiKeys();
  return <ApiKeysContext.Provider value={value}>{children}</ApiKeysContext.Provider>;
}

export function useApiKeysContext(): ApiKeysContextValue {
  const ctx = useContext(ApiKeysContext);
  if (!ctx) throw new Error("useApiKeysContext must be used within <ApiKeysProvider>");
  return ctx;
}
