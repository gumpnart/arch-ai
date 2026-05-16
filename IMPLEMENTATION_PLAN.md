# Implementation Plan: AI-Powered Architecture Documentation System
<!-- CLAUDE CODE INSTRUCTIONS: Read this entire file before writing any code.
     Execute phases in order. Do not skip steps. Run tests after each phase. -->

## System Overview

Build a complete, self-hosted AI-powered architecture documentation pipeline:

```
Claude (claude.ai)
  ↓ MCP
arch-doc-mcp          Node.js — SA document templates + Kroki bridge
  ↓ HTTP
kroki-mcp             Self-hosted MCP wrapper for Kroki rendering
  ↓ HTTP
Kroki Server          Docker — diagram DSL → SVG/PNG renderer

Obsidian Vault        Git repo — .md files, human-verified
  ↓ git push
GitHub Actions        CI/CD — build + deploy
  ↓
VitePress Site        Static site — published documentation

Browser
  ↓
web/                  React + Vite — BlockNote editor (Phase 9)
  ↓ fetch
web/server/           Express API — reads/writes vault files
  ↓ proxy
Kroki :8000           Diagram preview rendering
```

**AI scope**: Claude generates DSL + doc drafts. Human verifies. Kroki renders for preview.
**What gets stored**: Mermaid DSL text in `.md` files — never binary images.

---

## Repository Structure

```
arch-doc-system/
├── arch-doc-mcp/          ← MCP server (Phase 1–2)
│   ├── src/
│   │   ├── index.ts
│   │   ├── kroki-bridge.ts        ← Phase 2
│   │   └── templates/
│   │       └── registry.ts
│   │   └── tools/
│   │       └── render-and-embed.ts ← Phase 2
│   ├── package.json
│   ├── tsconfig.json
│   └── README.md
│
├── kroki/                 ← Phase 3
│   └── docker-compose.yml
│
├── vault/                 ← Phase 4
│   ├── Architecture/
│   │   ├── Diagrams/
│   │   └── ADR/
│   ├── Components/
│   ├── Infrastructure/
│   ├── Runbooks/
│   └── README.md
│
├── site/                  ← Phase 5
│   ├── .vitepress/
│   │   └── config.ts
│   ├── index.md
│   └── package.json
│
├── web/                   ← Phase 9
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── Sidebar/
│   │   │   └── Editor/
│   │   ├── hooks/
│   │   ├── lib/
│   │   └── api/
│   ├── server/
│   │   ├── index.ts
│   │   └── routes/
│   ├── package.json
│   └── vite.config.ts
│
├── .github/
│   └── workflows/
│       └── publish.yml    ← Phase 5
│
├── .env                   ← root env vars
├── package.json           ← monorepo scripts
└── .claude/
    └── mcp.json           ← Phase 6
```

---

## Prerequisites

```bash
# Verify before starting
node --version        # >= 20.0.0
npm --version         # >= 10.0.0
docker --version      # >= 24.0.0
docker compose version  # >= 2.0.0
go version            # >= 1.21 (for utain/kroki-mcp)
git --version         # any recent version
```

---

## Phase 1 — arch-doc-mcp Server

> **Goal**: Working MCP server with all 11 SA templates, stdio transport, compiles clean.

### 1.1 Scaffold

```bash
mkdir -p arch-doc-system/arch-doc-mcp/src/templates
mkdir -p arch-doc-system/arch-doc-mcp/src/tools
cd arch-doc-system/arch-doc-mcp
```

### 1.2 `package.json`

```json
{
  "name": "arch-doc-mcp",
  "version": "1.0.0",
  "description": "MCP server — Solution Architecture document templates",
  "type": "module",
  "bin": { "arch-doc-mcp": "dist/index.js" },
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "start:http": "node dist/index.js --transport http --port 3456",
    "test": "node --test dist/tests/*.test.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.0",
    "zod": "^3.25.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.5.0"
  }
}
```

### 1.3 `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 1.4 `src/templates/registry.ts`

Create the template registry with all 11 mandatory SA documents.
Each template has: `id`, `abbr`, `name`, `category`, `mandatory`, `when`,
`audience`, `purpose`, `vaultPath`, `frontmatterType`, `content`.

**Templates to implement** (all with full `{{placeholder}}` variables):

| ID | Abbr | Vault Path |
|----|------|------------|
| `sad` | SAD | `vault/Architecture/sad.md` |
| `nfr` | NFR | `vault/Architecture/non-functional-requirements.md` |
| `c4-context` | C4-L1 | `vault/Architecture/Diagrams/system-context.md` |
| `c4-container` | C4-L2 | `vault/Architecture/Diagrams/container-diagram.md` |
| `c4-component` | C4-L3 | `vault/Components/{{service_name}}.md` |
| `adr` | ADR | `vault/Architecture/ADR/ADR-{{number}}-{{slug}}.md` |
| `data-architecture` | DA | `vault/Architecture/data-architecture.md` |
| `integration-architecture` | IA | `vault/Architecture/integration-architecture.md` |
| `security-architecture` | SA | `vault/Architecture/security-architecture.md` |
| `infrastructure-architecture` | INFRA | `vault/Infrastructure/infrastructure-architecture.md` |
| `risk-register` | RISK | `vault/Architecture/risk-register.md` |
| `runbook` | RB | `vault/Runbooks/{{service_name}}-runbook.md` |

Each template content must include:
- YAML frontmatter (`---`) with `title`, `type`, `status: draft`, `created`, `tags`, `relates_to`
- Markdown body with proper section headings
- At least one ` ```mermaid ` block (except `nfr`, `adr`, `risk-register`)
- `{{placeholder}}` variables for all system-specific values

Export:
```typescript
export const TEMPLATES: Record<string, Template>
export const CATEGORIES: Record<string, { label: string; color: string; docIds: string[] }>
export const ALL_TEMPLATE_IDS: string[]
```

### 1.5 `src/index.ts`

Main MCP server. Register these primitives:

**Tools:**
```typescript
server.registerTool("list_templates", ...)            // list with optional category filter
server.registerTool("get_template", ...)              // get by id
server.registerTool("get_template_placeholders", ...) // list {{vars}}
server.registerTool("fill_template", ...)             // fill vars
server.registerTool("get_document_checklist", ...)    // by phase: initiation|design|implementation|go-live|all
server.registerTool("generate_document", ...)         // high-level: description → filled draft
// Phase 2 tools registered here too (see Phase 2)
```

**Resources:**
```typescript
server.registerResource("template-index", "arch-doc://templates", ...)
server.registerResource("template", new ResourceTemplate("arch-doc://template/{id}", ...), ...)
```

**Prompts:**
```typescript
server.registerPrompt("generate-sad", ...)
server.registerPrompt("generate-adr", ...)
server.registerPrompt("generate-runbook", ...)
```

**Transport logic** (at bottom of file):
```typescript
// Parse --transport http --port XXXX args
// Default: stdio (for Claude Desktop / Claude Code)
// HTTP: StreamableHTTPServerTransport on /mcp with health at /health
```

### 1.6 Phase 1 Validation

```bash
cd arch-doc-mcp
npm install
npm run build
# Must compile with 0 errors

