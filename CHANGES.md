# Change Log

## 2026-05-17 — feat: mermaid diagram rendering in arch-doc-web; remove vault-editor

### Changes

| Area | Change |
|---|---|
| `docker-compose.yml` | Removed `vault-editor` service — project no longer uses the vault-editor container |
| `web/src/components/Editor/DocEditor.tsx` | Registers `MermaidBlock` in a custom BlockNote schema; converts `codeBlock` blocks with diagram languages (mermaid, plantuml, graphviz, d2, c4plantuml, erd) to `mermaid` blocks on load; serializes `mermaid` blocks back to code fences on save |
| `web/src/components/Editor/MermaidBlock.tsx` | Called `createReactBlockSpec(...)()` — in BlockNote 0.51 the function returns a factory; call it to get the `BlockSpec` |
| `web/vite.config.ts` | Ported `fixProsemirrorRenderSpec` from esbuild plugin (deprecated in Vite 8) to `optimizeDeps.rolldownOptions.plugins` with a Rolldown-compatible `transform` hook; added `server.port: 3000` |

---

## 2026-05-16 — fix: web editor — file loading, BlockNote crash, port conflicts

### Bug Fixes

| File | Fix |
|---|---|
| `web/server/routes/files.ts` | `path.join` → `path.resolve` for all path traversal guards — file fetch returned 403 on Windows because `path.join(relative, ...)` produces a relative path that never `startsWith` the absolute resolved vault path |
| `web/src/lib/markdown.ts` | Removed module-level `BlockNoteSchema.create({ blockSpecs: { ...defaultBlockSpecs } })` — passing core DOM-based block specs to `useCreateBlockNote` caused "Invalid array passed to renderSpec" crash in BlockNote v0.50.0 |
| `web/src/components/Editor/DocEditor.tsx` | `useCreateBlockNote()` called without schema option — uses BlockNote's internal React-aware default schema; Diagram slash-menu item now inserts a proper `codeBlock` with `language: "mermaid"` |
| `web/vite.config.ts` | Vite `/api` proxy target `http://localhost:5432` (PostgreSQL!) → `http://localhost:3030` |
| `web/server/index.ts` | Server port default 3001 → 3030 to avoid conflict with Docker bridge on 3001; reads `WEB_PORT` env var |
| `.env` | `WEB_PORT=3030` |

---

## 2026-05-16 — chore: consolidate Kroki; rename excalidraw-mcp stack to arch-doc

- Deleted standalone `kroki/docker-compose.yml` — root compose already provides Kroki on port 8000
- Renamed all Docker containers/network from `excalidraw-*`/`diagrams-*` to `arch-doc-*`
  - `excalidraw-bridge` → `arch-doc-bridge`
  - `excalidraw-kroki` → `arch-doc-kroki`
  - `excalidraw-mermaid` → `arch-doc-mermaid`
  - `diagrams-mcp` → `arch-doc-mcp`
  - `diagrams-mcp-tls` → `arch-doc-mcp-tls`
  - `diagrams-vault-editor` → `arch-doc-vault-editor`
  - network `excalidraw-net` → `arch-doc-net`
- Updated CLAUDE.md: project title, container name in Docker config, host paths
- **Action required**: update `claude_desktop_config.json` container name to `arch-doc-mcp`

---

## 2026-05-16 — feat: add arch-doc-system (arch-doc-mcp + vault + site + web editor)

### Overview

Added a complete AI-powered architecture documentation pipeline alongside the existing excalidraw-mcp stack. The system consists of an MCP server with 12 SA document templates, a self-hosted Kroki diagram renderer, an Obsidian vault, a VitePress static site, and a BlockNote-based web editor.

### Added

| What | Phase | Details |
|---|---|---|
| `arch-doc-mcp/` | 1–2 | MCP server with 12 SA templates + Kroki bridge. 8 tools registered. |
| `kroki/docker-compose.yml` | 3 | Self-hosted Kroki stack (kroki + mermaid + bpmn + excalidraw containers) |
| `vault/` | 4 | Obsidian vault structure with 3 example docs (SAD, ADR-001, C4-L1) |
| `site/` | 5 | VitePress static site config with Mermaid plugin |
| `.github/workflows/publish.yml` | 5 | CI/CD: vault push → build + deploy to GitHub Pages |
| `.claude/mcp.json` | 6 | MCP config for both arch-doc-mcp and kroki-mcp |
| `web/` | 9 | React + BlockNote vault editor with Express API and Kroki proxy |
| `.env` | — | Root environment variables |
| `package.json` | — | Monorepo scripts for all components |

### arch-doc-mcp Tools

| Tool | Description |
|---|---|
| `list_templates` | List all SA templates with optional category filter |
| `get_template` | Get full template content by ID |
| `get_template_placeholders` | List all `{{var}}` placeholders in a template |
| `fill_template` | Fill placeholders with provided values |
| `get_document_checklist` | Get documents required for a project phase |
| `generate_document` | High-level: description → filled draft |
| `render_and_embed_diagram` | Render DSL via Kroki + embed in template |
| `get_diagram_dsl_prompt` | Get DSL generation instructions for a diagram type |

### Templates (12)

SAD, NFR, C4-L1 (System Context), C4-L2 (Container), C4-L3 (Component), ADR, Data Architecture, Integration Architecture, Security Architecture, Infrastructure Architecture, Risk Register, Runbook

---

## 2026-05-14 — feat: remove Excalidraw entirely; replace with diagram-as-code MCP + Kroki

### Overview

