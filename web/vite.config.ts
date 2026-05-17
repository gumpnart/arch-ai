import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import fs from "fs";

// prosemirror-model@1.25.5+ changed renderSpec to only handle text nodes (nodeType==3),
// breaking BlockNote's blockContainer nodes which return bare HTMLElements.
// This esbuild plugin restores the pre-1.25.5 behavior at build time.
const fixProsemirrorRenderSpec = {
  name: "fix-prosemirror-renderspec",
  setup(build: { onLoad: Function }) {
    build.onLoad(
      { filter: /prosemirror-model[\\/]dist[\\/]index\.(js|cjs)$/ },
      async (args: { path: string }) => {
        let code = fs.readFileSync(args.path, "utf8");
        code = code.replace(
          /if \(structure\.nodeType == 3\)/g,
          "if (structure.nodeType != null)"
        );
        const loader = args.path.endsWith(".cjs") ? "js" : "js";
        return { contents: code, loader };
      }
    );
  },
};

export default defineConfig({
  plugins: [tanstackStart(), tailwindcss(), react()],
  optimizeDeps: {
    include: ["@blocknote/core", "@blocknote/react", "@blocknote/shadcn"],
    esbuildOptions: {
      plugins: [fixProsemirrorRenderSpec],
    },
  },
  resolve: {
    dedupe: ["react", "react-dom"],
  },
});
