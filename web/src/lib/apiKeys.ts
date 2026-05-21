import { encrypt, decrypt, isEncrypted } from "./crypto.js";

const STORAGE_PREFIX = "arch-doc:";

export type AIProvider = "auto" | "gemini" | "ollama";

/**
 * "local"   — ciphertext in localStorage, survives restarts (default).
 * "session" — ciphertext in sessionStorage, cleared on tab close (shared machines).
 */
export type StorageMode = "local" | "session";

export interface ApiKeySettings {
  provider: AIProvider;
  // Gemini
  geminiApiKey: string;
  // Ollama / OpenAI-compatible
  ollamaUrl: string;
  ollamaApiKey: string;
  // Storage
  storageMode: StorageMode;
}

export const DEFAULTS: ApiKeySettings = {
  provider: "auto",
  geminiApiKey: "",
  ollamaUrl: "",
  ollamaApiKey: "",
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
  const mode = (localStorage.getItem(storeKey("storageMode")) ?? "local") as StorageMode;
  const store = getStorage(mode);
  return {
    provider:    (store.getItem(storeKey("provider"))     ?? DEFAULTS.provider) as AIProvider,
    geminiApiKey: store.getItem(storeKey("geminiApiKey")) ?? "",
    ollamaUrl:    store.getItem(storeKey("ollamaUrl"))    ?? "",
    ollamaApiKey: store.getItem(storeKey("ollamaApiKey")) ?? "",
    storageMode: mode,
  };
}

/** Decrypt any encrypted fields in `raw`. Silently clears fields that fail decryption. */
export async function decryptSettings(raw: ApiKeySettings): Promise<ApiKeySettings> {
  const result = { ...raw };

  for (const field of SENSITIVE_FIELDS) {
    const value = raw[field] as string;
    if (!value || !isEncrypted(value)) continue;

    const plaintext = await decrypt(value);
    if (plaintext === null) {
      result[field] = "" as never;
      getStorage(raw.storageMode).removeItem(storeKey(field));
    } else {
      result[field] = plaintext as never;
    }
  }

  return result;
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

  localStorage.setItem(storeKey("storageMode"), mode);

  const store = getStorage(mode);
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
  if (settings.provider !== "auto") h["x-ai-provider"]    = settings.provider;
  if (settings.geminiApiKey)        h["x-gemini-api-key"] = settings.geminiApiKey;
  if (settings.ollamaUrl)           h["x-ollama-url"]     = settings.ollamaUrl;
  if (settings.ollamaApiKey)        h["x-ollama-api-key"] = settings.ollamaApiKey;
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
