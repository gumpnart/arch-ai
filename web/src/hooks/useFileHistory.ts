import { useState, useCallback } from "react";

const MAX_HISTORY = 100;

export interface UseFileHistoryReturn {
  push: (path: string) => void;
  goBack: () => string | null;
  goForward: () => string | null;
  canGoBack: boolean;
  canGoForward: boolean;
}

export function useFileHistory(): UseFileHistoryReturn {
  const [state, setState] = useState<{ history: string[]; index: number }>({
    history: [],
    index: -1,
  });

  const push = useCallback((path: string) => {
    setState((s) => {
      if (s.history[s.index] === path) return s;
      const next = [...s.history.slice(0, s.index + 1), path];
      if (next.length > MAX_HISTORY) next.shift();
      return { history: next, index: next.length - 1 };
    });
  }, []);

  const goBack = useCallback((): string | null => {
    let result: string | null = null;
    setState((s) => {
      if (s.index <= 0) return s;
      const newIndex = s.index - 1;
      result = s.history[newIndex];
      return { ...s, index: newIndex };
    });
    return result;
  }, []);

  const goForward = useCallback((): string | null => {
    let result: string | null = null;
    setState((s) => {
      if (s.index >= s.history.length - 1) return s;
      const newIndex = s.index + 1;
      result = s.history[newIndex];
      return { ...s, index: newIndex };
    });
    return result;
  }, []);

  return {
    push,
    goBack,
    goForward,
    canGoBack: state.index > 0,
    canGoForward: state.index < state.history.length - 1,
  };
}
