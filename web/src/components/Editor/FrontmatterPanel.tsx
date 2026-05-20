import type { Frontmatter } from "../../lib/frontmatter.js";

interface FrontmatterPanelProps {
  frontmatter: Frontmatter;
  onChange: (fm: Frontmatter) => void;
}

export function FrontmatterPanel({ frontmatter, onChange }: FrontmatterPanelProps) {
  const update = (key: string, value: unknown) =>
    onChange({ ...frontmatter, [key]: value });

  return (
    <aside style={{
      width: 224,
      borderLeft: "1px solid var(--border)",
      background: "var(--panel-bg)",
      padding: "16px 14px",
      overflow: "auto",
      flexShrink: 0,
    }}>
      <div style={{
        fontSize: 10,
        fontWeight: 700,
        color: "var(--text-3)",
        marginBottom: 14,
        textTransform: "uppercase",
        letterSpacing: "0.07em",
      }}>
        Properties
      </div>

      <Field label="Title">
        <input
          value={(frontmatter.title as string) ?? ""}
          onChange={(e) => update("title", e.target.value)}
          style={inputStyle}
        />
      </Field>

      <Field label="Status">
        <select
          value={(frontmatter.status as string) ?? "draft"}
          onChange={(e) => update("status", e.target.value)}
          style={inputStyle}
        >
          {["draft", "in-review", "stable", "deprecated"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </Field>

      <Field label="Owner">
        <input
          value={(frontmatter.owner as string) ?? ""}
          onChange={(e) => update("owner", e.target.value)}
          style={inputStyle}
        />
      </Field>

      <Field label="Tags">
        <input
          placeholder="comma-separated"
          value={Array.isArray(frontmatter.tags) ? frontmatter.tags.join(", ") : ""}
          onChange={(e) =>
            update("tags", e.target.value.split(",").map((t) => t.trim()).filter(Boolean))
          }
          style={inputStyle}
        />
        {Array.isArray(frontmatter.tags) && frontmatter.tags.length > 0 && (
          <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
            {(frontmatter.tags as string[]).map((tag) => (
              <span key={tag} style={{
                fontSize: 10,
                padding: "2px 8px",
                background: "var(--accent-bg)",
                color: "var(--accent)",
                borderRadius: 999,
                border: "1px solid var(--accent-border)",
                fontWeight: 500,
              }}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </Field>

      <Field label="Relates to">
        <input
          placeholder="comma-separated"
          value={Array.isArray(frontmatter.relates_to) ? frontmatter.relates_to.join(", ") : ""}
          onChange={(e) =>
            update("relates_to", e.target.value.split(",").map((t) => t.trim()).filter(Boolean))
          }
          style={inputStyle}
        />
      </Field>

      <Field label="Type">
        <input
          value={(frontmatter.type as string) ?? ""}
          onChange={(e) => update("type", e.target.value)}
          style={inputStyle}
        />
      </Field>

      <div style={{ marginTop: 16, fontSize: 10, color: "var(--text-3)", lineHeight: 1.8 }}>
        <div>Created: {(frontmatter.created as string) ?? "—"}</div>
        <div>Updated: {(frontmatter.updated as string) ?? "—"}</div>
      </div>
    </aside>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{
        display: "block",
        fontSize: 10,
        fontWeight: 600,
        color: "var(--text-3)",
        marginBottom: 4,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
      }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  fontSize: 12,
  padding: "5px 8px",
  border: "1px solid var(--border-mid)",
  borderRadius: 6,
  background: "#fff",
  boxSizing: "border-box",
  color: "var(--text-1)",
  fontFamily: "var(--font-sans)",
  outline: "none",
};
