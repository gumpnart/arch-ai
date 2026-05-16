#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import http from "node:http";
import { TEMPLATES, CATEGORIES, ALL_TEMPLATE_IDS } from "./templates/registry.js";
import { registerRenderAndEmbedTool, registerGetDslPromptTool } from "./tools/render-and-embed.js";

const server = new McpServer({
  name: "arch-doc-mcp",
  version: "1.0.0",
});

// ─── Tools ────────────────────────────────────────────────────────────────────

server.registerTool(
  "list_templates",
  {
    description: "List all available SA document templates. Optionally filter by category.",
    inputSchema: {
      category: z.string().optional().describe("Filter by category: foundation | diagrams | decisions | architecture | governance | operations"),
    },
  },
  async (args) => {
    const ids = args.category
      ? (CATEGORIES[args.category]?.docIds ?? [])
      : ALL_TEMPLATE_IDS;

    const rows = ids.map((id) => {
      const t = TEMPLATES[id];
      if (!t) return null;
      return `| ${t.abbr} | ${t.name} | ${t.category} | ${t.mandatory ? "✅" : "—"} | ${t.when} |`;
    }).filter(Boolean);

    const table = [
      "| Abbr | Name | Category | Mandatory | When |",
      "|------|------|----------|-----------|------|",
      ...rows,
    ].join("\n");

    const categoryList = Object.entries(CATEGORIES)
      .map(([k, v]) => `- **${v.label}** (\`${k}\`): ${v.docIds.join(", ")}`)
      .join("\n");

    return {
      content: [
        {
          type: "text",
          text: [
            `## Available SA Document Templates (${ids.length})`,
            "",
            table,
            "",
            "## Categories",
            categoryList,
          ].join("\n"),
        },
      ],
    };
  }
);

server.registerTool(
  "get_template",
  {
    description: "Get the full content of a template by its ID.",
    inputSchema: {
      id: z.string().describe("Template ID (e.g. 'sad', 'adr', 'c4-container')"),
    },
  },
  async (args) => {
    const t = TEMPLATES[args.id];
    if (!t) {
      return {
        content: [{ type: "text", text: `Template '${args.id}' not found. Use list_templates to see valid IDs.` }],
        isError: true,
      };
    }
    return {
      content: [
        {
          type: "text",
          text: [
            `## ${t.name} (${t.abbr})`,
            ``,
            `**Category**: ${t.category}`,
            `**Mandatory**: ${t.mandatory}`,
            `**When**: ${t.when}`,
            `**Audience**: ${t.audience}`,
            `**Purpose**: ${t.purpose}`,
            `**Vault path**: \`${t.vaultPath}\``,
            ``,
            `---`,
            ``,
            t.content,
          ].join("\n"),
        },
      ],
    };
  }
);

server.registerTool(
  "get_template_placeholders",
  {
    description: "List all {{placeholder}} variables in a template that need to be filled.",
    inputSchema: {
      id: z.string().describe("Template ID"),
    },
  },
  async (args) => {
    const t = TEMPLATES[args.id];
    if (!t) {
      return {
        content: [{ type: "text", text: `Template '${args.id}' not found.` }],
        isError: true,
      };
    }
    const placeholders = [...t.content.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
    const unique = [...new Set(placeholders)];
    return {
      content: [
        {
          type: "text",
          text: [
            `## Placeholders in ${t.name}`,
            "",
            `${unique.length} unique placeholder(s):`,
            "",
            unique.map((p) => `- \`{{${p}}}\``).join("\n"),
          ].join("\n"),
        },
      ],
    };
  }
);

server.registerTool(
  "fill_template",
  {
    description: "Fill {{placeholder}} variables in a template with provided values.",
    inputSchema: {
      id: z.string().describe("Template ID"),
      vars: z.record(z.string()).describe("Map of placeholder name → value"),
    },
  },
  async (args) => {
    const t = TEMPLATES[args.id];
    if (!t) {
      return {
        content: [{ type: "text", text: `Template '${args.id}' not found.` }],
        isError: true,
      };
    }
    let content = t.content;
    for (const [key, val] of Object.entries(args.vars)) {
      content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), val);
    }
    const remaining = [...content.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
    const uniqueRemaining = [...new Set(remaining)];
    return {
      content: [
        {
          type: "text",
          text: [
            uniqueRemaining.length > 0
              ? `⚠️ ${uniqueRemaining.length} placeholder(s) still unfilled: ${uniqueRemaining.map((p) => `{{${p}}}`).join(", ")}`
              : "✅ All placeholders filled.",
            "",
            "---",
            "",
            content,
          ].join("\n"),
        },
      ],
    };
  }
);

