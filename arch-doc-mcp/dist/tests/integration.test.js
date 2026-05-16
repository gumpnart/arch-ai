import { strict as assert } from "node:assert";
import { test } from "node:test";
import { buildKrokiUrl } from "../kroki-bridge.js";
import { TEMPLATES, ALL_TEMPLATE_IDS } from "../templates/registry.js";
test("all 12 templates are registered", () => {
    const required = [
        "sad", "nfr", "c4-context", "c4-container", "c4-component",
        "adr", "data-architecture", "integration-architecture", "security-architecture",
        "infrastructure-architecture", "risk-register", "runbook",
    ];
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
test("template fill replaces placeholders", () => {
    const sad = TEMPLATES["sad"];
    const filled = sad.content.replace(/\{\{system_name\}\}/g, "Test System");
    assert(filled.includes("Test System"), "Placeholder not replaced");
    assert(!filled.includes("{{system_name}}"), "Placeholder still present");
});
test("all diagram-using templates have mermaid block", () => {
    const nodiagram = ["nfr", "adr", "risk-register"];
    for (const id of ALL_TEMPLATE_IDS) {
        if (!nodiagram.includes(id)) {
            assert(TEMPLATES[id].content.includes("```mermaid"), `Template ${id} missing mermaid block`);
        }
    }
});
test("all templates have YAML frontmatter", () => {
    for (const id of ALL_TEMPLATE_IDS) {
        assert(TEMPLATES[id].content.startsWith("---"), `Template ${id} missing YAML frontmatter`);
    }
});
test("ALL_TEMPLATE_IDS matches TEMPLATES keys", () => {
    for (const id of ALL_TEMPLATE_IDS) {
        assert(TEMPLATES[id], `ALL_TEMPLATE_IDS contains unknown id: ${id}`);
    }
    assert.equal(ALL_TEMPLATE_IDS.length, Object.keys(TEMPLATES).length, "Count mismatch");
});
