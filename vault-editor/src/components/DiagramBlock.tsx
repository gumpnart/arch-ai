import { createReactBlockSpec } from '@blocknote/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';

export const DIAGRAM_FORMATS = [
  'mermaid',
  'plantuml',
  'graphviz',
  'd2',
  'c4plantuml',
  'erd',
  'nomnoml',
] as const;

export type DiagramFormat = (typeof DIAGRAM_FORMATS)[number];

const FORMAT_LABELS: Record<DiagramFormat, string> = {
  mermaid: 'Mermaid',
  plantuml: 'PlantUML',
  graphviz: 'Graphviz',
  d2: 'D2',
  c4plantuml: 'C4 PlantUML',
  erd: 'ERD',
  nomnoml: 'Nomnoml',
};

const DEFAULT_SOURCE: Record<DiagramFormat, string> = {
  mermaid: 'graph LR\n  A --> B',
  plantuml: '@startuml\nA -> B : message\n@enduml',
  graphviz: 'digraph G {\n  A -> B\n}',
  d2: 'A -> B',
  c4plantuml:
    '@startuml\n!include C4Context.puml\nPerson(user, "User")\nSystem(system, "System")\nRel(user, system, "Uses")\n@enduml',
  erd: 'table1 {\n  id int pk\n  name varchar\n}\ntable2 {\n  id int pk\n  table1_id int fk\n}',
  nomnoml: '[A] -> [B]',
};

export const DiagramBlock = createReactBlockSpec(
  {
    type: 'diagram' as const,
    propSchema: {
      format: { default: 'mermaid' as DiagramFormat },
      source: { default: '' },
    },
    content: 'none',
  },
  {
    render: ({ block, editor }) => {
      const [localSource, setLocalSource] = useState(
        block.props.source || DEFAULT_SOURCE[block.props.format as DiagramFormat] || ''
      );
      const [localFormat, setLocalFormat] = useState(block.props.format as DiagramFormat);
      const [svg, setSvg] = useState<string | null>(null);
      const [loading, setLoading] = useState(false);
      const [error, setError] = useState<string | null>(null);
      const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

      const renderPreview = useCallback(async (format: string, source: string) => {
        if (!source.trim()) return;
        setLoading(true);
        setError(null);
        try {
          const svgData = await api.renderDiagram(format, source);
          setSvg(svgData);
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Render failed');
          setSvg(null);
        } finally {
          setLoading(false);
        }
      }, []);

      // Auto-render on mount
      useEffect(() => {
        renderPreview(localFormat, localSource);
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);

      // Debounced auto-render on source change
      useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          renderPreview(localFormat, localSource);
        }, 800);
        return () => {
          if (debounceRef.current) clearTimeout(debounceRef.current);
        };
      }, [localSource, localFormat, renderPreview]);

      const saveToBlock = useCallback(() => {
        editor.updateBlock(block, {
          type: 'diagram',
          props: { format: localFormat, source: localSource },
        });
      }, [editor, block, localFormat, localSource]);

      const handleFormatChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const fmt = e.target.value as DiagramFormat;
        setLocalFormat(fmt);
        // If source is the old default, switch to new default
        const oldDefault = DEFAULT_SOURCE[localFormat] || '';
        if (localSource === '' || localSource === oldDefault) {
          setLocalSource(DEFAULT_SOURCE[fmt] || '');
        }
      };

      return (
        <div
          className="diagram-block"
          contentEditable={false}
          data-format={localFormat}
        >
          <div className="diagram-block-header">
            <span className="diagram-block-icon">◈</span>
            <select
              className="diagram-format-select"
              value={localFormat}
              onChange={handleFormatChange}
              onBlur={saveToBlock}
            >
              {DIAGRAM_FORMATS.map((f) => (
                <option key={f} value={f}>
                  {FORMAT_LABELS[f]}
                </option>
              ))}
            </select>
            <button
              className="diagram-render-btn"
              onClick={() => {
                saveToBlock();
                renderPreview(localFormat, localSource);
              }}
              title="Re-render diagram"
            >
              Render
            </button>
          </div>

          <div className="diagram-block-body">
            {/* Code editor (left) */}
            <div className="diagram-block-editor">
              <textarea
                className="diagram-source-textarea"
                value={localSource}
                onChange={(e) => setLocalSource(e.target.value)}
                onBlur={saveToBlock}
                spellCheck={false}
                placeholder={`Enter ${FORMAT_LABELS[localFormat]} source…`}
              />
            </div>

            {/* SVG preview (right) */}
            <div className="diagram-block-preview">
              {loading && (
                <div className="diagram-status diagram-loading">Rendering…</div>
              )}
              {error && !loading && (
                <div className="diagram-status diagram-error">{error}</div>
              )}
              {svg && !loading && (
                <div
                  className="diagram-svg-output"
                  /* SVG from Kroki is safe — same-origin rendering */
                  dangerouslySetInnerHTML={{ __html: svg }}
                />
              )}
              {!svg && !loading && !error && (
                <div className="diagram-status diagram-placeholder">
                  Preview will appear here
                </div>
              )}
            </div>
          </div>
        </div>
      );
    },
  }
);
