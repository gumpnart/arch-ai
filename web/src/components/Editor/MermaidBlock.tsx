import { createReactBlockSpec } from "@blocknote/react";
import { useState, useEffect, useCallback } from "react";

export const MermaidBlock = createReactBlockSpec(
  {
    type: "mermaid" as const,
    propSchema: {
      dsl: { default: "" },
      diagramType: { default: "mermaid" },
      viewMode: { default: "split" },
    },
    content: "none",
  },
  {
    render: ({ block, editor }) => {
      const { dsl, diagramType, viewMode } = block.props;
      const [svgContent, setSvgContent] = useState("");
      const [renderError, setRenderError] = useState("");
      const [isRendering, setIsRendering] = useState(false);

      const renderDiagram = useCallback(async (code: string, type: string) => {
        if (!code.trim()) return;
        setIsRendering(true);
        setRenderError("");
        try {
          const res = await fetch("/api/kroki/render", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ diagramType: type, dsl: code, format: "svg" }),
          });
          if (res.ok) setSvgContent(await res.text());
          else setRenderError(`Render error: ${res.statusText}`);
        } catch (err) {
          setRenderError(`Kroki unavailable: ${String(err)}`);
        } finally {
          setIsRendering(false);
        }
      }, []);

      useEffect(() => {
        if (viewMode !== "code") {
          const timer = setTimeout(() => renderDiagram(dsl, diagramType), 800);
          return () => clearTimeout(timer);
        }
      }, [dsl, diagramType, viewMode, renderDiagram]);

      const update = (key: string, value: string) =>
        editor.updateBlock(block, { props: { ...block.props, [key]: value } });

      return (
        <div style={{ border: "1px solid #e0e0e0", borderRadius: 8, overflow: "hidden", margin: "8px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 10px", background: "#f8f9fa", borderBottom: "1px solid #e0e0e0" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#555" }}>Diagram</span>
            <select
              value={diagramType}
              onChange={(e) => update("diagramType", e.target.value)}
              style={{ fontSize: 10, border: "1px solid #ddd", borderRadius: 3, padding: "1px 4px" }}
            >
              {["mermaid", "c4plantuml", "plantuml", "graphviz", "d2", "erd"].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <div style={{ marginLeft: "auto", display: "flex", gap: 3 }}>
              {(["code", "split", "preview"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => update("viewMode", m)}
                  style={{
                    fontSize: 10,
                    padding: "1px 7px",
                    borderRadius: 4,
                    cursor: "pointer",
                    background: viewMode === m ? "#333" : "#fff",
                    color: viewMode === m ? "#fff" : "#333",
                    border: "1px solid #ccc",
                  }}
                >
                  {m === "code" ? "<>" : m === "split" ? "Split" : "Preview"}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex" }}>
            {(viewMode === "code" || viewMode === "split") && (
              <textarea
                value={dsl}
                onChange={(e) => update("dsl", e.target.value)}
                placeholder="Enter diagram DSL here..."
                style={{
                  flex: 1,
                  minHeight: 160,
                  padding: 12,
                  fontFamily: "monospace",
                  fontSize: 12,
                  lineHeight: 1.6,
                  border: "none",
                  outline: "none",
                  resize: "vertical",
                  background: "#1e1e1e",
                  color: "#d4d4d4",
                  borderRight: viewMode === "split" ? "1px solid #e0e0e0" : "none",
                }}
              />
            )}
            {(viewMode === "preview" || viewMode === "split") && (
              <div style={{
                flex: 1,
                minHeight: 160,
                padding: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#fff",
              }}>
                {isRendering ? (
                  <span style={{ color: "#999", fontSize: 12 }}>Rendering...</span>
                ) : renderError ? (
                  <span style={{ color: "#e53935", fontSize: 11 }}>{renderError}</span>
                ) : svgContent ? (
                  <div dangerouslySetInnerHTML={{ __html: svgContent }} style={{ maxWidth: "100%", overflow: "auto" }} />
                ) : (
                  <span style={{ color: "#ccc", fontSize: 12 }}>Enter DSL to preview</span>
                )}
              </div>
            )}
          </div>
        </div>
      );
    },
  }
)();
