import { createFileRoute } from "@tanstack/react-router";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { readSettings } from "../../../lib/server/settings.js";

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
      POST: async () => {
        // All AI config comes from the server-side encrypted store.
        const stored = await readSettings();
        const geminiKey   = stored.geminiApiKey  || (process.env.GEMINI_API_KEY  ?? "");
        const geminiModel =                          process.env.GEMINI_MODEL    ?? "gemma-4-31b-it";
        const ollamaUrl   = (stored.ollamaUrl && validateHttpUrl(stored.ollamaUrl))
          || (process.env.OLLAMA_URL  ?? "http://localhost:11434");
        const ollamaKey   = stored.ollamaApiKey  || (process.env.OLLAMA_API_KEY  ?? "");
        const ollamaModel =                          process.env.OLLAMA_MODEL    ?? "gemma4:2b";

        const provider = stored.provider || "auto";
        const useGemini =
          provider === "gemini" ||
          (provider !== "ollama" && Boolean(geminiKey));

        const t0 = Date.now();

        if (useGemini && geminiKey) {
          try {
            const genAI = new GoogleGenerativeAI(geminiKey);
            const model = genAI.getGenerativeModel({ model: geminiModel });
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
