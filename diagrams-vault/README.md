# Diagrams Vault

Diagram-as-code source files for the excalidraw-mcp project.  
Each `.md` file is a diagram rendered by [Kroki](https://kroki.io) and displayed as an embedded SVG image in an Excalidraw scene.

## Structure

```
diagrams-vault/
├── Architecture/     ← system and component diagrams
├── Flows/            ← user flows, business processes
├── Sequences/        ← sequence and interaction diagrams
└── Infrastructure/   ← deployment, networking, infra diagrams
```

## Markdown format

```markdown
---
title: System Architecture
format: mermaid
scene: architecture.excalidraw
fileId: <hex — links to scene.files>
elementId: <hex — image element ID in scene>
tags: [architecture, backend]
created: 2025-01-15
updated: 2025-01-15
---

# System Architecture

> One-line description

​```mermaid
graph LR
  Browser --> API
​```
```

## Supported formats

`mermaid` · `plantuml` · `graphviz` · `d2` · `c4plantuml` · `structurizr` · `bpmn` · `erd` · `nomnoml` · and ~20 more via Kroki.

## Usage

Use the MCP tools from Claude Desktop:

- `create_diagram` — write source + render to scene
- `update_diagram` — edit source + re-render in-place
- `render_diagram` — re-place into a scene (e.g. after clear)
- `get_diagram` — read source
- `list_diagrams` — browse by folder
- `git_log` / `git_status` — version history

Open this folder directly in [Obsidian](https://obsidian.md) for a visual diagram library.
