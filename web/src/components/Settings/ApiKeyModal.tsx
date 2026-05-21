import { useState, useEffect } from "react";
import type { ApiKeyStatus, AIProvider, SaveSettingsPatch } from "../../lib/apiKeys.js";
import { isValidGeminiKey, isValidHttpUrl } from "../../lib/apiKeys.js";

interface ApiKeyModalProps {
  open: boolean;
  settings: ApiKeyStatus;
  onSave: (patch: SaveSettingsPatch) => Promise<void>;
  onClear: () => Promise<void>;
  onClose: () => void;
}

interface FormState {
  provider: AIProvider;
  geminiApiKey: string;
  ollamaUrl: string;
  ollamaApiKey: string;
}

export function ApiKeyModal({ open, settings, onSave, onClear, onClose }: ApiKeyModalProps) {
  const [form, setForm] = useState<FormState>({
    provider: "auto",
    geminiApiKey: "",
    ollamaUrl: "",
    ollamaApiKey: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        provider: settings.provider,
        geminiApiKey: "",
        ollamaUrl: settings.ollamaUrl,
        ollamaApiKey: "",
      });
      setErrors({});
    }
  }, [open, settings]);

  if (!open) return null;

  const set = (field: keyof FormState, value: string) => {
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
      const patch: SaveSettingsPatch = {
        provider: form.provider,
        ollamaUrl: form.ollamaUrl,
      };
      if (form.geminiApiKey) patch.geminiApiKey = form.geminiApiKey;
      if (form.ollamaApiKey) patch.ollamaApiKey = form.ollamaApiKey;
      await onSave(patch);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    await onClear();
    onClose();
  };

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
            {settings.hasGeminiKey && (
              <p style={{ fontSize: 11, color: "#a6e3a1", margin: "0 0 8px" }}>✓ Key saved on server</p>
            )}
            <Field label={settings.hasGeminiKey ? "Replace key" : "API Key"} error={errors.geminiApiKey}>
              <input
                type="password"
                value={form.geminiApiKey}
                onChange={(e) => set("geminiApiKey", e.target.value)}
                placeholder={settings.hasGeminiKey ? "Enter new key to replace…" : "AIza…"}
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
            <Field label="Base URL" error={errors.ollamaUrl}>
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
          API keys are encrypted with AES-256-GCM and stored on the server.
          The browser never holds your keys — not even temporarily.
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <button onClick={handleClear} style={dangerBtn}>Clear all</button>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onClose} style={secondaryBtn}>Cancel</button>
            <button onClick={handleSave} disabled={saving} style={{ ...primaryBtn, opacity: saving ? 0.7 : 1 }}>
              {saving ? "Saving…" : "Save"}
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
