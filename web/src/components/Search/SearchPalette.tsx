import { useEffect, useRef, useState, useCallback } from "react";
import { useFileSearch } from "../../hooks/useFileSearch.js";
import type { FileNode } from "../../api/client.js";
import type { SearchResult } from "../../hooks/useFileSearch.js";

interface SearchPaletteProps {
  open: boolean;
  onClose: () => void;
  tree: FileNode[];
  selectedFile: string | null;
  recentFiles: string[];
  onSelect: (path: string) => void;
  readFile: (path: string) => Promise<string>;
}

export function SearchPalette({
  open,
  onClose,
  tree,
  selectedFile,
  recentFiles,
  onSelect,
  readFile,
}: SearchPaletteProps) {
  const search = useFileSearch(tree);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Focus input when palette opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 10);
      setActiveIndex(0);
      search.setQuery("");
    }
  }, [open]);

  // Lazily index file content when palette opens
  useEffect(() => {
    if (!open) return;
    // Index content of the currently selected file if not yet indexed
    if (selectedFile) {
      readFile(selectedFile).then((content) => {
        search.indexFile(selectedFile, content);
      }).catch(() => {});
    }
  }, [open, selectedFile]);

  // Reset active index when results change
  useEffect(() => {
    setActiveIndex(0);
  }, [search.results, search.isSearching]);

  // Scroll active item into view
  useEffect(() => {
    itemRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const displayItems = search.isSearching ? search.results : recentFiles.slice(0, 8);

  const handleSelect = useCallback(
    (path: string) => {
      onSelect(path);
      onClose();
    },
    [onSelect, onClose]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, displayItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = search.isSearching
        ? (search.results[activeIndex] ?? search.results[0])
        : null;
      const path = target
        ? target.path
        : recentFiles[activeIndex] ?? recentFiles[0];
      if (path) handleSelect(path);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          zIndex: 1000,
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: "fixed",
          top: "12%",
          left: "50%",
          transform: "translateX(-50%)",
          width: 600,
          maxWidth: "calc(100vw - 32px)",
          background: "#1e1e1e",
          borderRadius: "var(--r-lg)",
          boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
          zIndex: 1001,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Search input */}
        <div style={{ position: "relative" }}>
          <span
            style={{
              position: "absolute",
              left: 14,
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: 14,
              pointerEvents: "none",
            }}
          >
            🔍
          </span>
          <input
            ref={inputRef}
            value={search.query}
            onChange={(e) => search.setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search files by name…"
            style={{
              width: "100%",
              boxSizing: "border-box",
              background: "#3c3c3c",
              border: "none",
              borderBottom: "1px solid #454545",
              color: "#cccccc",
              fontSize: 14,
              padding: "13px 12px 13px 40px",
              outline: "none",
            }}
          />
        </div>

        {/* Section label */}
        <div
          style={{
            fontSize: 10,
            color: "#6b6b6b",
            padding: "8px 12px 4px",
            letterSpacing: "0.08em",
            fontWeight: 600,
          }}
        >
          {search.isSearching ? "RESULTS" : "RECENTLY OPENED"}
        </div>

        {/* Results list */}
        <div
          ref={listRef}
          style={{ maxHeight: 360, overflowY: "auto" }}
        >
          {displayItems.length === 0 ? (
            <div
              style={{
                padding: "12px 16px",
                fontSize: 13,
                color: "#555",
                fontStyle: "italic",
              }}
            >
              {search.isSearching ? "No files found" : "No recently opened files"}
            </div>
          ) : search.isSearching ? (
            (displayItems as SearchResult[]).map((result, i) => (
              <ResultRow
                key={result.id}
                ref={(el) => { itemRefs.current[i] = el; }}
                name={result.name}
                path={result.path}
                terms={result.terms}
                isActive={i === activeIndex}
                isSelected={result.path === selectedFile}
                isRecent={false}
                onClick={() => handleSelect(result.path)}
                onMouseEnter={() => setActiveIndex(i)}
              />
            ))
          ) : (
            (displayItems as string[]).map((path, i) => (
              <ResultRow
                key={path}
                ref={(el) => { itemRefs.current[i] = el; }}
                name={path.split("/").pop() ?? path}
                path={path}
                terms={[]}
                isActive={i === activeIndex}
                isSelected={path === selectedFile}
                isRecent={true}
                onClick={() => handleSelect(path)}
                onMouseEnter={() => setActiveIndex(i)}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            fontSize: 11,
            color: "#555",
            padding: "6px 12px",
            borderTop: "1px solid #454545",
            display: "flex",
            gap: 16,
          }}
        >
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc dismiss</span>
        </div>
      </div>
    </>
  );
}

// ── Result row ────────────────────────────────────────────────────────────────

const ResultRow = ({
  name,
  path,
  terms,
  isActive,
  isSelected,
  isRecent,
  onClick,
  onMouseEnter,
  ref,
}: {
  name: string;
  path: string;
  terms: string[];
  isActive: boolean;
  isSelected: boolean;
  isRecent: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  ref: (el: HTMLDivElement | null) => void;
}) => {
  const dirPath = path.includes("/")
    ? path.substring(0, path.lastIndexOf("/"))
    : "";

  let bg = "transparent";
  if (isSelected) bg = "#094771";
  else if (isActive) bg = "#2a2d2e";

  return (
    <div
      ref={ref}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      style={{
        padding: "6px 12px",
        display: "flex",
        alignItems: "center",
        gap: 8,
        cursor: "pointer",
        background: bg,
      }}
    >
      <span style={{ fontSize: 13, flexShrink: 0 }}>📄</span>
      <span
        style={{
          flex: 1,
          fontSize: 13,
          color: "#cccccc",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        <HighlightedText text={name} terms={terms} />
      </span>
      <span
        style={{
          fontSize: 11,
          color: "#8a8a8a",
          flexShrink: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          maxWidth: 180,
        }}
      >
        {dirPath}
      </span>
      {isRecent && (
        <span style={{ fontSize: 10, color: "#6b6b6b", flexShrink: 0 }}>
          recently opened
        </span>
      )}
    </div>
  );
};

// ── Highlight matched terms ───────────────────────────────────────────────────

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function HighlightedText({ text, terms }: { text: string; terms: string[] }) {
  const display = text.replace(/\.md$/i, "");
  if (!terms.length) return <>{display}</>;

  const regex = new RegExp(terms.map(escapeRegex).join("|"), "gi");
  const parts: { text: string; match: boolean }[] = [];
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = regex.exec(display)) !== null) {
    if (m.index > last) parts.push({ text: display.slice(last, m.index), match: false });
    parts.push({ text: m[0], match: true });
    last = m.index + m[0].length;
  }
  if (last < display.length) parts.push({ text: display.slice(last), match: false });

  return (
    <>
      {parts.map((p, i) =>
        p.match ? (
          <mark
            key={i}
            style={{
              background: "#fbbf24",
              color: "#1e1e1e",
              borderRadius: 2,
              padding: "0 1px",
            }}
          >
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
    </>
  );
}