Complete pivot: removed all Excalidraw tooling and replaced with a clean **diagram-as-code** stack. The MCP server now manages diagrams as Markdown files rendered by Kroki. The vault editor (BlockNote) renders diagram code blocks inline.

### Removed

| What | Why |
|---|---|
| `excalidraw-app/` (port 3000) | No longer needed — Excalidraw canvas removed entirely |
| `mcp-server/src/` (gumpnart/excalidraw-mcp) | Replaced with diagram-as-code MCP |
| `mcp-http` docker-compose service | Merged into single `mcp-server` service |
| `scenes/` Docker volume | No scenes without Excalidraw |
| `bridge` scenes mount (`./scenes:/scenes`) | Not needed |

### New: diagram-as-code MCP server (`mcp-server/`)

| File | Description |
|---|---|
| `src/index.ts` | Entry point: `--stdio` for docker exec, HTTP for connectors |
| `src/server.ts` | `McpServer` factory + 11 tool registrations |
| `src/kroki.ts` | `renderDiagram(format, source)` → SVG via Kroki POST; `SUPPORTED_FORMATS` list |
| `src/vault.ts` | Vault file ops, frontmatter parse/build, `updateDiagramSource`, `initProject`, `gitCommitAndPush`, `gitStatus` |
| `package.json` | `@modelcontextprotocol/sdk`, `express`, `simple-git`, `zod` |
| `Dockerfile` | Two-stage: `node:20-alpine` builder (tsc) → `node:20-alpine` runtime |

**Tools registered:** `render_diagram`, `list_formats`, `create_diagram`, `update_diagram`, `get_diagram`, `list_diagrams`, `delete_diagram`, `create_document`, `init_project`, `git_status`, `git_commit`

### Updated: `docker-compose.yml`

- Removed: `excalidraw-app`, `mcp-http`, `scenes` volume
- `mcp-server` now: port 3002, `KROKI_URL` + `VAULT_PATH` env vars, no bridge dependency
- `bridge`: removed scenes mount (only vault mount remains)

### Updated: `README.md`

Complete rewrite to reflect diagram-as-code architecture, new tool list, and updated quick-start steps.

## 2026-05-14 — feat: replace mcp-server with gumpnart/excalidraw-mcp; migrate vault-editor to BlockNote with live diagram blocks

### mcp-server — full replacement

Replaced the custom scene/vault/Kroki MCP server with the upstream **gumpnart/excalidraw-mcp** ("Streamable Excalidraw MCP App server").

| What changed | Details |
|---|---|
| `mcp-server/src/` | Replaced with upstream source: `server.ts`, `main.ts`, `checkpoint-store.ts`, `mcp-app.tsx`, `mcp-entry.tsx`, `edit-context.ts`, `sounds.ts`, `pencil-audio.ts`, `global.css` |
| `mcp-server/api/` | Added Vercel `api/mcp.ts` handler |
| `mcp-server/scripts/` | `build.mjs` (bun-based build), `setup-bun.mjs` |
| `mcp-server/Dockerfile` | New two-stage build: `oven/bun:1` builder → `node:20-alpine` runner |
| `mcp-server/package.json` | Updated to upstream package (`@mcp-demos/excalidraw-server` v0.3.2) |
| `docker-compose.yml` | Merged old `mcp-server` (stdio) + `mcp-http` (HTTP) into single new `mcp-server` service on port 3002; dropped `BRIDGE_URL`, `KROKI_URL`, `VAULT_PATH` env vars; `mcp-tls` points to new service |

**Tools provided by the new server:** `read_me`, `create_view` (streaming Excalidraw with camera control + checkpoint restore), `export_to_excalidraw`.

**What was removed:** vault/Obsidian tools, Kroki integration, git operations, scene management via bridge. These were handled by the old mcp-server which is now replaced.

### vault-editor — BlockNote migration + live diagram blocks

Replaced TipTap with **BlockNote** and added a custom `DiagramBlock` that renders diagrams inline.

| File | Change |
|---|---|
| `vault-editor/package.json` | Removed TipTap/lowlight; added `@blocknote/core`, `@blocknote/react`, `@blocknote/mantine`, `@mantine/core`, `@mantine/hooks` |
| `vault-editor/src/components/Editor.tsx` | Rewritten: `useCreateBlockNote` with custom schema; markdown↔blocks round-trip preserves diagram code fences as `DiagramBlock` instances |
| `vault-editor/src/components/DiagramBlock.tsx` | New `createReactBlockSpec` custom block: format selector (mermaid/plantuml/graphviz/d2/c4plantuml/erd/nomnoml) + code editor (left) + Kroki SVG preview (right); auto-renders on mount and debounces re-render on edit |
| `vault-editor/src/styles/global.css` | Added BlockNote override styles (dark theme) + `.diagram-block` split-pane layout |

