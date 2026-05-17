import { deflateSync } from "node:zlib";
export function buildKrokiUrl(diagramType, dsl, format) {
    const base = process.env.KROKI_URL ?? "https://kroki.io";
    const compressed = deflateSync(Buffer.from(dsl, "utf-8"), { level: 9 });
    const encoded = compressed
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");
    return `${base}/${diagramType}/${format}/${encoded}`;
}
export async function renderDiagram(req) {
    const format = req.outputFormat ?? "svg";
    const url = buildKrokiUrl(req.diagramType, req.dsl, format);
    const mermaidBlock = ["```mermaid", req.dsl.trim(), "```"].join("\n");
    return { url, diagramType: req.diagramType, outputFormat: format, mermaidBlock };
}
export const TEMPLATE_KROKI_MAP = {
    "sad": { type: "mermaid", dslHint: "C4Context or flowchart TB" },
    "c4-context": { type: "c4plantuml", dslHint: "C4Context (PlantUML macros)" },
    "c4-container": { type: "c4plantuml", dslHint: "C4Container (PlantUML macros)" },
    "c4-component": { type: "c4plantuml", dslHint: "C4Component (PlantUML macros)" },
    "data-architecture": { type: "mermaid", dslHint: "erDiagram" },
    "integration-architecture": { type: "mermaid", dslHint: "sequenceDiagram" },
    "security-architecture": { type: "mermaid", dslHint: "flowchart TB" },
    "infrastructure-architecture": { type: "mermaid", dslHint: "flowchart TB (cloud topology)" },
    "runbook": { type: "mermaid", dslHint: "flowchart TD" },
};
export function buildDslPrompt(templateId, systemName, description) {
    const hints = {
        "c4-context": `Generate C4PlantUML C4Context DSL for "${systemName}". ${description}
Show: the system, all human actors, and all external systems.
No internal components. DSL must start with @startuml and use C4Context macros.`,
        "c4-container": `Generate C4PlantUML C4Container DSL for "${systemName}". ${description}
Show: all deployable containers (frontend, APIs, DBs, queues, caches).
Include technology labels and communication protocols.`,
        "c4-component": `Generate C4PlantUML C4Component DSL for "${systemName}". ${description}
Show: internal components (controller, service layer, repository, event publisher).`,
        "data-architecture": `Generate Mermaid erDiagram for "${systemName}". ${description}
Show: all entities with PK/FK fields and cardinality.`,
        "integration-architecture": `Generate Mermaid sequenceDiagram for "${systemName}". ${description}
Show: complete message flow with request/response and async events.`,
        "infrastructure-architecture": `Generate Mermaid flowchart TB for "${systemName}" infrastructure. ${description}
Use subgraph for VPC/subnet zones. Show LB, compute, DB, queue.`,
        "runbook": `Generate Mermaid flowchart TD for "${systemName}" incident flow. ${description}
Show: alert → triage → resolution decision tree.`,
    };
    return hints[templateId] ?? `Generate ${TEMPLATE_KROKI_MAP[templateId]?.dslHint ?? "diagram"} DSL for "${systemName}". ${description}`;
}
