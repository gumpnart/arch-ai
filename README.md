# software-arch-ai

AI-powered architecture documentation system. Two integrated stacks:

1. **arch-doc-system** — SA document templates + Kroki bridge MCP server, Obsidian vault, VitePress static site, BlockNote web editor
2. **excalidraw-mcp** (legacy) — diagram-as-code MCP + Kroki + vault editor Docker stack

---

## arch-doc-system (Phases 1–9)

```
Claude (claude.ai)
  ↓ MCP stdio
arch-doc-mcp        Node.js — 12 SA templates + Kroki bridge (8 tools)
  ↓ HTTP
Kroki Server        Docker — diagram DSL → SVG/PNG (port 8000)

vault/              Git repo — Obsidian .md files, human-verified
  ↓ git push
GitHub Actions      CI/CD — build + deploy to GitHub Pages
  ↓
VitePress Site       Static site — published docs

Browser → web/      React + BlockNote editor (port 5173)
  ↓ fetch /api/*
web/server/         Express API — reads/writes vault files
  ↓ proxy
Kroki :8000         Diagram preview rendering
```

### arch-doc-mcp Tools

| Tool | Description |
|---|---|
| `list_templates` | List all 12 SA templates (optional category filter) |
| `get_template` | Get full template content by ID |
| `get_template_placeholders` | List `{{var}}` placeholders in a template |
| `fill_template` | Fill placeholders with values |
| `get_document_checklist` | Documents needed per project phase |
| `generate_document` | Description → filled draft |
| `render_and_embed_diagram` | Render DSL via Kroki + embed in template |
| `get_diagram_dsl_prompt` | DSL generation instructions for a diagram type |

### Quick Start

```bash
# 1. Build MCP server
cd arch-doc-mcp && npm install && npm run build

# 2. Start Kroki
cd kroki && docker compose up -d

# 3. Start web editor
cd web && VAULT_PATH=../vault npm run dev
# → http://localhost:5173

# 4. Run tests
cd arch-doc-mcp && npm test
```

### MCP Config (Claude Code CLI)

`.claude/mcp.json` is pre-configured for both `arch-doc-mcp` and `kroki-mcp`.

---

## excalidraw-mcp (legacy)

