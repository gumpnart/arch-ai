import { useState } from "react";

const VAULT_TREE = [
  { type: "dir", name: "Architecture", children: [
    { type: "dir", name: "Diagrams", children: [
      { type: "file", name: "system-context.md", status: "stable" },
      { type: "file", name: "container-diagram.md", status: "in-review" },
    ]},
    { type: "dir", name: "ADR", children: [
      { type: "file", name: "ADR-001-use-mermaid.md", status: "stable" },
      { type: "file", name: "ADR-002-use-kroki.md", status: "draft" },
    ]},
    { type: "file", name: "sad.md", status: "in-review" },
    { type: "file", name: "non-functional-requirements.md", status: "draft" },
    { type: "file", name: "risk-register.md", status: "draft" },
  ]},
  { type: "dir", name: "Components", children: [
    { type: "file", name: "order-service.md", status: "stable" },
    { type: "file", name: "payment-service.md", status: "draft" },
  ]},
  { type: "dir", name: "Infrastructure", children: [
    { type: "file", name: "infrastructure-architecture.md", status: "draft" },
  ]},
  { type: "dir", name: "Runbooks", children: [
    { type: "file", name: "order-service-runbook.md", status: "stable" },
  ]},
  { type: "file", name: "README.md", status: "stable" },
];

const SAMPLE_DOC = {
  path: "Components/order-service.md",
  frontmatter: {
    title: "Order Service",
    type: "component",
    status: "stable",
    created: "2026-05-15",
    tags: ["orders", "kafka", "backend"],
    relates_to: ["[[api-gateway]]", "[[payment-service]]", "[[container-diagram]]"],
    owner: "platform-team",
    reviewed_by: "@arm",
  },
  blocks: [
    { type: "heading", level: 1, text: "Order Service" },
    { type: "heading", level: 2, text: "Overview" },
    { type: "paragraph", text: "The Order Service is the core transaction processor responsible for orchestrating the checkout flow between the API Gateway, Payment Service, and downstream event consumers via Kafka." },
    { type: "heading", level: 2, text: "Responsibilities" },
    { type: "bulletItem", text: "Validate incoming CheckoutEvent payloads" },
    { type: "bulletItem", text: "Delegate payment authorization to Payment Service" },
    { type: "bulletItem", text: "Publish order-confirmed events to Kafka" },
    { type: "heading", level: 2, text: "Checkout Sequence" },
    { type: "mermaid", dsl: "sequenceDiagram\n  APIGateway->>+OrderSvc: CheckoutEvent\n  OrderSvc->>+PaymentSvc: authorizePayment()\n  PaymentSvc-->>-OrderSvc: authorized\n  OrderSvc->>Kafka: publish(order-confirmed)\n  OrderSvc-->>-APIGateway: 202 Accepted", preview: true },
    { type: "heading", level: 2, text: "SLA" },
    { type: "paragraph", text: "P99 response time < 200ms. Availability target 99.9%. See [[non-functional-requirements]] for full detail." },
  ]
};

const STATUS_COLORS = {
  draft: { bg: "#fff3cd", color: "#856404", border: "#ffc107" },
  "in-review": { bg: "#cce5ff", color: "#004085", border: "#004085" },
  stable: { bg: "#d4edda", color: "#155724", border: "#28a745" },
  deprecated: { bg: "#f5f5f5", color: "#666", border: "#ccc" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_COLORS[status as keyof typeof STATUS_COLORS] ?? STATUS_COLORS.draft;
  return (
    <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 8, letterSpacing: 0.3 }}>
      {status}
    </span>
  );
}

function FileNode({ node, depth = 0, selected, onSelect }: any) {
  const [open, setOpen] = useState(depth < 2);
  if (node.type === "dir") {
    return (
      <div>
        <div
          onClick={() => setOpen(!open)}
          style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 8px 4px", paddingLeft: 8 + depth * 14, cursor: "pointer", fontSize: 12, color: "#555", userSelect: "none" }}
        >
          <span style={{ fontSize: 10 }}>{open ? "▾" : "▸"}</span>
          <span>📁</span>
          <span style={{ fontWeight: 600 }}>{node.name}</span>
        </div>
        {open && node.children.map((child: any, i: number) => (
          <FileNode key={i} node={child} depth={depth + 1} selected={selected} onSelect={onSelect} />
        ))}
      </div>
    );
  }
  const isSelected = selected === node.name;
  return (
    <div
      onClick={() => onSelect(node.name)}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "3px 8px 3px", paddingLeft: 8 + depth * 14,
        cursor: "pointer", fontSize: 11,
        background: isSelected ? "#e8f0fe" : "transparent",
        color: isSelected ? "#1a73e8" : "#444",
      }}
    >
      <span>📄</span>
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {node.name.replace(".md", "")}
      </span>
      <StatusBadge status={node.status} />
    </div>
  );
}

