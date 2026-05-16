---
title: Architecture Documentation Vault
type: readme
status: stable
created: 2026-05-16
tags: [vault, readme]
relates_to: []
---

# Architecture Documentation Vault

## Structure
- `Architecture/` — SAD, NFR, C4 diagrams, ADRs, Risk Register
- `Architecture/Diagrams/` — C4 Level 1, 2, 3 diagrams
- `Architecture/ADR/` — Architecture Decision Records (ADR-NNN-title.md)
- `Components/` — Per-service component docs
- `Infrastructure/` — Cloud, networking, DR docs
- `Runbooks/` — Operations runbooks per service

## Document Status Lifecycle
- `status: draft` — AI-generated, awaiting human review
- `status: in-review` — PR open, under peer review
- `status: stable` — Merged, human-verified, published
- `status: deprecated` — Superseded, kept for history

## Conventions
- All docs are AI-drafted, human-verified before commit
- Diagrams stored as Mermaid DSL in code blocks — never binary images
- Every doc has YAML frontmatter with `status`, `tags`, `relates_to`
- Wikilinks `[[note-name]]` for cross-references
- Git branch: `docs/feat-*` for new docs, `docs/fix-*` for corrections
- PR review required before merge to `main`
