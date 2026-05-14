# Excalidraw MCP

**Obsidian-centric MCP server + Docker stack** for generating software architecture documentation.

```
MCP commands
  init_project        ──►  Obsidian vault (folder structure + git)
  create_diagram      ──►  mermaid: inline code block (Obsidian-native)
  (Kroki: 20+ formats)      other:   {folder}/Assets/{name}.svg + ![[…]] embed
  create_eraser_diagram ──► {folder}/Assets/{name}.png + ![[…]] embed  (Eraser.io API)
  create_document     ──►  Structured .md: sections + auto-embedded diagrams
                                    ↓
                       Obsidian vault  ←  primary output, open and read immediately
                       Excalidraw      ←  optional live-preview (add scene param)
```

The vault is the deliverable. Excalidraw, Kroki, and Eraser.io are pluggable renderers.

See [`sample-project/`](sample-project/) for a complete worked example.

```
Claude Desktop  ──stdio (docker exec)──►  mcp-server  ─┐
                                                        ├──HTTP──►  Bridge  ──volume──►  .excalidraw files
Claude Desktop / Claude Code  ──HTTPS──►  mcp-tls  ────►  mcp-http  ──┘              │
                                          (port 3443)   (port 3002)                  SSE
                                                                                      │
                                                                             Excalidraw App (browser)
                                                                             auto-reloads on every change

                           Both MCP services share one Docker image (excalidraw-mcp-server)
                           and call Kroki for diagram-as-code rendering.
                           mcp-tls = nginx with self-signed cert (trusted once via PowerShell).
                           diagrams-vault/ is a separate git repo for versionable sources.
```

---

## How Claude asks about projects

Before calling any MCP tool that targets a specific scene, Claude will:
1. Call `list_scenes` to show what exists
2. Ask you to pick a scene (or confirm if only one is open)
3. Then execute the requested action

For diagram tools, Claude will also ask which vault folder (`Architecture/`, `Flows/`, `Sequences/`, `Infrastructure/`) if you haven't specified one.

**To skip the prompt:** name the scene in your message — e.g. *"add a rectangle to architecture.excalidraw"* or *"create a flow diagram in Flows/"*.

---

## Vault Editor (port 4000)

A browser-based Markdown editor for vault files, rebuilt with Astro + React.

| Feature | Details |
|---|---|
| **WYSIWYG editor** | TipTap with Medium/Confluence-style formatting |
| **Bubble menu** | Bold, italic, strikethrough, code, link — appears on text selection |
| **Floating menu** | H1–H3, lists, tasks, code block, blockquote, table, diagram — appears on empty lines |
| **Frontmatter** | Toggle panel shows preserved YAML frontmatter |
| **Diagram insert** | ◈ Diagram button opens modal: pick format, write source, preview via Kroki, save to vault |
| **Git status & commit** | ⎇ Git modal with Status/Commit tab and Clone Repository tab |
| **Clone from git** | Replaces vault content by cloning a remote repository into `VAULT_DIR` |
| **SSE sync** | Sidebar auto-refreshes when Claude/MCP tools add or remove files |
| **Ctrl+S save** | Keyboard shortcut + Save button — serializes TipTap content back to Markdown |

---

## Quick Start

### 1. Prerequisites

- **Docker + Docker Compose** — runs everything (app, bridge, Kroki, and both MCP services)
- **Claude Desktop** and/or **Claude Code**
- **git** (for vault auto-commit from inside the container)

> Node.js is no longer required on the host. The MCP server builds and runs inside Docker.

---

### 2. Start all Docker services

```bash
# From project root
docker compose up --build -d
```

This starts seven containers:

| Service | URL | Purpose |
|---|---|---|
| `excalidraw-app` | http://localhost:3000 | Excalidraw canvas (open this in your browser) |
| `bridge` | http://localhost:3001 | File API + SSE live-reload |
| `kroki` | http://localhost:8000 | Diagram renderer (Mermaid, PlantUML, etc.) |
| `mermaid` | internal | Kroki companion for Mermaid support |
| `mcp-server` | — | Keepalive container for Claude Desktop `docker exec` stdio |
| `mcp-http` | http://localhost:3002 | Streamable HTTP transport (internal — proxied by mcp-tls) |
| `mcp-tls` | **https://localhost:3443** | HTTPS/TLS proxy for Claude Desktop + Claude Code connectors |
| `vault-editor` | **http://localhost:4000** | Web markdown editor — browse and edit vault `.md` files |

Both `mcp-server` and `mcp-http` share the same built image (`excalidraw-mcp-server`), so `--build` only compiles once.

Open **http://localhost:3000** in your browser.

---

### 3. Set up the diagrams vault

Run the interactive setup script once from the project root:

```bash
bash setup-vault.sh
```

It will:
1. Initialise `diagrams-vault/` as a git repo
2. Optionally add a GitHub remote and push

---

### 3a. Vault Editor (`vault-editor` container)

Open **http://localhost:4000** to browse and edit all `.md` files in `diagrams-vault/`.

