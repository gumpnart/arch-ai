# Change Log

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
