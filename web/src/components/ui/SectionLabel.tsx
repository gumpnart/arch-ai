import type { ReactNode } from "react";

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{
      padding: "var(--sp-2) 14px var(--sp-1)",
      fontSize: "var(--text-xs)",
      fontWeight: 700,
      color: "var(--text-3)",
      letterSpacing: "0.07em",
      textTransform: "uppercase",
      fontFamily: "var(--font-sans)",
      userSelect: "none",
    }}>
      {children}
    </div>
  );
}