server.registerTool(
  "get_document_checklist",
  {
    description: "Get the list of documents required for a project phase.",
    inputSchema: {
      phase: z.enum(["initiation", "design", "implementation", "go-live", "all"]).describe("Project phase"),
    },
  },
  async (args) => {
    const phaseMap: Record<string, string[]> = {
      initiation: ["sad", "nfr", "risk-register"],
      design: ["c4-context", "c4-container", "c4-component", "data-architecture", "integration-architecture", "security-architecture", "infrastructure-architecture", "adr"],
      implementation: ["adr", "runbook"],
      "go-live": ["runbook", "risk-register"],
      all: ALL_TEMPLATE_IDS,
    };

    const ids = phaseMap[args.phase] ?? ALL_TEMPLATE_IDS;
    const rows = ids.map((id) => {
      const t = TEMPLATES[id];
      if (!t) return null;
      return `- [ ] **${t.abbr}** — ${t.name}\n  - Path: \`${t.vaultPath}\`\n  - Audience: ${t.audience}`;
    }).filter(Boolean);

    return {
      content: [
        {
          type: "text",
          text: [
            `## Document Checklist — ${args.phase.charAt(0).toUpperCase() + args.phase.slice(1)} Phase`,
            "",
            rows.join("\n"),
          ].join("\n"),
        },
      ],
    };
  }
);

server.registerTool(
  "generate_document",
  {
    description: "High-level tool: given a description, generate a filled draft of an SA document.",
    inputSchema: {
      template_id: z.string().describe("Template ID to generate"),
      system_name: z.string().describe("Name of the system"),
      description: z.string().describe("Brief description of the system for context"),
      author: z.string().optional().describe("Document author"),
      extra_vars: z.record(z.string()).optional().describe("Additional placeholder values"),
    },
  },
  async (args) => {
    const t = TEMPLATES[args.template_id];
    if (!t) {
      return {
        content: [{ type: "text", text: `Template '${args.template_id}' not found. Use list_templates for valid IDs.` }],
        isError: true,
      };
    }

    const today = new Date().toISOString().split("T")[0];
    const slug = args.system_name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

    const baseVars: Record<string, string> = {
      system_name: args.system_name,
      system_name_slug: slug,
      service_name: args.system_name,
      service_name_slug: slug,
      date: today,
      author: args.author ?? "Architecture Team",
      ...args.extra_vars,
    };

    let content = t.content;
    for (const [key, val] of Object.entries(baseVars)) {
      content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), val);
    }

    const remaining = [...content.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
    const uniqueRemaining = [...new Set(remaining)];

    return {
      content: [
        {
          type: "text",
          text: [
            `## Generated: ${t.name} for ${args.system_name}`,
            "",
            `**Template**: ${t.abbr} | **Category**: ${t.category}`,
            `**Save to**: \`${t.vaultPath.replace("{{service_name}}", slug).replace("{{number}}", "001").replace("{{slug}}", slug)}\``,
            "",
            uniqueRemaining.length > 0
              ? `**Still needs**: ${uniqueRemaining.slice(0, 10).map((p) => `\`{{${p}}}\``).join(", ")}${uniqueRemaining.length > 10 ? ` (+${uniqueRemaining.length - 10} more)` : ""}`
              : "**Fully templated** — fill in any remaining details.",
            "",
            "---",
            "",
            content,
          ].join("\n"),
        },
      ],
    };
  }
);

// Phase 2 tools
registerRenderAndEmbedTool(server);
registerGetDslPromptTool(server);

// ─── Resources ────────────────────────────────────────────────────────────────

server.registerResource(
  "template-index",
  "arch-doc://templates",
  {
    description: "All available SA document templates",
    mimeType: "application/json",
  },
  async () => ({
    contents: [
      {
        uri: "arch-doc://templates",
        mimeType: "application/json",
        text: JSON.stringify(
          ALL_TEMPLATE_IDS.map((id) => {
            const t = TEMPLATES[id];
            return { id: t.id, abbr: t.abbr, name: t.name, category: t.category, mandatory: t.mandatory };
          }),
          null,
          2
        ),
      },
    ],
  })
);

// ─── Prompts ──────────────────────────────────────────────────────────────────

server.registerPrompt(
  "generate-sad",
  {
    description: "Generate a Solution Architecture Document for a system",
    argsSchema: {
      system_name: z.string().describe("System name"),
      description: z.string().describe("Brief system description"),
    },
  },
  async (args) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Generate a complete Solution Architecture Document for "${args.system_name}".

System description: ${args.description}

Use the generate_document tool with template_id="sad". Fill in realistic values for all sections including:
- Executive summary
- Business context and stakeholders
- System context diagram (Mermaid C4Context)
- Technology stack
- Quality attributes
- Key architectural decisions
- Risks and mitigations`,
        },
      },
    ],
  })
);

