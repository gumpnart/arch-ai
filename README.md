# Excalidraw MCP

Connect Claude to a self-hosted Excalidraw instance. Claude can draw shapes, build architecture diagrams, and render **diagram-as-code** (Mermaid, PlantUML, Graphviz, D2, and 20+ more) — all visible live in your browser. Diagram sources are stored as Markdown files in an Obsidian-compatible vault with full git history.

```
Claude Desktop  ──stdio──►  MCP Server  ──HTTP──►  Bridge  ──volume──►  .excalidraw files
                                │                      │
                                │                     SSE
                                │                      │
                           Kroki (SVG)        Excalidraw App (browser)
                                │              auto-reloads on every change
                           diagrams-vault/
                           (git repo, Obsidian-ready)
```

---

## Quick Start

### 1. Prerequisites

- **Docker + Docker Compose** (Excalidraw app, bridge, Kroki)
- **Node.js 20+** and **pnpm** (MCP server, runs locally)
- **Claude Desktop**
- **git** (for vault auto-commit)

Install pnpm if needed:
```bash
npm install -g pnpm
```

---

### 2. Start all Docker services

```bash
# From project root
docker compose up --build -d
```

This starts four containers:

| Service | URL | Purpose |
|---|---|---|
| `excalidraw-app` | http://localhost:3000 | Excalidraw canvas (open this in your browser) |
| `bridge` | http://localhost:3001 | File API + SSE live-reload |
| `kroki` | http://localhost:8000 | Diagram renderer (Mermaid, PlantUML, etc.) |
| `mermaid` | internal | Kroki companion for Mermaid support |

Open **http://localhost:3000** in your browser.

---

### 3. Build the MCP server

```bash
cd mcp-server
pnpm install
pnpm run build
```

Test it:
```bash
BRIDGE_URL=http://localhost:3001 node dist/index.js
# [excalidraw-mcp] Server running. Bridge: http://localhost:3001 | Kroki: http://localhost:8000 | Vault: (not set)
# Ctrl+C to exit
```

---

### 4. Set up the diagrams vault

Run the interactive setup script once from the project root:

```bash
bash setup-vault.sh
```

It will:
1. Initialise `diagrams-vault/` as a git repo
2. Optionally add a GitHub remote and push
3. Print a ready-to-paste `claude_desktop_config.json` block with your absolute paths filled in

---

### 5. Configure Claude Desktop

Open **Settings → Developer → Edit Config**
- Mac: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "excalidraw": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/excalidraw-mcp/mcp-server/dist/index.js"],
      "env": {
        "BRIDGE_URL": "http://localhost:3001",
        "KROKI_URL": "http://localhost:8000",
        "VAULT_PATH": "/ABSOLUTE/PATH/TO/excalidraw-mcp/diagrams-vault"
      }
    }
  }
}
```

> `setup-vault.sh` prints this block with your paths already substituted.  
> On Windows use forward slashes or double-backslashes in JSON strings.

Restart Claude Desktop. The Excalidraw tools will appear in the tools panel.

---

## Available Tools

### Scene tools

| Tool | Description |
|---|---|
| `list_scenes` | List all saved scene files |
| `create_scene` | Create a new blank scene |
| `read_scene` | Read scene JSON (all elements + IDs) |
| `add_elements` | Add shapes, text, arrows to a scene |
| `update_element` | Modify an element by ID |
| `delete_element` | Remove elements by ID |
| `clear_scene` | Wipe all elements |
| `delete_scene` | Delete a scene file |
| `get_scene_summary` | Get element counts and bounding box |
| `add_diagram` | **High-level**: create node+arrow diagrams in one call |

### Diagram-as-code tools

| Tool | Description |
|---|---|
| `create_diagram` | Write diagram code → Kroki renders → SVG placed in scene → git push |
| `update_diagram` | Edit source → re-render in-place (same position/size) → git push |
| `render_diagram` | Re-render a vault diagram into a scene (e.g. after a scene is cleared) |
| `get_diagram` | Read raw source + metadata from vault |
| `list_diagrams` | Browse vault by folder |
| `git_log` | View diagram commit history |
| `git_status` | Check remote, branch, and uncommitted changes |

**Supported diagram formats** (via Kroki): `mermaid` · `plantuml` · `graphviz` · `d2` · `c4plantuml` · `structurizr` · `bpmn` · `erd` · `nomnoml` · and ~15 more.

---

## Example Prompts

### Shape-based diagram (add_diagram)
```
Create a scene "kafka-pipeline" showing:
Producer → Kafka Topic → [Consumer A, Consumer B] → [Redis, PostgreSQL]
Use dashed arrows for async connections.
```

### Mermaid diagram (create_diagram)
```
Create a Mermaid sequence diagram in the Flows folder called "auth-flow"
showing: User → Frontend → Auth Service → JWT → User.
Place it in the scene "auth.excalidraw".
```

### PlantUML component diagram
```
Draw a PlantUML component diagram of a microservices architecture
(API Gateway, User Service, Order Service, Notification Service, PostgreSQL).
Save it to Architecture/microservices.md and add it to the "overview" scene.
```

### Iterate on a diagram
```
Update the diagram at Architecture/microservices.md — add a Redis cache
between the API Gateway and the services.
```

### Re-place a diagram after clearing
```
The "overview" scene was cleared. Re-render Architecture/microservices.md
into "overview" at position x=100, y=80.
```

### Browse and check history
```
List all diagrams in the Architecture folder, then show the last 5 git commits.
```

---

## Project Structure

```
excalidraw-mcp/
├── docker-compose.yml          # bridge + excalidraw-app + kroki + mermaid
├── setup-vault.sh              # one-time vault init + config printer
│
├── scenes/                     # .excalidraw files (Docker volume)
│
├── diagrams-vault/             # Obsidian vault — diagram sources (separate git repo)
│   ├── .gitignore
│   ├── README.md
│   ├── Architecture/
│   ├── Flows/
│   ├── Sequences/
│   └── Infrastructure/
│
├── bridge/                     # Express API + chokidar + SSE (Docker)
│   ├── Dockerfile
│   ├── package.json
│   └── src/index.ts            # scenes + diagrams routes, vault watcher
│
├── excalidraw-app/             # React + @excalidraw/excalidraw (Docker)
│   ├── Dockerfile              # Vite build → nginx
│   ├── nginx.conf              # proxies /api → bridge
│   └── src/App.tsx
│
└── mcp-server/                 # Runs locally (stdio → Claude Desktop)
    ├── package.json
    └── src/
        ├── index.ts            # MCP server, all tool handlers, Kroki client
        ├── builder.ts          # Excalidraw element factory
        └── types.ts            # Excalidraw JSON types + DiagramFrontmatter