# Smoke test via stdio JSON-RPC:
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"0.0.1"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' \
  | node dist/index.js 2>/dev/null

# Expected: JSON with 6+ tools in the tools array
# Required tools present: list_templates, get_template, fill_template,
#   get_template_placeholders, get_document_checklist, generate_document
```

---

## Phase 2 — Kroki Bridge Integration

> **Goal**: Replace Eraser with self-hosted Kroki. Claude generates DSL, Kroki renders preview URL.

### 2.1 Delete old Eraser files

```bash
rm -f src/eraser-bridge.ts
rm -f src/tools/generate-with-diagram.ts
```

### 2.2 `src/kroki-bridge.ts`

```typescript
import { deflateSync } from "node:zlib";

export type KrokiDiagramType =
  | "mermaid" | "plantuml" | "c4plantuml"
  | "graphviz" | "d2" | "erd" | "bpmn" | "excalidraw";

export type KrokiOutputFormat = "svg" | "png" | "pdf" | "jpeg";

export interface RenderRequest {
  diagramType: KrokiDiagramType;
  dsl: string;
  outputFormat?: KrokiOutputFormat;
}

export interface RenderResult {
  url: string;          // Kroki render URL — shareable preview
  diagramType: KrokiDiagramType;
  outputFormat: KrokiOutputFormat;
  mermaidBlock: string; // ```mermaid DSL ``` ready for Obsidian .md
}

// Build Kroki URL (zlib deflate + base64url encode the DSL)
export function buildKrokiUrl(diagramType: string, dsl: string, format: string): string {
  const base = process.env.KROKI_URL ?? "https://kroki.io";
  const compressed = deflateSync(Buffer.from(dsl, "utf-8"), { level: 9 });
  const encoded = compressed
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `${base}/${diagramType}/${format}/${encoded}`;
}

export async function renderDiagram(req: RenderRequest): Promise<RenderResult> {
  const format = req.outputFormat ?? "svg";
  const url = buildKrokiUrl(req.diagramType, req.dsl, format);
  const mermaidBlock = ["```mermaid", req.dsl.trim(), "```"].join("\n");
  return { url, diagramType: req.diagramType, outputFormat: format, mermaidBlock };
}

// Template → Kroki type mapping
export const TEMPLATE_KROKI_MAP: Record<string, { type: KrokiDiagramType; dslHint: string }> = {
  "sad":                         { type: "mermaid",    dslHint: "C4Context or flowchart TB" },
  "c4-context":                  { type: "c4plantuml", dslHint: "C4Context (PlantUML macros)" },
  "c4-container":                { type: "c4plantuml", dslHint: "C4Container (PlantUML macros)" },
  "c4-component":                { type: "c4plantuml", dslHint: "C4Component (PlantUML macros)" },
  "data-architecture":           { type: "mermaid",    dslHint: "erDiagram" },
  "integration-architecture":    { type: "mermaid",    dslHint: "sequenceDiagram" },
  "security-architecture":       { type: "mermaid",    dslHint: "flowchart TB" },
  "infrastructure-architecture": { type: "mermaid",    dslHint: "flowchart TB (cloud topology)" },
  "runbook":                     { type: "mermaid",    dslHint: "flowchart TD" },
};

// DSL generation prompts — instructions for Claude to write correct DSL
export function buildDslPrompt(templateId: string, systemName: string, description: string): string {
  const hints: Record<string, string> = {
    "c4-context": `Generate C4PlantUML C4Context DSL for "${systemName}". ${description}
Show: the system, all human actors, and all external systems.
No internal components. DSL must start with @startuml and use C4Context macros.`,
    "c4-container": `Generate C4PlantUML C4Container DSL for "${systemName}". ${description}
Show: all deployable containers (frontend, APIs, DBs, queues, caches).
Include technology labels and communication protocols.`,
    "c4-component": `Generate C4PlantUML C4Component DSL for "${systemName}". ${description}
Show: internal components (controller, service layer, repository, event publisher).`,
    "data-architecture": `Generate Mermaid erDiagram for "${systemName}". ${description}
Show: all entities with PK/FK fields and cardinality.`,
    "integration-architecture": `Generate Mermaid sequenceDiagram for "${systemName}". ${description}
Show: complete message flow with request/response and async events.`,
    "infrastructure-architecture": `Generate Mermaid flowchart TB for "${systemName}" infrastructure. ${description}
Use subgraph for VPC/subnet zones. Show LB, compute, DB, queue.`,
    "runbook": `Generate Mermaid flowchart TD for "${systemName}" incident flow. ${description}
Show: alert → triage → resolution decision tree.`,
  };
  return hints[templateId] ?? `Generate ${TEMPLATE_KROKI_MAP[templateId]?.dslHint ?? "diagram"} DSL for "${systemName}". ${description}`;
}
```

### 2.3 `src/tools/render-and-embed.ts`

Register two new tools on the MCP server:

**`render_and_embed_diagram`**
```typescript
// inputSchema: { template_id, system_name, diagram_dsl, diagram_type?, author?, additional_vars? }
// Logic:
// 1. Get template from registry
// 2. Resolve kroki type from TEMPLATE_KROKI_MAP or diagram_type param
// 3. Call renderDiagram(dsl) → get url + mermaidBlock
// 4. Replace first ```mermaid...``` block in template with mermaidBlock
// 5. fillTemplate with baseVars (system_name, date, author, tags)
// 6. Return: filled doc + kroki preview URL + remaining {{placeholders}}
```

**`get_diagram_dsl_prompt`**
```typescript
// inputSchema: { template_id, system_name, description }
// Returns: format instructions + dslHint + "then call render_and_embed_diagram"
// readOnlyHint: true
```

### 2.4 Register tools in `src/index.ts`

```typescript
import { registerRenderAndEmbedTool, registerGetDslPromptTool } from "./tools/render-and-embed.js";

registerRenderAndEmbedTool(server);
registerGetDslPromptTool(server);
```

### 2.5 Phase 2 Validation

```bash
npm run build
# Must compile with 0 errors

# Verify 8 tools registered:
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"0.0.1"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' \
  | node dist/index.js 2>/dev/null \
  | grep -o '"name":"[^"]*"'

