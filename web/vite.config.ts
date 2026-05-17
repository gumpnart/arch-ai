import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// prosemirror-model@1.25.5+ changed renderSpec to only handle text nodes (nodeType==3),
// breaking BlockNote's blockContainer nodes which return bare HTMLElements.
// Applied via optimizeDeps.rolldownOptions (Vite 8) to patch the dep bundle.
const fixProsemirrorRenderSpec = {
  name: "fix-prosemirror-renderspec",
  transform(code: string, id: string) {
    if (/prosemirror-model[\\/]dist[\\/]index\.(js|cjs)$/.test(id)) {
      const patched = code.replace(
        /if \(structure\.nodeType == 3\)/g,
        "if (structure.nodeType != null)"
      );
      if (patched !== code) return { code: patched, map: null };
    }
  },
};

export default defineConfig({
  server: { port: 3000, strictPort: true },
  plugins: [tanstackStart(), tailwindcss(), react()],
  optimizeDeps: {
    include: ["@blocknote/core", "@blocknote/react", "@blocknote/shadcn"],
    rolldownOptions: {
      plugins: [fixProsemirrorRenderSpec],
    },
  },
  resolve: {
    dedupe: ["react", "react-dom"],
  },
});
