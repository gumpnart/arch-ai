import type { Frontmatter } from "../../lib/frontmatter.js";
import { Input } from "../ui/Input.js";
import { Badge } from "../ui/Badge.js";

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
        <Input
          value={(frontmatter.title as string) ?? ""}
          onChange={(e) => update("title", e.target.value)}
        />
      </Field>

      <Field label="Status">
        <select
          value={(frontmatter.status as string) ?? "draft"}
          onChange={(e) => update("status", e.target.value)}
          style={selectStyle}
        >
          {["draft", "in-review", "stable", "deprecated"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </Field>

      <Field label="Owner">
        <Input
          value={(frontmatter.owner as string) ?? ""}
          onChange={(e) => update("owner", e.target.value)}
        />
      </Field>

      <Field label="Tags">
        <Input
          placeholder="comma-separated"
          value={Array.isArray(frontmatter.tags) ? frontmatter.tags.join(", ") : ""}
          onChange={(e) =>
            update("tags", e.target.value.split(",").map((t) => t.trim()).filter(Boolean))
          }
        />
        {Array.isArray(frontmatter.tags) && frontmatter.tags.length > 0 && (
          <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
            {(frontmatter.tags as string[]).map((tag) => (
              <Badge key={tag} variant="tag">{tag}</Badge>
            ))}
          </div>
        )}
      </Field>

      <Field label="Relates to">
        <Input
          placeholder="comma-separated"
          value={Array.isArray(frontmatter.relates_to) ? frontmatter.relates_to.join(", ") : ""}
          onChange={(e) =>
            update("relates_to", e.target.value.split(",").map((t) => t.trim()).filter(Boolean))
          }
        />
      </Field>

      <Field label="Type">
        <Input
          value={(frontmatter.type as string) ?? ""}
          onChange={(e) => update("type", e.target.value)}
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

const selectStyle: React.CSSProperties = {
  width: "100%",
  fontSize: "var(--text-sm)",
  padding: "5px 8px",
  border: "1px solid var(--border-mid)",
  borderRadius: "var(--r-md)",
  background: "#fff",
  boxSizing: "border-box",
  color: "var(--text-1)",
  fontFamily: "var(--font-sans)",
  outline: "none",
  cursor: "pointer",
};
