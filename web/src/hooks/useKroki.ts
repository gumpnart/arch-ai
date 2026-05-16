import { useState, useEffect, useRef } from "react";
import { renderKroki } from "../api/client.js";

export function useKroki(diagramType: string, dsl: string, debounceMs = 800) {
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");
  const [isRendering, setIsRendering] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!dsl.trim()) {
      setSvg("");
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setIsRendering(true);
      setError("");
      try {
        const result = await renderKroki(diagramType, dsl);
        setSvg(result);
      } catch (err) {
        setError(String(err));
      } finally {
        setIsRendering(false);
      }
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [diagramType, dsl, debounceMs]);

  return { svg, error, isRendering };
}
