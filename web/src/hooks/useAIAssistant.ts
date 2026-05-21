import { useState, useCallback, useRef } from "react";

export type AIStatus = "idle" | "streaming" | "done" | "error";

export function useAIAssistant() {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<AIStatus>("idle");
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const generate = useCallback(async (
    prompt: string,
    context?: string,
    extraHeaders?: Record<string, string>,
  ) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setText("");
    setError("");
    setStatus("streaming");

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...extraHeaders },
        body: JSON.stringify({ prompt, context }),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? res.statusText);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (payload === "[DONE]") {
            setStatus("done");
            return;
          }
          try {
            const parsed = JSON.parse(payload) as { text?: string; error?: string };
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.text) setText((prev) => prev + parsed.text);
          } catch (parseErr) {
            if ((parseErr as Error).name !== "SyntaxError") throw parseErr;
          }
        }
      }
      setStatus("done");
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setStatus("idle");
        return;
      }
      setError(String(err));
      setStatus("error");
    }
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setText("");
    setError("");
    setStatus("idle");
  }, []);

  return { text, status, error, generate, reset };
}