**Key behaviour:** existing markdown files with code blocks like ` ```mermaid ` automatically load as editable diagram blocks with live preview. Saving serializes them back to code fences.

## 2026-05-14 — feat: rebuild vault-editor as Astro + React + TipTap WYSIWYG editor

### Overview

Replaced the vanilla JS SPA vault-editor with a full **Astro + React** application featuring a **TipTap** WYSIWYG editor — similar to Medium or Confluence in style and interaction.

### vault-editor (port 4000) — complete rewrite

**Project setup**

| File | Description |
|---|---|
| `vault-editor/package.json` | Astro 5, React 18, TipTap 2.x, tiptap-markdown, lowlight/highlight.js |
| `vault-editor/astro.config.mjs` | `output: 'static'` with `@astrojs/react` integration |
| `vault-editor/tsconfig.json` | Extends `astro/tsconfigs/strict` with React JSX |
| `vault-editor/Dockerfile` | Multi-stage: node:20-alpine build → nginx:alpine serve |
| `vault-editor/nginx.conf` | Same proxy rules (`/api/` → `bridge:3001/`); SSE route unchanged |

**React components**

| Component | Description |
|---|---|
| `App.tsx` | Root layout: topbar, sidebar, main editor area, statusbar; holds editor ref for diagram insertion |
| `Sidebar.tsx` | Collapsible folder groups, file search, per-file delete button |
| `Editor.tsx` | TipTap editor with `forwardRef`; bubble menu (bold/italic/strike/code/link/H1/H2); floating menu (H1–H3, lists, task list, code block, quote, table, diagram); Ctrl+S save; frontmatter preserved and shown in toggle panel |
| `DiagramModal.tsx` | Format selector (mermaid, plantuml, graphviz, d2, c4plantuml, erd, nomnoml); code editor; Kroki live preview via bridge; saves diagram `.md` to vault; inserts embed code into editor |
| `GitModal.tsx` | Two tabs: **Status & Commit** (git status + commit message + push) and **Clone Repository** (URL + branch → clones into vault) |
| `NewFileModal.tsx` | Folder picker + name input; auto-generates YAML frontmatter template |
| `Toast.tsx` | Fixed-position toast notifications (success/error/info) |

**Hooks & lib**

| File | Description |
|---|---|
| `src/hooks/useSSE.ts` | EventSource client with auto-reconnect; drives sidebar refresh on diagram events |
| `src/lib/api.ts` | Typed fetch wrappers for all bridge endpoints including `gitClone` and `renderDiagram` |
| `src/styles/global.css` | Catppuccin Mocha dark theme; full TipTap prose styles; syntax highlighting; all component styles |

### bridge — new endpoints

| Route | Description |
|---|---|
| `POST /git/clone` | Clones a remote repository into `VAULT_DIR` (replaces existing content); validates URL scheme; `depth=1` for speed |
| `POST /diagrams/render` | Proxies source code to Kroki for SVG rendering; returns `{ svg }`; used by the vault-editor DiagramModal for live preview |

---

## 2026-05-14 — feat: replace Obsidian+CouchDB with lightweight vault-editor web app

### Motivation

Removed the heavy `obsidian` (noVNC) and `couchdb` (LiveSync database) containers. The vault folder structure is preserved exactly as before; vault data is versioned with git instead of a database. A new `vault-editor` service (nginx + static SPA) provides browser-based markdown editing.

### Removed

- `obsidian` service (`ghcr.io/sytone/obsidian-remote`, port 8080)
- `couchdb` service (`couchdb:3`, port 5984)
- `couchdb-data` named volume
- `couchdb/local.ini` no longer referenced by any service

### Added — `vault-editor/` service (port 4000)

| File | Description |
|---|---|
| `vault-editor/Dockerfile` | nginx:alpine serving static files |
| `vault-editor/nginx.conf` | Proxies `/api/` → `bridge:3001/`; SSE route with buffering disabled |
| `vault-editor/public/index.html` | Single-page markdown editor SPA |

**SPA features:**
- Sidebar file tree with Obsidian folder order (`Architecture`, `Flows`, `Sequences`, `Infrastructure`, `Notes`)
- Edit / Split / Preview mode toggle
- Ctrl+S save; dirty-state indicator
- **+ New** — creates `.md` with YAML frontmatter in any vault folder
- **Delete** — removes the open file after confirmation
- **⎇ Commit** — shows `git status --porcelain`, accepts a commit message, calls `POST /api/git/commit`
- SSE integration: sidebar auto-refreshes on `diagram_added` / `diagram_removed` events from the bridge

### Added — bridge git endpoints (`bridge/src/index.ts`)

| Route | Description |
|---|---|
| `GET /git/status` | Runs `git -C VAULT_DIR status --porcelain`; returns `{ status }` |
| `POST /git/commit` | `git add .` → `git commit -m <message>` → `git push` (push non-fatal); returns `{ success, output }` |

### Updated — `bridge/Dockerfile`

Added `apk add --no-cache git` and `git config --global --add safe.directory '*'` to the runtime stage so the bridge can run git commands against the mounted vault volume.

### `docker-compose.yml`

- `vault-editor` service added: port `4000:4000`, depends on `bridge`
- `obsidian`, `couchdb` services removed
- `couchdb-data` volume removed
- Service count: 8 → 7

---

## 2026-05-14 — refactor: Obsidian-centric workflow — documents first, Excalidraw optional (v1.4.0)

### Overview

The MCP server is now **Obsidian-first**. Documents are the primary deliverable; diagrams are embedded resources. Excalidraw is an optional live-preview layer, not the required destination for every diagram.

### Rendering strategy (new)

| Format | Asset | Obsidian embed | Excalidraw |
|---|---|---|---|
| `mermaid` | none (inline code block) | ` ```mermaid ``` ` — renders natively | optional via `scene` |
| Kroki (plantuml, graphviz, d2, …) | `{folder}/Assets/{name}.svg` | `![[Assets/name.svg]]` | optional via `scene` |
| Eraser.io | `{folder}/Assets/{name}.png` | `![[Assets/name.png]]` | optional via `scene` |

### Tool changes (`mcp-server/src/handlers.ts`, `1.3.0` → `1.4.0`)

| Tool | Change |
|---|---|
| `create_diagram` | `scene` removed from **required** — now optional. Mermaid stored as inline code block; other formats render SVG to `{folder}/Assets/`. |
| `create_eraser_diagram` | `scene` removed from **required** — now optional. PNG saved to `{folder}/Assets/`. |
| `update_diagram` | Now handles all three cases: Obsidian-only, mermaid+Excalidraw, SVG/PNG+Excalidraw. |
| `create_note` | **Removed** — replaced by `create_document`. |
| `create_document` | **New primary tool.** Structured document with `sections: [{heading, body?, diagram?}]`. When a section has a `diagram` path, auto-reads the diagram `.md` and inserts the correct embed (mermaid inline or `![[asset]]`). |

### Helper changes

- `buildMarkdown` replaced by `buildObsidianMarkdown` — uses `asset` field for `![[…]]` embed; omits asset embed for mermaid; Excalidraw fields optional.
- New `saveAsset(vaultPath, folder, name, data, ext)` — writes to `{folder}/Assets/`.
- New `getDiagramEmbed(vaultPath, diagramPath)` — reads diagram `.md` and returns the correct Obsidian embed string for use in `create_document`.

### `mcp-server/src/types.ts`

- `DiagramFrontmatter`: `scene`, `fileId`, `elementId` are now optional; new optional fields `asset` and `diagramType`.

### `sample-project/`

Updated to show the new Obsidian-centric flow:
- Architecture → Mermaid inline (no asset)
- Sequence → PlantUML via Kroki → `Assets/order-placement.svg`
- Cloud → Eraser.io → `Assets/cloud-architecture.png`
- Final document → `create_document` with sections embedding all three

---

## 2026-05-14 — feat: Obsidian project init, note creation, Eraser.io diagram support + sample project

### Scope

Repo refocused as an **MCP server + container services** platform. Excalidraw is a diagram renderer embedded in the workflow, not the primary product. Three new MCP tools added; a sample project demonstrates the full document-generation workflow.

### New MCP tools (`mcp-server/src/handlers.ts`, version `1.2.0` → `1.3.0`)

| Tool | Description |
|---|---|
| `init_project` | Scaffold a new Obsidian-compatible vault under `VAULT_PATH` with standard folders, `README.md`, `.obsidian/app.json`, `.gitignore`, and an initial git commit |
| `create_note` | Write an Obsidian markdown note with YAML frontmatter; embed diagram sources via `![[path]]` |
| `create_eraser_diagram` | Render diagram via **Eraser.io API** → PNG → embed in Excalidraw; save source in vault; auto-commit |

### Eraser.io integration

- New `ERASER_API_KEY` env var on `mcp-server` and `mcp-http` services (sourced from host `$ERASER_API_KEY`, defaults to empty).
- New `renderWithEraser()` helper: POSTs to `https://app.eraser.io/api/render/prompt` with `returnFile: true`, returns PNG buffer.
- New `pngDimensions()` helper: reads IHDR chunk (bytes 16–23) for width/height; scales to max 1200 px.
- Supported `diagram_type` values: `flowchart`, `sequenceDiagram`, `classDiagram`, `entityRelationshipDiagram`, `cloudArchitectureDiagram`, `mindmap`.
- Vault `.md` format uses `format: eraser` + `diagramType` frontmatter fields.

