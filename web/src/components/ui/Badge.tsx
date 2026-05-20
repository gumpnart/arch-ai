import type { CSSProperties, ReactNode } from "react";

type BadgeVariant = "status" | "count" | "tag";

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  style?: CSSProperties;
}

const BASE: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  fontFamily: "var(--font-sans)",
  fontWeight: 600,
  flexShrink: 0,
  letterSpacing: "0.04em",
};

const VARIANTS: Record<BadgeVariant, CSSProperties> = {
  status: {
    fontSize: "var(--text-xs)",
    padding: "2px 7px",
    borderRadius: "var(--r-full)",
    textTransform: "uppercase",
  },
  count: {
    fontSize: "var(--text-xs)",
    padding: "1px 6px",
    borderRadius: "var(--r-full)",
    background: "var(--text-2)",
    color: "#fff",
  },
  tag: {
    fontSize: "var(--text-xs)",
    padding: "2px 8px",
    borderRadius: "var(--r-full)",
    background: "var(--accent-bg)",
    color: "var(--accent)",
    border: "1px solid var(--accent-border)",
    fontWeight: 500,
  },
};

export function Badge({ children, variant = "status", style }: BadgeProps) {
  return (
    <span style={{ ...BASE, ...VARIANTS[variant], ...style }}>
      {children}
    </span>
  );
}

// ── Status badge with semantic colors ─────────────────────────────────────────

const STATUS_STYLES: Record<string, CSSProperties> = {
  draft:       { background: "var(--status-draft-bg)",      color: "var(--status-draft-text)" },
  "in-review": { background: "var(--status-review-bg)",     color: "var(--status-review-text)" },
  stable:      { background: "var(--status-stable-bg)",     color: "var(--status-stable-text)" },
  deprecated:  { background: "var(--status-deprecated-bg)", color: "var(--status-deprecated-text)" },
  example:     { background: "var(--status-example-bg)",    color: "var(--status-example-text)" },
};

export function StatusBadge({ status }: { status?: string }) {
  const key = status ?? "unknown";
  const colorStyle = STATUS_STYLES[key] ?? {
    background: "var(--status-unknown-bg)",
    color: "var(--status-unknown-text)",
  };
  return (
    <Badge variant="status" style={colorStyle}>
      {key}
    </Badge>
  );
}
