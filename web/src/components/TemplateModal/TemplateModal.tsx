import { useState, useEffect, useRef } from "react";
import {
  Compass, PlugsConnected, ClipboardText,
  FolderPlus, FolderOpen, FileText, X,
} from "@phosphor-icons/react";
import { TEMPLATES, isoDate } from "../../templates/index.js";
import type { Template } from "../../templates/index.js";

const TEMPLATE_ICON_MAP: Record<string, React.ReactNode> = {
  Compass:       <Compass size={20} />,
  PlugsConnected: <PlugsConnected size={20} />,
  ClipboardText: <ClipboardText size={20} />,
};

type Location = "subfolder" | "current";

interface TemplateModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (files: Record<string, string>, projectName: string, location: Location) => Promise<void>;
}

export function TemplateModal({ open, onClose, onConfirm }: TemplateModalProps) {
  const [selectedId, setSelectedId] = useState<string>(TEMPLATES[0].id);
  const [projectName, setProjectName] = useState("");
  const [location, setLocation] = useState<Location>("subfolder");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = TEMPLATES.find((t) => t.id === selectedId) ?? TEMPLATES[0];

  useEffect(() => {
    if (open) {
      setProjectName("");
      setError(null);
      setCreating(false);
      setSelectedId(TEMPLATES[0].id);
      setLocation("subfolder");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter" && !creating) handleCreate();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, creating, projectName, selectedId, location]);

  const previewName = projectName.trim() || (location === "subfolder" ? "my-project" : "project-name");
  const previewFiles = Object.keys(selected.scaffold(previewName, isoDate()));

  async function handleCreate() {
    const name = projectName.trim();
    if (!name) {
      setError(location === "subfolder" ? "Folder name is required." : "Project name is required.");
      return;
    }
    if (!/^[a-zA-Z0-9._-]+$/.test(name)) {
      setError("Use only letters, numbers, hyphens, underscores, and dots.");
      return;
    }
    setError(null);
    setCreating(true);
    try {
      const files = selected.scaffold(name, isoDate());
      await onConfirm(files, name, location);
      onClose();
    } catch (err) {
      setError((err as Error).message ?? "Failed to create files.");
      setCreating(false);
    }
  }

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.45)",
          zIndex: 1000,
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: "fixed",
          top: "10%",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 1001,
          background: "#fff",
          borderRadius: 10,
          boxShadow: "0 8px 40px rgba(0,0,0,0.22)",
          width: 680,
          maxWidth: "92vw",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px 12px",
            borderBottom: "1px solid #e8e8e8",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <span style={{ fontWeight: 700, fontSize: 15, color: "#1a1a1a" }}>
            New from Template
          </span>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#888",
              padding: "0 4px",
              lineHeight: 1,
              display: "flex",
              alignItems: "center",
            }}
          >
            <X size={16} weight="bold" />
          </button>
        </div>

        {/* Body — two columns */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* Left — template list */}
          <div
            style={{
              width: 220,
              borderRight: "1px solid #e8e8e8",
              overflowY: "auto",
              padding: "10px 8px",
              flexShrink: 0,
            }}
          >
            {TEMPLATES.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                selected={t.id === selectedId}
                onClick={() => setSelectedId(t.id)}
              />
            ))}
          </div>

          {/* Right — name input + file preview */}
          <div
            style={{
              flex: 1,
              padding: "16px 20px",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            {/* Selected template info */}
            <div>
              <div style={{ marginBottom: 4, color: "#555" }}>{TEMPLATE_ICON_MAP[selected.icon] ?? selected.icon}</div>
              <div style={{ fontWeight: 600, fontSize: 14, color: "#1a1a1a", marginBottom: 4 }}>
                {selected.name}
              </div>
              <div style={{ fontSize: 12, color: "#666", lineHeight: 1.5 }}>
                {selected.description}
              </div>
            </div>

            {/* Location picker */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#444", marginBottom: 7 }}>
                Where to create
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <LocationOption
                  active={location === "subfolder"}
                  onClick={() => setLocation("subfolder")}
                  icon={<FolderPlus size={16} />}
                  label="New subfolder"
                  hint="Creates a new folder with the project name"
                />
                <LocationOption
                  active={location === "current"}
                  onClick={() => setLocation("current")}
                  icon={<FolderOpen size={16} />}
                  label="Current directory"
                  hint="Places files directly in the opened folder"
                />
              </div>
            </div>

            {/* Project / folder name */}
            <div>
              <label
                style={{ fontSize: 12, fontWeight: 600, color: "#444", display: "block", marginBottom: 5 }}
              >
                {location === "subfolder" ? "Folder name" : "Project name"}
              </label>
              <input
                ref={inputRef}
                value={projectName}
                onChange={(e) => { setProjectName(e.target.value); setError(null); }}
                placeholder={location === "subfolder" ? "my-project" : "project-name"}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "7px 10px",
                  border: error ? "1.5px solid #d93025" : "1.5px solid #d0d0d0",
                  borderRadius: 6,
                  fontSize: 13,
                  fontFamily: "monospace",
                  outline: "none",
                  background: "#fafafa",
                }}
              />
              {error && (
                <div style={{ fontSize: 11, color: "#d93025", marginTop: 4 }}>{error}</div>
              )}
              {location === "current" && (
                <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>
                  Used as the project title in document content only — no folder will be created.
                </div>
              )}
            </div>

            {/* File preview */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#444", marginBottom: 6 }}>
                Files to be created ({previewFiles.length})
              </div>
              <div
                style={{
                  background: "#f5f5f5",
                  borderRadius: 6,
                  padding: "8px 12px",
                  maxHeight: 180,
                  overflowY: "auto",
                }}
              >
                {previewFiles.map((f) => (
                  <div
                    key={f}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 11,
                      fontFamily: "monospace",
                      color: "#444",
                      padding: "2px 0",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    <FileText size={11} style={{ flexShrink: 0 }} />
                    {location === "subfolder"
                      ? `${projectName.trim() || "<name>"}/${f}`
                      : f}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid #e8e8e8",
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            flexShrink: 0,
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "7px 16px",
              border: "1.5px solid #d0d0d0",
              borderRadius: 6,
              background: "#fff",
              cursor: "pointer",
              fontSize: 13,
              color: "#444",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || !projectName.trim()}
            style={{
              padding: "7px 18px",
              border: "none",
              borderRadius: 6,
              background: creating || !projectName.trim() ? "#b0c4de" : "#1a73e8",
              color: "#fff",
              cursor: creating || !projectName.trim() ? "default" : "pointer",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {creating ? "Creating…" : "Create →"}
          </button>
        </div>
      </div>
    </>
  );
}

function LocationOption({
  active,
  onClick,
  icon,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        flex: 1,
        padding: "9px 12px",
        borderRadius: 7,
        cursor: "pointer",
        border: active ? "1.5px solid #1a73e8" : "1.5px solid #d0d0d0",
        background: active ? "#e8f0fe" : "#fafafa",
        transition: "border-color 0.1s, background 0.1s",
      }}
    >
      <div style={{ marginBottom: 3, color: active ? "#1a73e8" : "#555" }}>{icon}</div>
      <div style={{ fontWeight: 600, fontSize: 12, color: active ? "#1a73e8" : "#1a1a1a" }}>
        {label}
      </div>
      <div style={{ fontSize: 11, color: "#888", marginTop: 2, lineHeight: 1.35 }}>{hint}</div>
    </div>
  );
}

function TemplateCard({
  template,
  selected,
  onClick,
}: {
  template: Template;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: "10px 12px",
        borderRadius: 7,
        cursor: "pointer",
        background: selected ? "#e8f0fe" : "transparent",
        border: selected ? "1.5px solid #1a73e8" : "1.5px solid transparent",
        marginBottom: 4,
        transition: "background 0.1s",
      }}
    >
      <div style={{ marginBottom: 3, color: selected ? "#1a73e8" : "#555" }}>{TEMPLATE_ICON_MAP[template.icon] ?? template.icon}</div>
      <div style={{ fontWeight: 600, fontSize: 12, color: selected ? "#1a73e8" : "#1a1a1a" }}>
        {template.name}
      </div>
      <div style={{ fontSize: 11, color: "#777", marginTop: 2, lineHeight: 1.4 }}>
        {template.description.split(".")[0]}.
      </div>
    </div>
  );
}
