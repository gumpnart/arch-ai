import { useState, useRef, useCallback, useEffect } from "react";
import type { FileNode } from "../api/client.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ContentMatch {
  lineNumber: number;
  lineText: string;
  matchStart: number;
  matchEnd: number;
}

export interface ContentSearchFileResult {
  path: string;
  name: string;
  matches: ContentMatch[];
}

export interface ContentSearchOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
  useRegex: boolean;
}

export interface UseContentSearchReturn {
  query: string;
  setQuery: (q: string) => void;
  results: ContentSearchFileResult[];
  totalMatches: number;
  progress: { searched: number; total: number } | null;
  options: ContentSearchOptions;
  setOption: <K extends keyof ContentSearchOptions>(key: K, value: ContentSearchOptions[K]) => void;
  clear: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function flattenFiles(nodes: FileNode[]): FileNode[] {
  const out: FileNode[] = [];
  for (const n of nodes) {
    if (n.type === "file") out.push(n);
    else if (n.children) out.push(...flattenFiles(n.children));
  }
  return out;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildRegex(query: string, opts: ContentSearchOptions): RegExp | null {
  try {
    const pattern = opts.useRegex ? query : escapeRegex(query);
    const bounded = opts.wholeWord ? `\\b${pattern}\\b` : pattern;
    const flags = opts.caseSensitive ? "g" : "gi";
    return new RegExp(bounded, flags);
  } catch {
    return null;
  }
}

function searchLines(content: string, regex: RegExp): ContentMatch[] {
  const lines = content.split("\n");
  const matches: ContentMatch[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    regex.lastIndex = 0;
    const m = regex.exec(line);
    if (m !== null) {
      matches.push({
        lineNumber: i + 1,
        lineText: line,
        matchStart: m.index,
        matchEnd: m.index + m[0].length,
      });
    }
  }

  return matches;
}

const BATCH_SIZE = 8;
const DEBOUNCE_MS = 300;

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useContentSearch(
  tree: FileNode[],
  readFile: (path: string) => Promise<string>
): UseContentSearchReturn {
  const [query, setQueryRaw] = useState("");
  const [results, setResults] = useState<ContentSearchFileResult[]>([]);
  const [progress, setProgress] = useState<{ searched: number; total: number } | null>(null);
  const [options, setOptions] = useState<ContentSearchOptions>({
    caseSensitive: false,
    wholeWord: false,
    useRegex: false,
  });

  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const queryRef = useRef(query);
  queryRef.current = query;

  const runSearch = useCallback(
    async (q: string, opts: ContentSearchOptions, signal: AbortSignal) => {
      const regex = buildRegex(q, opts);
      if (!regex) {
        setResults([]);
        setProgress(null);
        return;
      }

      const files = flattenFiles(tree);
      setResults([]);
      setProgress({ searched: 0, total: files.length });

      for (let i = 0; i < files.length; i += BATCH_SIZE) {
        if (signal.aborted) return;

        const batch = files.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map(async (f) => {
            if (signal.aborted) return null;
            try {
              const content = await readFile(f.path);
              regex.lastIndex = 0;
              const matches = searchLines(content, regex);
              return matches.length > 0
                ? { path: f.path, name: f.name, matches }
                : null;
            } catch {
              return null;
            }
          })
        );

        if (signal.aborted) return;

        const valid = batchResults.filter(
          (r): r is ContentSearchFileResult => r !== null
        );
        if (valid.length > 0) {
          setResults((prev) => [...prev, ...valid]);
        }
        setProgress({
          searched: Math.min(i + BATCH_SIZE, files.length),
          total: files.length,
        });
      }

      if (!signal.aborted) setProgress(null);
    },
    [tree, readFile]
  );

  const triggerSearch = useCallback(
    (q: string, opts: ContentSearchOptions) => {
      if (abortRef.current) abortRef.current.abort();
      if (!q.trim()) {
        setResults([]);
        setProgress(null);
        return;
      }
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      runSearch(q, opts, ctrl.signal);
    },
    [runSearch]
  );

  const setQuery = useCallback(
    (q: string) => {
      setQueryRaw(q);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        triggerSearch(q, optionsRef.current);
      }, DEBOUNCE_MS);
    },
    [triggerSearch]
  );

  const setOption = useCallback(
    <K extends keyof ContentSearchOptions>(key: K, value: ContentSearchOptions[K]) => {
      setOptions((prev) => {
        const next = { ...prev, [key]: value };
        if (queryRef.current.trim()) {
          if (debounceRef.current) clearTimeout(debounceRef.current);
          triggerSearch(queryRef.current, next);
        }
        return next;
      });
    },
    [triggerSearch]
  );

  const clear = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setQueryRaw("");
    setResults([]);
    setProgress(null);
  }, []);

  // Abort on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const totalMatches = results.reduce((sum, r) => sum + r.matches.length, 0);

  return { query, setQuery, results, totalMatches, progress, options, setOption, clear };
}