**Features:**
- Sidebar file tree mirroring the Obsidian folder structure (`Architecture/`, `Flows/`, `Sequences/`, `Infrastructure/`, `Notes/`)
- **Edit / Split / Preview** modes — split shows editor and rendered markdown side by side
- **Ctrl+S** saves the current file
- **+ New** creates a new `.md` file in any folder with YAML frontmatter pre-filled
- **Delete** removes the current file
- **⎇ Commit** stages all vault changes, commits with a custom message, and pushes to the configured remote
- SSE live-reload: the sidebar refreshes automatically when Claude writes new files via MCP tools

> The vault uses **git** for version control — no database required. Run `bash setup-vault.sh` once to initialise `diagrams-vault/` as a git repo and optionally connect a GitHub remote.

**To explore the sample project**, set `VAULT_DIR` in `docker-compose.yml` to `./sample-project/vault` and restart the bridge:

```yaml
- VAULT_DIR=/sample-project-vault
```

and add the mount:

```yaml
- ./sample-project/vault:/sample-project-vault
```

---

### 4. Configure Claude Desktop

Two connection methods are available — choose one.

#### Option A: stdio via `docker exec` (simplest, no TLS needed)

After `docker compose up -d`, no host Node.js is required. Claude Desktop spawns the MCP server by running `node` inside the already-running `excalidraw-mcp` container.

Open **Settings → Developer → Edit Config**
- Mac: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "excalidraw": {
      "command": "docker",
      "args": ["exec", "-i", "excalidraw-mcp", "node", "/app/dist/index.js"]
    }
  }
}
```

No `env` block needed — `BRIDGE_URL`, `KROKI_URL`, and `VAULT_PATH` are already set inside the container.

#### Option B: HTTPS connector (port 3443)

Claude Desktop only accepts **https** for HTTP-transport connectors. The `mcp-tls` container handles TLS termination with a self-signed certificate.

**Step 1 — Trust the certificate (once, Windows only, run PowerShell as Administrator):**

```powershell
Import-Certificate -FilePath "$PWD\certs\server.crt" -CertStoreLocation Cert:\LocalMachine\Root
```

> The `certs/server.crt` file is generated automatically on the first `docker compose up`. If it does not exist yet, start the stack first, then run the command above.

**Step 2 — Add via the Claude Desktop UI:**

Open Claude Desktop → Settings → Developer → Add custom connector → enter `https://localhost:3443/mcp`.

Claude Desktop will open your browser for an OAuth authorization step. The server **auto-approves** (no manual action needed — it redirects immediately back to Claude). Tokens are stored in memory and reset when the container restarts.

**Alternative — Add to `claude_desktop_config.json` directly** (skips the OAuth UI entirely):

```json
{
  "mcpServers": {
    "excalidraw": {
      "url": "https://localhost:3443/mcp"
    }
  }
}
```

Restart Claude Desktop. The Excalidraw tools will appear in the tools panel.

---

### 5. Configure Claude Code (HTTPS connector)

After `docker compose up -d` and trusting the cert (see Option B above):

```bash
claude mcp add --transport http excalidraw https://localhost:3443/mcp
```

The `mcp-tls` service proxies HTTPS → `mcp-http:3002` internally. Do not point connectors directly at port 3002 — Claude Desktop and Claude Code both require HTTPS.

---

### 6. claude.ai web (requires public URL)

