import { createFileRoute } from "@tanstack/react-router";
import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";
const GEMINI_MODEL   = process.env.GEMINI_MODEL   ?? "gemma-4-31b-it";
const OLLAMA_URL     = process.env.OLLAMA_URL      ?? "http://localhost:11434";
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY  ?? "";
const OLLAMA_MODEL   = process.env.OLLAMA_MODEL    ?? "gemma4:2b";

function sanitizeHeader(value: string, maxLen = 500): string {
  return value.replace(/[\r\n\0]/g, "").slice(0, maxLen);
}

function validateHttpUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return raw;
  } catch {
    return null;
  }
}

export const Route = (createFileRoute as any)("/api/ai/ping")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const clientProvider    = sanitizeHeader(request.headers.get("x-ai-provider")    ?? "auto", 10);
        const clientGeminiKey   = sanitizeHeader(request.headers.get("x-gemini-api-key") ?? "", 200);
        const rawOllamaUrl      = sanitizeHeader(request.headers.get("x-ollama-url")     ?? "", 200);
        const clientOllamaKey   = sanitizeHeader(request.headers.get("x-ollama-api-key") ?? "", 200);
        const clientOllamaModel = sanitizeHeader(request.headers.get("x-ollama-model")   ?? "", 100);

        const clientOllamaUrl = rawOllamaUrl ? validateHttpUrl(rawOllamaUrl) : null;
        if (rawOllamaUrl && !clientOllamaUrl)
          return Response.json({ ok: false, error: "Invalid Ollama URL" }, { status: 400 });

        const geminiKey  = clientGeminiKey  || GEMINI_API_KEY;
        const ollamaUrl  = clientOllamaUrl  || OLLAMA_URL;
        const ollamaKey  = clientOllamaKey  || OLLAMA_API_KEY;
        const ollamaModel = clientOllamaModel || OLLAMA_MODEL;

        const useGemini =
          clientProvider === "gemini" ||
          (clientProvider !== "ollama" && Boolean(geminiKey));

        const t0 = Date.now();

        if (useGemini && geminiKey) {
          try {
            const genAI = new GoogleGenerativeAI(geminiKey);
            const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
            await model.generateContent("ping");
            return Response.json({ ok: true, provider: "gemini", latencyMs: Date.now() - t0 });
          } catch (err) {
            const msg = String(err).replace(geminiKey, "[REDACTED]");
            return Response.json({ ok: false, provider: "gemini", error: msg });
          }
        }

        // Ollama / OpenAI-compatible
        try {
          const headers: Record<string, string> = { "Content-Type": "application/json" };
          if (ollamaKey) headers["Authorization"] = `Bearer ${ollamaKey}`;

          const res = await fetch(`${ollamaUrl}/v1/chat/completions`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              model: ollamaModel,
              messages: [{ role: "user", content: "ping" }],
              stream: false,
              max_tokens: 1,
            }),
          });

          if (!res.ok) {
            return Response.json({ ok: false, provider: "ollama", error: `HTTP ${res.status}: ${res.statusText}` });
          }
          return Response.json({ ok: true, provider: "ollama", latencyMs: Date.now() - t0 });
        } catch (err) {
          return Response.json({ ok: false, provider: "ollama", error: String(err) });
        }
      },
    },
  },
});