### `docker-compose.yml`

- Added `ERASER_API_KEY=${ERASER_API_KEY:-}` to both `mcp-server` and `mcp-http` environment blocks.

### `sample-project/`

New directory demonstrating a full document-generation workflow (Order Management System):

```
sample-project/
├── README.md                          ← 6-step workflow with exact MCP prompts
└── vault/                             ← pre-built example output vault
    ├── README.md
    ├── .gitignore
    ├── Architecture/system-overview.md
    ├── Flows/checkout-flow.md
    ├── Sequences/order-placement.md
    └── Notes/system-documentation.md
```

### How to enable Eraser.io

```powershell
$env:ERASER_API_KEY = "your-key"
docker compose up -d mcp-server mcp-http
```

Get an API key at https://app.eraser.io/workspace/settings.

---

## 2026-05-14 — chore: add MCP interaction rule — Claude always asks which scene before acting

Added a behavioral rule to `CLAUDE.md` that instructs Claude to confirm the target scene or diagram before calling any MCP tool that writes to or reads a specific scene/diagram.

**Rule summary:**
- Before any scene-targeting MCP call, Claude calls `list_scenes` and asks the user to pick.
- For `create_diagram` / `update_diagram` without a specified path, Claude also asks which vault folder (`Architecture/`, `Flows/`, `Sequences/`, `Infrastructure/`).
- Exceptions: the user already names the scene in their message; read-only listing tools (`list_scenes`, `list_diagrams`, `git_log`, `git_status`).

---

## 2026-05-14 — feat: add self-hosted Obsidian browser UI + CouchDB LiveSync containers

### Overview

Added two new Docker services to support vault management and cross-device sync:

