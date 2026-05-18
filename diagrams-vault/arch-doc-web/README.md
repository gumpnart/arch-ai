---
title: arch-doc-web
type: readme
status: draft
created: 2026-05-18
updated: 2026-05-18
tags: [project, readme]
relates_to: []
---

# arch-doc-web

Architecture documentation for the arch-doc web editor (React + BlockNote + TanStack Start)

## Quick Start

1. Fill in `Architecture/SAD-template.md` — rename it and replace all `[PLACEHOLDER]` markers
2. Copy `Architecture/ADR/ADR-000-template.md` → `ADR-001-<decision>.md` for your first decision
3. Ask Claude: *"Create a system context diagram for arch-doc-web in Architecture/Diagrams/"*
4. Ask Claude: *"Create an overview document in Notes/ for arch-doc-web"*

## Folder Guide

| Folder | Purpose | Typical Documents |
|---|---|---|
| `Architecture/` | System structure and decisions | SAD, ADRs, C4 diagrams, NFRs, Risk Register |
| `Flows/` | User and business process flows | Flowcharts, state machines |
| `Sequences/` | Component interaction over time | Sequence diagrams, API call flows |
| `Infrastructure/` | Deployment and operations | Topology diagrams, DR plan, CI/CD pipeline |
| `Notes/` | Unstructured working documents | Meeting notes, spike reports, glossary |

## Document Status Lifecycle

- `status: draft` — AI-generated or in progress, awaiting human review
- `status: in-review` — PR open, under peer review
- `status: stable` — Merged, human-verified, published
- `status: deprecated` — Superseded, kept for history

## Conventions

- Diagrams stored as Mermaid DSL in code blocks — never binary images
- Every doc has YAML frontmatter with `title`, `type`, `status`, `tags`, `relates_to`
- Use wikilinks `[[note-name]]` for cross-references between documents
- Git branch naming: `docs/feat-*` for new docs, `docs/fix-*` for corrections
- PR review required before merging to `main`