# Expected: list_templates, get_template, get_template_placeholders,
#   fill_template, get_document_checklist, generate_document,
#   render_and_embed_diagram, get_diagram_dsl_prompt

# Test Kroki URL generation (no network needed):
node -e "
import('./dist/kroki-bridge.js').then(m => {
  const url = m.buildKrokiUrl('mermaid', 'graph TD; A-->B', 'svg');
  console.log('Valid URL:', url.startsWith('https://kroki.io') && url.length > 50);
});
"
```

---

## Phase 3 — Self-Hosted Kroki Stack

> **Goal**: Kroki rendering server running locally on port 8000.

### 3.1 `kroki/docker-compose.yml`

```yaml
version: "3.8"

services:
  kroki:
    image: yuzutech/kroki:latest
    container_name: kroki
    restart: unless-stopped
    environment:
      - KROKI_MERMAID_HOST=mermaid
      - KROKI_BPMN_HOST=bpmn
      - KROKI_EXCALIDRAW_HOST=excalidraw
    ports:
      - "8000:8000"
    depends_on:
      - mermaid
      - bpmn
      - excalidraw
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  mermaid:
    image: yuzutech/kroki-mermaid:latest
    container_name: kroki-mermaid
    restart: unless-stopped
    expose:
      - "8002"

  bpmn:
    image: yuzutech/kroki-bpmn:latest
    container_name: kroki-bpmn
    restart: unless-stopped
    expose:
      - "8003"

  excalidraw:
    image: yuzutech/kroki-excalidraw:latest
    container_name: kroki-excalidraw
    restart: unless-stopped
    expose:
      - "8004"

networks:
  default:
    name: kroki-network
```

### 3.2 Phase 3 Validation

```bash
cd kroki && docker compose up -d

# Wait for health check
until curl -sf http://localhost:8000/health > /dev/null; do
  echo "Waiting for Kroki..."; sleep 3
done && echo "Kroki is up"

# Test Mermaid rendering
curl -s -X POST http://localhost:8000/mermaid/svg \
  -H "Content-Type: text/plain" \
  -d "graph TD; A[Start] --> B[End]" -o /tmp/test.svg
head -1 /tmp/test.svg | grep -q "<svg" && echo "✅ Mermaid OK" || echo "❌ Mermaid failed"
```

---

## Phase 4 — Obsidian Vault Structure

> **Goal**: Git-backed vault ready for AI-generated, human-verified documentation.

### 4.1 Create directory structure

```bash
mkdir -p vault/Architecture/Diagrams
mkdir -p vault/Architecture/ADR
mkdir -p vault/Components
mkdir -p vault/Infrastructure
mkdir -p vault/Runbooks
mkdir -p vault/.obsidian
```

### 4.2 `vault/README.md`

```markdown
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
```

### 4.3 `vault/.obsidian/app.json`

```json
{ "useMarkdownLinks": false, "newLinkFormat": "shortest", "attachmentFolderPath": "Assets" }
```

### 4.4 Seed example documents

Create these three files with real content (status: `example`):
- `vault/Architecture/sad.md` — filled SAD template
- `vault/Architecture/ADR/ADR-001-use-mermaid-for-diagrams.md` — real ADR
- `vault/Architecture/Diagrams/system-context.md` — C4-L1 of this system

### 4.5 `vault/.gitattributes`

```gitattributes
*.md text eol=lf
*.json text eol=lf
```

### 4.6 Phase 4 Validation

```bash
find vault -name "*.md" | wc -l  # >= 4 files

# Validate frontmatter present in all .md files
for f in $(find vault -name "*.md"); do
  head -1 "$f" | grep -q "^---" || echo "WARNING: no frontmatter in $f"
done
```

---

## Phase 5 — VitePress Static Site

> **Goal**: `git push` to main triggers build and deploys the vault as a static site.

### 5.1 `site/package.json`

```json
{
  "name": "arch-doc-site",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "vitepress dev docs",
    "build": "vitepress build docs",
    "preview": "vitepress preview docs"
  },
  "dependencies": {
    "vitepress": "^1.3.0",
    "vitepress-plugin-mermaid": "^2.0.16"
  }
}
```

### 5.2 `site/.vitepress/config.ts`

```typescript
import { defineConfig } from "vitepress";
import { withMermaid } from "vitepress-plugin-mermaid";

export default withMermaid(
  defineConfig({
    title: "Architecture Documentation",
    description: "AI-generated, human-verified architecture docs",
    srcDir: "../vault",
    outDir: "../dist",
    themeConfig: {
      nav: [
        { text: "Overview", link: "/README" },
        { text: "Architecture", link: "/Architecture/sad" },
        { text: "Components", link: "/Components/" },
        { text: "Runbooks", link: "/Runbooks/" },
      ],
      sidebar: {
        "/Architecture/": [
          { text: "Foundation", items: [
            { text: "SAD", link: "/Architecture/sad" },
            { text: "NFR", link: "/Architecture/non-functional-requirements" },
            { text: "Risk Register", link: "/Architecture/risk-register" },
          ]},
          { text: "Diagrams", items: [
            { text: "System Context (C4-L1)", link: "/Architecture/Diagrams/system-context" },
            { text: "Container Diagram (C4-L2)", link: "/Architecture/Diagrams/container-diagram" },
          ]},
          { text: "ADR", link: "/Architecture/ADR/" },
        ],
        "/Components/": [{ text: "Components", items: [] }],
        "/Runbooks/": [{ text: "Runbooks", items: [] }],
      },
      search: { provider: "local" },
    },
    mermaid: { theme: "default" },
  })
);
```

### 5.3 `.github/workflows/publish.yml`

```yaml
name: Build & Deploy Docs

on:
  push:
    branches: [main]
    paths: ["vault/**", "site/**"]
  pull_request:
    branches: [main]
    paths: ["vault/**"]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
          cache-dependency-path: site/package.json
      - run: cd site && npm install
      - name: Check for broken wikilinks
        run: |
          grep -rh "\[\[" vault/ --include="*.md" \
            | grep -oP '(?<=\[\[)[^\]]+' \
            | while read link; do
                name="${link%%|*}"
                find vault -name "${name}.md" > /dev/null 2>&1 \
                  || echo "BROKEN LINK: [[$name]]"
              done
      - run: cd site && npm run build
      - name: Deploy to GitHub Pages
        if: github.ref == 'refs/heads/main'
        uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

### 5.4 Phase 5 Validation

```bash
cd site && npm install && npm run build
# dist/ must exist with index.html

npm run dev
# Open http://localhost:5173 — Mermaid diagrams must render
```

---

## Phase 6 — Claude Code + Claude Desktop Config

> **Goal**: Connect everything so Claude can call all MCP tools from a conversation.

