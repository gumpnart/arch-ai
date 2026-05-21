import { createContext, useContext } from "react";
import { useApiKeys } from "../hooks/useApiKeys.js";
import type { ApiKeySettings } from "../lib/apiKeys.js";

export interface ApiKeysContextValue {
  settings: ApiKeySettings;
  headers: Record<string, string>;
  isReady: boolean;
  wasLocked: boolean;
  save: (next: Partial<ApiKeySettings>) => Promise<void>;
  clear: () => void;
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
