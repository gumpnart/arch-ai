# Change Log

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