### 6.1 `.claude/mcp.json`

```json
{
  "mcpServers": {
    "arch-doc-mcp": {
      "command": "node",
      "args": ["./arch-doc-mcp/dist/index.js"],
      "env": { "KROKI_URL": "http://localhost:8000" }
    },
    "kroki-mcp": {
      "command": "go",
      "args": [
        "run", "github.com/utain/kroki-mcp/cmd/kroki-mcp@latest",
        "-m", "stdio", "-f", "svg",
        "--kroki-host", "http://localhost:8000"
      ]
    }
  }
}
```

### 6.2 Claude Desktop config

File: `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)

```json
{
  "mcpServers": {
    "arch-doc-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/arch-doc-system/arch-doc-mcp/dist/index.js"],
      "env": { "KROKI_URL": "http://localhost:8000" }
    },
    "kroki-mcp": {
      "command": "go",
      "args": [
        "run", "github.com/utain/kroki-mcp/cmd/kroki-mcp@latest",
        "-m", "stdio", "-f", "svg",
        "--kroki-host", "http://localhost:8000"
      ]
    }
  }
}
```

### 6.3 Phase 6 Validation

```bash
# Both MCP servers must start cleanly
KROKI_URL=http://localhost:8000 node arch-doc-mcp/dist/index.js &
sleep 1 && kill %1 && echo "✅ arch-doc-mcp starts"

go run github.com/utain/kroki-mcp/cmd/kroki-mcp@latest \
  -m stdio -f svg --kroki-host http://localhost:8000 &
sleep 3 && kill %1 && echo "✅ kroki-mcp starts"
```

---

## Phase 7 — End-to-End Integration Test

> **Goal**: Full workflow test — Claude prompt → arch-doc-mcp → Kroki → .md file → VitePress build.

### 7.1 Start all services

```bash
# Terminal 1: Kroki
cd kroki && docker compose up

# Terminal 2: arch-doc-mcp
cd arch-doc-mcp && KROKI_URL=http://localhost:8000 node dist/index.js
```

### 7.2 Automated integration test

Create `arch-doc-mcp/src/tests/integration.test.ts`:

```typescript
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { buildKrokiUrl } from "../kroki-bridge.js";
import { TEMPLATES, ALL_TEMPLATE_IDS } from "../templates/registry.js";

test("all 11 templates are registered", () => {
  const required = ["sad","nfr","c4-context","c4-container","c4-component",
    "adr","data-architecture","integration-architecture","security-architecture",
    "infrastructure-architecture","risk-register","runbook"];
  for (const id of required) {
    assert(TEMPLATES[id], `Missing template: ${id}`);
    assert(TEMPLATES[id].content.length > 100, `Template too short: ${id}`);
    assert(TEMPLATES[id].content.includes("{{"), `Template has no placeholders: ${id}`);
  }
});

test("kroki URL encoding is correct", () => {
  const url = buildKrokiUrl("mermaid", "graph TD; A-->B", "svg");
  assert(url.includes("/mermaid/svg/"), "URL format incorrect");
  assert(url.length > 50, "URL too short");
});

test("template fill replaces placeholders", async () => {
  const sad = TEMPLATES["sad"];
  const filled = sad.content.replace(/\{\{system_name\}\}/g, "Test System");
  assert(filled.includes("Test System"), "Placeholder not replaced");
  assert(!filled.includes("{{system_name}}"), "Placeholder still present");
});

test("all diagram-using templates have mermaid block", () => {
  const nodiagram = ["nfr", "adr", "risk-register"];
  for (const id of ALL_TEMPLATE_IDS) {
    if (!nodiagram.includes(id)) {
      assert(TEMPLATES[id].content.includes("```mermaid"),
        `Template ${id} missing mermaid block`);
    }
  }
});
```

```bash
cd arch-doc-mcp && npm run build && npm test

# Test Kroki render end-to-end
KROKI_URL=http://localhost:8000 node -e "
import('./dist/kroki-bridge.js').then(async m => {
  const result = await m.renderDiagram({
    diagramType: 'mermaid',
    dsl: 'sequenceDiagram\n  A->>B: Hello\n  B-->>A: World',
    outputFormat: 'svg'
  });
  const res = await fetch(result.url);
  console.log(res.ok ? '✅ Kroki render works' : '❌ Kroki failed: ' + res.status);
});
"
```

### 7.3 Manual Claude conversation test

```
# Test 1: List templates
"What architecture document templates are available?"

# Test 2: Generate document
"Generate an NFR document for a payment service.
 P99 < 200ms, 99.9% uptime, PostgreSQL + Redis, PCI-DSS scope."

# Test 3: Render diagram
"Generate a container diagram doc for an e-commerce system:
 React frontend, Node.js API Gateway, Order Service (PostgreSQL),
 Payment Service (Stripe), Kafka.
 Use get_diagram_dsl_prompt first, generate the DSL, then render it."

# Test 4: Checklist
"What documents do I need at project initiation?"
```

Expected: Table of 11 templates / filled NFR.md / complete doc + Kroki preview URL / SAD + NFR + C4-L1 + Risk Register

---

## Phase 8 — Git & CI/CD Setup

> **Goal**: Vault changes trigger automatic site rebuild and deploy.

### 8.1 Initialize repository

```bash
cd arch-doc-system
git init
git add .
git commit -m "chore: initial project setup

