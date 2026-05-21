import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ShieldCheck } from "@phosphor-icons/react";
import { useApiKeysContext } from "../../contexts/ApiKeysContext.js";
import {
  isValidGeminiKey,
  isValidHttpUrl,
  type AIProvider,
} from "../../lib/apiKeys.js";

// ── Page shell ────────────────────────────────────────────────────────────────

export function SettingsPage() {
  const [activeSection, setActiveSection] = useState<"ai">("ai");

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "var(--font-sans)", background: "var(--editor-bg)" }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: 200, flexShrink: 0,
        background: "var(--panel-bg)",
        borderRight: "1px solid var(--panel-border)",
        display: "flex", flexDirection: "column",
      }}>
        <Link
          to="/"
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "14px 16px",
            color: "var(--text-2)", fontSize: 13, textDecoration: "none",
            borderBottom: "1px solid var(--panel-border)",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-1)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-2)")}
        >
          <ArrowLeft size={14} />
          Back to editor
        </Link>
        <nav style={{ padding: "12px 8px" }}>
          <NavLabel>Configuration</NavLabel>
          <NavItem active={activeSection === "ai"} onClick={() => setActiveSection("ai")}>
            AI Provider
          </NavItem>
        </nav>
      </aside>

      {/* ── Content ── */}
      <main style={{ flex: 1, overflow: "auto" }}>
        <div style={{ maxWidth: 660, margin: "0 auto", padding: "40px 48px" }}>
          {activeSection === "ai" && <AIProviderSection />}
        </div>
      </main>
    </div>
  );
}

// ── Connection status ─────────────────────────────────────────────────────────

type ConnectionStatus =
  | { state: "idle" }
  | { state: "testing" }
  | { state: "ok"; provider: string; latencyMs?: number }
  | { state: "error"; message: string };

// ── Form state (local only — keys are never stored client-side) ───────────────

interface FormState {
  provider: AIProvider;
  geminiApiKey: string;
  ollamaUrl: string;
  ollamaApiKey: string;
}

type FormErrors = Partial<Record<keyof FormState, string>>;

// ── AI Provider section ───────────────────────────────────────────────────────

