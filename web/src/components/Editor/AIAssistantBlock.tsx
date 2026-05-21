import { createReactBlockSpec } from "@blocknote/react";
import { createContext, useContext, useState, useEffect } from "react";
import { useAIAssistant } from "../../hooks/useAIAssistant.js";

// ── Context ───────────────────────────────────────────────────────────────────

interface AIAssistantContextValue {
  getStableDocsContext: () => Promise<string>;
  stableCount: number;
}

export const AIAssistantContext = createContext<AIAssistantContextValue>({
  getStableDocsContext: async () => "",
  stableCount: 0,
});

// ── Block spec ────────────────────────────────────────────────────────────────

export const AIAssistantBlock = createReactBlockSpec(
  {
    type: "aiAssistant" as const,
    propSchema: {
      prompt: { default: "" },
      useStableDocs: { default: "false" },
      generatedText: { default: "" },
    },
    content: "none",
  },
  {
    render: ({ block, editor }) => {
      const { getStableDocsContext, stableCount } = useContext(AIAssistantContext);
      const { prompt, useStableDocs, generatedText } = block.props as {
        prompt: string;
        useStableDocs: string;
        generatedText: string;
      };

      const { text, status, error, generate, reset } = useAIAssistant();
      const [displayText, setDisplayText] = useState(generatedText);

      const isStreaming = status === "streaming";
      const isActive = status === "streaming" || status === "done";

      useEffect(() => {
        if (status === "streaming" || status === "done") {
          setDisplayText(text);
          editor.updateBlock(block, {
            props: { ...block.props, generatedText: text },
          });
        }
      // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [text, status]);

      const handleGenerate = async () => {
        let ctx: string | undefined;
        if (useStableDocs === "true") {
          const raw = await getStableDocsContext();
          if (raw) ctx = raw;
        }
        generate(prompt, ctx);
      };

      const handleAccept = async () => {
        const parsed = await editor.tryParseMarkdownToBlocks(displayText);
        editor.replaceBlocks(
          [block as any],
          (parsed.length ? parsed : [{ type: "paragraph" as const, content: [{ type: "text" as const, text: displayText, styles: {} }] }]) as any
        );
      };

      const handleDiscard = () => {
        reset();
        setDisplayText("");
        editor.updateBlock(block, {
          props: { ...block.props, generatedText: "", prompt: "" },
        });
      };

      return (
        <div
          data-testid="ai-assistant-block"
          style={{
            border: "1.5px solid #c7d2fe",
            borderRadius: 8,
            overflow: "hidden",
            margin: "4px 0",
            width: "100%",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "5px 12px",
              background: "#eef2ff",
              borderBottom: "1.5px solid #c7d2fe",
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: "#4f46e5", letterSpacing: "0.05em" }}>
              ✦ AI ASSISTANT
            </span>
            {isStreaming && (
              <span style={{ fontSize: 10, color: "#818cf8", marginLeft: "auto" }}>Generating…</span>
            )}
            {status === "done" && (
              <span style={{ fontSize: 10, color: "#22c55e", marginLeft: "auto" }}>Done — review &amp; accept</span>
            )}
            {status === "error" && (
              <span style={{ fontSize: 10, color: "#ef4444", marginLeft: "auto" }}>Error</span>
            )}
          </div>

          {/* Prompt + controls */}
          <div style={{ padding: "10px 12px", background: "#f8f9ff" }}>
            <textarea
              data-testid="ai-prompt-textarea"
              value={prompt}
              onChange={(e) =>
                editor.updateBlock(block, { props: { ...block.props, prompt: e.target.value } })
              }
              placeholder="Describe what you want to write…"
              disabled={isStreaming}
              rows={3}
              style={{
                width: "100%",
                boxSizing: "border-box",
                fontFamily: "system-ui, sans-serif",
                fontSize: 13,
                border: "1px solid #e0e7ff",
                borderRadius: 4,
                padding: "7px 9px",
                resize: "vertical",
                outline: "none",
                background: isStreaming ? "#f0f0f0" : "#fff",
                color: "#1e1b4b",
              }}
            />

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 12,
                  color: "#6366f1",
                  cursor: isStreaming ? "not-allowed" : "pointer",
                  userSelect: "none",
                }}
              >
                <input
                  data-testid="ai-stable-docs-checkbox"
                  type="checkbox"
                  checked={useStableDocs === "true"}
                  disabled={isStreaming}
                  onChange={(e) =>
                    editor.updateBlock(block, {
                      props: { ...block.props, useStableDocs: e.target.checked ? "true" : "false" },
                    })
                  }
                  style={{ accentColor: "#6366f1" }}
                />
                Use stable docs as context
                {stableCount > 0 && (
                  <span style={{ color: "#a5b4fc", fontSize: 11 }}>
                    ({stableCount} doc{stableCount !== 1 ? "s" : ""})
                  </span>
                )}
              </label>

              <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                {isActive && (
                  <>
                    <button
                      data-testid="ai-accept-btn"
                      onClick={handleAccept}
                      disabled={isStreaming}
                      style={{
                        fontSize: 12,
                        padding: "4px 13px",
                        background: isStreaming ? "#a5b4fc" : "#4f46e5",
                        color: "#fff",
                        border: "none",
                        borderRadius: 4,
                        cursor: isStreaming ? "not-allowed" : "pointer",
                        fontWeight: 600,
                      }}
                    >
                      Accept
                    </button>
                    <button
                      data-testid="ai-discard-btn"
                      onClick={handleDiscard}
                      style={{
                        fontSize: 12,
                        padding: "4px 13px",
                        background: "#fff",
                        color: "#6b7280",
                        border: "1px solid #d1d5db",
                        borderRadius: 4,
                        cursor: "pointer",
                      }}
                    >
                      Discard
                    </button>
                  </>
                )}
                <button
                  data-testid="ai-generate-btn"
                  onClick={handleGenerate}
                  disabled={!prompt.trim() || isStreaming}
                  style={{
                    fontSize: 12,
                    padding: "4px 13px",
                    background: !prompt.trim() || isStreaming ? "#c7d2fe" : "#6366f1",
                    color: "#fff",
                    border: "none",
                    borderRadius: 4,
                    cursor: !prompt.trim() || isStreaming ? "not-allowed" : "pointer",
                    fontWeight: 600,
                  }}
                >
                  {isStreaming ? "Generating…" : isActive ? "Regenerate" : "Generate"}
                </button>
              </div>
            </div>
          </div>

          {/* Output panel */}
          {(isActive || displayText || error) && (
            <div
              style={{
                borderTop: "1.5px solid #e0e7ff",
                padding: "10px 12px",
                background: "#fff",
                maxHeight: 320,
                overflowY: "auto",
              }}
            >
              {error ? (
                <span style={{ color: "#ef4444", fontSize: 13 }}>{error}</span>
              ) : (
                <pre
                  style={{
                    fontFamily: "system-ui, sans-serif",
                    fontSize: 13,
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                    margin: 0,
                    color: "#1e1b4b",
                  }}
                >
                  {displayText}
                  {isStreaming && (
                    <span
                      style={{
                        display: "inline-block",
                        width: 2,
                        height: "1em",
                        background: "#6366f1",
                        marginLeft: 1,
                        verticalAlign: "text-bottom",
                        animation: "ai-blink 1s step-end infinite",
                      }}
                    />
                  )}
                </pre>
              )}
            </div>
          )}

          <style>{`
            @keyframes ai-blink {
              0%, 100% { opacity: 1; }
              50% { opacity: 0; }
            }
          `}</style>
        </div>
      );
    },
  }
);