- **`obsidian`** (`ghcr.io/sytone/obsidian-remote`) — runs the full Obsidian desktop app in a browser-accessible VNC session (port 8080). The `diagrams-vault/` is mounted at `/vaults/diagrams-vault` inside the container; open it via **Open folder as vault** on first launch.
- **`couchdb`** (`couchdb:3`) — CouchDB database on port 5984, pre-configured with CORS for the [Self-hosted LiveSync](https://github.com/vrtmrz/obsidian-livesync) plugin. Enables vault sync between the browser Obsidian instance and any desktop Obsidian client.

### New files

- **`couchdb/local.ini`** — CouchDB CORS configuration (origins `*`, all methods, standard headers); bind-mounted into the container at `/opt/couchdb/etc/local.ini`.

### `docker-compose.yml`

- Added `obsidian` service: port `8080:8080`, volume `./diagrams-vault:/vaults/diagrams-vault`, network `excalidraw-net`.
- Added `couchdb` service: port `5984:5984`, named volume `couchdb-data` for data persistence, bind-mount `./couchdb/local.ini`, env `COUCHDB_USER=admin` / `COUCHDB_PASSWORD=obsidian`, network `excalidraw-net`.
- Added `couchdb-data` to the top-level `volumes` block.

### One-time CouchDB setup (after first `docker compose up`)

```bash
curl -X PUT http://admin:obsidian@localhost:5984/obsidian-vault
```

Then connect the Self-hosted LiveSync plugin in Obsidian to `http://localhost:5984` with database `obsidian-vault`.

### `README.md`

- Updated services table (six → eight containers).
- Added sections **3a** (Obsidian in browser) and **3b** (CouchDB LiveSync setup).

---

## 2026-05-14 — chore: align OAuth provider with MCP TypeScript SDK v1.29.0 reference implementation

Updated `mcp-server/src/http-server.ts` to match the SDK's v1.29.0 `demoInMemoryOAuthProvider` patterns:

- **`registerClient`**: removed redundant `client_id` generation — SDK generates it before calling this method; implementation now stores the full object as-is
- **`authCodes` map**: now stores full `AuthorizationParams` + client (was: just challenge string + client_id)
- **`authorize`**: added `redirect_uri` validation against `client.redirect_uris` (throws `InvalidRequestError` for unregistered URIs)
- **`exchangeAuthorizationCode`**: new parameters per v1.29.0 interface — `codeVerifier?`, `redirectUri?`, `resource?`; resource tracked per-token; scopes propagated into `AuthInfo`
- **`exchangeRefreshToken`**: added `resource?: URL` parameter to match updated interface
- **`verifyAccessToken`**: now returns `resource` field from `AuthInfo`; explicit expiry check
- **`token_type`**: changed from `"Bearer"` (RFC non-conformant) to `"bearer"` (lowercase per OAuth 2.1)
- **`isInitializeRequest`**: now imported from `@modelcontextprotocol/sdk/types.js` instead of a local copy
- **`mcpAuthRouter`**: added `scopesSupported: ["mcp:tools"]` option
- **`package.json`**: bumped SDK version constraint from `^1.12.0` → `^1.29.0` to match what pnpm already resolved

## 2026-05-14 — feat: OAuth 2.0 support for Claude Desktop "Add custom connector" UI

### Root cause analysis

Claude Desktop's "Add custom connector" UI performs OAuth validation before adding a server. It sends a GET to `/.well-known/oauth-authorization-server` to discover the authorization server, then registers a client, opens the browser for the user to authorize, and exchanges the code for a token. Without OAuth endpoints, the connector addition fails with "Failed to add connector."

### What changed

The HTTP transport (`mcp-http` container) was rewritten from **Fastify** to **Express** to use the MCP SDK's built-in OAuth auth router (`mcpAuthRouter`). A simple in-memory `OAuthServerProvider` auto-approves all authorization requests (dev mode — no real user consent needed for a local server).

**OAuth endpoints now served at `https://localhost:3443/`:**

| Endpoint | Purpose |
|---|---|
| `GET /.well-known/oauth-authorization-server` | RFC 8414 authorization server metadata |
| `GET /.well-known/oauth-protected-resource/mcp` | RFC 9728 protected resource metadata |
| `GET/POST /authorize` | Authorization endpoint (auto-approves, redirects with code) |
| `POST /token` | Token endpoint (PKCE S256 exchange) |
| `POST /register` | Dynamic client registration (RFC 7591) |

**`/mcp` routes** now require a valid Bearer token (`Authorization: Bearer <token>`). The 401 response includes `WWW-Authenticate` with a `resource_metadata` hint so clients can discover OAuth endpoints automatically.

Tokens are issued with a 1-year expiry (in-memory, reset on container restart).

### Changes

- **`mcp-server/src/http-server.ts`** — Rewritten from Fastify to Express; added in-memory `OAuthServerProvider`; mounted `mcpAuthRouter()`; added `requireBearerAuth` to all `/mcp` routes.
- **`mcp-server/package.json`** — Added `express@^5.0.0`, `@types/express@^5.0.0`; removed `fastify@^4.28.0`.
- **`mcp-server/pnpm-lock.yaml`** — Updated lockfile.

### How to apply

```bash
docker compose build mcp-server && docker compose up -d mcp-server mcp-http
```

After rebuilding, open Claude Desktop → Settings → Developer → Add custom connector → `https://localhost:3443/mcp`. Claude will open your browser for the OAuth authorization step (which auto-approves and redirects immediately).

---

## 2026-05-14 — fix: add Private Network Access header + root endpoint; clarify claude.ai web requires public URL

### Root cause analysis

`claude.ai` web custom connectors are validated by **Anthropic's backend servers**, not by the browser. Because Anthropic's servers cannot reach `localhost`, any `localhost` URL silently fails with "Failed to add connector" before a single byte reaches nginx (confirmed by empty access logs on every add attempt).

The `Access-Control-Allow-Private-Network: true` header — required by Chrome's Private Network Access policy for browser-side clients — was also missing. It is now added to all CORS responses so that browser-based MCP clients (e.g. future claude.ai architecture or direct API consumers) can connect from `https://claude.ai` to localhost.

**For claude.ai web**: expose the server with a public HTTPS tunnel, then add the tunnel URL as the connector:
- **ngrok**: `ngrok http --url=<your-static-domain> https://localhost:3443` (or plain `ngrok http 3443` after disabling TLS termination — easier: `ngrok http http://localhost:3002` and point nginx out of the path)
- **Cloudflare Tunnel**: `cloudflared tunnel --url http://localhost:3002`

**For Claude Desktop**: `https://localhost:3443/mcp` works directly (local connection, cert already trusted).

### Changes

- **`mcp-server/src/http-server.ts`** — Added `Access-Control-Allow-Private-Network: true` to `onRequest` CORS hook and OPTIONS handler.
- **`mcp-server/src/http-server.ts`** — Added `GET /` discovery endpoint returning server name, version, and instructions.

### How to apply

```bash
docker compose build mcp-http && docker compose up -d mcp-http
```

---

## 2026-05-13 — fix: GET /mcp returns 405 so Claude Desktop/Code can add the server

### Root cause

When adding `https://localhost:3443/mcp` in Claude Desktop or Claude Code, the client sends an initial `GET /mcp` (without a session ID) as a reachability probe. The server was returning `400 Bad Request`, which the MCP SDK client treats as a fatal `StreamableHTTPError`. Only `405 Method Not Allowed` is handled gracefully — the SDK falls back to POST-only mode and continues.

### Changes

- **`mcp-server/src/http-server.ts`** — GET handler now checks the session ID *before* calling `reply.hijack()`. A missing or unknown session ID returns `405` with `Allow: POST`, instead of `400`.
- **`mcp-server/src/http-server.ts`** — OPTIONS CORS handler adds `mcp-protocol-version` and `authorization` to `Access-Control-Allow-Headers` (required by MCP SDK 1.29.0 clients).

### How to apply

```bash
docker compose build mcp-http && docker compose up -d mcp-http
```

---

## 2026-05-13 — mcp-tls: add HTTPS proxy for Claude Desktop / Claude Code connectors

### Problem

Claude Desktop (and Claude Code CLI) only accept **https** URLs for HTTP-transport MCP connectors. The existing `mcp-http` service on port 3002 serves plain HTTP, so the connector URL `http://localhost:3002/mcp` was rejected.

### Solution

Added a new `mcp-tls` Docker service — an nginx reverse proxy that terminates TLS on port 3443 and forwards to `mcp-http:3002` over HTTP inside the Docker network.

### New files

- `nginx-tls/Dockerfile` — builds nginx:alpine with openssl
- `nginx-tls/entrypoint.sh` — generates a self-signed certificate into the `./certs/` bind-mount on first start; prints the PowerShell trust command; then starts nginx
- `nginx-tls/nginx.conf` — listens on 3443 with SSL; proxy_pass to `mcp-http:3002`; buffering disabled for SSE

### `docker-compose.yml`

- Added `mcp-tls` service (port `3443:3443`, bind-mount `./certs:/certs`, depends on `mcp-http`)

### `.gitignore`

- Added `certs/` — the generated certificate files are runtime artefacts, not source

### One-time setup (Windows, run once after first `docker compose up`)

```powershell
# Run PowerShell as Administrator
Import-Certificate -FilePath "$PWD\certs\server.crt" -CertStoreLocation Cert:\LocalMachine\Root
```

### Updated connector URLs

| Client | URL |
|---|---|
| Claude Desktop (HTTP connector) | `https://localhost:3443/mcp` |
| Claude Code CLI | `claude mcp add --transport http excalidraw https://localhost:3443/mcp` |

### `CLAUDE.md` and `README.md`

- Added project rule: always update README.md and CHANGES.md on any project change
- Updated Architecture section to include `nginx-tls/` and `certs/`
- Updated Claude Desktop config section with Option A (stdio) / Option B (HTTPS)
- Updated Claude Code connector section to use HTTPS URL

---

## 2026-05-13 — mcp-http: add CORS support for browser-based connectors

### `mcp-server/src/http-server.ts`

- Added `onRequest` Fastify hook that sets `Access-Control-Allow-Origin` (echoes request `Origin`), `Access-Control-Allow-Credentials`, and `Access-Control-Expose-Headers: mcp-session-id` on every response — including hijacked routes where plugins cannot inject headers after the fact
- Added `OPTIONS /mcp` route for CORS preflight — responds 204 with `Access-Control-Allow-Methods`, `Access-Control-Allow-Headers`, and `Access-Control-Max-Age`

**Why:** Claude Desktop and claude.ai send requests from an `https://claude.ai` origin. Without CORS headers the browser blocks all requests before the MCP handshake, which was the root cause of the "failed to add connector" error.

---

## 2026-05-13 — mcp-server: containerise stdio server; share image with mcp-http

### `docker-compose.yml`

- Added `mcp-server` service (container name `excalidraw-mcp`):
  - Builds from `./mcp-server/Dockerfile`, tagged as `image: excalidraw-mcp-server`
  - Runs `tail -f /dev/null` (`entrypoint` override) — keepalive so Claude Desktop can `docker exec` into it
  - Volume `./diagrams-vault:/vault`; env vars `BRIDGE_URL`, `KROKI_URL`, `VAULT_PATH` pre-set
  - `depends_on: [bridge, kroki]`
- Updated `mcp-http` service:
  - Added `image: excalidraw-mcp-server` — shares the same built image (Docker caches the build; only one build on `--build`)
  - `depends_on` now includes `mcp-server` to guarantee build order

### Claude Desktop config (updated)

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

---

## 2026-05-13 — mcp-server: add Streamable HTTP transport for Claude connectors

### Overview

Added a second entry point (`http-server.ts`) that exposes all existing MCP tools over **Streamable HTTP** (the transport required by Claude connectors / Settings > Connectors). The stdio entry point (`index.ts`) is unchanged. All tool logic is now in a shared `handlers.ts` module.

---

### `mcp-server/src/handlers.ts` (new)

Extracted from `index.ts`:
- All env var constants (`BRIDGE_URL`, `KROKI_URL`, `VAULT_PATH`)
- All helper functions (bridge, Kroki, vault, git, image element factory)
- `TOOLS` array
- All `handle*` functions
- `handleTool(name, args)` dispatcher
- `createMcpServer()` factory — creates a `Server` instance with `ListTools` and `CallTool` handlers wired up
- Exports: `TOOLS`, `handleTool`, `createMcpServer`, `ok`, `err`

### `mcp-server/src/index.ts` (simplified)

- Now a 15-line stdio wrapper: imports `createMcpServer` from `handlers.ts`, connects with `StdioServerTransport`, logs env vars

### `mcp-server/src/http-server.ts` (new)

- Fastify v4 server on `PORT` (default `3002`)
- Uses `reply.hijack()` + `reply.raw` for raw HTTP control (same pattern as bridge SSE)
- `POST /mcp` — creates a new `StreamableHTTPServerTransport` + `Server` per session on `initialize`, routes subsequent requests to existing session by `mcp-session-id` header
- `GET /mcp` — SSE stream for server-to-client messages
- `DELETE /mcp` — closes and cleans up session
- `GET /health` — returns `{ status: "ok", sessions: N }`
- Session map: `Map<sessionId, StreamableHTTPServerTransport>`; cleaned up via `transport.onclose`

### `mcp-server/package.json`

- Bumped version `1.1.0` → `1.2.0`
- Upgraded `@modelcontextprotocol/sdk` `^1.0.4` → `^1.12.0` (adds `StreamableHTTPServerTransport`)
- Removed `node-fetch` (no longer needed — uses native `fetch` from Node 20)
- Added `fastify ^4.28.0`
- Added scripts: `start:http` (`node dist/http-server.js`), `dev:http` (`tsx src/http-server.ts`)

### `mcp-server/Dockerfile` (new)

- Multi-stage: builder (pnpm install + tsc) → runtime (Alpine + git + prod deps)
- Git installed via `apk add git` with global user config for vault commit operations
- Default `CMD`: `node dist/http-server.js`

### `docker-compose.yml`

- Added `mcp-http` service:
  - Builds from `./mcp-server/Dockerfile`
  - Port `3002:3002` exposed to host
  - Volume `./diagrams-vault:/vault` for git-tracked diagram sources
  - `BRIDGE_URL=http://bridge:3001`, `KROKI_URL=http://kroki:8000` (internal Docker network)
  - `depends_on: [bridge, kroki]`

---

### Claude Code connector setup

After `docker compose up --build -d`:

```
Settings > Connectors > Add custom connector
URL: http://localhost:3002/mcp
```

Or via Claude Code CLI:
```bash
claude mcp add --transport http excalidraw http://localhost:3002/mcp
```

## 2026-05-12 — bridge: migrate Express → Fastify, adopt pnpm; add SPEC.md

### `bridge/src/index.ts`

- Replaced `express` + `cors` with `fastify` v4 + `@fastify/cors`
- SSE endpoint uses `reply.hijack()` + `reply.raw` (Node.js `ServerResponse`) for raw streaming
- Wildcard diagram routes use Fastify's `request.params["*"]` instead of Express's `req.params[0]`
- Route type generics added for all parameterised routes (`Params`, `Body`) for TypeScript correctness
- Disconnect detection changed from Express `req.on("close", ...)` to `request.raw.on("close", ...)`

### `bridge/package.json`

- Removed: `express`, `cors`, `@types/express`, `@types/cors`, `ts-node`
- Added: `fastify ^4.28.0`, `@fastify/cors ^9.0.0`, `tsx ^4.0.0`
- Dev script changed from `ts-node src/index.ts` to `tsx src/index.ts`

### `bridge/Dockerfile`

- Switched from `npm` to `pnpm` (installed via `npm install -g pnpm`)
- Builder stage: `pnpm install --frozen-lockfile` + `pnpm run build`
- Runtime stage: `pnpm install --prod --frozen-lockfile`

### `SPEC.md` (new)

- Created full technical specification at project root covering all components (MCP server, bridge, excalidraw-app, Kroki), HTTP API reference, SSE event catalogue, data flows, vault format, networking diagram, `builder.ts` internals, known quirks, dev commands, and Claude Desktop config

---

## 2026-05-12 — Kroki diagram-as-code integration + Obsidian vault

### Overview

Added full diagram-as-code support: Claude can now write Mermaid, PlantUML, Graphviz, D2, and ~20 other diagram formats, render them to SVG via a self-hosted Kroki instance, and place the result as an embedded image element in an Excalidraw scene. Diagram sources are stored as Obsidian-compatible Markdown files in a dedicated git-tracked vault.

---

### `docker-compose.yml`

- Added `ports: ["3001:3001"]` to the `bridge` service so the MCP server (running on the host) can reach it.
- Added `./diagrams-vault:/diagrams-vault` volume mount to `bridge`.
- Added `VAULT_DIR=/diagrams-vault` environment variable to `bridge`.
- Added new `kroki` service (`yuzutech/kroki`, port `8000:8000`) with `KROKI_MERMAID_HOST=mermaid`.
- Added new `mermaid` service (`yuzutech/kroki-mermaid`, internal port `8002`) required by Kroki for Mermaid rendering.

---

### `bridge/src/index.ts`

- Added `VAULT_DIR` env var (default `./diagrams-vault`) and `ensureVaultDir()`.
- Added chokidar watcher for `VAULT_DIR` — broadcasts `diagram_added`, `diagram_changed`, `diagram_removed` SSE events on `.md` file changes; ignores `.obsidian/` directory.
- Added `/diagrams` routes:
  - `GET /diagrams` — recursively list all `.md` files in vault
  - `GET /diagrams/*` — return content of a diagram source file
  - `PUT /diagrams/*` — create or overwrite a diagram source file (creates parent dirs)
  - `DELETE /diagrams/*` — delete a diagram source file
- Added `sanitizeDiagramPath()` helper — prevents path traversal, validates path segments, enforces `.md` extension.
- Added `walkDir()` helper for recursive directory listing.
- Updated `/health` response to include `vault_dir`.

---

### `mcp-server/package.json`

- Bumped version `1.0.0` → `1.1.0`.
- Added dependency: `simple-git ^3.27.0`.

---

### `mcp-server/src/types.ts`

- Added `"image"` to `ElementType` union.
- Added `ImageElement` interface (`type: "image"`, `status`, `fileId`, `scale`).
- Added `ExcalidrawFileEntry` interface (`mimeType`, `id`, `dataURL`, `created`, `lastRetrieved`).
- Added `DiagramFrontmatter` interface for vault `.md` frontmatter schema.
- Tightened `ExcalidrawScene.files` type from `Record<string, unknown>` to `Record<string, ExcalidrawFileEntry>`.
- Updated `ExcalidrawElement` union to include `ImageElement`.

---

### `mcp-server/src/index.ts`

**New env vars:**
- `KROKI_URL` (default `http://localhost:8000`)
- `VAULT_PATH` (no default — must be set in Claude Desktop config)

**New imports:** `fs/promises`, `fs` (existsSync), `crypto` (randomBytes), `path`, `simple-git`.

**New internal helpers:**
- `renderWithKroki(format, source)` — POST to Kroki, returns SVG string
- `extractSvgDimensions(svg)` — parses `viewBox` / `width`+`height` attributes
- `svgToDataUrl(svg)` — base64-encodes SVG to `data:image/svg+xml;base64,...`
- `makeFileId()` / `makeElementId()` — random hex IDs
- `requireVaultPath()` — throws descriptive error if `VAULT_PATH` is unset
- `buildMarkdown(fm, source)` — serialises frontmatter + fenced code block
- `parseFrontmatter(content)` — extracts YAML frontmatter and fenced source
- `walkVault(dir, base, results)` — recursive `.md` file lister
- `gitCommitAndPush(vaultPath, message)` — `git add . && git commit && git push`; gracefully handles missing remote
- `makeImageElement(elementId, fileId, x, y, w, h)` — constructs a valid Excalidraw image element

**New MCP tools (7):**

| Tool | What it does |
|---|---|
| `create_diagram` | Render source → SVG → base64 image in scene; write `.md` to vault; git push |
| `update_diagram` | Re-render source → update `scene.files[fileId].dataURL` in-place; update `.md`; git push |
| `render_diagram` | Re-render existing vault diagram into a scene (fresh image element at given position) |
| `get_diagram` | Read raw `.md` content from vault |
| `list_diagrams` | Recursively list `.md` files, optionally filtered by folder |
| `git_log` | Show vault commit history |
| `git_status` | Show branch, remote, and uncommitted changes |

Server version bumped to `1.1.0` in the MCP server identity.

---

### `diagrams-vault/` (new)

New top-level directory — an Obsidian-compatible vault and git repo for diagram sources.

```
diagrams-vault/
├── .gitignore          ← ignores Obsidian workspace state
├── README.md           ← vault usage guide
├── Architecture/       ← system / component diagrams
├── Flows/              ← user flows, business processes
├── Sequences/          ← sequence / interaction diagrams
└── Infrastructure/     ← deployment, networking, infra
```

Each subdirectory contains a `.gitkeep` placeholder.

---

### `setup-vault.sh` (new)

Interactive first-time setup script:
1. Runs `git init` + initial commit in `diagrams-vault/` (skips if already a repo).
2. Prompts for a GitHub remote URL and optionally pushes.
3. Prints a ready-to-paste `claude_desktop_config.json` block with absolute paths pre-filled for `BRIDGE_URL`, `KROKI_URL`, and `VAULT_PATH`.
4. Prints the `pnpm install && pnpm run build` reminder.

---

## 2026-05-12 — Fix TypeScript build error in excalidraw-app

**File:** `excalidraw-app/src/App.tsx`

**Error:**
```
src/App.tsx(84,9): error TS4104: The type 'readonly NonDeletedExcalidrawElement[]'
is 'readonly' and cannot be assigned to the mutable type 'unknown[]'
```

**Root cause:**
`canvas.getSceneElements()` (Excalidraw's imperative API) returns
`readonly NonDeletedExcalidrawElement[]` — a readonly array. The local
`SceneFile` interface declared `elements: unknown[]` (mutable), which TypeScript
rejects because widening a readonly array to a mutable array could allow
unintended mutations.

**Fix:**
Changed the `elements` field in the `SceneFile` interface from `unknown[]` to
`readonly unknown[]` (line 11). The array is only ever serialized to JSON and
never mutated, so the readonly constraint is correct.

```diff
- elements: unknown[];
+ elements: readonly unknown[];
```