function MermaidBlockUI({ block, showCode, onToggle }: any) {
  const [mode, setMode] = useState<"code" | "preview" | "split">("split");
  return (
    <div style={{ border: "1px solid #e0e0e0", borderRadius: 8, overflow: "hidden", margin: "10px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 10px", background: "#f8f9fa", borderBottom: "1px solid #e0e0e0" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#555" }}>📐 Diagram</span>
        <select style={{ fontSize: 10, border: "1px solid #ddd", borderRadius: 3, padding: "1px 4px", color: "#555" }}>
          <option>mermaid</option>
          <option>c4plantuml</option>
          <option>plantuml</option>
        </select>
        <div style={{ marginLeft: "auto", display: "flex", gap: 3 }}>
          {(["code", "split", "preview"] as const).map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              fontSize: 10, padding: "1px 7px", borderRadius: 4, cursor: "pointer",
              background: mode === m ? "#333" : "#fff", color: mode === m ? "#fff" : "#333",
              border: "1px solid #ccc",
            }}>
              {m === "code" ? "<>" : m === "split" ? "⊞" : "👁"}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: "flex" }}>
        {(mode === "code" || mode === "split") && (
          <pre style={{ flex: 1, margin: 0, padding: 12, background: "#1e1e1e", color: "#d4d4d4", fontSize: 11, lineHeight: 1.6, overflow: "auto" }}>
            {block.dsl}
          </pre>
        )}
        {(mode === "preview" || mode === "split") && (
          <div style={{ flex: 1, padding: 12, display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", minHeight: 120, borderLeft: mode === "split" ? "1px solid #e0e0e0" : "none" }}>
            {/* Simulated Kroki SVG preview */}
            <svg viewBox="0 0 320 140" width="100%" style={{ maxHeight: 140 }}>
              <defs>
                <marker id="arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="#666" />
                </marker>
              </defs>
              {/* Participants */}
              {["APIGateway", "OrderSvc", "PaymentSvc", "Kafka"].map((name, i) => (
                <g key={name}>
                  <rect x={10 + i * 77} y={4} width={70} height={20} rx={3} fill="#e3f2fd" stroke="#90caf9" strokeWidth="1" />
                  <text x={45 + i * 77} y={18} textAnchor="middle" fontSize={8} fill="#1565c0" fontFamily="monospace">{name}</text>
                  <line x1={45 + i * 77} y1={24} x2={45 + i * 77} y2={136} stroke="#ccc" strokeDasharray="3,3" />
                </g>
              ))}
              {/* Messages */}
              {[
                { y: 40, x1: 45, x2: 122, label: "CheckoutEvent", dir: 1 },
                { y: 60, x1: 122, x2: 199, label: "authorizePayment()", dir: 1 },
                { y: 78, x1: 199, x2: 122, label: "authorized", dir: -1 },
                { y: 96, x1: 122, x2: 276, label: "publish(order-confirmed)", dir: 1 },
                { y: 114, x1: 122, x2: 45, label: "202 Accepted", dir: -1 },
              ].map((msg, i) => (
                <g key={i}>
                  <line x1={msg.x1} y1={msg.y} x2={msg.x2} y2={msg.y} stroke={msg.dir > 0 ? "#1565c0" : "#666"} strokeWidth="1" markerEnd="url(#arrow)" />
                  <text x={(msg.x1 + msg.x2) / 2} y={msg.y - 3} textAnchor="middle" fontSize={7} fill="#555" fontFamily="monospace">{msg.label}</text>
                </g>
              ))}
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}

function BlockRenderer({ block }: { block: any }) {
  if (block.type === "heading") {
    const Tag = `h${block.level}` as any;
    const sizes = { 1: 22, 2: 17, 3: 14 };
    return <Tag style={{ margin: "16px 0 6px", fontWeight: 700, fontSize: sizes[block.level as 1|2|3], color: "#111", lineHeight: 1.3 }}>{block.text}</Tag>;
  }
  if (block.type === "paragraph") return <p style={{ margin: "6px 0", fontSize: 14, color: "#333", lineHeight: 1.7 }}>{block.text}</p>;
  if (block.type === "bulletItem") return <li style={{ fontSize: 14, color: "#333", lineHeight: 1.7, marginLeft: 20 }}>{block.text}</li>;
  if (block.type === "mermaid") return <MermaidBlockUI block={block} />;
  return null;
}

export default function App() {
  const [selectedFile, setSelectedFile] = useState<string | null>("order-service.md");
  const [status, setStatus] = useState(SAMPLE_DOC.frontmatter.status);
  const [isDirty, setIsDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showFM, setShowFM] = useState(true);
  const [activeTab, setActiveTab] = useState<"edit" | "raw">("edit");

  const handleSave = () => {
    setSaved(true);
    setIsDirty(false);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "'Inter', system-ui, sans-serif", background: "#fff", overflow: "hidden" }}>

      {/* Sidebar */}
      <aside style={{ width: 240, borderRight: "1px solid #e8eaed", background: "#fafafa", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "12px 12px 8px", borderBottom: "1px solid #e8eaed" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 16 }}>🏛️</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#202124" }}>arch-doc-system</div>
              <div style={{ fontSize: 10, color: "#80868b" }}>Obsidian Vault · 12 docs</div>
            </div>
          </div>
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: "4px 0" }}>
          {VAULT_TREE.map((node, i) => (
            <FileNode key={i} node={node} depth={0} selected={selectedFile} onSelect={setSelectedFile} />
          ))}
        </div>
        <div style={{ padding: "8px 10px", borderTop: "1px solid #e8eaed", background: "#f1f3f4" }}>
          <div style={{ fontSize: 10, color: "#80868b" }}>Kroki ● <span style={{ color: "#34a853" }}>connected</span></div>
        </div>
      </aside>

      {/* Main editor */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Toolbar */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderBottom: "1px solid #e8eaed", background: "#fff", flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: "#80868b", flex: 1 }}>
            📁 Components /&nbsp;
            <strong style={{ color: "#202124" }}>order-service.md</strong>
            {isDirty && <span style={{ color: "#f9ab00", marginLeft: 6 }}>● unsaved</span>}
          </span>

          {/* View tabs */}
          <div style={{ display: "flex", gap: 2, background: "#f1f3f4", borderRadius: 6, padding: 2 }}>
            {(["edit", "raw"] as const).map(t => (
              <button key={t} onClick={() => setActiveTab(t)} style={{
                fontSize: 11, padding: "3px 10px", borderRadius: 4, border: "none", cursor: "pointer",
                background: activeTab === t ? "#fff" : "transparent",
                color: activeTab === t ? "#1a73e8" : "#5f6368",
                fontWeight: activeTab === t ? 600 : 400,
                boxShadow: activeTab === t ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              }}>{t === "edit" ? "✏️ Edit" : "< > Raw"}</button>
            ))}
          </div>

          {/* Status selector */}
          <select
            value={status}
            onChange={e => { setStatus(e.target.value as any); setIsDirty(true); }}
            style={{ fontSize: 11, border: "1px solid #dadce0", borderRadius: 6, padding: "4px 8px", color: "#333", background: "#fff" }}
          >
            <option value="draft">🟡 draft</option>
            <option value="in-review">🔵 in-review</option>
            <option value="stable">🟢 stable</option>
            <option value="deprecated">⚫ deprecated</option>
          </select>

          {/* FM toggle */}
          <button onClick={() => setShowFM(!showFM)} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "1px solid #dadce0", background: showFM ? "#e8f0fe" : "#fff", color: showFM ? "#1a73e8" : "#555", cursor: "pointer" }}>
            ⚙️ Frontmatter
          </button>

          {/* Save */}
          <button onClick={handleSave} style={{
            fontSize: 11, padding: "4px 14px", borderRadius: 6, border: "none", cursor: "pointer",
            background: saved ? "#34a853" : "#1a73e8", color: "#fff", fontWeight: 600,
            transition: "background 0.3s",
          }}>
            {saved ? "✅ Saved" : "💾 Save"}
          </button>
        </div>

        {/* Editor + Frontmatter */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

          {/* Editor */}
          <div style={{ flex: 1, overflow: "auto", padding: "24px 48px" }} onClick={() => setIsDirty(true)}>
            {activeTab === "edit" ? (
              <div style={{ maxWidth: 720, margin: "0 auto" }}>
                {/* BlockNote toolbar sim */}
                <div style={{ display: "flex", gap: 2, marginBottom: 16, padding: "4px 8px", background: "#f8f9fa", borderRadius: 8, border: "1px solid #e8eaed", flexWrap: "wrap" }}>
                  {["B", "I", "U", "S", "H1", "H2", "H3", "—", "• List", "1. List", "> Quote", "```Code", "/📐 Diagram"].map((btn, i) => (
                    <button key={i} style={{
                      fontSize: btn.startsWith("/") ? 10 : 11, padding: "2px 7px", borderRadius: 4, border: btn === "—" ? "none" : "1px solid #e0e0e0",
                      background: btn.startsWith("/") ? "#e8f0fe" : "#fff", color: btn.startsWith("/") ? "#1a73e8" : "#333",
                      cursor: "pointer", fontWeight: ["B","H1","H2","H3"].includes(btn) ? 700 : 400,
                      fontStyle: btn === "I" ? "italic" : "normal",
                    }}>{btn}</button>
                  ))}
                </div>

                {/* Blocks */}
                <div style={{ outline: "none" }}>
                  {SAMPLE_DOC.blocks.map((block, i) => (
                    <BlockRenderer key={i} block={block} />
                  ))}
                </div>

                {/* Add block hint */}
                <div style={{ marginTop: 20, padding: "8px 12px", border: "1px dashed #e0e0e0", borderRadius: 6, color: "#bbb", fontSize: 12, cursor: "pointer" }}>
                  + Click to add block · type <code style={{background:"#f5f5f5", padding:"1px 4px", borderRadius:3}}>/</code> for commands · type <code style={{background:"#f5f5f5", padding:"1px 4px", borderRadius:3}}>/diagram</code> to insert Mermaid block
                </div>
              </div>
            ) : (
              <pre style={{ fontFamily: "monospace", fontSize: 11, color: "#333", lineHeight: 1.7, background: "#f8f9fa", padding: 20, borderRadius: 8, overflow: "auto" }}>{`---
title: Order Service
type: component
status: ${status}
created: 2026-05-15
updated: 2026-05-15
tags: [orders, kafka, backend]
relates_to:
  - "[[api-gateway]]"
  - "[[payment-service]]"
  - "[[container-diagram]]"
owner: platform-team
reviewed_by: "@arm"
---

# Order Service

## Overview
The Order Service is the core transaction processor...

## Responsibilities
- Validate incoming CheckoutEvent payloads
- Delegate payment authorization to Payment Service
- Publish order-confirmed events to Kafka

## Checkout Sequence

\`\`\`mermaid
sequenceDiagram
  APIGateway->>+OrderSvc: CheckoutEvent
  OrderSvc->>+PaymentSvc: authorizePayment()
  PaymentSvc-->>-OrderSvc: authorized
  OrderSvc->>Kafka: publish(order-confirmed)
  OrderSvc-->>-APIGateway: 202 Accepted
\`\`\`

## SLA
P99 response time < 200ms. Availability 99.9%.`}</pre>
            )}
          </div>

          {/* Frontmatter Panel */}
          {showFM && (
            <aside style={{ width: 220, borderLeft: "1px solid #e8eaed", background: "#fafafa", overflow: "auto", flexShrink: 0 }}>
              <div style={{ padding: "10px 12px", borderBottom: "1px solid #e8eaed", fontSize: 11, fontWeight: 700, color: "#5f6368" }}>
                ⚙️ FRONTMATTER
              </div>
              {[
                { label: "Title", value: SAMPLE_DOC.frontmatter.title, input: "text" },
                { label: "Type", value: SAMPLE_DOC.frontmatter.type, input: "text" },
                { label: "Owner", value: SAMPLE_DOC.frontmatter.owner, input: "text" },
                { label: "Reviewed by", value: SAMPLE_DOC.frontmatter.reviewed_by, input: "text" },
                { label: "Created", value: SAMPLE_DOC.frontmatter.created, input: "date" },
              ].map((f, i) => (
                <div key={i} style={{ padding: "8px 12px", borderBottom: "1px solid #f1f3f4" }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#80868b", marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.5 }}>{f.label}</div>
                  <input
                    defaultValue={f.value}
                    type={f.input}
                    onChange={() => setIsDirty(true)}
                    style={{ width: "100%", fontSize: 11, border: "1px solid #e0e0e0", borderRadius: 4, padding: "3px 6px", color: "#333", background: "#fff", boxSizing: "border-box" }}
                  />
                </div>
              ))}

              {/* Tags */}
              <div style={{ padding: "8px 12px", borderBottom: "1px solid #f1f3f4" }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#80868b", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Tags</div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {SAMPLE_DOC.frontmatter.tags.map((tag, i) => (
                    <span key={i} style={{ background: "#e8f0fe", color: "#1a73e8", fontSize: 9, padding: "2px 6px", borderRadius: 10, fontWeight: 600 }}>
                      {tag} ✕
                    </span>
                  ))}
                  <span style={{ background: "#f1f3f4", color: "#80868b", fontSize: 9, padding: "2px 6px", borderRadius: 10, cursor: "pointer" }}>+ add</span>
                </div>
              </div>

              {/* Relates to */}
              <div style={{ padding: "8px 12px" }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#80868b", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Relates to</div>
                {SAMPLE_DOC.frontmatter.relates_to.map((link, i) => (
                  <div key={i} style={{ fontSize: 10, color: "#1a73e8", marginBottom: 3, cursor: "pointer" }}>🔗 {link}</div>
                ))}
                <div style={{ fontSize: 10, color: "#80868b", cursor: "pointer", marginTop: 4 }}>+ add wikilink</div>
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
