import { createReactBlockSpec } from "@blocknote/react";
import { useState, useEffect, useCallback, useRef } from "react";

type Layout = "left" | "right" | "top" | "bottom";

const LAYOUT_LABELS: Record<Layout, string> = { left: "←", right: "→", top: "↑", bottom: "↓" };

export const MermaidBlock = createReactBlockSpec(
  {
    type: "mermaid" as const,
    propSchema: {
      dsl: { default: "" },
      diagramType: { default: "mermaid" },
      viewMode: { default: "split" },
      layout: { default: "left" },
    },
    content: "none",
  },
  {
    render: ({ block, editor }) => {
      const { dsl, diagramType, viewMode, layout } = block.props as {
        dsl: string;
        diagramType: string;
        viewMode: string;
        layout: Layout;
      };

      const [svgContent, setSvgContent] = useState("");
      const [renderError, setRenderError] = useState("");
      const [isRendering, setIsRendering] = useState(false);

      // Preview zoom/pan
      const [scale, setScale] = useState(1);
      const [translate, setTranslate] = useState({ x: 0, y: 0 });
      const [isPanning, setIsPanning] = useState(false);
      const panOrigin = useRef({ mouseX: 0, mouseY: 0, tx: 0, ty: 0 });

      // Split panel resize — ratio of the FIRST rendered panel
      const [splitRatio, setSplitRatio] = useState(0.5);
      const contentRef = useRef<HTMLDivElement>(null);
      const isSplitDragging = useRef(false);

      // Block height (content area, excludes toolbar + resize handle)
      const [blockHeight, setBlockHeight] = useState(320);

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

      useEffect(() => {
        setScale(1);
        setTranslate({ x: 0, y: 0 });
      }, [svgContent]);

      useEffect(() => {
        setSplitRatio(0.5);
      }, [layout]);

      const update = (key: string, value: string) =>
        editor.updateBlock(block, { props: { ...block.props, [key]: value } });

      // ── Preview pan/zoom ──────────────────────────────────────────────────────

      const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        setScale((s) => Math.min(10, Math.max(0.1, s * (e.deltaY < 0 ? 1.1 : 0.9))));
      }, []);

      const handlePanStart = useCallback(
        (e: React.MouseEvent) => {
          if (e.button !== 0) return;
          setIsPanning(true);
          panOrigin.current = { mouseX: e.clientX, mouseY: e.clientY, tx: translate.x, ty: translate.y };
          e.preventDefault();
        },
        [translate.x, translate.y]
      );

      const handlePanMove = useCallback(
        (e: React.MouseEvent) => {
          if (!isPanning) return;
          setTranslate({
            x: panOrigin.current.tx + (e.clientX - panOrigin.current.mouseX),
            y: panOrigin.current.ty + (e.clientY - panOrigin.current.mouseY),
          });
        },
        [isPanning]
      );

      const stopPan = useCallback(() => setIsPanning(false), []);

      const resetView = useCallback(() => {
        setScale(1);
        setTranslate({ x: 0, y: 0 });
      }, []);

      // ── Split panel drag ──────────────────────────────────────────────────────

      const handleDividerMouseDown = useCallback(
        (e: React.MouseEvent) => {
          e.preventDefault();
          isSplitDragging.current = true;
          const isVert = layout === "top" || layout === "bottom";

          const onMouseMove = (ev: MouseEvent) => {
            if (!isSplitDragging.current || !contentRef.current) return;
            const rect = contentRef.current.getBoundingClientRect();
            const ratio = isVert
              ? (ev.clientY - rect.top) / rect.height
              : (ev.clientX - rect.left) / rect.width;
            setSplitRatio(Math.min(0.85, Math.max(0.15, ratio)));
          };

          const onMouseUp = () => {
            isSplitDragging.current = false;
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
          };

          window.addEventListener("mousemove", onMouseMove);
          window.addEventListener("mouseup", onMouseUp);
        },
        [layout]
      );

      // ── Block height resize ───────────────────────────────────────────────────

      const handleBlockResizeMouseDown = useCallback(
        (e: React.MouseEvent) => {
          e.preventDefault();
          const startY = e.clientY;
          const startHeight = blockHeight;

          const onMouseMove = (ev: MouseEvent) => {
            setBlockHeight(Math.max(100, startHeight + (ev.clientY - startY)));
          };

          const onMouseUp = () => {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
          };

          window.addEventListener("mousemove", onMouseMove);
          window.addEventListener("mouseup", onMouseUp);
        },
        [blockHeight]
      );

      // ── Layout-derived values ─────────────────────────────────────────────────

      const isVertical = layout === "top" || layout === "bottom";
      const codeFirst = layout === "left" || layout === "top";
      const codeFlex = codeFirst ? splitRatio : 1 - splitRatio;
      const previewFlex = codeFirst ? 1 - splitRatio : splitRatio;
      const showPreview = viewMode === "preview" || viewMode === "split";

      // ── Panels ────────────────────────────────────────────────────────────────

      const codePanel = (viewMode === "code" || viewMode === "split") && (
        <textarea
          key="code"
          data-testid="mermaid-code-textarea"
          value={dsl}
          onChange={(e) => update("dsl", e.target.value)}
          placeholder="Enter diagram DSL here..."
          style={{
            flex: viewMode === "split" ? codeFlex : 1,
            minHeight: 0,
            minWidth: 0,
            padding: 12,
            fontFamily: "monospace",
            fontSize: 12,
            lineHeight: 1.6,
            border: "none",
            outline: "none",
            resize: "none",
            background: "#1e1e1e",
            color: "#d4d4d4",
            overflowY: "auto",
          }}
        />
      );

      const divider = viewMode === "split" && (
        <div
          key="divider"
          onMouseDown={handleDividerMouseDown}
          style={{
            ...(isVertical ? { height: 5, width: "100%" } : { width: 5 }),
            flexShrink: 0,
            background: "#e0e0e0",
            cursor: isVertical ? "row-resize" : "col-resize",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            userSelect: "none",
          }}
        >
          <div style={isVertical
            ? { height: 1, width: 20, background: "#bbb" }
            : { width: 1, height: 20, background: "#bbb" }
          } />
        </div>
      );

      const previewPanel = showPreview && (
        <div
          key="preview"
          style={{
            flex: viewMode === "split" ? previewFlex : 1,
            minHeight: 0,
            minWidth: 0,
            background: "#fff",
            overflow: "hidden",
            position: "relative",
            cursor: isPanning ? "grabbing" : "grab",
          }}
          onWheel={handleWheel}
          onMouseDown={handlePanStart}
          onMouseMove={handlePanMove}
          onMouseUp={stopPan}
          onMouseLeave={stopPan}
          onDoubleClick={resetView}
        >
          {isRendering ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
              <span style={{ color: "#999", fontSize: 12 }}>Rendering...</span>
            </div>
          ) : renderError ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
              <span style={{ color: "#e53935", fontSize: 11 }}>{renderError}</span>
            </div>
          ) : svgContent ? (
            <div
              dangerouslySetInnerHTML={{ __html: svgContent }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 12,
                transformOrigin: "center center",
                transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
                userSelect: "none",
                pointerEvents: "none",
              }}
            />
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
              <span style={{ color: "#ccc", fontSize: 12 }}>Enter DSL to preview</span>
            </div>
          )}
        </div>
      );

      // ── Render ────────────────────────────────────────────────────────────────

      return (
        <div data-testid="mermaid-block" style={{ border: "1px solid #e0e0e0", borderRadius: 8, overflow: "hidden", margin: "8px 0", width: "100%" }}>
          {/* Toolbar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "5px 10px",
              background: "#f8f9fa",
              borderBottom: "1px solid #e0e0e0",
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: "#555" }}>Diagram</span>
            <select
              data-testid="mermaid-type-select"
              value={diagramType}
              onChange={(e) => update("diagramType", e.target.value)}
              style={{ fontSize: 10, border: "1px solid #ddd", borderRadius: 3, padding: "1px 4px" }}
            >
              {["mermaid", "c4plantuml", "plantuml", "graphviz", "d2", "erd"].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>

            <div style={{ marginLeft: "auto", display: "flex", gap: 3, alignItems: "center" }}>
              {viewMode === "split" && (
                <div style={{ display: "flex", gap: 2, marginRight: 6 }}>
                  {(["left", "right", "top", "bottom"] as Layout[]).map((l) => (
                    <button
                      key={l}
                      data-testid={`mermaid-layout-${l}-btn`}
                      title={`Code ${l}`}
                      onClick={() => update("layout", l)}
                      style={{
                        fontSize: 11,
                        padding: "1px 5px",
                        borderRadius: 4,
                        cursor: "pointer",
                        background: layout === l ? "#555" : "#fff",
                        color: layout === l ? "#fff" : "#555",
                        border: "1px solid #ccc",
                        lineHeight: 1,
                      }}
                    >
                      {LAYOUT_LABELS[l]}
                    </button>
                  ))}
                </div>
              )}

              {showPreview && svgContent && (
                <span style={{ fontSize: 10, color: "#999", marginRight: 4 }}>
                  {Math.round(scale * 100)}% · dbl-click to reset
                </span>
              )}

              {(["code", "split", "preview"] as const).map((m) => (
                <button
                  key={m}
                  data-testid={`mermaid-view-${m}-btn`}
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

          {/* Content panels */}
          <div
            ref={contentRef}
            style={{
              display: "flex",
              flexDirection: isVertical ? "column" : "row",
              overflow: "hidden",
              height: blockHeight,
            }}
          >
            {codeFirst
              ? [codePanel, divider, previewPanel]
              : [previewPanel, divider, codePanel]}
          </div>

          {/* Block resize handle */}
          <div
            data-testid="mermaid-resize-handle"
            onMouseDown={handleBlockResizeMouseDown}
            style={{
              height: 6,
              background: "#f5f5f5",
              borderTop: "1px solid #e0e0e0",
              cursor: "ns-resize",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              userSelect: "none",
            }}
          >
            <div style={{ width: 28, height: 2, background: "#ccc", borderRadius: 1 }} />
          </div>
        </div>
      );
    },
  }
)();
