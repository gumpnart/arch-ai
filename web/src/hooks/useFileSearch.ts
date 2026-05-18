import { useState, useEffect, useRef, useCallback } from "react";
import MiniSearch from "minisearch";
import type { FileNode } from "../api/client.js";

interface SearchDoc {
  id: string;
  name: string;
  nameStem: string;
  path: string;
  content: string;
}

export interface SearchResult {
  id: string;
  name: string;
  path: string;
  score: number;
  terms: string[];
}

export interface UseFileSearchReturn {
  query: string;
  setQuery: (q: string) => void;
  results: SearchResult[];
  isSearching: boolean;
  indexFile: (path: string, content: string) => void;
}

function flattenTree(nodes: FileNode[]): FileNode[] {
  const out: FileNode[] = [];
  for (const node of nodes) {
    if (node.type === "file") out.push(node);
    else if (node.children) out.push(...flattenTree(node.children));
  }
  return out;
}

function toNameStem(name: string): string {
  return name.replace(/\.md$/i, "").replace(/[-_]/g, " ").toLowerCase();
}

function createIndex(): MiniSearch<SearchDoc> {
  return new MiniSearch<SearchDoc>({
    fields: ["nameStem", "path", "content"],
    storeFields: ["name", "path"],
    searchOptions: {
      boost: { nameStem: 10, path: 2, content: 1 },
      fuzzy: 0.2,
      prefix: true,
      combineWith: "AND",
    },
  });
}

export function useFileSearch(tree: FileNode[]): UseFileSearchReturn {
  const [query, setQueryRaw] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const msRef = useRef<MiniSearch<SearchDoc>>(createIndex());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentMapRef = useRef<Map<string, string>>(new Map());
  const queryRef = useRef(query);
  queryRef.current = query;

  useEffect(() => {
    const ms = createIndex();
    const files = flattenTree(tree);
    const docs: SearchDoc[] = files.map((f) => ({
      id: f.path,
      name: f.name,
      nameStem: toNameStem(f.name),
      path: f.path,
      content: contentMapRef.current.get(f.path) ?? "",
    }));
    ms.addAll(docs);
    msRef.current = ms;

    if (queryRef.current.trim()) {
      const raw = ms.search(queryRef.current);
      setResults(
        raw.slice(0, 50).map((r) => ({
          id: r.id as string,
          name: r.name as string,
          path: r.path as string,
          score: r.score,
          terms: r.terms,
        }))
      );
    }
  }, [tree]);

  const setQuery = useCallback((q: string) => {
    setQueryRaw(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      const raw = msRef.current.search(q);
      setResults(
        raw.slice(0, 50).map((r) => ({
          id: r.id as string,
          name: r.name as string,
          path: r.path as string,
          score: r.score,
          terms: r.terms,
        }))
      );
    }, 150);
  }, []);

  const indexFile = useCallback((path: string, content: string) => {
    contentMapRef.current.set(path, content);
    const ms = msRef.current;
    const node = flattenTree(tree).find((f) => f.path === path);
    if (!node) return;
    const doc: SearchDoc = {
      id: path,
      name: node.name,
      nameStem: toNameStem(node.name),
      path,
      content,
    };
    try {
      ms.replace(doc);
    } catch {
      ms.add(doc);
    }
  }, [tree]);

  return {
    query,
    setQuery,
    results,
    isSearching: query.trim().length > 0,
    indexFile,
  };
}