- arch-doc-mcp: MCP server with 11 SA templates
- kroki: self-hosted diagram rendering stack
- vault: Obsidian vault structure with example docs
- site: VitePress static site config
- ci: GitHub Actions publish workflow"
```

### 8.2 Branch protection rules

GitHub → Settings → Branches → Add rule for `main`:
- ✅ Require a pull request before merging
- ✅ Require status checks: `build` job must pass
- ✅ Require branches to be up to date

### 8.3 Enable GitHub Pages

GitHub → Settings → Pages → Source: GitHub Actions

### 8.4 Test CI pipeline

```bash
git checkout -b docs/feat-test-pipeline
cp vault/Architecture/sad.md vault/Components/test-service.md
sed -i 's/sad/component/' vault/Components/test-service.md
git add vault/Components/test-service.md
git commit -m "docs(components): add test-service doc"
git push origin docs/feat-test-pipeline
# Open PR → verify build job passes before merging
```

---

## Phase 9 — Vault Web Editor (BlockNote)

> **Goal**: Local web application for browsing, previewing, and editing vault documents
> using BlockNote — a Notion-style block editor. Diagrams render inline via Kroki.
> Saves directly back to the vault as `.md` files.
> See ./mockup/web-editor-mockup.jsx, ./mockup/mockup.png for UI guidance.

```
Browser → web/ (React + Vite + BlockNote)
            ↓ fetch /api/*
         web/server/ (Express)
            ↓ fs            ↓ proxy
         vault/ (.md)    Kroki :8000
```

### 9.1 Directory Structure

```
web/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── components/
│   │   ├── Sidebar/
│   │   │   ├── FileTree.tsx          # Vault directory tree
│   │   │   └── DocStatusBadge.tsx    # draft / in-review / stable badge
│   │   ├── Editor/
│   │   │   ├── DocEditor.tsx         # BlockNote editor wrapper
│   │   │   ├── MermaidBlock.tsx      # Custom BlockNote block for diagrams
│   │   │   ├── FrontmatterPanel.tsx  # YAML frontmatter side panel
│   │   │   └── EditorToolbar.tsx     # Save / status / export actions
│   │   └── shared/
│   │       └── KrokiPreview.tsx      # Renders DSL to SVG via Kroki
│   ├── hooks/
│   │   ├── useVaultFiles.ts          # Load file tree from API
│   │   ├── useVaultFile.ts           # Load + save single .md file
│   │   └── useKroki.ts               # Render DSL via Kroki, debounced
│   ├── lib/
│   │   ├── markdown.ts               # .md ↔ BlockNote blocks bridge
│   │   └── frontmatter.ts            # Parse / serialize YAML frontmatter
│   └── api/
│       └── client.ts                 # Fetch wrapper for server API
│
├── server/
│   ├── index.ts                      # Express server entry
│   └── routes/
│       ├── files.ts                  # GET /api/files, GET/PUT /api/file/:path
│       └── kroki.ts                  # POST /api/kroki/render (proxy)
│
├── package.json
├── vite.config.ts
└── index.html
```

### 9.2 `web/package.json`

```json
{
  "name": "arch-doc-web",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "concurrently \"vite\" \"tsx watch server/index.ts\"",
    "build": "vite build",
    "server": "tsx server/index.ts",
    "preview": "vite preview"
  },
  "dependencies": {
    "@blocknote/core": "^0.50.0",
    "@blocknote/react": "^0.50.0",
    "@blocknote/mantine": "^0.50.0",
    "@defensestation/blocknote-mermaid": "^1.0.0",
    "mermaid": "^11.0.0",
    "express": "^4.19.0",
    "cors": "^2.8.5",
    "gray-matter": "^4.0.3",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "concurrently": "^9.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.5.0",
    "vite": "^5.4.0"
  }
}
```

### 9.3 `web/vite.config.ts`

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:3001", changeOrigin: true },
    },
  },
});
```

### 9.4 Express Server

#### `web/server/index.ts`

```typescript
import express from "express";
import cors from "cors";
import { filesRouter } from "./routes/files.js";
import { krokiRouter } from "./routes/kroki.js";

const app = express();
const PORT = process.env.PORT ?? 3001;
const VAULT_PATH = process.env.VAULT_PATH ?? "../vault";

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.text({ limit: "10mb" }));

app.use((req, _res, next) => {
  (req as any).vaultPath = VAULT_PATH;
  next();
});

app.use("/api/files", filesRouter);
app.use("/api/kroki", krokiRouter);
app.get("/api/health", (_req, res) => res.json({ status: "ok", vault: VAULT_PATH }));

app.listen(PORT, () => {
  console.log(`arch-doc-web server on http://localhost:${PORT}`);
  console.log(`Vault: ${VAULT_PATH}`);
});
```

#### `web/server/routes/files.ts`

```typescript
import { Router, Request, Response } from "express";
import { promises as fs } from "node:fs";
import path from "node:path";

export const filesRouter = Router();

// GET /api/files — return vault directory tree with status badges
filesRouter.get("/", async (req: Request, res: Response) => {
  const vaultPath = (req as any).vaultPath as string;

  async function buildTree(dir: string, base: string): Promise<any[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const items = [];
    for (const entry of entries) {
      if (entry.name.startsWith(".") && entry.name !== ".obsidian") continue;
      if (entry.name === "node_modules") continue;
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(base, fullPath);
      if (entry.isDirectory()) {
        items.push({ type: "dir", name: entry.name, path: relativePath,
          children: await buildTree(fullPath, base) });
      } else if (entry.name.endsWith(".md")) {
        let status = "unknown";
        try {
          const content = await fs.readFile(fullPath, "utf-8");
          const match = content.match(/^status:\s*(\S+)/m);
          if (match) status = match[1].replace(/['"]/g, "");
        } catch {}
        items.push({ type: "file", name: entry.name, path: relativePath, status });
      }
    }
    return items.sort((a, b) =>
      a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1
    );
  }

  try {
    res.json({ tree: await buildTree(vaultPath, vaultPath), vault: vaultPath });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/files/:path(*) — read a single .md file
filesRouter.get("/:filePath(*)", async (req: Request, res: Response) => {
  const vaultPath = (req as any).vaultPath as string;
  const filePath = path.join(vaultPath, req.params.filePath);
  if (!filePath.startsWith(path.resolve(vaultPath)))
    return res.status(403).json({ error: "Forbidden" });
  try {
    res.json({ content: await fs.readFile(filePath, "utf-8"), path: req.params.filePath });
  } catch {
    res.status(404).json({ error: "File not found" });
  }
});

// PUT /api/files/:path(*) — save a .md file
filesRouter.put("/:filePath(*)", async (req: Request, res: Response) => {
  const vaultPath = (req as any).vaultPath as string;
  const filePath = path.join(vaultPath, req.params.filePath);
  if (!filePath.startsWith(path.resolve(vaultPath)))
    return res.status(403).json({ error: "Forbidden" });
  if (!filePath.endsWith(".md"))
    return res.status(400).json({ error: "Only .md files allowed" });
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, req.body as string, "utf-8");
    res.json({ ok: true, path: req.params.filePath });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
```

#### `web/server/routes/kroki.ts`

```typescript
import { Router, Request, Response } from "express";

export const krokiRouter = Router();
const KROKI_URL = process.env.KROKI_URL ?? "http://localhost:8000";

// POST /api/kroki/render — proxy to Kroki with CORS support
krokiRouter.post("/render", async (req: Request, res: Response) => {
  const { diagramType, dsl, format = "svg" } = req.body as {
    diagramType: string; dsl: string; format?: string;
  };
  if (!diagramType || !dsl)
    return res.status(400).json({ error: "diagramType and dsl are required" });
  try {
    const response = await fetch(`${KROKI_URL}/${diagramType}/${format}`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: dsl,
    });
    if (!response.ok)
      return res.status(response.status).json({ error: `Kroki: ${response.statusText}` });
    res.set("Content-Type", "image/svg+xml");
    res.send(await response.text());
  } catch (err) {
    res.status(500).json({ error: `Kroki unavailable: ${String(err)}` });
  }
});
```

### 9.5 Markdown Bridge

#### `web/src/lib/frontmatter.ts`

```typescript
export interface Frontmatter {
  title?: string;
  type?: string;
  status?: "draft" | "in-review" | "stable" | "deprecated";
  created?: string;
  updated?: string;
  tags?: string[];
  relates_to?: string[];
  owner?: string;
  reviewed_by?: string;
  [key: string]: unknown;
}

export function parseFrontmatter(content: string): { frontmatter: Frontmatter; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: content };
  const frontmatter: Frontmatter = {};
  for (const line of match[1].split("\n")) {
    const [key, ...rest] = line.split(":");
    if (!key?.trim()) continue;
    const val = rest.join(":").trim().replace(/^["']|["']$/g, "");
    if (val.startsWith("[")) {
      try { frontmatter[key.trim()] = JSON.parse(val.replace(/'/g, '"')); }
      catch { frontmatter[key.trim()] = val; }
    } else {
      frontmatter[key.trim()] = val;
    }
  }
  return { frontmatter, body: match[2].trim() };
}

export function serializeFrontmatter(fm: Frontmatter, body: string): string {
  const lines = ["---"];
  for (const [key, val] of Object.entries(fm)) {
    if (Array.isArray(val)) {
      lines.push(`${key}:`);
      for (const item of val) lines.push(`  - "${item}"`);
    } else if (val !== undefined && val !== "") {
      lines.push(`${key}: ${val}`);
    }
  }
  lines.push("---", "", body);
  return lines.join("\n");
}
```

#### `web/src/lib/markdown.ts`

```typescript
import { BlockNoteEditor, BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core";
import { MermaidBlock } from "@defensestation/blocknote-mermaid";
import { parseFrontmatter, serializeFrontmatter, type Frontmatter } from "./frontmatter.js";

export const schema = BlockNoteSchema.create({
  blockSpecs: { ...defaultBlockSpecs, mermaid: MermaidBlock },
});

export async function markdownToBlocks(
  content: string,
  editor: BlockNoteEditor<typeof schema.blockSpecs>
) {
  const { frontmatter, body } = parseFrontmatter(content);
  // Convert ```mermaid fenced blocks → mermaid block markers
  const prepared = body.replace(/```mermaid\n([\s\S]*?)```/g, (_, dsl) =>
    `:::mermaid\n${dsl.trim()}\n:::`
  );
  const blocks = await editor.tryParseMarkdownToBlocks(prepared);
  return { frontmatter, blocks };
}

export async function blocksToMarkdown(
  blocks: any[],
  frontmatter: Frontmatter,
  editor: BlockNoteEditor<typeof schema.blockSpecs>
): Promise<string> {
  let md = await editor.blocksToMarkdownLossy(blocks);
  // Convert mermaid markers back to fenced code blocks
  md = md.replace(/:::mermaid\n([\s\S]*?):::/g, (_, dsl) =>
    ["```mermaid", dsl.trim(), "```"].join("\n")
  );
  return serializeFrontmatter(frontmatter, md);
}
```

### 9.6 Custom Mermaid Block

#### `web/src/components/Editor/MermaidBlock.tsx`

```tsx
import { createReactBlockSpec } from "@blocknote/react";
import { useState, useEffect, useCallback } from "react";

export const MermaidBlock = createReactBlockSpec(
  {
    type: "mermaid" as const,
    propSchema: {
      dsl: { default: "" },
      diagramType: { default: "mermaid" },
      viewMode: { default: "split" },  // "code" | "preview" | "split"
    },
    content: "none",
  },
  {
    render: ({ block, editor }) => {
      const { dsl, diagramType, viewMode } = block.props;
      const [svgContent, setSvgContent] = useState("");
      const [renderError, setRenderError] = useState("");
      const [isRendering, setIsRendering] = useState(false);

      const renderDiagram = useCallback(async (code: string, type: string) => {
        if (!code.trim()) return;
        setIsRendering(true);
        setRenderError("");
        try {
          const res = await fetch("/api/kroki/render", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ diagramType: type, dsl: code, format: "svg" }),
          });
          if (res.ok) setSvgContent(await res.text());
          else setRenderError(`Render error: ${res.statusText}`);
        } catch (err) {
          setRenderError(`Kroki unavailable: ${String(err)}`);
        } finally {
          setIsRendering(false);
        }
      }, []);

      // Debounced render on DSL change
      useEffect(() => {
        if (viewMode !== "code") {
          const timer = setTimeout(() => renderDiagram(dsl, diagramType), 800);
          return () => clearTimeout(timer);
        }
      }, [dsl, diagramType, viewMode, renderDiagram]);

      const update = (key: string, value: string) =>
        editor.updateBlock(block, { props: { ...block.props, [key]: value } });

      return (
        <div style={{ border: "1px solid #e0e0e0", borderRadius: 8, overflow: "hidden", margin: "8px 0" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 10px", background: "#f8f9fa", borderBottom: "1px solid #e0e0e0" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#555" }}>📐 Diagram</span>
            <select value={diagramType} onChange={e => update("diagramType", e.target.value)}
              style={{ fontSize: 10, border: "1px solid #ddd", borderRadius: 3, padding: "1px 4px" }}>
              {["mermaid","c4plantuml","plantuml","graphviz","d2","erd"].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <div style={{ marginLeft: "auto", display: "flex", gap: 3 }}>
              {(["code","split","preview"] as const).map(m => (
                <button key={m} onClick={() => update("viewMode", m)} style={{
                  fontSize: 10, padding: "1px 7px", borderRadius: 4, cursor: "pointer",
                  background: viewMode === m ? "#333" : "#fff",
                  color: viewMode === m ? "#fff" : "#333",
                  border: "1px solid #ccc",
                }}>
                  {m === "code" ? "<>" : m === "split" ? "⊞" : "👁"}
                </button>
              ))}
            </div>
          </div>
          {/* Content */}
          <div style={{ display: "flex" }}>
            {(viewMode === "code" || viewMode === "split") && (
              <textarea value={dsl} onChange={e => update("dsl", e.target.value)}
                placeholder="Enter diagram DSL here..."
                style={{
                  flex: 1, minHeight: 160, padding: 12, fontFamily: "monospace",
                  fontSize: 12, lineHeight: 1.6, border: "none", outline: "none",
                  resize: "vertical", background: "#1e1e1e", color: "#d4d4d4",
                  borderRight: viewMode === "split" ? "1px solid #e0e0e0" : "none",
                }} />
            )}
            {(viewMode === "preview" || viewMode === "split") && (
              <div style={{ flex: 1, minHeight: 160, padding: 12, display: "flex",
                alignItems: "center", justifyContent: "center", background: "#fff" }}>
                {isRendering ? (
                  <span style={{ color: "#999", fontSize: 12 }}>Rendering...</span>
                ) : renderError ? (
                  <span style={{ color: "#e53935", fontSize: 11 }}>{renderError}</span>
                ) : svgContent ? (
                  <div dangerouslySetInnerHTML={{ __html: svgContent }}
                    style={{ maxWidth: "100%", overflow: "auto" }} />
                ) : (
                  <span style={{ color: "#ccc", fontSize: 12 }}>Enter DSL to preview</span>
                )}
              </div>
            )}
          </div>
        </div>
      );
    },
  }
);
```

### 9.7 BlockNote Editor Component

#### `web/src/components/Editor/DocEditor.tsx`

```tsx
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { SuggestionMenuController, getDefaultReactSlashMenuItems } from "@blocknote/react";
import { insertOrUpdateBlock } from "@blocknote/core";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