**Docker stack** for generating and managing software architecture diagrams as code, with a Claude MCP server backed by [Kroki](https://kroki.io) and a **BlockNote-powered vault editor**.

```
MCP Tools
  render_diagram      ──►  Format + source → SVG (via Kroki)
  create_diagram      ──►  Save .md to vault (code fence + YAML frontmatter)
  update_diagram      ──►  Edit source in-place → auto re-renders in editor
  get_diagram         ──►  Read source + metadata
  list_diagrams       ──►  Browse vault by folder
  delete_diagram      ──►  Delete a diagram
  list_formats        ──►  All Kroki-supported formats
  create_document     ──►  Structured .md with optional diagram embeds
  init_project        ──►  Scaffold vault folder structure + git
  git_status          ──►  Branch, remote, changed files
  git_commit          ──►  Add + commit + push

Vault Editor (port 4000)
  BlockNote editor     ──►  Notion-style WYSIWYG with dark theme
  DiagramBlock         ──►  Code left | live Kroki SVG right — auto-renders on load
  Round-trip fidelity  ──►  Saves back as code fences (Obsidian-compatible)
```

```
Claude Desktop ──stdio (docker exec)──►  mcp-server ──┐
Claude Code    ──HTTPS──►  mcp-tls ────►  mcp-server  ├── KROKI_URL → kroki:8000
                          (port 3443)   (port 3002)   │
                                                      └── VAULT_PATH → diagrams-vault/
Vault Editor (port 4000) ←── bridge API (port 3001) ─── diagrams-vault/ (git repo)
```

---

## Supported Diagram Formats

All formats are rendered by [Kroki](https://kroki.io):

| Format | Keyword | Use case |
|---|---|---|
| Mermaid | `mermaid` | Flowcharts, sequence, ER, Gantt, class diagrams |
| PlantUML | `plantuml` | UML diagrams, component, deployment |
| Graphviz | `graphviz` | General-purpose graphs and DAGs |
| D2 | `d2` | Modern infrastructure and architecture diagrams |
| C4 PlantUML | `c4plantuml` | C4 model (context, container, component, code) |
| Structurizr | `structurizr` | Architecture as code (Structurizr DSL) |
| BPMN | `bpmn` | Business process diagrams |
| ERD | `erd` | Entity-relationship diagrams |
| Nomnoml | `nomnoml` | UML in lightweight text notation |
| Ditaa | `ditaa` | ASCII art → diagrams |
| WaveDrom | `wavedrom` | Digital timing diagrams |
| Vega / Vega-Lite | `vega` / `vega-lite` | Data visualisations |
| Pikchr | `pikchr` | Technical illustrations |
| DBML | `dbml` | Database schema diagrams |

---

## Vault Editor (port 4000)

Browser-based Markdown editor built with **Astro + React + BlockNote**.

| Feature | Details |
|---|---|
| **Inline diagram blocks** | Code blocks with diagram languages auto-load as split-pane DiagramBlocks |
| **Code + preview** | Source code (left) + Kroki SVG (right) — side by side in the block |
| **Auto-render** | Renders on block load; debounced re-render as you type |
| **Format selector** | Switch format (mermaid → d2 → plantuml …) from a dropdown in the block |
| **Round-trip fidelity** | Saves diagram blocks back as code fences — compatible with Obsidian |
| **Frontmatter** | Toggle ⚙ Meta to view preserved YAML frontmatter |
| **Diagram insert** | ◈ Diagram button → pick format + write code + Kroki preview → save to vault |
| **Git status & commit** | ⎇ Git modal: commit message + push; clone from URL |
| **SSE sync** | Sidebar auto-refreshes when Claude writes files via MCP |
| **Ctrl+S save** | Serialises blocks → Markdown |

---

## Quick Start

### 1. Prerequisites

- **Docker + Docker Compose**
- **Claude Desktop** and/or **Claude Code CLI**
- `git` on the host (for vault setup)

### 2. Start the stack

```bash
docker compose up --build -d
```

Services started:

| Service | URL | Purpose |
|---|---|---|
| `bridge` | http://localhost:3001 | Vault file API + SSE live-reload |
| `kroki` | http://localhost:8000 | Diagram renderer |
| `mermaid` | internal | Kroki companion for Mermaid |
| `mcp-server` | http://localhost:3002/mcp | MCP HTTP endpoint |
| `mcp-tls` | **https://localhost:3443** | TLS proxy for Claude connectors |
| `web` | **http://localhost:3000** | arch-doc-web editor (BlockNote + Mermaid) |

### 3. Initialise the vault

```bash
bash setup-vault.sh
```

Creates `diagrams-vault/` as a git repo, optionally connects a GitHub remote.

Or let Claude do it via MCP:
```
Initialise a new project called "my-architecture"
```

### 4. Connect Claude

#### Option A — stdio via `docker exec` (Claude Desktop, no TLS needed)

`claude_desktop_config.json` → Settings → Developer → Edit Config:

```json
{
  "mcpServers": {
    "diagram": {
      "command": "docker",
      "args": ["exec", "-i", "excalidraw-mcp", "node", "/app/dist/index.js", "--stdio"]
    }
  }
}
```

#### Option B — HTTPS connector (Claude Desktop + Claude Code)

**Trust the self-signed cert once (Windows, run as Administrator):**
```powershell
Import-Certificate -FilePath "$PWD\certs\server.crt" -CertStoreLocation Cert:\LocalMachine\Root
```

**Claude Code:**
```bash
claude mcp add --transport http diagram https://localhost:3443/mcp
```

**Claude Desktop:** Settings → Developer → Add custom connector → `https://localhost:3443/mcp`

#### Option C — Public tunnel (claude.ai web)

Anthropic's backend validates the URL, so `localhost` doesn't work. Use a tunnel:

```bash
cloudflared tunnel --url http://localhost:3002
# or: ngrok http 3002
```

Paste the HTTPS tunnel URL (`…/mcp`) into claude.ai → Settings → Connectors.

---

## Example Prompts

```
Create a Mermaid flowchart in Architecture/ called "system-overview"
showing: User → Load Balancer → [API-1, API-2] → PostgreSQL
```

```
Create a PlantUML C4 context diagram in Architecture/ called "c4-context"
for an e-commerce platform with Customer, Web App, Order Service, Payment Service
```

```
Update the diagram at Architecture/system-overview.md — add a Redis cache
between the Load Balancer and API servers
```

```
List all diagrams in the Flows folder, then show me the sequence diagram at Flows/auth-flow.md
```

```
Render the diagram at Architecture/system-overview.md and show me the SVG
```

---

## Project Structure

```
excalidraw-mcp/
├── docker-compose.yml           # bridge + kroki + mcp-server + mcp-tls
├── setup-vault.sh               # one-time vault init script
│
├── diagrams-vault/              # Obsidian vault — diagram sources (separate git repo)
│   ├── Architecture/
│   ├── Flows/
│   ├── Sequences/
│   ├── Infrastructure/
│   └── Notes/
│
├── bridge/                      # Fastify file API + SSE (Docker)
│   ├── Dockerfile
│   └── src/index.ts
│
├── nginx-tls/                   # nginx TLS proxy → mcp-server:3002
│   ├── Dockerfile
│   └── nginx.conf
│
├── web/                         # arch-doc-web — React + BlockNote + Mermaid (port 3000)
│   ├── src/
│   ├── package.json
│   └── src/
│       ├── components/
│       │   ├── App.tsx
│       │   ├── Editor.tsx       # BlockNote with DiagramBlock schema
│       │   ├── DiagramBlock.tsx # Custom block: code + Kroki preview
│       │   ├── DiagramModal.tsx
│       │   ├── Sidebar.tsx
│       │   ├── GitModal.tsx
│       │   └── NewFileModal.tsx
│       └── styles/global.css
│
└── mcp-server/                  # TypeScript MCP server (Docker, port 3002)
    ├── Dockerfile
    ├── package.json
    ├── tsconfig.json
    └── src/
        ├── index.ts             # Entry: --stdio or HTTP on PORT
        ├── server.ts            # McpServer factory + tool registration
        ├── kroki.ts             # Kroki render helper + supported formats
        └── vault.ts             # Vault file ops, frontmatter, git helpers
```

---

## Vault Markdown Format

Each diagram is a `.md` file in the vault:

```markdown
---
title: System Overview
format: mermaid
tags: [architecture, backend]
created: 2026-05-14
updated: 2026-05-14
---

# System Overview

> High-level system architecture

​```mermaid
graph LR
  User --> LoadBalancer
  LoadBalancer --> API
  API --> PostgreSQL
​```
```

Open `diagrams-vault/` in [Obsidian](https://obsidian.md) for a visual library with tags, backlinks, and graph view.

---

## Environment Variables

### MCP Server
| Variable | Default (Docker) | Description |
|---|---|---|
| `KROKI_URL` | `http://kroki:8000` | Kroki renderer URL |
| `VAULT_PATH` | `/vault` | Path to vault inside container |
| `PORT` | `3002` | HTTP port |

### Bridge
| Variable | Default | Description |
|---|---|---|
| `VAULT_DIR` | `/diagrams-vault` | Path to vault |
| `PORT` | `3001` | HTTP port |

---

## Troubleshooting

**MCP server not appearing in Claude**
- Check containers: `docker compose ps` — `excalidraw-mcp` must be `Up`
- For stdio: restart Claude Desktop after editing config
- For HTTPS: ensure cert is trusted, then remove and re-add the connector

**Kroki render fails**
- Test: `curl -X POST http://localhost:8000/mermaid/svg -H "Content-Type: text/plain" -d "graph LR\n  A --> B"`
- Check: `docker compose logs kroki` and `docker compose logs mermaid`
- Mermaid needs the `mermaid` companion container running

**Vault editor shows blank**
- Check bridge: `curl http://localhost:3001/health`
- Check: `docker compose logs bridge`

**Git push fails silently**
- Check remote: `git -C diagrams-vault remote -v`
- Add one: `git -C diagrams-vault remote add origin <url>`
