import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { useEditor, EditorContent, BubbleMenu, FloatingMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import Typography from '@tiptap/extension-typography';
import { Markdown } from 'tiptap-markdown';
import { createLowlight } from 'lowlight';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import yaml from 'highlight.js/lib/languages/yaml';
import bash from 'highlight.js/lib/languages/bash';
import json from 'highlight.js/lib/languages/json';
import css from 'highlight.js/lib/languages/css';
import sql from 'highlight.js/lib/languages/sql';
import xml from 'highlight.js/lib/languages/xml';

const lowlight = createLowlight();
lowlight.register({ javascript, typescript, python, yaml, bash, json, css, sql, xml });

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

function extractFrontmatter(raw: string): { frontmatter: string; body: string } {
  const match = raw.match(/^---\n[\s\S]*?\n---\n?/);
  if (!match) return { frontmatter: '', body: raw };
  return { frontmatter: match[0], body: raw.slice(match[0].length) };
}

const Editor = forwardRef<EditorHandle, Props>(
  ({ initialContent, filePath, onChange, onSave, onInsertDiagram }, ref) => {
    const { frontmatter, body } = extractFrontmatter(initialContent);
    const [showFrontmatter, setShowFrontmatter] = useState(false);
    const [savedFrontmatter] = useState(frontmatter);

    const editor = useEditor({
      extensions: [
        StarterKit.configure({ codeBlock: false }),
        CodeBlockLowlight.configure({ lowlight }),
        Image.configure({ inline: false }),
        Link.configure({
          openOnClick: false,
          HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
        }),
        Placeholder.configure({
          placeholder: ({ node }) =>
            node.type.name === 'heading'
              ? 'Heading…'
              : "Start writing, or press '/' for commands…",
          includeChildren: true,
        }),
        TaskList,
        TaskItem.configure({ nested: true }),
        Table.configure({ resizable: false }),
        TableRow,
        TableCell,
        TableHeader,
        Typography,
        Markdown.configure({
          html: false,
          tightLists: true,
          bulletListMarker: '-',
          transformPastedText: true,
          transformCopiedText: false,
        }),
      ],
      content: body,
      onUpdate: onChange,
      editorProps: {
        attributes: { class: 'prose-editor', spellcheck: 'true' },
      },
    });

    // Expose insertContent via forwardRef
    useImperativeHandle(
      ref,
      () => ({
        insertContent: (content: string) => {
          editor?.chain().focus().insertContent(content).run();
        },
      }),
      [editor]
    );

    // Ctrl+S / Cmd+S save
    useEffect(() => {
      const onKeyDown = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
          e.preventDefault();
          if (!editor) return;
          const md = editor.storage.markdown?.getMarkdown() ?? editor.getHTML();
          onSave(savedFrontmatter + md);
        }
      };
      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
    }, [editor, onSave, savedFrontmatter]);

    const handleSave = () => {
      if (!editor) return;
      const md = editor.storage.markdown?.getMarkdown() ?? editor.getHTML();
      onSave(savedFrontmatter + md);
    };

    const setLink = () => {
      if (!editor) return;
      const prev = editor.getAttributes('link').href as string | undefined;
      const url = window.prompt('URL:', prev ?? '');
      if (url === null) return;
      if (url) editor.chain().focus().setLink({ href: url }).run();
      else editor.chain().focus().unsetLink().run();
    };

    if (!editor) return null;

    return (
      <div className="editor-container">
        {/* ── Toolbar ── */}
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
            <button className="toolbar-btn toolbar-btn-save" onClick={handleSave} title="Save (Ctrl+S)">
              Save
            </button>
          </div>
        </div>

        {/* ── Frontmatter panel ── */}
        {showFrontmatter && savedFrontmatter && (
          <div className="frontmatter-panel">
            <span className="frontmatter-label">Frontmatter</span>
            <pre className="frontmatter-pre">{savedFrontmatter}</pre>
          </div>
        )}

        {/* ── Bubble Menu: appears on text selection ── */}
        <BubbleMenu editor={editor} tippyOptions={{ duration: 100, placement: 'top' }}>
          <div className="bubble-menu">
            <button
              className={`bubble-btn ${editor.isActive('bold') ? 'is-active' : ''}`}
              onClick={() => editor.chain().focus().toggleBold().run()}
            >
              <strong>B</strong>
            </button>
            <button
              className={`bubble-btn ${editor.isActive('italic') ? 'is-active' : ''}`}
              onClick={() => editor.chain().focus().toggleItalic().run()}
            >
              <em>I</em>
            </button>
            <button
              className={`bubble-btn ${editor.isActive('strike') ? 'is-active' : ''}`}
              onClick={() => editor.chain().focus().toggleStrike().run()}
            >
              <s>S</s>
            </button>
            <button
              className={`bubble-btn ${editor.isActive('code') ? 'is-active' : ''}`}
              onClick={() => editor.chain().focus().toggleCode().run()}
            >
              {'<>'}
            </button>
            <div className="bubble-divider" />
            <button
              className={`bubble-btn ${editor.isActive('link') ? 'is-active' : ''}`}
              onClick={setLink}
              title="Link"
            >
              🔗
            </button>
            <button
              className="bubble-btn bubble-btn-h1"
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            >
              H1
            </button>
            <button
              className="bubble-btn bubble-btn-h2"
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            >
              H2
            </button>
          </div>
        </BubbleMenu>

        {/* ── Floating Menu: appears on empty lines ── */}
        <FloatingMenu
          editor={editor}
          tippyOptions={{ duration: 100, placement: 'left-start', offset: [-8, 8] }}
        >
          <div className="floating-menu">
            <button className="float-btn" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
              H1
            </button>
            <button className="float-btn" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
              H2
            </button>
            <button className="float-btn" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
              H3
            </button>
            <div className="float-divider" />
            <button className="float-btn" onClick={() => editor.chain().focus().toggleBulletList().run()}>
              • List
            </button>
            <button className="float-btn" onClick={() => editor.chain().focus().toggleOrderedList().run()}>
              1. List
            </button>
            <button className="float-btn" onClick={() => editor.chain().focus().toggleTaskList().run()}>
              ☑ Tasks
            </button>
            <div className="float-divider" />
            <button className="float-btn" onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
              {'<>'} Code
            </button>
            <button className="float-btn" onClick={() => editor.chain().focus().toggleBlockquote().run()}>
              ❝ Quote
            </button>
            <button
              className="float-btn"
              onClick={() =>
                editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
              }
            >
              ⊞ Table
            </button>
            <div className="float-divider" />
            <button className="float-btn float-btn-accent" onClick={onInsertDiagram}>
              ◈ Diagram
            </button>
          </div>
        </FloatingMenu>

        {/* ── Editor content ── */}
        <EditorContent editor={editor} className="editor-content-wrap" />
      </div>
    );
  }
);

Editor.displayName = 'Editor';
export default Editor;
