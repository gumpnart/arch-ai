---
title: "arch-doc-system — System Context (C4 Level 1)"
type: c4-context
status: example
created: 2026-05-16
updated: 2026-05-16
owner: Architecture Team
tags: [c4, context, diagram, arch-doc-system]
relates_to: [Architecture/sad]
---

# arch-doc-system — System Context

> C4 Level 1: shows the arch-doc-system and its relationship to users and external systems.

```mermaid
flowchart TB
  subgraph users["People"]
    SA["Solution Architect\n(Primary User)"]
    Dev["Developer\n(Doc Consumer)"]
  end

  subgraph system["arch-doc-system [System Boundary]"]
    MCP["arch-doc-mcp\nMCP Server"]
    Kroki["Kroki\nDiagram Renderer"]
    Vault["Obsidian Vault"]
    Site["VitePress Site"]
  end

  subgraph ext["External Systems"]
    ClaudeAI["Claude AI\n[External — claude.ai]"]
    GitHub["GitHub\n[External — git remote + CI/CD]"]
    GHPages["GitHub Pages\n[External — hosting]"]
  end

  SA -->|"Chat + MCP tools"| ClaudeAI
  ClaudeAI -->|"stdio MCP"| MCP
  MCP -->|"HTTP"| Kroki
  MCP -->|"Returns filled templates"| ClaudeAI
  ClaudeAI -->|"Saves reviewed .md"| Vault
  Vault -->|"git push"| GitHub
  GitHub -->|"Actions: build + deploy"| GHPages
  Dev -->|"Reads"| Site
  GHPages -->|"Serves"| Site
```

## Actors

| Actor | Type | Description |
|---|---|---|
| Solution Architect | Human | Creates and reviews architecture documents using Claude |
| Developer | External User | Reads published documentation on the VitePress site |

## External Systems

| System | Owner | Integration | Data Exchanged |
|---|---|---|---|
| Claude AI (claude.ai) | Anthropic | MCP protocol (stdio) | Tool calls, template content |
| GitHub | GitHub Inc. | Git remote + GitHub Actions | Markdown files, build artifacts |
| GitHub Pages | GitHub Inc. | Static site hosting | HTML/CSS/JS site |

## Key Decisions
- The MCP server runs as a local process — no cloud deployment needed for the AI layer
- Kroki runs in Docker — fully self-hosted, no external API calls for diagram rendering
- The vault is a git repository — every document change is versioned and auditable
