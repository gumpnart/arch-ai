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
          {
            text: "Foundation",
            items: [
              { text: "SAD", link: "/Architecture/sad" },
              { text: "NFR", link: "/Architecture/non-functional-requirements" },
              { text: "Risk Register", link: "/Architecture/risk-register" },
            ],
          },
          {
            text: "Diagrams",
            items: [
              { text: "System Context (C4-L1)", link: "/Architecture/Diagrams/system-context" },
              { text: "Container Diagram (C4-L2)", link: "/Architecture/Diagrams/container-diagram" },
            ],
          },
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
