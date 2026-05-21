/**
 * AES-256-GCM encryption backed by a persistent, non-extractable CryptoKey
 * stored in IndexedDB.
 *
 * Threat model
 * ─────────────
 * ✅ localStorage / Chrome-Sync dump  — ciphertext is useless without the
 *    IndexedDB key (the two stores are synced independently).
 * ✅ Key exfiltration via XSS         — extractable:false means exportKey()
 *    throws; an attacker can decrypt on-page but cannot steal the raw key
 *    for offline use.
 * ❌ Same-page XSS calling decrypt()  — same-origin JS can call our decrypt
 *    helper; no browser-only solution exists without a server.
 *
 * The key is generated once per browser profile and persists until the user
 * explicitly clears site data (IndexedDB). If that happens, stored ciphertexts
 * become unreadable; the hook will detect this and prompt re-entry.
 */

const DB_NAME    = "arch-doc-vault";
const DB_VERSION = 1;
const STORE_NAME = "keys";
const KEY_ID     = "api-enc-key";
const ENC_PREFIX = "enc1:";

let _key: CryptoKey | null = null;

// ── IndexedDB helpers ─────────────────────────────────────────────────────────

function openVaultDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

function idbGet<T>(db: IDBDatabase, id: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(id);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror   = () => reject(req.error);
  });
}

function idbPut(db: IDBDatabase, id: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(value, id);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

// ── Key management ────────────────────────────────────────────────────────────

async function getOrCreateKey(): Promise<CryptoKey> {
  if (_key) return _key;

  const db = await openVaultDB();
  const existing = await idbGet<CryptoKey>(db, KEY_ID);

  if (existing) {
    _key = existing;
    return _key;
  }

  // extractable: false — exportKey() throws, so the raw key bytes can never
  // be read out of the browser even by JavaScript running on this page.
  _key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );

  await idbPut(db, KEY_ID, _key);
  return _key;
}

// ── Public API ────────────────────────────────────────────────────────────────

function toB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function fromB64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/** Encrypt a plaintext string. Returns `enc1:<iv_b64>:<ct_b64>`. */
export async function encrypt(plaintext: string): Promise<string> {
  const key = await getOrCreateKey();
  const iv  = crypto.getRandomValues(new Uint8Array(12));
  const ct  = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  return `${ENC_PREFIX}${toB64(iv)}:${toB64(ct)}`;
}

/**
 * Decrypt a value produced by `encrypt()`.
 * - Returns the original string if the value is not encrypted (plain passthrough).
 * - Returns `null` if decryption fails (key lost — site data cleared).
 */
export async function decrypt(value: string): Promise<string | null> {
  if (!value.startsWith(ENC_PREFIX)) return value;
  try {
    const rest  = value.slice(ENC_PREFIX.length);
    const colon = rest.indexOf(":");
    if (colon === -1) return null;
    const iv = fromB64(rest.slice(0, colon));
    const ct = fromB64(rest.slice(colon + 1));
    const key = await getOrCreateKey();
    const pt  = await crypto.subtle.decrypt(
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