import { schema, markdownToBlocks, blocksToMarkdown } from "../../lib/markdown.js";
import { FrontmatterPanel } from "./FrontmatterPanel.js";
import { EditorToolbar } from "./EditorToolbar.js";
import { useState, useEffect, useCallback } from "react";
import type { Frontmatter } from "../../lib/frontmatter.js";

export function DocEditor({ filePath, onSaveSuccess }: { filePath: string; onSaveSuccess: () => void }) {
  const [frontmatter, setFrontmatter] = useState<Frontmatter>({});
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const editor = useCreateBlockNote({ schema });

  // Load file on path change
  useEffect(() => {
    setLoadError("");
    fetch(`/api/files/${encodeURIComponent(filePath)}`)
      .then(r => r.json())
      .then(async ({ content }: { content: string }) => {
        const { frontmatter: fm, blocks } = await markdownToBlocks(content, editor);
        setFrontmatter(fm);
        editor.replaceBlocks(editor.document, blocks);
        setIsDirty(false);
      })
      .catch(err => setLoadError(String(err)));
  }, [filePath]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const updatedFm = { ...frontmatter, updated: new Date().toISOString().split("T")[0] };
      const markdown = await blocksToMarkdown(editor.document, updatedFm, editor);
      const res = await fetch(`/api/files/${encodeURIComponent(filePath)}`, {
        method: "PUT", headers: { "Content-Type": "text/plain" }, body: markdown,
      });
      if (res.ok) { setIsDirty(false); setFrontmatter(updatedFm); onSaveSuccess(); }
    } finally {
      setIsSaving(false);
    }
  }, [filePath, frontmatter, editor, onSaveSuccess]);

  // Cmd+S shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); handleSave(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSave]);

  if (loadError) return <div style={{ padding: 20, color: "#e53935" }}>Error: {loadError}</div>;

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <EditorToolbar filePath={filePath} status={frontmatter.status}
          isDirty={isDirty} isSaving={isSaving} onSave={handleSave}
          onStatusChange={status => { setFrontmatter(p => ({ ...p, status })); setIsDirty(true); }} />
        <div style={{ flex: 1, overflow: "auto", padding: "20px 40px" }}>
          <BlockNoteView editor={editor} onChange={() => setIsDirty(true)} theme="light" slashMenu={false}>
            <SuggestionMenuController
              triggerCharacter="/"
              getItems={async query => [
                ...getDefaultReactSlashMenuItems(editor),
                {
                  title: "Diagram",
                  subtext: "Insert a Mermaid / C4 / PlantUML diagram block",
                  onItemClick: () => insertOrUpdateBlock(editor, { type: "mermaid", props: { viewMode: "split" } }),
                  group: "Architecture",
                  icon: <span>📐</span>,
                },
              ].filter(i => i.title.toLowerCase().includes(query.toLowerCase()))}
            />
          </BlockNoteView>
        </div>
      </div>
      <FrontmatterPanel frontmatter={frontmatter}
        onChange={fm => { setFrontmatter(fm); setIsDirty(true); }} />
    </div>
  );
}
```

### 9.8 App Entry + Sidebar

#### `web/src/App.tsx`

```tsx
import { useState } from "react";
import { FileTree } from "./components/Sidebar/FileTree.js";
import { DocEditor } from "./components/Editor/DocEditor.js";
import { useVaultFiles } from "./hooks/useVaultFiles.js";

