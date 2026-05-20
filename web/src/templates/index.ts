export interface Template {
  id: string;
  name: string;
  description: string;
  icon: string;
  /** Returns { relativePath: content } — paths are relative to the project root folder */
  scaffold: (name: string, date: string) => Record<string, string>;
}

function isoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Architecture Project ──────────────────────────────────────────────────────

function archProjectScaffold(name: string, date: string): Record<string, string> {
  return {
    "README.md":
      `---\ntitle: ${name}\ntype: readme\nstatus: draft\ncreated: ${date}\nupdated: ${date}\ntags: [project, readme]\nrelates_to: []\n---\n\n` +
      `# ${name}\n\n` +
      `## Quick Start\n\n` +
      `1. Fill in \`Architecture/SAD-template.md\` — rename it and replace all \`[PLACEHOLDER]\` markers\n` +
      `2. Copy \`Architecture/ADR/ADR-000-template.md\` → \`ADR-001-<decision>.md\` for your first decision\n` +
      `3. Create a system context diagram in \`Architecture/Diagrams/\`\n` +
      `4. Add an overview document in \`Notes/\`\n\n` +
      `## Folder Guide\n\n` +
      `| Folder | Purpose | Typical Documents |\n` +
      `|---|---|---|\n` +
      `| \`Architecture/\` | System structure and decisions | SAD, ADRs, C4 diagrams, NFRs, Risk Register |\n` +
      `| \`Flows/\` | User and business process flows | Flowcharts, state machines |\n` +
      `| \`Sequences/\` | Component interaction over time | Sequence diagrams, API call flows |\n` +
      `| \`Infrastructure/\` | Deployment and operations | Topology diagrams, DR plan, CI/CD pipeline |\n` +
      `| \`Notes/\` | Unstructured working documents | Meeting notes, spike reports, glossary |\n\n` +
      `## Document Status Lifecycle\n\n` +
      `- \`status: draft\` — AI-generated or in progress, awaiting human review\n` +
      `- \`status: in-review\` — PR open, under peer review\n` +
      `- \`status: stable\` — Merged, human-verified, published\n` +
      `- \`status: deprecated\` — Superseded, kept for history\n\n` +
      `## Conventions\n\n` +
      `- Diagrams stored as Mermaid DSL in code blocks — never binary images\n` +
      `- Every doc has YAML frontmatter with \`title\`, \`type\`, \`status\`, \`tags\`, \`relates_to\`\n` +
      `- Use wikilinks \`[[note-name]]\` for cross-references between documents\n` +
      `- Git branch naming: \`docs/feat-*\` for new docs, \`docs/fix-*\` for corrections\n`,

    "Architecture/README.md":
      `# Architecture\n\n` +
      `This folder holds all architecture-level documentation for the project.\n\n` +
      `## Document Types\n\n` +
      `| Type | Naming | Purpose |\n` +
      `|---|---|---|\n` +
      `| SAD | \`SAD-<project>.md\` | Solution Architecture Document — the primary reference |\n` +
      `| ADR | \`ADR/ADR-NNN-<title>.md\` | Architecture Decision Records |\n` +
      `| C4 Context | \`Diagrams/system-context.md\` | C4 Level 1 — system boundary |\n` +
      `| C4 Container | \`Diagrams/container.md\` | C4 Level 2 — containers/services |\n` +
      `| NFR | \`nfr.md\` | Non-Functional Requirements |\n` +
      `| Risk Register | \`risk-register.md\` | Risks and mitigations |\n\n` +
      `## Getting Started\n\n` +
      `1. Copy \`SAD-template.md\` → rename to \`SAD-${name}.md\` and fill in placeholders\n` +
      `2. Copy \`ADR/ADR-000-template.md\` → \`ADR/ADR-001-<decision-title>.md\` for first decision\n`,

    "Architecture/SAD-template.md":
      `---\ntitle: "${name} — Solution Architecture Document"\ntype: sad\nstatus: draft\ncreated: ${date}\nupdated: ${date}\nowner: "[PLACEHOLDER: Team Name]"\ntags: [architecture, sad]\nrelates_to: []\n---\n\n` +
      `# ${name} — Solution Architecture Document\n\n` +
      `## 1. Executive Summary\n\n[PLACEHOLDER: 2–3 sentences describing what this system does and why it exists.]\n\n` +
      `## 2. Business Context\n\n### 2.1 Business Goals\n\n- [PLACEHOLDER: Goal 1]\n- [PLACEHOLDER: Goal 2]\n\n` +
      `### 2.2 Stakeholders\n\n| Stakeholder | Role | Interest |\n|---|---|---|\n| [PLACEHOLDER] | [PLACEHOLDER] | [PLACEHOLDER] |\n\n` +
      `## 3. System Overview\n\n### 3.1 Scope\n\n[PLACEHOLDER: Define what is in scope and what is explicitly out of scope.]\n\n` +
      `### 3.2 System Context\n\n\`\`\`mermaid\nflowchart TB\n  subgraph users["Users"]\n    User["[PLACEHOLDER: User]"]\n  end\n  subgraph system["${name}"]\n    Core["[PLACEHOLDER: Core Service]"]\n  end\n  subgraph external["External Systems"]\n    Ext["[PLACEHOLDER: External System]"]\n  end\n\n  User -->|"[PLACEHOLDER: action]"| Core\n  Core -->|"[PLACEHOLDER: integration]"| Ext\n\`\`\`\n\n` +
      `## 4. Architecture Decisions\n\n| Decision | Rationale | Alternatives Considered |\n|---|---|---|\n| [PLACEHOLDER] | [PLACEHOLDER] | [PLACEHOLDER] |\n\n` +
      `## 5. Architecture Views\n\n### 5.1 Logical Architecture\n\n[PLACEHOLDER: Describe the major logical layers or domains.]\n\n` +
      `### 5.2 Physical Architecture\n\n[PLACEHOLDER: Describe deployment topology.]\n\n` +
      `## 6. Quality Attributes\n\n| Attribute | Requirement | Mechanism |\n|---|---|---|\n| Availability | [PLACEHOLDER] | [PLACEHOLDER] |\n| Performance | [PLACEHOLDER] | [PLACEHOLDER] |\n| Security | [PLACEHOLDER] | [PLACEHOLDER] |\n\n` +
      `## 7. Technology Stack\n\n| Layer | Technology | Version | Rationale |\n|---|---|---|---|\n| [PLACEHOLDER] | [PLACEHOLDER] | [PLACEHOLDER] | [PLACEHOLDER] |\n\n` +
      `## 8. Cross-Cutting Concerns\n\n### 8.1 Security\n\n[PLACEHOLDER]\n\n### 8.2 Observability\n\n[PLACEHOLDER]\n\n### 8.3 Disaster Recovery\n\n- RTO: [PLACEHOLDER]\n- RPO: [PLACEHOLDER]\n\n` +
      `## 9. Risks and Mitigations\n\n| Risk | Likelihood | Impact | Mitigation |\n|---|---|---|---|\n| [PLACEHOLDER] | Low/Med/High | Low/Med/High | [PLACEHOLDER] |\n\n` +
      `## 10. Open Questions\n\n- [ ] [PLACEHOLDER: Question 1]\n- [ ] [PLACEHOLDER: Question 2]\n`,

    "Architecture/ADR/ADR-000-template.md":
      `---\ntitle: "ADR-000: [PLACEHOLDER: Decision Title]"\ntype: adr\nstatus: proposed\ncreated: ${date}\nupdated: ${date}\nowner: "[PLACEHOLDER: Team Name]"\ndeciders: ["[PLACEHOLDER: Name]"]\ntags: [adr, decision]\nrelates_to: [Architecture/SAD-template]\n---\n\n` +
      `# ADR-000: [PLACEHOLDER: Decision Title]\n\n` +
      `## Status\n\n**Proposed** — ${date}\n\n` +
      `## Context\n\n[PLACEHOLDER: Describe the situation that forces a decision.]\n\n` +
      `### Forces\n\n* [PLACEHOLDER: Force 1]\n* [PLACEHOLDER: Force 2]\n\n` +
      `## Decision\n\n[PLACEHOLDER: "We will …"]\n\n` +
      `## Consequences\n\n### Positive\n\n* [PLACEHOLDER]\n\n### Negative\n\n* [PLACEHOLDER]\n\n### Risks\n\n* [PLACEHOLDER]\n\n` +
      `## Alternatives Considered\n\n### Option 1: [PLACEHOLDER]\n\n**Pros**: [PLACEHOLDER]\\\n**Cons**: [PLACEHOLDER]\n\n` +
      `## Implementation Notes\n\n[PLACEHOLDER]\n\n` +
      `## Review Date\n\n[PLACEHOLDER: YYYY-MM-DD]\n`,

    "Flows/README.md":
      `# Flows\n\nUser flows, business process flows, and state machine diagrams.\n\n` +
      `## Mermaid Examples\n\n\`\`\`mermaid\nflowchart TD\n  Start([Start]) --> Step1[Step One]\n  Step1 --> Decision{Condition?}\n  Decision -- Yes --> Step2[Step Two]\n  Decision -- No --> End([End])\n  Step2 --> End\n\`\`\`\n`,

    "Sequences/README.md":
      `# Sequences\n\nSequence and interaction diagrams showing how components communicate over time.\n\n` +
      `## Mermaid Example\n\n\`\`\`mermaid\nsequenceDiagram\n  actor User\n  participant Gateway as API Gateway\n  participant Service as Target Service\n\n  User->>Gateway: POST /request\n  Gateway->>Service: Forward request\n  Service-->>Gateway: Response\n  Gateway-->>User: 200 OK\n\`\`\`\n`,

    "Infrastructure/README.md":
      `# Infrastructure\n\nDeployment, cloud, networking, and disaster-recovery documentation.\n\n` +
      `## Mermaid Example\n\n\`\`\`mermaid\ngraph TB\n  subgraph cloud["Cloud Region"]\n    LB[Load Balancer]\n    App[App Server]\n    DB[(Database)]\n  end\n  Internet([Internet]) --> LB\n  LB --> App\n  App --> DB\n\`\`\`\n`,

    "Notes/README.md":
      `# Notes\n\nMeeting notes, spike reports, overview documents, and other working content.\n\n` +
      `| Type | Naming | Purpose |\n` +
      `|---|---|---|\n` +
      `| Meeting Note | \`YYYY-MM-DD-<topic>.md\` | Decision log from architecture reviews |\n` +
      `| Spike Report | \`spike-<topic>.md\` | Time-boxed investigation findings |\n` +
      `| Overview | \`overview.md\` | Narrative introduction to the project |\n` +
      `| Glossary | \`glossary.md\` | Project-specific terms and acronyms |\n`,
  };
}

