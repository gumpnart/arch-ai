import { useKroki } from "../../hooks/useKroki.js";

interface KrokiPreviewProps {
  diagramType: string;
  dsl: string;
}

export function KrokiPreview({ diagramType, dsl }: KrokiPreviewProps) {
  const { svg, error, isRendering } = useKroki(diagramType, dsl);

  if (!dsl.trim()) {
    return (
      <div style={{ color: "#ccc", fontSize: 12, padding: 12 }}>
        Enter DSL to preview
      </div>
    );
  }
  if (isRendering) {
    return <div style={{ color: "#999", fontSize: 12, padding: 12 }}>Rendering...</div>;
  }
  if (error) {
    return <div style={{ color: "#e53935", fontSize: 11, padding: 12 }}>{error}</div>;
  }
  return (
    <div
      dangerouslySetInnerHTML={{ __html: svg }}
      style={{ maxWidth: "100%", overflow: "auto", padding: 12 }}
    />
  );
}