```

---

## How Live Reload Works

### Scene changes
1. Claude calls a scene tool (e.g. `add_elements`)
2. MCP server `PUT /scenes/:name` → bridge writes `.excalidraw` to shared volume
3. chokidar detects change → SSE `scene_changed` broadcast
4. Browser `EventSource` receives event → `excalidrawAPI.updateScene()` — instant, no refresh

### Diagram renders
1. Claude calls `create_diagram` or `update_diagram`
2. MCP server POSTs source to Kroki → receives SVG
3. SVG base64-encoded → embedded in `scene.files[fileId]` as `image/svg+xml`
4. Scene PUT to bridge → chokidar → SSE → browser refreshes canvas
5. `.md` written to `diagrams-vault/` → `git commit && git push`

---

## Vault Markdown Format

Each diagram is a `.md` file readable in Obsidian or any editor:

```markdown
---
title: System Architecture
format: mermaid
scene: architecture.excalidraw
fileId: a3f8c2e1d409b7   ← links to scene.files{}
elementId: 9b1e4c7a2f83  ← image element ID in scene
tags: [architecture, backend]
created: 2025-01-15
updated: 2025-01-15
---

# System Architecture

> 3-tier web architecture

​```mermaid
graph LR
  Browser --> APIGateway
  APIGateway --> AuthService
  AuthService --> PostgreSQL
​```
```

Open `diagrams-vault/` directly in [Obsidian](https://obsidian.md) to get a visual diagram library with backlinks, tags, and graph view.

---

## Environment Variables

### Bridge
| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | HTTP port |
| `SCENES_DIR` | `/scenes` | Directory for `.excalidraw` files |
| `VAULT_DIR` | `/diagrams-vault` | Directory for diagram `.md` files |

### MCP Server
| Variable | Default | Description |
|---|---|---|
| `BRIDGE_URL` | `http://localhost:3001` | Bridge server URL |
| `KROKI_URL` | `http://localhost:8000` | Kroki renderer URL |
| `VAULT_PATH` | *(required)* | Absolute host path to `diagrams-vault/` |

---

## Troubleshooting

**Claude can't connect to MCP server**
- Confirm `pnpm run build` completed in `mcp-server/` with no errors
- Check the absolute path in `claude_desktop_config.json`
- Restart Claude Desktop after any config change

**Scene not live-reloading**
- Check all containers are running: `docker compose ps`
- Check bridge logs: `docker compose logs bridge`
- Make sure you've selected the correct scene in the Excalidraw UI dropdown

**`create_diagram` fails with Kroki error**
- Verify Kroki is running: `curl http://localhost:8000/health`
- Check Kroki logs: `docker compose logs kroki`
- For Mermaid: confirm the `mermaid` companion container is also running

**`create_diagram` says "VAULT_PATH env var is not set"**
- Add `VAULT_PATH` to your `claude_desktop_config.json` env block and restart Claude Desktop
- Run `bash setup-vault.sh` to get the correct value for your machine

**Git push fails silently**
- Run `create_diagram` or `git_status` tool — it reports "committed (no remote configured)"
- Add a remote: `git -C diagrams-vault remote add origin <url>` then re-run the tool

**`@excalidraw/excalidraw` build is slow**
- The package is ~10 MB; allow `docker compose build` a few minutes
- If it OOMs, increase Docker's memory limit to 4 GB+

**Port 3000 already in use**
- Change `"3000:80"` to e.g. `"3002:80"` in `docker-compose.yml`
