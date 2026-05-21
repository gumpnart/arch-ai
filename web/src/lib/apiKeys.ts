import { encrypt, decrypt, isEncrypted } from "./crypto.js";

const STORAGE_PREFIX = "arch-doc:";

export type AIProvider = "auto" | "gemini" | "ollama";

/**
 * "local"   — ciphertext in localStorage, survives restarts (default).
 * "session" — ciphertext in sessionStorage, cleared on tab close (shared machines).
 * Either way the encryption key lives in IndexedDB and persists across sessions.
 */
export type StorageMode = "local" | "session";

export interface ApiKeySettings {
  provider: AIProvider;
  // Gemini
  geminiApiKey: string;
  geminiModel: string;
  // Ollama / OpenAI-compatible
  ollamaUrl: string;
  ollamaApiKey: string;
  ollamaModel: string;
  // Storage
  storageMode: StorageMode;
}

export const DEFAULTS: ApiKeySettings = {
  provider: "auto",
  geminiApiKey: "",
  geminiModel: "",
  ollamaUrl: "",
  ollamaApiKey: "",
  ollamaModel: "",
  storageMode: "local",
};

// Only these fields are encrypted before being written to storage.
const SENSITIVE_FIELDS: ReadonlySet<keyof ApiKeySettings> = new Set(["geminiApiKey", "ollamaApiKey"]);

function storeKey(field: keyof ApiKeySettings) {
  return `${STORAGE_PREFIX}${field}`;
}

function getStorage(mode: StorageMode): Storage {
  return mode === "session" ? sessionStorage : localStorage;
}

/** Read raw (possibly still-encrypted) values from storage — synchronous. */
export function loadRawSettings(): ApiKeySettings {
  // storageMode is always in localStorage so we know which store to open.
  const mode = (localStorage.getItem(storeKey("storageMode")) ?? "local") as StorageMode;
  const store = getStorage(mode);
  return {
    provider:      (store.getItem(storeKey("provider"))     ?? DEFAULTS.provider) as AIProvider,
    geminiApiKey:   store.getItem(storeKey("geminiApiKey")) ?? "",
    geminiModel:    store.getItem(storeKey("geminiModel"))  ?? "",
    ollamaUrl:      store.getItem(storeKey("ollamaUrl"))    ?? "",
    ollamaApiKey:   store.getItem(storeKey("ollamaApiKey")) ?? "",
    ollamaModel:    store.getItem(storeKey("ollamaModel"))  ?? "",
    storageMode: mode,
  };
}

/**
 * Decrypt any encrypted fields in `raw`.
 * Returns `{ settings, wasLocked }`.
 * `wasLocked = true` means IndexedDB was cleared — those fields are wiped
 * and the user will be prompted to re-enter them.
 */
export async function decryptSettings(
  raw: ApiKeySettings,
): Promise<{ settings: ApiKeySettings; wasLocked: boolean }> {
  let wasLocked = false;
  const result = { ...raw };

  for (const field of SENSITIVE_FIELDS) {
    const value = raw[field] as string;
    if (!value || !isEncrypted(value)) continue;

    const plaintext = await decrypt(value);
    if (plaintext === null) {
      // Encryption key gone (IndexedDB cleared) — remove the unreadable blob.
      result[field] = "" as never;
      wasLocked = true;
      getStorage(raw.storageMode).removeItem(storeKey(field));
    } else {
      result[field] = plaintext as never;
    }
  }

  return { settings: result, wasLocked };
}

/** Encrypt sensitive fields and write all settings to storage. */
export async function saveApiKeySettings(
  next: Partial<ApiKeySettings>,
  current: ApiKeySettings = loadRawSettings(),
): Promise<void> {
  const mode: StorageMode = next.storageMode ?? current.storageMode;

  if (next.storageMode && next.storageMode !== current.storageMode) {
    clearApiKeySettings();
  }

  // storageMode pointer always lives in localStorage.
  localStorage.setItem(storeKey("storageMode"), mode);

  const store  = getStorage(mode);
  const merged = { ...current, ...next, storageMode: mode };

  for (const field of Object.keys(DEFAULTS) as (keyof ApiKeySettings)[]) {
    if (field === "storageMode") continue;
    const value = merged[field] as string;
    if (!value) { store.removeItem(storeKey(field)); continue; }
    const stored = SENSITIVE_FIELDS.has(field) ? await encrypt(value) : value;
    store.setItem(storeKey(field), stored);
  }
}

export function clearApiKeySettings(): void {
  for (const field of Object.keys(DEFAULTS) as (keyof ApiKeySettings)[]) {
    localStorage.removeItem(storeKey(field));
    sessionStorage.removeItem(storeKey(field));
  }
}

export function buildAIHeaders(settings: ApiKeySettings): Record<string, string> {
  const h: Record<string, string> = {};
  if (settings.provider !== "auto") h["x-ai-provider"]       = settings.provider;
  if (settings.geminiApiKey)        h["x-gemini-api-key"]    = settings.geminiApiKey;
  if (settings.geminiModel)         h["x-gemini-model"]      = settings.geminiModel;
  if (settings.ollamaUrl)           h["x-ollama-url"]        = settings.ollamaUrl;
  if (settings.ollamaApiKey)        h["x-ollama-api-key"]    = settings.ollamaApiKey;
  if (settings.ollamaModel)         h["x-ollama-model"]      = settings.ollamaModel;
  return h;
}

export function isValidGeminiKey(key: string): boolean {
  return /^AIza[0-9A-Za-z\-_]{35,}$/.test(key.trim());
}

export function isValidHttpUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch { return false; }
}