// ── API Service ───────────────────────────────────────────────────────────────

function apiServiceScaffold(name: string, date: string): Record<string, string> {
  return {
    "README.md":
      `---\ntitle: ${name}\ntype: readme\nstatus: draft\ncreated: ${date}\nupdated: ${date}\ntags: [api, readme]\nrelates_to: []\n---\n\n` +
      `# ${name}\n\n` +
      `API service documentation — endpoints, sequences, and integration contracts.\n\n` +
      `## Folders\n\n` +
      `| Folder | Purpose |\n` +
      `|---|---|\n` +
      `| \`Sequences/\` | API call flows and interaction diagrams |\n` +
      `| \`Flows/\` | Business process and state machine diagrams |\n` +
      `| \`Architecture/\` | Component and C4 diagrams |\n` +
      `| \`Notes/\` | Design notes and spike reports |\n`,

    "Sequences/api-overview.md":
      `---\ntitle: "${name} — API Overview"\ntype: document\nstatus: draft\ncreated: ${date}\nupdated: ${date}\ntags: [api, sequences]\nrelates_to: []\n---\n\n` +
      `# ${name} — API Overview\n\n` +
      `[PLACEHOLDER: Brief description of this service's API surface.]\n\n` +
      `## Authentication Flow\n\n\`\`\`mermaid\nsequenceDiagram\n  actor Client\n  participant Gateway as API Gateway\n  participant Auth as Auth Service\n  participant API as ${name}\n\n  Client->>Gateway: Request + Bearer token\n  Gateway->>Auth: Validate token\n  Auth-->>Gateway: 200 OK + claims\n  Gateway->>API: Forward + X-User-Id header\n  API-->>Gateway: Response\n  Gateway-->>Client: Response\n\`\`\`\n\n` +
      `## Key Endpoints\n\n| Method | Path | Description |\n|---|---|---|\n| GET | /[PLACEHOLDER] | [PLACEHOLDER] |\n| POST | /[PLACEHOLDER] | [PLACEHOLDER] |\n\n` +
      `## Error Codes\n\n| Code | Meaning |\n|---|---|\n| 400 | [PLACEHOLDER] |\n| 401 | Unauthenticated |\n| 403 | Forbidden |\n| 404 | Not Found |\n| 500 | Internal error |\n`,

    "Flows/state-machine.md":
      `---\ntitle: "${name} — State Machine"\ntype: document\nstatus: draft\ncreated: ${date}\nupdated: ${date}\ntags: [flows, state]\nrelates_to: []\n---\n\n` +
      `# ${name} — State Machine\n\n` +
      `[PLACEHOLDER: Describe the entity or resource lifecycle managed by this service.]\n\n` +
      `\`\`\`mermaid\nstateDiagram-v2\n  [*] --> Created : POST /[PLACEHOLDER]\n  Created --> Active : activate\n  Active --> Suspended : suspend\n  Suspended --> Active : resume\n  Active --> Closed : close\n  Closed --> [*]\n\`\`\`\n`,

    "Architecture/component.md":
      `---\ntitle: "${name} — Component Diagram"\ntype: document\nstatus: draft\ncreated: ${date}\nupdated: ${date}\ntags: [architecture, component]\nrelates_to: []\n---\n\n` +
      `# ${name} — Component Diagram\n\n` +
      `[PLACEHOLDER: Describe the internal components of this service.]\n\n` +
      `\`\`\`mermaid\nflowchart LR\n  Client([Client]) --> API[REST API]\n  API --> Service[Service Layer]\n  Service --> Repo[Repository]\n  Repo --> DB[(Database)]\n  Service --> Queue[Message Queue]\n\`\`\`\n`,

    "Notes/decisions.md":
      `---\ntitle: "${name} — Design Decisions"\ntype: document\nstatus: draft\ncreated: ${date}\nupdated: ${date}\ntags: [notes, decisions]\nrelates_to: []\n---\n\n` +
      `# ${name} — Design Decisions\n\n` +
      `Running log of key design choices made during development.\n\n` +
      `| Decision | Rationale | Date |\n` +
      `|---|---|---|\n` +
      `| [PLACEHOLDER] | [PLACEHOLDER] | ${date} |\n`,
  };
}

