import { DocStatusBadge } from "../Sidebar/DocStatusBadge.js";
import { Button } from "../ui/Button.js";
import type { Frontmatter } from "../../lib/frontmatter.js";

interface EditorToolbarProps {
  filePath: string;
  folderName?: string;
  status?: Frontmatter["status"];
  isDirty: boolean;
  isSaving: boolean;
  onSave: () => void;
  onStatusChange: (status: Frontmatter["status"]) => void;
  canGoBack?: boolean;
  canGoForward?: boolean;
  onGoBack?: () => void;
  onGoForward?: () => void;
}

export function EditorToolbar({
  filePath,
  folderName,
  status,
  isDirty,
  isSaving,
  onSave,
  onStatusChange,
  canGoBack,
  canGoForward,
  onGoBack,
  onGoForward,
}: EditorToolbarProps) {
  const crumbs = buildBreadcrumb(folderName ?? "", filePath);

  return (
    <div style={{
      height: "var(--editor-topbar-h)",
      display: "flex",
      alignItems: "center",
      padding: "0 24px",
      gap: 10,
      borderBottom: "1px solid var(--border)",
      background: "var(--editor-bg)",
      flexShrink: 0,
    }}>
      {/* Back / Forward */}
      <NavArrow
        onClick={onGoBack}
        disabled={!canGoBack}
        title="Go back (Alt+←)"
        dir="left"
      />
      <NavArrow
        onClick={onGoForward}
        disabled={!canGoForward}
        title="Go forward (Alt+→)"
        dir="right"
      />

      {/* Breadcrumb */}
      <div style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        gap: 4,
        overflow: "hidden",
        minWidth: 0,
        fontSize: 13,
      }}>
        {folderName && (
          <>
            <span style={{ color: "var(--text-3)", whiteSpace: "nowrap", flexShrink: 0, fontSize: 12 }}>
              {folderName}
            </span>
            <BcSep />
          </>
        )}
        {crumbs.segments.map((seg, i) => {
          const isLast = i === crumbs.segments.length - 1;
          return (
            <span key={i} style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0, flexShrink: isLast ? 0 : 1 }}>
              {isLast ? (
                <span style={{ color: "var(--text-1)", fontWeight: 600, whiteSpace: "nowrap" }}>
                  {seg}
                  {isDirty && (
                    <span style={{ color: "#f59e0b", marginLeft: 4, fontSize: 10 }}>●</span>
                  )}
                </span>
              ) : (
                <>
                  <span style={{ color: "var(--text-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontSize: 12 }}>
                    {seg}
                  </span>
                  <BcSep />
                </>
              )}
            </span>
          );
        })}
      </div>

      {/* Status chip */}
      <DocStatusBadge status={status} />

      {/* Status select — compact */}
      <select
        value={status ?? "draft"}
        onChange={(e) => onStatusChange(e.target.value as Frontmatter["status"])}
        style={{
          fontSize: 11,
          padding: "3px 6px",
          border: "1px solid var(--border-mid)",
          borderRadius: 6,
          background: "var(--hover-bg)",
          color: "var(--text-2)",
          fontFamily: "var(--font-sans)",
          outline: "none",
          cursor: "pointer",
        }}
      >
        {["draft", "in-review", "stable", "deprecated"].map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      {/* Save button */}
      <Button
        variant={isDirty && !isSaving ? "primary" : "secondary"}
        size="sm"
        disabled={isSaving || !isDirty}
        onClick={onSave}
      >
        {isSaving ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function BcSep() {
  return (
    <span style={{ color: "#d4d4d8", fontSize: 11, flexShrink: 0 }}>›</span>
  );
}

function NavArrow({
  onClick,
  disabled,
  title,
  dir,
}: {
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  dir: "left" | "right";
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      title={title}
      style={{
        width: 26,
        height: 26,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "none",
        borderRadius: 6,
        background: "none",
        color: disabled ? "var(--border-mid)" : "var(--text-3)",
        cursor: disabled ? "default" : "pointer",
        padding: 0,
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        if (!disabled)
          (e.currentTarget as HTMLButtonElement).style.background = "var(--hover-bg)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = "none";
      }}
    >
      {dir === "left" ? (
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      ) : (
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M9 18l6-6-6-6" />
        </svg>
      )}
    </button>
  );
}

function buildBreadcrumb(folderName: string, filePath: string) {
  const parts = filePath.replace(/\\/g, "/").split("/");
  const segments = parts.map((p, i) =>
    i === parts.length - 1 ? p.replace(/\.(md|excalidraw)$/i, "") : p
  );
  return { folder: folderName, segments };
}
