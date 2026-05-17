const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft: { bg: "#fef3c7", text: "#92400e" },
  "in-review": { bg: "#dbeafe", text: "#1e40af" },
  stable: { bg: "#d1fae5", text: "#065f46" },
  deprecated: { bg: "#f3f4f6", text: "#6b7280" },
  example: { bg: "#ede9fe", text: "#4c1d95" },
  unknown: { bg: "#f3f4f6", text: "#9ca3af" },
};

export function DocStatusBadge({ status }: { status?: string }) {
  const key = status ?? "unknown";
  const colors = STATUS_COLORS[key] ?? STATUS_COLORS.unknown;
  return (
    <span style={{
      fontSize: 9,
      fontWeight: 600,
      padding: "1px 5px",
      borderRadius: 3,
      background: colors.bg,
      color: colors.text,
      textTransform: "uppercase",
      letterSpacing: "0.04em",
      flexShrink: 0,
    }}>
      {key}
    </span>
  );
}
