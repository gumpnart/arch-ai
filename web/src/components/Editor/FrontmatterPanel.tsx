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
      width: 240,
      borderLeft: "1px solid #e5e7eb",
      background: "#fafafa",
      padding: 16,
      overflow: "auto",
      flexShrink: 0,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        Frontmatter
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

      <Field label="Tags (comma-separated)">
        <input
          value={Array.isArray(frontmatter.tags) ? frontmatter.tags.join(", ") : ""}
          onChange={(e) =>
            update("tags", e.target.value.split(",").map((t) => t.trim()).filter(Boolean))
          }
          style={inputStyle}
        />
      </Field>

      <Field label="Relates to (comma-separated)">
        <input
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

      <div style={{ marginTop: 16, fontSize: 10, color: "#9ca3af" }}>
        <div>Created: {(frontmatter.created as string) ?? "—"}</div>
        <div>Updated: {(frontmatter.updated as string) ?? "—"}</div>
      </div>
    </aside>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#6b7280", marginBottom: 3 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  fontSize: 12,
  padding: "4px 6px",
  border: "1px solid #d1d5db",
  borderRadius: 4,
  background: "#fff",
  boxSizing: "border-box",
};