// ── ADR Collection ────────────────────────────────────────────────────────────

function adrCollectionScaffold(name: string, date: string): Record<string, string> {
  return {
    "README.md":
      `---\ntitle: ${name}\ntype: readme\nstatus: draft\ncreated: ${date}\nupdated: ${date}\ntags: [adr, readme]\nrelates_to: []\n---\n\n` +
      `# ${name} — Architecture Decision Records\n\n` +
      `A lightweight ADR log. Each decision is a single Markdown file.\n\n` +
      `## Status Values\n\n` +
      `- \`proposed\` — Under discussion\n` +
      `- \`accepted\` — Agreed and in effect\n` +
      `- \`rejected\` — Considered and ruled out\n` +
      `- \`deprecated\` — Superseded by a newer ADR\n\n` +
      `## Index\n\n` +
      `| ADR | Title | Status |\n` +
      `|---|---|---|\n` +
      `| ADR-000 | Template | — |\n`,

    "ADR-000-template.md":
      `---\ntitle: "ADR-000: [PLACEHOLDER: Decision Title]"\ntype: adr\nstatus: proposed\ncreated: ${date}\nupdated: ${date}\nowner: "[PLACEHOLDER: Team Name]"\ndeciders: ["[PLACEHOLDER: Name]"]\ntags: [adr, decision]\nrelates_to: []\n---\n\n` +
      `# ADR-000: [PLACEHOLDER: Decision Title]\n\n` +
      `## Status\n\n**Proposed** — ${date}\n\n` +
      `## Context\n\n[PLACEHOLDER: What is the problem? What constraints exist?]\n\n` +
      `### Forces\n\n* [PLACEHOLDER: Force 1]\n* [PLACEHOLDER: Force 2]\n\n` +
      `## Decision\n\n[PLACEHOLDER: "We will …"]\n\n` +
      `## Consequences\n\n### Positive\n\n* [PLACEHOLDER]\n\n### Negative\n\n* [PLACEHOLDER]\n\n` +
      `## Alternatives Considered\n\n### Option 1: [PLACEHOLDER]\n\n**Pros**: [PLACEHOLDER]\\\n**Cons**: [PLACEHOLDER]\n\n` +
      `## Review Date\n\n[PLACEHOLDER: YYYY-MM-DD]\n`,
  };
}

// ── Exported templates ────────────────────────────────────────────────────────

export const TEMPLATES: Template[] = [
  {
    id: "architecture-project",
    name: "Architecture Project",
    description: "Full SA documentation scaffold: SAD, ADRs, per-folder READMEs, and Mermaid diagram starters.",
    icon: "Compass",
    scaffold: archProjectScaffold,
  },
  {
    id: "api-service",
    name: "API Service",
    description: "REST API documentation with auth sequence, state machine, component diagram, and design log.",
    icon: "PlugsConnected",
    scaffold: apiServiceScaffold,
  },
  {
    id: "adr-collection",
    name: "ADR Collection",
    description: "Lightweight Architecture Decision Record log with an index README and starter template.",
    icon: "ClipboardText",
    scaffold: adrCollectionScaffold,
  },
];

export function getTemplateById(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

export { isoDate };
