import { useState, useEffect } from "react";
import type { ApiKeySettings, AIProvider, StorageMode } from "../../lib/apiKeys.js";
import { isValidGeminiKey, isValidHttpUrl } from "../../lib/apiKeys.js";

interface ApiKeyModalProps {
  open: boolean;
  settings: ApiKeySettings;
  onSave: (next: Partial<ApiKeySettings>) => Promise<void>;
  onClear: () => void;
  onClose: () => void;
}

export function ApiKeyModal({ open, settings, onSave, onClear, onClose }: ApiKeyModalProps) {
  const [form, setForm] = useState<ApiKeySettings>(settings);
  const [errors, setErrors] = useState<Partial<Record<keyof ApiKeySettings, string>>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setForm(settings); setErrors({}); }
  }, [open, settings]);

  if (!open) return null;

  const set = (field: keyof ApiKeySettings, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validate = (): boolean => {
    const next: typeof errors = {};
    if (form.geminiApiKey && !isValidGeminiKey(form.geminiApiKey)) {
      next.geminiApiKey = "Gemini keys start with AIza and are ~40 chars. Check for typos.";
    }
    if (form.ollamaUrl && !isValidHttpUrl(form.ollamaUrl)) {
      next.ollamaUrl = "Must be a valid http:// or https:// URL.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    onClear();
    onClose();
  };

  const isSession = form.storageMode === "session";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: "#1e1e2e",
          border: "1px solid #313244",
          borderRadius: 10,
          width: 480,
          maxWidth: "calc(100vw - 32px)",
          padding: "24px 28px",
          color: "#cdd6f4",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#cba6f7" }}>AI Provider Settings</span>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>

        {/* Provider */}
        <Field label="Provider">
          <select
            value={form.provider}
            onChange={(e) => set("provider", e.target.value as AIProvider)}
            style={selectStyle}
          >
            <option value="auto">Auto (use server env vars)</option>
            <option value="gemini">Gemini</option>
            <option value="ollama">Ollama (local)</option>
          </select>
        </Field>

        {/* Gemini section */}
        {(form.provider === "auto" || form.provider === "gemini") && (
          <>
            <Divider label="Gemini" />
            <Field label="API Key" error={errors.geminiApiKey}>
              <input
                type="password"
                value={form.geminiApiKey}
                onChange={(e) => set("geminiApiKey", e.target.value)}
                placeholder="AIza…"
                style={{ ...inputStyle, borderColor: errors.geminiApiKey ? "#f38ba8" : "#313244" }}
                autoComplete="off"
              />
            </Field>
          </>
        )}

        {/* Ollama section */}
        {(form.provider === "auto" || form.provider === "ollama") && (
          <>
            <Divider label="Ollama" />
            <Field label="Base URL (optional)" error={errors.ollamaUrl}>
              <input
                type="text"
                value={form.ollamaUrl}
                onChange={(e) => set("ollamaUrl", e.target.value)}
                placeholder="http://localhost:11434"
                style={{ ...inputStyle, borderColor: errors.ollamaUrl ? "#f38ba8" : "#313244" }}
              />
            </Field>
</>
        )}

        {/* Storage mode */}
        <Divider label="Storage" />
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <ModeButton
            active={!isSession}
            onClick={() => set("storageMode", "local")}
            label="Persist"
            description="Survives tab/browser restarts. Readable by JS on this page."
          />
          <ModeButton
            active={isSession}
            onClick={() => set("storageMode", "session")}
            label="Session only"
            description="Cleared when tab closes. Reduces risk if you share your machine."
          />
        </div>

        {/* Security notice */}
        <div style={{
          background: "#181825",
          border: "1px solid #313244",
          borderRadius: 6,
          padding: "10px 12px",
          marginBottom: 20,
          fontSize: 11,
          color: "#6c7086",
          lineHeight: 1.6,
        }}>
          <strong style={{ color: "#a6adc8" }}>Security notice</strong><br />
          Your API key is encrypted with AES-256-GCM before being written to{" "}
          {isSession ? "sessionStorage" : "localStorage"}.
          The encryption key is stored in IndexedDB (non-extractable — its raw bytes cannot be read by JavaScript)
          and persists across restarts, so you only need to enter your key once.{" "}
          {isSession
            ? "Session mode: the ciphertext is cleared when the tab closes."
            : "Local mode: the ciphertext survives restarts and is decrypted automatically."
          }{" "}
          Encryption does not protect against XSS on this page.
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <button onClick={handleClear} style={dangerBtn}>Clear all</button>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onClose} style={secondaryBtn}>Cancel</button>
            <button onClick={handleSave} disabled={saving} style={{ ...primaryBtn, opacity: saving ? 0.7 : 1 }}>
              {saving ? "Encrypting…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 12, color: "#a6adc8", marginBottom: 5 }}>{label}</label>
      {children}
      {error && (
        <p style={{ margin: "4px 0 0", fontSize: 11, color: "#f38ba8" }}>{error}</p>
      )}
    </div>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "16px 0 12px" }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: "#6c7086", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: "#313244" }} />
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  label,
  description,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  description: string;
}) {
  return (
    <button
      onClick={onClick}
      title={description}
      style={{
        flex: 1,
        padding: "8px 10px",
        background: active ? "#313244" : "#181825",
        border: `1px solid ${active ? "#cba6f7" : "#313244"}`,
        borderRadius: 6,
        color: active ? "#cba6f7" : "#6c7086",
        fontSize: 12,
        fontWeight: active ? 600 : 400,
        cursor: "pointer",
        textAlign: "left" as const,
      }}
    >
      <div>{label}</div>
      <div style={{ fontSize: 10, marginTop: 2, opacity: 0.8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {description}
      </div>
    </button>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "#181825",
  border: "1px solid #313244",
  borderRadius: 6,
  padding: "7px 10px",
  color: "#cdd6f4",
  fontSize: 13,
  outline: "none",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: "pointer",
};

const closeBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "#6c7086",
  cursor: "pointer",
  fontSize: 16,
  padding: "0 4px",
};

const primaryBtn: React.CSSProperties = {
  background: "#cba6f7",
  color: "#1e1e2e",
  border: "none",
  borderRadius: 6,
  padding: "7px 18px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const secondaryBtn: React.CSSProperties = {
  background: "none",
  color: "#a6adc8",
  border: "1px solid #313244",
  borderRadius: 6,
  padding: "7px 14px",
  fontSize: 13,
  cursor: "pointer",
};

const dangerBtn: React.CSSProperties = {
  background: "none",
  color: "#f38ba8",
  border: "1px solid #313244",
  borderRadius: 6,
  padding: "7px 14px",
  fontSize: 13,
  cursor: "pointer",
};
