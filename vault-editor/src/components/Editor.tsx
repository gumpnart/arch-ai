import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { BlockNoteSchema, defaultBlockSpecs, type Block } from '@blocknote/core';
import { BlockNoteView } from '@blocknote/mantine';
import { useCreateBlockNote } from '@blocknote/react';
import '@blocknote/mantine/style.css';
import { DiagramBlock, DIAGRAM_FORMATS, type DiagramFormat } from './DiagramBlock';

// ── Schema with custom diagram block ────────────────────────────────────────

const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    diagram: DiagramBlock,
  },
});

type EditorSchema = typeof schema;
type EditorBlock = Block<EditorSchema['blockSpecs']>;

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractFrontmatter(raw: string): { frontmatter: string; body: string } {
  const match = raw.match(/^---\n[\s\S]*?\n---\n?/);
  if (!match) return { frontmatter: '', body: raw };
  return { frontmatter: match[0], body: raw.slice(match[0].length) };
}

const DIAGRAM_FORMAT_SET = new Set<string>(DIAGRAM_FORMATS);

/** After markdown parse, convert code blocks whose language is a diagram format into diagram blocks. */
function convertDiagramCodeBlocks(blocks: EditorBlock[]): EditorBlock[] {
  return blocks.map((block) => {
    if (block.type === 'codeBlock') {
      const lang = (block.props as { language?: string }).language ?? '';
      if (DIAGRAM_FORMAT_SET.has(lang)) {
        const source = (block.content as Array<{ type: string; text: string }>)
          .map((c) => c.text ?? '')
          .join('');
        return {
          id: block.id,
          type: 'diagram',
          props: { format: lang as DiagramFormat, source },
          content: [],
          children: [],
        } as unknown as EditorBlock;
      }
    }
    return block;
  });
}

/** Serialize blocks back to markdown, handling diagram blocks as code fences. */
async function serializeToMarkdown(
  editor: ReturnType<typeof useCreateBlockNote<EditorSchema['blockSpecs']>>,
  blocks: EditorBlock[]
): Promise<string> {
  const parts: string[] = [];
  let pending: EditorBlock[] = [];

  const flushPending = async () => {
    if (!pending.length) return;
    const md = await editor.blocksToMarkdownLossy(pending);
    if (md.trim()) parts.push(md.trim());
    pending = [];
  };

  for (const block of blocks) {
    if (block.type === 'diagram') {
      await flushPending();
      const { format, source } = block.props as { format: string; source: string };
      parts.push('```' + format + '\n' + source + '\n```');
    } else {
      pending.push(block);
    }
  }
  await flushPending();

  return parts.join('\n\n') + '\n';
}

// ── Component ────────────────────────────────────────────────────────────────

export interface EditorHandle {
  insertContent: (content: string) => void;
}

interface Props {
  initialContent: string;
  filePath: string;
  onChange: () => void;
  onSave: (markdown: string) => void;
  onInsertDiagram: () => void;
}

const Editor = forwardRef<EditorHandle, Props>(
  ({ initialContent, filePath, onChange, onSave, onInsertDiagram }, ref) => {
    const [showFrontmatter, setShowFrontmatter] = useState(false);
    const savedFrontmatter = useRef('');
    const onChangeRef = useRef(onChange);
    const onSaveRef = useRef(onSave);
    const isLoadingRef = useRef(false);

    useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
    useEffect(() => { onSaveRef.current = onSave; }, [onSave]);

    const editor = useCreateBlockNote({ schema });

    // Load content whenever file changes (App passes key={activeFile} so this
    // component re-mounts per file, but initialContent may arrive async)
    useEffect(() => {
      if (!editor) return;
      const { frontmatter, body } = extractFrontmatter(initialContent);
      savedFrontmatter.current = frontmatter;

      let cancelled = false;
      isLoadingRef.current = true;

      (async () => {
        const blocks = await editor.tryParseMarkdownToBlocks(body || '');
        const processed = convertDiagramCodeBlocks(blocks);
        if (!cancelled) {
          editor.replaceBlocks(editor.document, processed);
        }
        isLoadingRef.current = false;
      })().catch(console.error);

      return () => { cancelled = true; };
    }, [initialContent, editor]);

    // Wire onChange (suppress during load to avoid spurious dirty flag)
    useEffect(() => {
      if (!editor) return;
      return editor.onChange(() => {
        if (!isLoadingRef.current) onChangeRef.current();
      });
    }, [editor]);

    const handleSave = useCallback(async () => {
      const md = await serializeToMarkdown(editor, editor.document as EditorBlock[]);
      onSaveRef.current(savedFrontmatter.current + md);
    }, [editor]);

    // Expose insertContent for DiagramModal compatibility (inserts text paragraph)
    useImperativeHandle(ref, () => ({
      insertContent: (content: string) => {
        editor.insertBlocks(
          [{ type: 'paragraph', content: [{ type: 'text', text: content, styles: {} }] }],
          editor.getTextCursorPosition().block,
          'after'
        );
      },
    }), [editor]);

    // Ctrl+S / Cmd+S
    useEffect(() => {
      const onKeyDown = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
          e.preventDefault();
          handleSave();
        }
      };
      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
    }, [handleSave]);

    return (
      <div className="editor-container">
        {/* Toolbar */}
        <div className="editor-toolbar">
          <span className="toolbar-filepath" title={filePath}>{filePath}</span>
          <div className="toolbar-actions">
            <button
              className={`toolbar-btn ${showFrontmatter ? 'active' : ''}`}
              title="Toggle frontmatter"
              onClick={() => setShowFrontmatter((v) => !v)}
            >
              ⚙ Meta
            </button>
            <button
              className="toolbar-btn toolbar-btn-diagram"
              title="Insert diagram"
              onClick={onInsertDiagram}
            >
              ◈ Diagram
            </button>
            <button
              className="toolbar-btn toolbar-btn-save"
              onClick={handleSave}
              title="Save (Ctrl+S)"
            >
              Save
            </button>
          </div>
        </div>

        {/* Frontmatter panel */}
        {showFrontmatter && savedFrontmatter.current && (
          <div className="frontmatter-panel">
            <span className="frontmatter-label">Frontmatter</span>
            <pre className="frontmatter-pre">{savedFrontmatter.current}</pre>
          </div>
        )}

        {/* BlockNote editor */}
        <div className="editor-content-wrap">
          <BlockNoteView
            editor={editor}
            theme="dark"
            className="blocknote-editor"
          />
        </div>
      </div>
    );
  }
);

Editor.displayName = 'Editor';
export default Editor;
