import { z } from "zod";
import { TEMPLATES } from "../templates/registry.js";
import { renderDiagram, TEMPLATE_KROKI_MAP, buildDslPrompt } from "../kroki-bridge.js";
export function registerRenderAndEmbedTool(server) {
    server.registerTool("render_and_embed_diagram", {
        description: "Render a diagram via Kroki and embed it into an SA document template. Returns the filled document with the diagram block and a Kroki preview URL.",
        inputSchema: {
            template_id: z.string().describe("Template ID (e.g. 'c4-container', 'sad', 'runbook')"),
            system_name: z.string().describe("Name of the system being documented"),
            diagram_dsl: z.string().describe("Diagram DSL source code (Mermaid, C4PlantUML, etc.)"),
            diagram_type: z.string().optional().describe("Override diagram type (mermaid, c4plantuml, plantuml, graphviz, d2, erd). Defaults to template mapping."),
            author: z.string().optional().describe("Document author name"),
            additional_vars: z.record(z.string()).optional().describe("Additional {{placeholder}} values to fill"),
        },
    }, async (args) => {
        const template = TEMPLATES[args.template_id];
        if (!template) {
            return {
                content: [{ type: "text", text: `Unknown template: ${args.template_id}. Use list_templates to see available IDs.` }],
                isError: true,
            };
        }
        const krokiType = args.diagram_type
            ?? TEMPLATE_KROKI_MAP[args.template_id]?.type
            ?? "mermaid";
        const renderResult = await renderDiagram({
            diagramType: krokiType,
            dsl: args.diagram_dsl,
            outputFormat: "svg",
        });
        const today = new Date().toISOString().split("T")[0];
        const systemSlug = args.system_name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
        const baseVars = {
            system_name: args.system_name,
            system_name_slug: systemSlug,
            service_name: args.system_name,
            service_name_slug: systemSlug,
            date: today,
            author: args.author ?? "{{author}}",
            ...args.additional_vars,
        };
        // Replace first ```mermaid...``` block in template with rendered block
        let content = template.content.replace(/```mermaid[\s\S]*?```/, renderResult.mermaidBlock);
        // Fill base variables
        for (const [key, val] of Object.entries(baseVars)) {
            content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), val);
        }
        // Find remaining unfilled placeholders
        const remaining = [...content.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
        const uniqueRemaining = [...new Set(remaining)];
        return {
            content: [
                {
                    type: "text",
                    text: [
                        `## ${template.name} — ${args.system_name}`,
                        ``,
                        `**Kroki Preview URL**: ${renderResult.url}`,
                        `**Diagram type**: ${krokiType}`,
                        ``,
                        uniqueRemaining.length > 0
                            ? `**Remaining placeholders** (fill these manually):\n${uniqueRemaining.map((p) => `- \`{{${p}}}\``).join("\n")}`
                            : `**All base placeholders filled.**`,
                        ``,
                        `---`,
                        ``,
                        content,
                    ].join("\n"),
                },
            ],
        };
    });
}
export function registerGetDslPromptTool(server) {
    server.registerTool("get_diagram_dsl_prompt", {
        description: "Get DSL generation instructions for a diagram type. Returns a prompt telling Claude exactly what DSL to write, then calls render_and_embed_diagram.",
        inputSchema: {
            template_id: z.string().describe("Template ID that needs a diagram"),
            system_name: z.string().describe("Name of the system"),
            description: z.string().describe("Brief description of the system and what to show in the diagram"),
        },
    }, async (args) => {
        const template = TEMPLATES[args.template_id];
        if (!template) {
            return {
                content: [{ type: "text", text: `Unknown template: ${args.template_id}` }],
                isError: true,
            };
        }
        const krokiInfo = TEMPLATE_KROKI_MAP[args.template_id];
        const prompt = buildDslPrompt(args.template_id, args.system_name, args.description);
        return {
            content: [
                {
                    type: "text",
                    text: [
                        `## DSL Generation Instructions for ${template.name}`,
                        ``,
                        `**Diagram format**: ${krokiInfo?.type ?? "mermaid"}`,
                        `**DSL hint**: ${krokiInfo?.dslHint ?? "standard diagram"}`,
                        ``,
                        `### Instructions`,
                        prompt,
                        ``,
                        `### Next Step`,
                        `After generating the DSL, call \`render_and_embed_diagram\` with:`,
                        `- \`template_id\`: "${args.template_id}"`,
                        `- \`system_name\`: "${args.system_name}"`,
                        `- \`diagram_dsl\`: <the DSL you generate>`,
                        `- \`diagram_type\`: "${krokiInfo?.type ?? "mermaid"}"`,
                    ].join("\n"),
                },
            ],
        };
    });
}
