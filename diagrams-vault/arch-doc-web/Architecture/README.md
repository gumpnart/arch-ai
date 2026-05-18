# Architecture

This folder holds all architecture-level documentation for the project.

## Document Types

| Type | Naming | Purpose |
|---|---|---|
| SAD | `SAD-<project>.md` | Solution Architecture Document — the primary reference |
| ADR | `ADR/ADR-NNN-<title>.md` | Architecture Decision Records |
| C4 Context | `Diagrams/system-context.md` | C4 Level 1 — system boundary |
| C4 Container | `Diagrams/container.md` | C4 Level 2 — containers/services |
| C4 Component | `Diagrams/component-<svc>.md` | C4 Level 3 — internal components |
| NFR | `nfr.md` | Non-Functional Requirements |
| Risk Register | `risk-register.md` | Risks and mitigations |

## Getting Started

1. Copy `SAD-template.md` → rename to `SAD-<your-project>.md` and fill in placeholders
2. Copy `ADR/ADR-000-template.md` → `ADR/ADR-001-<decision-title>.md` for first decision
3. Run `create_diagram` with format `mermaid` to generate a system context diagram