export default function App() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const { tree, reload } = useVaultFiles();

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "system-ui, sans-serif" }}>
      <aside style={{ width: 260, borderRight: "1px solid #e0e0e0", background: "#fafafa",
        overflow: "auto", flexShrink: 0 }}>
        <div style={{ padding: "16px 16px 8px", borderBottom: "1px solid #e0e0e0" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#333" }}>📁 Vault</div>
          <div style={{ fontSize: 10, color: "#999", marginTop: 2 }}>arch-doc-system</div>
        </div>
        <FileTree tree={tree} selectedFile={selectedFile} onSelect={setSelectedFile} />
      </aside>
      <main style={{ flex: 1, overflow: "hidden" }}>
        {selectedFile ? (
          <DocEditor key={selectedFile} filePath={selectedFile} onSaveSuccess={reload} />
        ) : (
          <div style={{ height: "100%", display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", color: "#999" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📄</div>
            <div style={{ fontSize: 14 }}>Select a document from the sidebar</div>
            <div style={{ fontSize: 11, marginTop: 8 }}>
              Tip: type <code>/diagram</code> in the editor to insert a diagram block
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
```

### 9.9 Phase 9 Validation

```bash
cd web
npm install

# Verify key packages installed
ls node_modules/@blocknote/core && echo "✅ @blocknote/core"
ls node_modules/@blocknote/react && echo "✅ @blocknote/react"
ls node_modules/@defensestation/blocknote-mermaid && echo "✅ blocknote-mermaid"

# Start full stack (requires Kroki running from Phase 3)
VAULT_PATH=../vault npm run dev

# API tests (in separate terminal)
curl http://localhost:3001/api/health
# Expected: { "status": "ok", "vault": "../vault" }

curl http://localhost:3001/api/files | python3 -m json.tool | head -30
# Expected: tree array with vault structure

curl http://localhost:3001/api/files/README.md | python3 -m json.tool
# Expected: { "content": "...", "path": "README.md" }

curl -X POST http://localhost:3001/api/kroki/render \
  -H "Content-Type: application/json" \
  -d '{"diagramType":"mermaid","dsl":"graph TD; A-->B","format":"svg"}' | head -1
# Expected: <svg ...

open http://localhost:5173
# Manual checks:
# [ ] Sidebar shows vault file tree with status badges
# [ ] Clicking a .md file opens it in BlockNote editor
# [ ] Rich text formatting (bold, headings, lists) works
# [ ] Frontmatter panel shows title, status, tags, relates_to
# [ ] Typing /diagram in editor inserts Mermaid block
# [ ] Mermaid block: enter DSL → click preview → diagram renders
# [ ] Split mode shows code + preview side by side
# [ ] Cmd+S saves file (verify modification time changed in vault/)
# [ ] Saved file preserves frontmatter + DSL code blocks
# [ ] Status change dropdown updates frontmatter on save
```

---

## Root `package.json` — Monorepo Scripts

```json
{
  "name": "arch-doc-system",
  "private": true,
  "scripts": {
    "dev:kroki": "cd kroki && docker compose up",
    "dev:mcp":   "cd arch-doc-mcp && KROKI_URL=http://localhost:8000 node dist/index.js",
    "dev:web":   "cd web && VAULT_PATH=../vault npm run dev",
    "dev:site":  "cd site && npm run dev",
    "dev":       "concurrently \"npm:dev:kroki\" \"npm:dev:web\"",
    "build:mcp": "cd arch-doc-mcp && npm run build",
    "build:site":"cd site && npm run build",
    "build":     "npm run build:mcp && npm run build:site",
    "test:mcp":  "cd arch-doc-mcp && npm test"
  },
  "devDependencies": {
    "concurrently": "^9.0.0"
  }
}
```

---

## Root `.env`

```bash
# Kroki rendering server
KROKI_URL=http://localhost:8000

# Web editor server
VAULT_PATH=./vault
WEB_PORT=3001
```

---

## Environment Variables Reference

| Variable | Used by | Default | Notes |
|----------|---------|---------|-------|
| `KROKI_URL` | arch-doc-mcp, web/server | `https://kroki.io` | Set to `http://localhost:8000` for self-hosted |
| `VAULT_PATH` | web/server | `../vault` | Absolute or relative path to vault root |
| `PORT` | web/server | `3001` | Express API port |

---

## Troubleshooting

### arch-doc-mcp won't compile
```bash
node --version  # must be >= 20
rm -rf dist node_modules && npm install && npm run build
```

### Kroki container unhealthy
```bash
docker compose -f kroki/docker-compose.yml logs kroki
# Common fix: mermaid container not ready — wait 30s or restart
docker compose -f kroki/docker-compose.yml restart kroki
```

### MCP server not visible in Claude Desktop
```bash
# Verify JSON syntax
cat ~/Library/Application\ Support/Claude/claude_desktop_config.json | python3 -m json.tool
which node  # use absolute path in config, not just "node"
# Fully quit and relaunch Claude Desktop
```

### Wikilinks failing CI check
```bash
grep -rh "\[\[" vault/ --include="*.md" | grep -oP '(?<=\[\[)[^\]]+' | sort -u
# For each result, verify vault/{name}.md exists
```

### Kroki URL too long
```bash
# Use POST instead of GET-encoded URL for large diagrams
curl -X POST http://localhost:8000/mermaid/svg \
  -H "Content-Type: text/plain" --data-binary @diagram.mmd
```

### BlockNote editor blank on load
```bash
# Check Express server is running on :3001
curl http://localhost:3001/api/health
# Check Vite proxy is configured correctly in vite.config.ts
# Check browser console for CORS or 404 errors
```

### Mermaid block preview shows "Kroki unavailable"
```bash
# Verify Kroki is running
curl http://localhost:8000/health
# Verify web server KROKI_URL points to correct port
echo $KROKI_URL  # should be http://localhost:8000
```

### File saves but Obsidian shows corrupted frontmatter
```bash
# Verify serializeFrontmatter outputs valid YAML
# Check that arrays use correct indented list format
# Test manually: open vault/.md in Obsidian after save
```

---

## Completion Checklist

```
Phase 1 — arch-doc-mcp
  [ ] npm run build succeeds with 0 errors
  [ ] 6 tools registered (list_templates, get_template, get_template_placeholders,
      fill_template, get_document_checklist, generate_document)
  [ ] All 11 templates in registry with content > 100 chars
  [ ] stdio transport working (JSON-RPC smoke test passes)

Phase 2 — Kroki Bridge
  [ ] eraser-bridge.ts deleted
  [ ] kroki-bridge.ts compiles
  [ ] 8 tools registered (+ render_and_embed_diagram, get_diagram_dsl_prompt)
  [ ] buildKrokiUrl produces valid URL format
  [ ] TEMPLATE_KROKI_MAP covers all 9 diagram-using templates

Phase 3 — Kroki Docker
  [ ] docker compose up starts all 4 containers
  [ ] http://localhost:8000/health returns 200
  [ ] Mermaid SVG renders correctly (curl test passes)
  [ ] C4PlantUML renders correctly

Phase 4 — Vault
  [ ] Directory structure created
  [ ] vault/README.md explains conventions
  [ ] At least 3 example .md files with frontmatter
  [ ] No .md file missing frontmatter (validation loop passes)

Phase 5 — VitePress
  [ ] npm run build succeeds in site/
  [ ] dist/ created with index.html
  [ ] Mermaid diagrams render in browser (npm run dev)
  [ ] GitHub Actions workflow file valid YAML

Phase 6 — MCP Config
  [ ] .claude/mcp.json created with both servers
  [ ] Claude Desktop config updated (absolute paths)
  [ ] Both MCP servers start without errors

Phase 7 — Integration
  [ ] All unit tests pass (npm test)
  [ ] Kroki render URL test passes (requires Kroki running)
  [ ] All 4 manual Claude conversation tests produce expected output

Phase 8 — Git & CI/CD
  [ ] Repository initialized with meaningful first commit
  [ ] Branch protection rules configured
  [ ] GitHub Pages enabled
  [ ] Test PR triggers build job successfully

Phase 9 — BlockNote Web Editor
  [ ] npm install succeeds in web/
  [ ] API health endpoint returns 200
  [ ] File tree API returns vault structure with status fields
  [ ] File read API returns content for README.md
  [ ] File write API saves .md (no path traversal possible)
  [ ] Kroki proxy returns SVG for test diagram
  [ ] Vite dev server starts without errors
  [ ] Sidebar renders vault tree with draft/stable/in-review badges
  [ ] Opening a .md file loads content into BlockNote editor
  [ ] Frontmatter panel shows title, status, tags, relates_to
  [ ] /diagram slash command inserts Mermaid block
  [ ] Mermaid block split view shows code editor + Kroki preview
  [ ] Cmd+S saves back to vault .md file
  [ ] Saved file preserves YAML frontmatter and DSL code blocks
  [ ] Status dropdown change updates frontmatter field on save
```

---
*Generated for Claude Code execution · arch-doc-system v1.1 · 2026-05-15 · 9 phases*
