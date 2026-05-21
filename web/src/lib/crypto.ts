/**
 * AES-256-GCM encryption with a key derived via PBKDF2 from
 * VITE_ENCRYPTION_SECRET (set at build time via env var).
 *
 * Threat model
 * ─────────────
 * ✅ localStorage / Chrome-Sync dump  — ciphertext is useless without the key.
 * ✅ Key is deterministic from env var — no IndexedDB loss scenario.
 * ⚠  VITE_ vars are baked into the bundle — set a strong secret per deployment.
 * ❌ Same-page XSS calling decrypt()  — same-origin JS can call our decrypt
 *    helper; no browser-only solution exists without a server.
 */

const ENC_PREFIX = "enc1:";
const SALT = new TextEncoder().encode("arch-doc-v1-pbkdf2");

let _key: CryptoKey | null = null;

async function getKey(): Promise<CryptoKey> {
  if (_key) return _key;

  const secret =
    (import.meta.env as Record<string, string>).VITE_ENCRYPTION_SECRET ||
    "arch-doc-default-enc-secret-v1";

  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  _key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: SALT, iterations: 100_000, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );

  return _key;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function fromB64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Encrypt a plaintext string. Returns `enc1:<iv_b64>:<ct_b64>`. */
export async function encrypt(plaintext: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  return `${ENC_PREFIX}${toB64(iv)}:${toB64(ct)}`;
}

/**
 * Decrypt a value produced by `encrypt()`.
 * Returns `null` if decryption fails (e.g. wrong key, corrupted data).
 */
export async function decrypt(value: string): Promise<string | null> {
  if (!value.startsWith(ENC_PREFIX)) return value;
  try {
    const rest = value.slice(ENC_PREFIX.length);
    const colon = rest.indexOf(":");
    if (colon === -1) return null;
    const iv = fromB64(rest.slice(0, colon));
    const ct = fromB64(rest.slice(colon + 1));
    const key = await getKey();
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      key,
      ct as BufferSource,
    );
    return new TextDecoder().decode(pt);
  } catch {
    return null;
  }
}

export const isEncrypted = (v: string) => v.startsWith(ENC_PREFIX);
