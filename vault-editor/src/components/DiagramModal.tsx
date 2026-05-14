import { useState, useEffect, type FC } from 'react';
import { FOLDERS, type Folder, api } from '../lib/api';

const FORMATS = ['mermaid', 'plantuml', 'graphviz', 'd2', 'c4plantuml', 'erd', 'nomnoml'] as const;
type DiagramFormat = (typeof FORMATS)[number];

const EXAMPLES: Record<DiagramFormat, string> = {
  mermaid: `graph LR
  A[Browser] --> B[API Gateway]
  B --> C[Auth Service]
  B --> D[Data Service]
  C --> E[(Database)]
  D --> E`,
  plantuml: `@startuml
actor User
User -> Server: HTTP Request
Server -> Database: Query
Database --> Server: Result
Server --> User: HTTP Response
@enduml`,
  graphviz: `digraph G {
  rankdir=LR;
  node [shape=box];
  A -> B -> C;
  B -> D;
}`,
  d2: `user -> server: HTTP request
server -> db: query
db -> server: results
server -> user: response`,
  c4plantuml: `@startuml
!include C4Context.puml
Person(user, "User")
System(system, "System", "Main application")
Rel(user, system, "Uses")
@enduml`,
  erd: `[users]
*id
name
email

[posts]
*id
+user_id
title

users ||--o{ posts`,
  nomnoml: `[User] -> [System]
[System] -> [Database]`,
};

interface Props {
  onClose: () => void;
  onInsert: (embedCode: string) => void;
  onToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

const DiagramModal: FC<Props> = ({ onClose, onInsert, onToast }) => {
  const [folder, setFolder] = useState<Folder>('Architecture');
  const [name, setName] = useState('');
  const [format, setFormat] = useState<DiagramFormat>('mermaid');
  const [source, setSource] = useState(EXAMPLES.mermaid);
  const [previewSvg, setPreviewSvg] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSource(EXAMPLES[format]);
    setPreviewSvg('');
  }, [format]);

  const handlePreview = async () => {
    if (!source.trim()) return;
    setPreviewLoading(true);
    try {
      const svg = await api.renderDiagram(format, source);
      setPreviewSvg(svg);
    } catch (e) {
      onToast(`Preview failed: ${String(e)}`, 'error');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) { onToast('File name is required', 'error'); return; }
    const slug = name.trim().replace(/\s+/g, '-').replace(/[^\w-]/g, '').toLowerCase();
    if (!slug) { onToast('Invalid file name', 'error'); return; }

    const today = new Date().toISOString().split('T')[0];
    const filePath = `${folder}/${slug}.md`;
    const mdContent = `---
title: ${name.trim()}
format: ${format}
tags: []
created: ${today}
updated: ${today}
---

# ${name.trim()}

\`\`\`${format}
${source}
\`\`\`
`;

    setSaving(true);
    try {
      await api.writeFile(filePath, mdContent);
      const embed =
        format === 'mermaid'
          ? `\`\`\`mermaid\n${source}\n\`\`\``
          : `![[${filePath}]]`;
      onInsert(embed);
      onToast('Diagram saved', 'success');
      onClose();
    } catch (e) {
      onToast(`Save failed: ${String(e)}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Insert Diagram</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="form-row">
            <div className="form-group">
              <label>Folder</label>
              <select value={folder} onChange={(e) => setFolder(e.target.value as Folder)} className="form-select">
                {FOLDERS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div className="form-group form-group-grow">
              <label>File name</label>
              <input
                type="text"
                placeholder="my-diagram"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label>Format</label>
              <select value={format} onChange={(e) => setFormat(e.target.value as DiagramFormat)} className="form-select">
                {FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>

          <div className="diagram-split">
            <div className="diagram-pane">
              <div className="pane-label">Source</div>
              <textarea
                className="code-textarea"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                spellCheck={false}
              />
              <button
                className="btn btn-secondary btn-sm"
                onClick={handlePreview}
                disabled={previewLoading}
              >
                {previewLoading ? 'Rendering…' : '▶ Preview'}
              </button>
            </div>

            <div className="diagram-pane">
              <div className="pane-label">Preview</div>
              {previewSvg ? (
                <div
                  className="svg-preview"
                  dangerouslySetInnerHTML={{ __html: previewSvg }}
                />
              ) : (
                <div className="preview-empty">Click Preview to render</div>
              )}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save & Insert'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DiagramModal;