**Why localhost does not work with claude.ai web**: When you click "Add custom connector" on [claude.ai](https://claude.ai), Anthropic's **backend servers** validate the URL — not your browser. Anthropic's servers cannot reach `localhost`, so the connector addition fails immediately with "Failed to add connector" without sending a single request to nginx (confirmed by empty access logs).

**Solution: expose port 3002 with a tunnel**

Pick one of the options below. Both give you a public HTTPS URL that you paste into claude.ai → Settings → Connectors → Add custom connector.

#### Option A: Cloudflare Tunnel (recommended — free, no account required for short sessions)

```bash
# Install once: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
cloudflared tunnel --url http://localhost:3002
# Output: https://xxxx-xxxx-xxxx.trycloudflare.com
```

Add `https://xxxx-xxxx-xxxx.trycloudflare.com/mcp` to claude.ai.

#### Option B: ngrok

```bash
ngrok http 3002
# Output: https://xxxx.ngrok-free.app
```

Add `https://xxxx.ngrok-free.app/mcp` to claude.ai.

> **Note:** The tunnel points at port `3002` (plain HTTP, no TLS) — there's no need to double-wrap TLS. The tunnel provider adds HTTPS automatically. The `mcp-tls` container (port 3443) is only for Claude Desktop / Claude Code which connect locally.

> **Legacy host-based config** — if you prefer to run the MCP server outside Docker, install Node 20+ and pnpm, then `cd mcp-server && pnpm install && pnpm run build`, and use this Claude Desktop config:
> ```json
> {
>   "mcpServers": {
>     "excalidraw": {
>       "command": "node",
>       "args": ["/ABSOLUTE/PATH/TO/excalidraw-mcp/mcp-server/dist/index.js"],
>       "env": {
>         "BRIDGE_URL": "http://localhost:3001",
>         "KROKI_URL": "http://localhost:8000",
>         "VAULT_PATH": "/ABSOLUTE/PATH/TO/excalidraw-mcp/diagrams-vault"
>       }
>     }
>   }
> }
> ```

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

**Supported Kroki formats**: `mermaid` · `plantuml` · `graphviz` · `d2` · `c4plantuml` · `structurizr` · `bpmn` · `erd` · `nomnoml` · and ~15 more.

### Project / document tools (Obsidian-first)

| Tool | Description |
|---|---|
| `init_project` | Scaffold a new Obsidian vault at `VAULT_PATH/<name>/` — standard folders, README, `.obsidian/app.json`, `.gitignore`, initial git commit |
| `create_document` | **Primary document tool.** Structured `.md` with sections; each section can embed a diagram — mermaid inserted inline, SVG/PNG via `![[…]]` |
| `create_eraser_diagram` | Render via **Eraser.io API** → PNG saved to `{folder}/Assets/`; `.md` source file with `![[…]]` embed; optionally also push to Excalidraw |

**Eraser.io `diagram_type`**: `flowchart` · `sequenceDiagram` · `classDiagram` · `entityRelationshipDiagram` · `cloudArchitectureDiagram` · `mindmap`

To enable Eraser.io:
```powershell
$env:ERASER_API_KEY = "your-key"
docker compose up -d mcp-server mcp-http
```
Get a key at https://app.eraser.io/workspace/settings.

### Rendering matrix

| Format | Where stored | Obsidian embed | Excalidraw |
|---|---|---|---|
| `mermaid` | inline in `.md` | ` ```mermaid ``` ` native | optional |
| Kroki (plantuml, d2, …) | `{folder}/Assets/{name}.svg` | `![[…svg]]` | optional |
| Eraser.io | `{folder}/Assets/{name}.png` | `![[…png]]` | optional |

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
├── docker-compose.yml          # bridge + excalidraw-app + kroki + mermaid + mcp-server + mcp-http
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
└── mcp-server/                 # Builds into Docker image (excalidraw-mcp-server)
    ├── Dockerfile              # Multi-stage: builder (tsc) → runtime (Alpine + git)
    ├── package.json
    └── src/
        ├── handlers.ts         # All tool logic, env vars, helpers, createMcpServer()
        ├── index.ts            # Stdio entry point (15 lines) → used by mcp-server container
        ├── http-server.ts      # Fastify + StreamableHTTPServerTransport → mcp-http container
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

### MCP Server (both `mcp-server` and `mcp-http` containers)
| Variable | Default (Docker) | Description |
|---|---|---|
| `BRIDGE_URL` | `http://bridge:3001` | Bridge server URL |
| `KROKI_URL` | `http://kroki:8000` | Kroki renderer URL |
| `VAULT_PATH` | `/vault` | Path to `diagrams-vault/` inside the container |
| `PORT` | `3002` | HTTP port for `mcp-http` (Streamable HTTP transport) |

---

## Troubleshooting

**"Cannot add server" when adding `https://localhost:3443/mcp` in Claude Desktop / Claude Code**
- Make sure you are running the latest `mcp-http` image: `docker compose build mcp-server && docker compose up -d mcp-server mcp-http`.
- Confirm the TLS certificate is trusted: run `Get-ChildItem Cert:\LocalMachine\Root | Where-Object { $_.Subject -match 'excalidraw' }` in PowerShell — you should see one entry. If not, run `Import-Certificate -FilePath "$PWD\certs\server.crt" -CertStoreLocation Cert:\LocalMachine\Root` as Administrator.
- The OAuth flow auto-approves — when Claude opens a browser window for authorization, wait briefly and the page will redirect back to Claude automatically.
- Tokens are stored **in memory** and reset when the container restarts. If Claude reports an invalid token, remove and re-add the connector in Settings → Developer.

**Claude can't connect to MCP server**
- Confirm all containers are running: `docker compose ps` — `excalidraw-mcp` must be `Up`
- For Claude Desktop: verify the `command` is `docker` and the container name is `excalidraw-mcp`
- For Claude Code: verify `docker compose ps` shows `excalidraw-mcp-http` as `Up` on port 3002
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
- Docker setup: `VAULT_PATH` is pre-set to `/vault` in `docker-compose.yml` — confirm the `diagrams-vault` volume mount is present and the container is running
- Legacy host setup: add `VAULT_PATH` to your `claude_desktop_config.json` env block and restart Claude Desktop

**Git push fails silently**
- Run `create_diagram` or `git_status` tool — it reports "committed (no remote configured)"
- Add a remote: `git -C diagrams-vault remote add origin <url>` then re-run the tool

**`@excalidraw/excalidraw` build is slow**
- The package is ~10 MB; allow `docker compose build` a few minutes
- If it OOMs, increase Docker's memory limit to 4 GB+

**Port 3000 already in use**
- Change `"3000:80"` to e.g. `"3002:80"` in `docker-compose.yml`