function AIProviderSection() {
  const { settings, save, clear, isReady } = useApiKeysContext();

  const [form, setForm] = useState<FormState>({
    provider: "auto",
    geminiApiKey: "",
    ollamaUrl: "",
    ollamaApiKey: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [connStatus, setConnStatus] = useState<ConnectionStatus>({ state: "idle" });

  useEffect(() => {
    if (isReady) {
      setForm((prev) => ({
        ...prev,
        provider: settings.provider,
        ollamaUrl: settings.ollamaUrl,
      }));
    }
  }, [isReady, settings.provider, settings.ollamaUrl]);

  const set = (field: keyof FormState, value: string) => {
    setForm((p) => ({ ...p, [field]: value }));
    setErrors((p) => ({ ...p, [field]: undefined }));
    setConnStatus({ state: "idle" });
  };

  const validate = (): boolean => {
    const next: FormErrors = {};
    if (form.geminiApiKey && !isValidGeminiKey(form.geminiApiKey))
      next.geminiApiKey = "Gemini keys start with AIza and are ~40 chars.";
    if (form.ollamaUrl && !isValidHttpUrl(form.ollamaUrl))
      next.ollamaUrl = "Must be a valid http:// or https:// URL.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    setConnStatus({ state: "idle" });
    try {
      // Build patch — only include key fields if the user typed a value.
      // Empty key field = keep existing server key (don't overwrite with blank).
      const patch: Parameters<typeof save>[0] = {
        provider: form.provider,
        ollamaUrl: form.ollamaUrl,
      };
      if (form.geminiApiKey) patch.geminiApiKey = form.geminiApiKey;
      if (form.ollamaApiKey) patch.ollamaApiKey = form.ollamaApiKey;

      await save(patch);

      // Clear key inputs after save — the server holds them now
      setForm((prev) => ({ ...prev, geminiApiKey: "", ollamaApiKey: "" }));

      // Test connection with freshly saved settings
      setConnStatus({ state: "testing" });
      const res = await fetch("/api/ai/ping", { method: "POST" });
      const json = (await res.json()) as { ok: boolean; provider?: string; latencyMs?: number; error?: string };

      if (json.ok) {
        setConnStatus({ state: "ok", provider: json.provider ?? "unknown", latencyMs: json.latencyMs });
      } else {
        setConnStatus({ state: "error", message: json.error ?? "Connection failed" });
      }
    } catch (err) {
      setConnStatus({ state: "error", message: String(err) });
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    await clear();
    setForm({ provider: "auto", geminiApiKey: "", ollamaUrl: "", ollamaApiKey: "" });
    setConnStatus({ state: "idle" });
  };

  const showGemini = form.provider === "auto" || form.provider === "gemini";
  const showOllama = form.provider === "auto" || form.provider === "ollama";

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-1)", margin: "0 0 4px" }}>
        AI Provider
      </h1>
      <p style={{ fontSize: 13, color: "var(--text-3)", margin: "0 0 32px", lineHeight: 1.6 }}>
        Configure the AI service that powers the AI Assistant block.
        API keys are encrypted with AES-256-GCM and stored on the server — never in the browser.
      </p>

      {/* Provider selector */}
      <Section title="Provider">
        <Field label="Active provider">
          <Select
            value={form.provider}
            onChange={(v) => set("provider", v as AIProvider)}
            options={[
              { value: "auto",   label: "Auto — server env vars, then saved key" },
              { value: "gemini", label: "Gemini" },
              { value: "ollama", label: "Ollama / OpenAI-compatible" },
            ]}
          />
        </Field>
      </Section>

      {/* Gemini */}
      {showGemini && (
        <Section title="Gemini">
          <Field
            label="API Key"
            hint="From Google AI Studio (aistudio.google.com)"
            error={errors.geminiApiKey}
          >
            {settings.hasGeminiKey && !form.geminiApiKey && (
              <KeySavedBadge onReplace={() => set("geminiApiKey", "")} />
            )}
            <TextInput
              type="password"
              value={form.geminiApiKey}
              onChange={(v) => set("geminiApiKey", v)}
              placeholder={settings.hasGeminiKey ? "Enter new key to replace…" : "AIza…"}
              invalid={!!errors.geminiApiKey}
              autoComplete="off"
            />
          </Field>
        </Section>
      )}

      {/* Ollama / OpenAI-compatible */}
      {showOllama && (
        <Section title="Ollama / OpenAI-compatible">
          <Field
            label="Base URL"
            hint="Required — base URL of the Ollama or OpenAI-compatible server"
            error={errors.ollamaUrl}
          >
            <TextInput
              value={form.ollamaUrl}
              onChange={(v) => set("ollamaUrl", v)}
              placeholder="http://localhost:11434"
              invalid={!!errors.ollamaUrl}
            />
          </Field>
          <Field
            label="API Key"
            hint="Optional — only needed for authenticated endpoints (e.g. Groq, OpenRouter)"
          >
            {settings.hasOllamaKey && !form.ollamaApiKey && (
              <KeySavedBadge onReplace={() => set("ollamaApiKey", "")} />
            )}
            <TextInput
              type="password"
              value={form.ollamaApiKey}
              onChange={(v) => set("ollamaApiKey", v)}
              placeholder={settings.hasOllamaKey ? "Enter new key to replace…" : "sk-…"}
              autoComplete="off"
            />
          </Field>
        </Section>
      )}

      {/* Security notice */}
      <Banner variant="success">
        <ShieldCheck size={15} weight="fill" style={{ flexShrink: 0 }} />
        <span>
          API keys are encrypted with AES-256-GCM on the server using a key derived from{" "}
          <code style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>ENCRYPTION_KEY</code>.
          Keys never leave the server — the browser holds no secrets.
        </span>
      </Banner>

      {/* Actions */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 8 }}>
        <button onClick={handleClear} style={dangerBtnStyle}>Clear all keys</button>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <ConnectionBadge status={connStatus} />
          <button onClick={handleSave} disabled={saving} style={{ ...primaryBtnStyle, opacity: saving ? 0.7 : 1 }}>
            {saving ? (connStatus.state === "testing" ? "Testing…" : "Saving…") : "Save & test"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Key saved badge ───────────────────────────────────────────────────────────

function KeySavedBadge({ onReplace }: { onReplace: () => void }) {
  void onReplace;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      fontSize: 12, color: "#16a34a", marginBottom: 6,
    }}>
      <span style={{ fontSize: 13 }}>✓</span>
      Key saved on server
    </div>
  );
}

// ── Connection badge ──────────────────────────────────────────────────────────

