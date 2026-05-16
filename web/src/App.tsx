import { useState } from "react";
import { FileTree } from "./components/Sidebar/FileTree.js";
import { DocEditor } from "./components/Editor/DocEditor.js";
import { useVaultFiles } from "./hooks/useVaultFiles.js";

export default function App() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const { tree, reload } = useVaultFiles();

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "system-ui, sans-serif" }}>
      <aside style={{
        width: 260,
        borderRight: "1px solid #e0e0e0",
        background: "#fafafa",
        overflow: "auto",
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
      }}>
        <div style={{ padding: "16px 16px 8px", borderBottom: "1px solid #e0e0e0", flexShrink: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#333" }}>Vault</div>
          <div style={{ fontSize: 10, color: "#999", marginTop: 2 }}>arch-doc-system</div>
        </div>
        <div style={{ flex: 1, overflow: "auto" }}>
          <FileTree tree={tree} selectedFile={selectedFile} onSelect={setSelectedFile} />
        </div>
      </aside>
      <main style={{ flex: 1, overflow: "hidden" }}>
        {selectedFile ? (
          <DocEditor key={selectedFile} filePath={selectedFile} onSaveSuccess={reload} />
        ) : (
          <div style={{
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: "#999",
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>D</div>
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
