import { createFileRoute } from "@tanstack/react-router";
import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY  = process.env.GEMINI_API_KEY  ?? "";
const GEMINI_MODEL    = process.env.GEMINI_MODEL    ?? "gemma-4-31b-it";
const OLLAMA_URL      = process.env.OLLAMA_URL      ?? "http://localhost:11434";
const OLLAMA_API_KEY  = process.env.OLLAMA_API_KEY  ?? "";
const OLLAMA_MODEL    = process.env.OLLAMA_MODEL    ?? "gemma4:2b";

/** Strip CRLF/NUL and cap length — prevents HTTP header injection. */
function sanitizeHeader(value: string, maxLen = 500): string {
  return value.replace(/[\r\n\0]/g, "").slice(0, maxLen);
}

/**
 * Only allow http/https schemes for client-supplied Ollama URL.
 * Rejects file://, data://, ftp://, and other protocols that could
 * turn the server into an SSRF proxy.
 */
function validateHttpUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return raw;
  } catch {
    return null;
  }
}

/**
 * Remove any occurrence of the API key from an error message before
 * sending it to the client, so a Gemini SDK error that echoes the key
 * does not expose it in the SSE stream.
 */
function redactKey(message: string, key: string): string {
  if (!key) return message;
  return message.split(key).join("[REDACTED]");
}

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  "Connection": "keep-alive",
};

function sseChunk(text: string): string {
  return `data: ${JSON.stringify({ text })}\n\n`;
}

function sseError(error: string): string {
  return `data: ${JSON.stringify({ error })}\n\n`;
}

const SSE_DONE = "data: [DONE]\n\n";

// Route will be registered in routeTree after first `vite dev` run
export const Route = (createFileRoute as any)("/api/ai/chat")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const { prompt, context } = (await request.json()) as {
          prompt: string;
          context?: string;
        };

        if (!prompt?.trim())
          return Response.json({ error: "prompt is required" }, { status: 400 });

        // Client-supplied values take precedence over server env vars.
        // All values are sanitized before use to prevent header injection.
        const clientProvider    = sanitizeHeader(request.headers.get("x-ai-provider")    ?? "auto", 10);
        const clientGeminiKey   = sanitizeHeader(request.headers.get("x-gemini-api-key") ?? "", 200);
        const clientGeminiModel = sanitizeHeader(request.headers.get("x-gemini-model")   ?? "", 100);
        const rawOllamaUrl      = sanitizeHeader(request.headers.get("x-ollama-url")     ?? "", 200);
        const clientOllamaKey   = sanitizeHeader(request.headers.get("x-ollama-api-key") ?? "", 200);
        const clientOllamaModel = sanitizeHeader(request.headers.get("x-ollama-model")   ?? "", 100);

        // SSRF guard: reject non-http/https schemes in client-supplied Ollama URL.
        const clientOllamaUrl = rawOllamaUrl ? validateHttpUrl(rawOllamaUrl) : null;
        if (rawOllamaUrl && !clientOllamaUrl)
          return Response.json({ error: "invalid ollama URL" }, { status: 400 });

        const geminiKey   = clientGeminiKey   || GEMINI_API_KEY;
        const geminiModel = clientGeminiModel || GEMINI_MODEL;
        const ollamaUrl     = clientOllamaUrl      || OLLAMA_URL;
        const ollamaApiKey  = clientOllamaKey      || OLLAMA_API_KEY;
        const ollamaModel   = clientOllamaModel    || OLLAMA_MODEL;

        const useGemini =
          clientProvider === "gemini" ||
          (clientProvider !== "ollama" && Boolean(geminiKey));

        const systemInstruction = context
          ? `You are a technical writing assistant. Use the following stable project documentation as context when answering:\n\n${context}\n\nNow fulfill the user's request.`
          : "You are a technical writing assistant. Help the user write clear, structured technical documentation.";

        const fullPrompt = `${systemInstruction}\n\nUser request: ${prompt}`;

        if (useGemini && geminiKey) {
          const stream = new ReadableStream({
            async start(controller) {
              const enc = new TextEncoder();
              try {
                const genAI = new GoogleGenerativeAI(geminiKey);
                const model = genAI.getGenerativeModel({ model: geminiModel });
                const result = await model.generateContentStream(fullPrompt);
                for await (const chunk of result.stream) {
                  const text = chunk.text();
                  if (text) controller.enqueue(enc.encode(sseChunk(text)));
                }
              } catch (err) {
                // Redact the key before sending the error to the client — Gemini
                // SDK errors sometimes echo request metadata including the key.
                const safe = redactKey(String(err), geminiKey);
                controller.enqueue(enc.encode(sseError(safe)));
              } finally {
                controller.enqueue(enc.encode(SSE_DONE));
                controller.close();
              }
            },
          });
          return new Response(stream, { headers: SSE_HEADERS });
        }

        // Ollama fallback (OpenAI-compatible streaming)
        const stream = new ReadableStream({
          async start(controller) {
            const enc = new TextEncoder();
            try {
              const ollamaHeaders: Record<string, string> = { "Content-Type": "application/json" };
              if (ollamaApiKey) ollamaHeaders["Authorization"] = `Bearer ${ollamaApiKey}`;

              const upstream = await fetch(`${ollamaUrl}/v1/chat/completions`, {
                method: "POST",
                headers: ollamaHeaders,
                body: JSON.stringify({
                  model: ollamaModel,
                  messages: [{ role: "user", content: fullPrompt }],
                  stream: true,
                }),
              });

              if (!upstream.ok) {
                controller.enqueue(enc.encode(sseError(`Ollama: ${upstream.statusText}`)));
                return;
              }

              const reader = upstream.body!.getReader();
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
                  if (payload === "[DONE]") break;
                  try {
                    const chunk = JSON.parse(payload) as {
                      choices?: { delta?: { content?: string } }[];
                    };
                    const text = chunk.choices?.[0]?.delta?.content ?? "";
                    if (text) controller.enqueue(enc.encode(sseChunk(text)));
                  } catch {
                    // skip malformed lines
                  }
                }
              }
            } catch (err) {
              controller.enqueue(enc.encode(sseError(String(err))));
            } finally {
              controller.enqueue(enc.encode(SSE_DONE));
              controller.close();
            }
          },
        });
        return new Response(stream, { headers: SSE_HEADERS });
      },
    },
  },
});
