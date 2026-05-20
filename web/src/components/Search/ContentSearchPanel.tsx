import { useRef, useEffect, useState } from "react";
import { useContentSearch } from "../../hooks/useContentSearch.js";
import type { FileNode } from "../../api/client.js";
import type { ContentSearchFileResult, ContentMatch } from "../../hooks/useContentSearch.js";

interface ContentSearchPanelProps {
  tree: FileNode[];
  readFile: (path: string) => Promise<string>;
  selectedFile: string | null;
  onSelect: (path: string) => void;
  autoFocus?: boolean;
}

export function ContentSearchPanel({
  tree,
  readFile,
  selectedFile,
  onSelect,
  autoFocus,
}: ContentSearchPanelProps) {
  const search = useContentSearch(tree, readFile);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const hasResults = search.results.length > 0;
  const isIdle = !search.query.trim();

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
      {/* Search input + options */}
      <div style={{ padding: "var(--sp-2) 10px 6px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        {/* Input row */}
        <div style={{ position: "relative", marginBottom: 6 }}>
          <input
            ref={inputRef}
            value={search.query}
            onChange={(e) => search.setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") search.clear();
            }}
            placeholder="Search…"
            style={{
              width: "100%",
              boxSizing: "border-box",
              fontSize: "var(--text-sm)",
              padding: "5px 28px 5px 8px",
              border: "1px solid var(--border-mid)",
              borderRadius: "var(--r-md)",
              outline: "none",
              color: "var(--text-1)",
              background: "#fff",
              fontFamily: "var(--font-sans)",
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-mid)"; }}
          />
          {search.query && (
            <button
              onClick={() => { search.clear(); inputRef.current?.focus(); }}
              title="Clear"
              style={{
                position: "absolute", right: 5, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer",
                fontSize: "var(--text-xs)", color: "var(--text-3)", padding: "0 2px", lineHeight: 1,
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Option toggles */}
        <div style={{ display: "flex", gap: 4 }}>
          <OptionToggle
            active={search.options.caseSensitive}
            onClick={() => search.setOption("caseSensitive", !search.options.caseSensitive)}
            title="Match case"
            label="Aa"
          />
          <OptionToggle
            active={search.options.wholeWord}
            onClick={() => search.setOption("wholeWord", !search.options.wholeWord)}
            title="Match whole word"
            label="ab|"
          />
          <OptionToggle
            active={search.options.useRegex}
            onClick={() => search.setOption("useRegex", !search.options.useRegex)}
            title="Use regular expression"
            label=".*"
          />
        </div>
      </div>

      {/* Summary bar */}
      {!isIdle && (
        <div style={{
          padding: "4px 10px",
          fontSize: "var(--text-xs)",
          color: "var(--text-3)",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          {search.progress ? (
            <span>
              Searching… {search.progress.searched}/{search.progress.total} files
            </span>
          ) : hasResults ? (
            <span>
              {search.totalMatches} result{search.totalMatches !== 1 ? "s" : ""} in{" "}
              {search.results.length} file{search.results.length !== 1 ? "s" : ""}
            </span>
          ) : (
            <span>No results</span>
          )}
          {/* Progress bar */}
          {search.progress && (
            <div style={{ width: 60, height: 3, background: "var(--border-mid)", borderRadius: 2, overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  background: "var(--accent)",
                  borderRadius: 2,
                  width: `${(search.progress.searched / search.progress.total) * 100}%`,
                  transition: "width 0.1s",
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Results list */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {isIdle ? (
          <div style={{ padding: "20px 12px", textAlign: "center", color: "var(--text-3)", fontSize: "var(--text-sm)" }}>
            Type to search across all files
          </div>
        ) : (
          search.results.map((fileResult) => (
            <FileResultGroup
              key={fileResult.path}
              fileResult={fileResult}
              query={search.query}
              options={search.options}
              isActiveFile={fileResult.path === selectedFile}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ── File result group ─────────────────────────────────────────────────────────

function FileResultGroup({
  fileResult,
  query,
  options,
  isActiveFile,
  onSelect,
}: {
  fileResult: ContentSearchFileResult;
  query: string;
  options: { caseSensitive: boolean; wholeWord: boolean; useRegex: boolean };
  isActiveFile: boolean;
  onSelect: (path: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div>
      {/* File header */}
      <div
        onClick={() => setCollapsed((c) => !c)}
        title={fileResult.path}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          padding: "4px 10px",
          cursor: "pointer",
          background: isActiveFile ? "var(--active-row-bg)" : "var(--hover-bg)",
          borderBottom: "1px solid var(--border)",
          position: "sticky",
          top: 0,
          zIndex: 1,
        }}
        onMouseEnter={(e) => {
          if (!isActiveFile) (e.currentTarget as HTMLDivElement).style.background = "var(--border-mid)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.background = isActiveFile ? "var(--active-row-bg)" : "var(--hover-bg)";
        }}
      >
        <span style={{ fontSize: 9, color: "#999", flexShrink: 0 }}>{collapsed ? "▸" : "▾"}</span>
        <span style={{ fontSize: 12, flexShrink: 0 }}>📄</span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: isActiveFile ? "var(--accent)" : "var(--text-2)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
          }}
        >
          {fileResult.name}
        </span>
        <span
          style={{
            fontSize: 10,
            color: "#fff",
            background: isActiveFile ? "var(--accent)" : "var(--text-3)",
            borderRadius: 8,
            padding: "1px 6px",
            flexShrink: 0,
          }}
        >
          {fileResult.matches.length}
        </span>
      </div>

      {/* Match rows */}
      {!collapsed &&
        fileResult.matches.map((match, i) => (
          <MatchRow
            key={i}
            match={match}
            query={query}
            options={options}
            onSelect={() => onSelect(fileResult.path)}
          />
        ))}
    </div>
  );
}

// ── Match row ─────────────────────────────────────────────────────────────────

function MatchRow({
  match,
  query,
  options,
  onSelect,
}: {
  match: ContentMatch;
  query: string;
  options: { caseSensitive: boolean; wholeWord: boolean; useRegex: boolean };
  onSelect: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const trimmed = match.lineText.trimStart();
  const leadingSpaces = match.lineText.length - trimmed.length;
  // Adjust match positions for trimmed display
  const adjStart = Math.max(0, match.matchStart - leadingSpaces);
  const adjEnd = Math.max(0, match.matchEnd - leadingSpaces);

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 6,
        padding: "2px 10px 2px 22px",
        cursor: "pointer",
        background: hovered ? "var(--active-row-bg)" : "transparent",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {/* Line number */}
      <span
        style={{
          fontSize: 10,
          color: "var(--text-3)",
          flexShrink: 0,
          minWidth: 24,
          textAlign: "right",
          paddingTop: 2,
          fontFamily: "monospace",
        }}
      >
        {match.lineNumber}
      </span>

      {/* Line text with highlighted match */}
      <span
        style={{
          fontSize: 12,
          color: "var(--text-2)",
          fontFamily: "var(--font-mono)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          flex: 1,
        }}
      >
        <MatchHighlight text={trimmed} start={adjStart} end={adjEnd} />
      </span>
    </div>
  );
}

// ── Match highlight ───────────────────────────────────────────────────────────

function MatchHighlight({
  text,
  start,
  end,
}: {
  text: string;
  start: number;
  end: number;
}) {
  if (start >= end || start < 0 || end > text.length) return <>{text}</>;
  return (
    <>
      {text.slice(0, start)}
      <mark
        style={{
          background: "#fef9c3",
          color: "#1e1e1e",
          borderRadius: 2,
          padding: "0 1px",
        }}
      >
        {text.slice(start, end)}
      </mark>
      {text.slice(end)}
    </>
  );
}

// ── Option toggle button ──────────────────────────────────────────────────────

function OptionToggle({
  active,
  onClick,
  title,
  label,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        fontSize: 10,
        fontFamily: "monospace",
        fontWeight: 600,
        padding: "2px 6px",
        border: `1px solid ${active ? "var(--accent)" : "var(--border-mid)"}`,
        borderRadius: "var(--r-sm)",
        background: active ? "var(--accent-bg)" : "#fff",
        color: active ? "var(--accent)" : "var(--text-2)",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}
