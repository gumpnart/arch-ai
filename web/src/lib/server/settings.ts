export interface StoredSettings {
  provider: string;
  geminiApiKey: string;
  ollamaUrl: string;
  ollamaApiKey: string;
}

const ALG = "aes-256-gcm" as const;
const SALT_HEX = "617263682d646f632d76312d73616c74"; // "arch-doc-v1-salt"

const SENSITIVE = new Set<keyof StoredSettings>(["geminiApiKey", "ollamaApiKey"]);

const EMPTY: StoredSettings = {
  provider: "auto",
  geminiApiKey: "",
  ollamaUrl: "",
  ollamaApiKey: "",
};

// Lazy-load Node.js modules so this file is safe to import in browser bundles.
// All functions are async; route handlers already await them.
async function getKey(): Promise<Buffer> {
  const { scryptSync } = await import("node:crypto");
  const secret = process.env.ENCRYPTION_KEY ?? "arch-doc-default-key-v1-insecure";
  if (!process.env.ENCRYPTION_KEY) {
    console.warn("[settings] ENCRYPTION_KEY not set — using insecure default. Set it in .env.");
  }
  return scryptSync(secret, Buffer.from(SALT_HEX, "hex"), 32) as Buffer;
}

async function encryptValue(plaintext: string): Promise<string> {
  const { createCipheriv, randomBytes } = await import("node:crypto");
  const key = await getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALG, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc1:${iv.toString("hex")}:${ct.toString("hex")}:${tag.toString("hex")}`;
}

async function decryptValue(value: string): Promise<string | null> {
  if (!value.startsWith("enc1:")) return value;
  try {
    const { createDecipheriv } = await import("node:crypto");
    const parts = value.slice(5).split(":");
    if (parts.length !== 3) return null;
    const [ivHex, ctHex, tagHex] = parts;
    const key = await getKey();
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

async function readRaw(): Promise<Record<string, string>> {
  const { existsSync, readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const file = join(process.cwd(), ".arch-doc-settings.json");
  if (!existsSync(file)) return {};
  try {
    return JSON.parse(readFileSync(file, "utf8")) as Record<string, string>;
  } catch {
    return {};
  }
}

export async function readSettings(): Promise<StoredSettings> {
  const raw = await readRaw();
  const result = { ...EMPTY };
  for (const k of Object.keys(EMPTY) as (keyof StoredSettings)[]) {
    const v = raw[k];
    if (!v) continue;
    result[k] = SENSITIVE.has(k) ? ((await decryptValue(v)) ?? "") : v;
  }
  return result;
}

export async function writeSettings(patch: Partial<StoredSettings>): Promise<void> {
  const { writeFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const file = join(process.cwd(), ".arch-doc-settings.json");
  const raw = await readRaw();
  const merged: Record<string, string> = { ...raw };
  for (const k of Object.keys(patch) as (keyof StoredSettings)[]) {
    const v = patch[k];
    if (v === undefined) continue;
    if (v === "") {
      delete merged[k];
    } else {
      merged[k] = SENSITIVE.has(k) ? await encryptValue(v) : v;
    }
  }
  writeFileSync(file, JSON.stringify(merged, null, 2), "utf8");
}

export async function clearSettings(): Promise<void> {
  const { existsSync, unlinkSync } = await import("node:fs");
  const { join } = await import("node:path");
  const file = join(process.cwd(), ".arch-doc-settings.json");
  if (existsSync(file)) unlinkSync(file);
}
