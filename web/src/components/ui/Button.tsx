import type { CSSProperties, ReactNode, MouseEvent } from "react";

type Variant = "primary" | "secondary" | "ghost" | "icon";
type Size = "sm" | "md";

interface ButtonProps {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  title?: string;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  style?: CSSProperties;
  type?: "button" | "submit" | "reset";
  "data-testid"?: string;
}

const BASE: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "var(--sp-1)",
  border: "none",
  borderRadius: "var(--r-lg)",
  fontFamily: "var(--font-sans)",
  fontWeight: 600,
  cursor: "pointer",
  flexShrink: 0,
  transition: "background 0.1s, color 0.1s, opacity 0.1s",
  userSelect: "none",
  WebkitFontSmoothing: "antialiased",
};

const VARIANTS: Record<Variant, CSSProperties> = {
  primary: {
    background: "var(--accent)",
    color: "#fff",
    boxShadow: "var(--shadow-accent)",
  },
  secondary: {
    background: "var(--hover-bg)",
    color: "var(--text-2)",
    border: "1px solid var(--border-mid)",
    boxShadow: "var(--shadow-sm)",
  },
  ghost: {
    background: "none",
    color: "var(--text-2)",
  },
  icon: {
    background: "none",
    color: "var(--text-3)",
    borderRadius: "var(--r-md)",
  },
};

const SIZES: Record<Size, CSSProperties> = {
  sm: { fontSize: "var(--text-sm)", padding: "4px 10px", height: 28 },
  md: { fontSize: "var(--text-base)", padding: "6px 16px", height: 32 },
};

const ICON_SIZES: Record<Size, CSSProperties> = {
  sm: { fontSize: "var(--text-sm)", width: 26, height: 26, padding: 0 },
  md: { fontSize: "var(--text-base)", width: 32, height: 32, padding: 0 },
};

// Hover backgrounds per variant
const HOVER_BG: Record<Variant, string> = {
  primary: "#1d4ed8",
  secondary: "#eaeaec",
  ghost: "var(--hover-bg)",
  icon: "var(--hover-bg)",
};

export function Button({
  children,
  variant = "secondary",
  size = "md",
  disabled,
  title,
  onClick,
  style,
  type = "button",
  "data-testid": dataTestId,
}: ButtonProps) {
  const sizeStyle = variant === "icon" ? ICON_SIZES[size] : SIZES[size];

  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      data-testid={dataTestId}
      style={{
        ...BASE,
        ...VARIANTS[variant],
        ...sizeStyle,
        ...(disabled ? { opacity: 0.4, cursor: "not-allowed", pointerEvents: "none" } : {}),
        ...style,
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          (e.currentTarget as HTMLButtonElement).style.background = HOVER_BG[variant];
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          (e.currentTarget as HTMLButtonElement).style.background =
            (VARIANTS[variant].background as string) ?? "none";
        }
      }}
    >
      {children}
    </button>
  );
}
