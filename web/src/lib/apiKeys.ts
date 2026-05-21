export type AIProvider = "auto" | "gemini" | "ollama";

export interface ApiKeyStatus {
  provider: AIProvider;
  ollamaUrl: string;
  hasGeminiKey: boolean;
  hasOllamaKey: boolean;
}

export const DEFAULTS: ApiKeyStatus = {
  provider: "auto",
  ollamaUrl: "",
  hasGeminiKey: false,
  hasOllamaKey: false,
};

export async function fetchApiKeyStatus(): Promise<ApiKeyStatus> {
  try {
    const res = await fetch("/api/settings");
    if (!res.ok) return { ...DEFAULTS };
    return (await res.json()) as ApiKeyStatus;
  } catch {
    return { ...DEFAULTS };
  }
}

export interface SaveSettingsPatch {
  provider?: string;
  geminiApiKey?: string;
  ollamaUrl?: string;
  ollamaApiKey?: string;
}

export async function saveApiKeySettings(patch: SaveSettingsPatch): Promise<void> {
  await fetch("/api/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}

export async function clearApiKeySettings(): Promise<void> {
  await fetch("/api/settings", { method: "DELETE" });
}

export function isValidGeminiKey(key: string): boolean {
  return /^AIza[0-9A-Za-z\-_]{35,}$/.test(key.trim());
}

export function isValidHttpUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
