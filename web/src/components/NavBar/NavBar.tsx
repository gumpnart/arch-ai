interface NavBarProps {
  selectedFile: string | null;
  folderName: string;
  canGoBack: boolean;
  canGoForward: boolean;
  onGoBack: () => void;
  onGoForward: () => void;
  onOpenPalette: () => void;
}

export function NavBar({
  selectedFile,
  folderName,
  canGoBack,
  canGoForward,
  onGoBack,
  onGoForward,
  onOpenPalette,
}: NavBarProps) {
  const breadcrumb = selectedFile
    ? buildBreadcrumb(folderName, selectedFile)
    : null;

  return (
    <div
      style={{
        height: 36,
        background: "#2d2d2d",
        display: "flex",
        alignItems: "center",
        borderBottom: "1px solid #1a1a1a",
        flexShrink: 0,
        userSelect: "none",
      }}
    >
      {/* ← → buttons */}
      <NavButton
        onClick={onGoBack}
        disabled={!canGoBack}
        title="Go back (Alt+←)"
        style={{ padding: "0 10px", fontSize: 16 }}
      >
        ←
      </NavButton>
      <NavButton
        onClick={onGoForward}
        disabled={!canGoForward}
        title="Go forward (Alt+→)"
        style={{ padding: "0 10px", fontSize: 16 }}
      >
        →
      </NavButton>

      {/* Separator */}
      <div
        style={{
          width: 1,
          height: 18,
          background: "#454545",
          margin: "0 4px",
          flexShrink: 0,
        }}
      />

      {/* Clickable breadcrumb */}
      <BreadcrumbArea breadcrumb={breadcrumb} onClick={onOpenPalette} />

      {/* Search icon */}
      <NavButton
        onClick={onOpenPalette}
        title="Search files (Ctrl+P)"
        style={{ padding: "0 12px", fontSize: 14, color: "#8a8a8a" }}
        hoverColor="#cccccc"
      >
        🔍
      </NavButton>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function BreadcrumbArea({
  breadcrumb,
  onClick,
}: {
  breadcrumb: { folder: string; segments: string[] } | null;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      title="Search files (Ctrl+P)"
      style={{
        flex: 1,
        padding: "0 12px",
        cursor: "pointer",
        fontSize: 13,
        color: breadcrumb ? "#cccccc" : "#6b6b6b",
        overflow: "hidden",
        whiteSpace: "nowrap",
        textOverflow: "ellipsis",
        height: "100%",
        display: "flex",
        alignItems: "center",
        gap: 4,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = "#3d3d3d";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = "transparent";
      }}
    >
      {breadcrumb ? (
        <>
          <span style={{ color: "#8a8a8a", fontSize: 12 }}>
            {breadcrumb.folder}
          </span>
          {breadcrumb.segments.map((seg, i) => (
            <span key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ color: "#555", fontSize: 11 }}>›</span>
              <span
                style={{
                  color: i === breadcrumb.segments.length - 1 ? "#cccccc" : "#8a8a8a",
                  fontWeight: i === breadcrumb.segments.length - 1 ? 500 : 400,
                }}
              >
                {seg}
              </span>
            </span>
          ))}
        </>
      ) : (
        <span style={{ fontSize: 12 }}>Search files… (Ctrl+P)</span>
      )}
    </div>
  );
}

function NavButton({
  children,
  onClick,
  disabled,
  title,
  style,
  hoverColor,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  style?: React.CSSProperties;
  hoverColor?: string;
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      title={title}
      style={{
        background: "none",
        border: "none",
        color: disabled ? "#4a4a4a" : "#cccccc",
        cursor: disabled ? "default" : "pointer",
        height: "100%",
        display: "flex",
        alignItems: "center",
        flexShrink: 0,
        transition: "color 0.1s",
        ...style,
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          (e.currentTarget as HTMLButtonElement).style.background = "#3d3d3d";
          if (hoverColor) (e.currentTarget as HTMLButtonElement).style.color = hoverColor;
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = "none";
        if (hoverColor) (e.currentTarget as HTMLButtonElement).style.color = disabled ? "#4a4a4a" : "#cccccc";
      }}
    >
      {children}
    </button>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildBreadcrumb(
  folderName: string,
  filePath: string
): { folder: string; segments: string[] } {
  const parts = filePath.replace(/\\/g, "/").split("/");
  const segments = parts.map((p, i) =>
    i === parts.length - 1 ? p.replace(/\.md$/i, "") : p
  );
  return { folder: folderName, segments };
}
