import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const SETTINGS_FILE = join(process.cwd(), ".arch-doc-settings.json");
const ALG = "aes-256-gcm" as const;
const SALT = Buffer.from("arch-doc-v1-salt");

function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY ?? "arch-doc-default-key-v1-insecure";
  if (!process.env.ENCRYPTION_KEY) {
    console.warn("[settings] ENCRYPTION_KEY not set — using insecure default. Set it in .env.");
  }
  return scryptSync(secret, SALT, 32);
}

function encryptValue(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALG, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc1:${iv.toString("hex")}:${ct.toString("hex")}:${tag.toString("hex")}`;
}

function decryptValue(value: string): string | null {
  if (!value.startsWith("enc1:")) return value;
  try {
    const parts = value.slice(5).split(":");
    if (parts.length !== 3) return null;
    const [ivHex, ctHex, tagHex] = parts;
    const key = getKey();
    const decipher = createDecipheriv(ALG, key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    const pt = Buffer.concat([
      decipher.update(Buffer.from(ctHex, "hex")),
      decipher.final(),
    ]);
    return pt.toString("utf8");
  } catch {
    return null;
  }
}

export interface StoredSettings {
  provider: string;
  geminiApiKey: string;
  ollamaUrl: string;
  ollamaApiKey: string;
}

const EMPTY: StoredSettings = {
  provider: "auto",
  geminiApiKey: "",
  ollamaUrl: "",
  ollamaApiKey: "",
};

const SENSITIVE = new Set<keyof StoredSettings>(["geminiApiKey", "ollamaApiKey"]);

function readRaw(): Record<string, string> {
  if (!existsSync(SETTINGS_FILE)) return {};
  try {
    return JSON.parse(readFileSync(SETTINGS_FILE, "utf8")) as Record<string, string>;
  } catch {
    return {};
  }
}

export function readSettings(): StoredSettings {
  const raw = readRaw();
  const result = { ...EMPTY };
  for (const k of Object.keys(EMPTY) as (keyof StoredSettings)[]) {
    const v = raw[k];
    if (!v) continue;
    result[k] = SENSITIVE.has(k) ? (decryptValue(v) ?? "") : v;
  }
  return result;
}

export function writeSettings(patch: Partial<StoredSettings>): void {
  const raw = readRaw();
  const merged: Record<string, string> = { ...raw };

  for (const k of Object.keys(patch) as (keyof StoredSettings)[]) {
    const v = patch[k];
    if (v === undefined) continue;
    if (v === "") {
      delete merged[k];
    } else {
      merged[k] = SENSITIVE.has(k) ? encryptValue(v) : v;
    }
  }

  writeFileSync(SETTINGS_FILE, JSON.stringify(merged, null, 2), "utf8");
}

export function clearSettings(): void {
  if (existsSync(SETTINGS_FILE)) unlinkSync(SETTINGS_FILE);
}
