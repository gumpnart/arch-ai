import { DocStatusBadge } from "../Sidebar/DocStatusBadge.js";
import type { Frontmatter } from "../../lib/frontmatter.js";

interface EditorToolbarProps {
  filePath: string;
  status?: Frontmatter["status"];
  isDirty: boolean;
  isSaving: boolean;
  onSave: () => void;
  onStatusChange: (status: Frontmatter["status"]) => void;
}

export function EditorToolbar({
  filePath,
  status,
  isDirty,
  isSaving,
  onSave,
  onStatusChange,
}: EditorToolbarProps) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "8px 20px",
      borderBottom: "1px solid #e5e7eb",
      background: "#fff",
      flexShrink: 0,
    }}>
      <span style={{ fontSize: 12, color: "#6b7280", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {filePath}
        {isDirty && <span style={{ color: "#f59e0b", marginLeft: 6 }}>●</span>}
      </span>

      <select
        value={status ?? "draft"}
        onChange={(e) => onStatusChange(e.target.value as Frontmatter["status"])}
        style={{
          fontSize: 11,
          padding: "2px 6px",
          border: "1px solid #d1d5db",
          borderRadius: 4,
          background: "#fff",
        }}
      >
        {["draft", "in-review", "stable", "deprecated"].map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      <DocStatusBadge status={status} />

      <button
        onClick={onSave}
        disabled={isSaving || !isDirty}
        style={{
          fontSize: 12,
          padding: "4px 12px",
          borderRadius: 4,
          border: "none",
          cursor: isDirty && !isSaving ? "pointer" : "not-allowed",
          background: isDirty && !isSaving ? "#2563eb" : "#e5e7eb",
          color: isDirty && !isSaving ? "#fff" : "#9ca3af",
          fontWeight: 600,
        }}
      >
        {isSaving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