function ConnectionBadge({ status }: { status: ConnectionStatus }) {
  if (status.state === "idle") return null;

  if (status.state === "testing") {
    return (
      <span style={{ fontSize: 12, color: "var(--text-3)", display: "flex", alignItems: "center", gap: 5 }}>
        <SpinnerDot />
        Testing connection…
      </span>
    );
  }

  if (status.state === "ok") {
    const label = status.latencyMs != null
      ? `Connected via ${status.provider} (${status.latencyMs}ms)`
      : `Connected via ${status.provider}`;
    return (
      <span style={{ fontSize: 12, color: "#16a34a", display: "flex", alignItems: "center", gap: 5 }}>
        <span style={{ fontSize: 14 }}>✓</span>
        {label}
      </span>
    );
  }

  return (
    <span style={{ fontSize: 12, color: "#dc2626", maxWidth: 260, lineHeight: 1.4 }}>
      ✗ {status.message}
    </span>
  );
}

function SpinnerDot() {
  return (
    <span style={{
      display: "inline-block", width: 8, height: 8, borderRadius: "50%",
      border: "2px solid var(--text-3)", borderTopColor: "transparent",
      animation: "spin 0.7s linear infinite",
    }} />
  );
}

// ── Layout primitives ─────────────────────────────────────────────────────────

function NavLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 600, color: "var(--text-3)",
      textTransform: "uppercase", letterSpacing: "0.08em",
      padding: "4px 8px 6px",
    }}>{children}</div>
  );
}

function NavItem({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      width: "100%", textAlign: "left",
      padding: "7px 10px", borderRadius: 6, border: "none",
      background: active ? "var(--active-row-bg)" : "none",
      color: active ? "var(--accent)" : "var(--text-2)",
      fontSize: 13, fontWeight: active ? 500 : 400,
      cursor: "pointer", fontFamily: "var(--font-sans)",
    }}>{children}</button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>
          {title}
        </span>
        <div style={{ flex: 1, height: 1, background: "var(--border-mid)" }} />
      </div>
      {children}
    </div>
  );
}

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: "8px 16px", marginBottom: 16, alignItems: "start" }}>
      <div style={{ paddingTop: 8 }}>
        <div style={{ fontSize: 13, color: "var(--text-1)", fontWeight: 500 }}>{label}</div>
        {hint && <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 3, lineHeight: 1.5 }}>{hint}</div>}
      </div>
      <div>
        {children}
        {error && <p style={{ margin: "4px 0 0", fontSize: 11, color: "#dc2626" }}>{error}</p>}
      </div>
    </div>
  );
}

function TextInput({ value, onChange, placeholder, type = "text", invalid, autoComplete }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
  type?: string; invalid?: boolean; autoComplete?: string;
}) {
  const border = invalid ? "#fca5a5" : "var(--border-mid)";
  return (
    <input
      type={type} value={value} placeholder={placeholder}
      autoComplete={autoComplete}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%", boxSizing: "border-box",
        padding: "7px 10px", borderRadius: 6, border: `1px solid ${border}`,
        fontSize: 13, color: "var(--text-1)",
        background: invalid ? "#fff5f5" : "#fff",
        outline: "none", fontFamily: "var(--font-sans)",
      }}
      onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "0 0 0 3px #dbeafe"; }}
      onBlur={(e)  => { e.currentTarget.style.borderColor = border;          e.currentTarget.style.boxShadow = "none"; }}
    />
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={{
      width: "100%", boxSizing: "border-box", padding: "7px 10px",
      border: "1px solid var(--border-mid)", borderRadius: 6,
      fontSize: 13, color: "var(--text-1)", background: "#fff",
      cursor: "pointer", outline: "none", fontFamily: "var(--font-sans)",
    }}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function Banner({ variant, children }: { variant: "warn" | "success"; children: React.ReactNode }) {
  const styles = variant === "warn"
    ? { bg: "#fffbeb", border: "#fde68a", color: "#92400e" }
    : { bg: "#f0fdf4", border: "#bbf7d0", color: "#166534" };
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 10,
      background: styles.bg, border: `1px solid ${styles.border}`,
      borderRadius: 8, padding: "12px 14px", margin: "0 0 28px",
      fontSize: 12, color: styles.color, lineHeight: 1.6,
    }}>
      {children}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const primaryBtnStyle: React.CSSProperties = {
  background: "var(--accent)", color: "#fff", border: "none",
  borderRadius: 6, padding: "8px 20px", fontSize: 13,
  fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)",
};

const dangerBtnStyle: React.CSSProperties = {
  background: "none", color: "#dc2626", border: "1px solid #fca5a5",
  borderRadius: 6, padding: "8px 16px", fontSize: 13,
  cursor: "pointer", fontFamily: "var(--font-sans)",
};