server.registerPrompt(
  "generate-adr",
  {
    description: "Generate an Architecture Decision Record",
    argsSchema: {
      system_name: z.string().describe("System name"),
      decision_title: z.string().describe("Short title for the decision"),
      context: z.string().describe("Context and problem being addressed"),
    },
  },
  async (args) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Generate an Architecture Decision Record for "${args.system_name}".

Decision: ${args.decision_title}
Context: ${args.context}

Use the generate_document tool with template_id="adr". Include:
- Clear problem statement and forces
- The decision made and why
- Positive and negative consequences
- At least 2 alternatives considered with pros/cons`,
        },
      },
    ],
  })
);

server.registerPrompt(
  "generate-runbook",
  {
    description: "Generate an operations runbook for a service",
    argsSchema: {
      service_name: z.string().describe("Service name"),
      description: z.string().describe("What the service does"),
    },
  },
  async (args) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Generate an operations runbook for the "${args.service_name}" service.

Service description: ${args.description}

Use the generate_document tool with template_id="runbook". Include:
- Incident response flowchart (Mermaid flowchart TD)
- At least 3 common alert scenarios with step-by-step resolution
- Deployment and rollback procedures
- Database backup/restore commands
- Escalation contacts`,
        },
      },
    ],
  })
);

// ─── Transport ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const transportIndex = args.indexOf("--transport");
const transport = transportIndex >= 0 ? args[transportIndex + 1] : "stdio";
const portIndex = args.indexOf("--port");
const port = portIndex >= 0 ? parseInt(args[portIndex + 1], 10) : 3456;

if (transport === "http") {
  const httpTransport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  const httpServer = http.createServer(async (req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", server: "arch-doc-mcp" }));
      return;
    }
    if (req.url?.startsWith("/mcp")) {
      await httpTransport.handleRequest(req, res);
      return;
    }
    res.writeHead(404);
    res.end("Not found");
  });

  await server.connect(httpTransport);
  httpServer.listen(port, () => {
    process.stderr.write(`arch-doc-mcp HTTP server on http://localhost:${port}\n`);
  });
} else {
  const stdioTransport = new StdioServerTransport();
  await server.connect(stdioTransport);
}
