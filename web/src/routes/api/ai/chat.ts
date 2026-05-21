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

        // All AI config comes from the server-side encrypted store.
        // Env vars are the fallback for zero-config deployments.
        const stored = readSettings();
        const geminiKey  = stored.geminiApiKey  || (process.env.GEMINI_API_KEY  ?? "");
        const geminiModel =                         process.env.GEMINI_MODEL    ?? "gemma-4-31b-it";
        const ollamaUrl  = (stored.ollamaUrl && validateHttpUrl(stored.ollamaUrl))
          || (process.env.OLLAMA_URL  ?? "http://localhost:11434");
        const ollamaKey  = stored.ollamaApiKey  || (process.env.OLLAMA_API_KEY  ?? "");
        const ollamaModel =                         process.env.OLLAMA_MODEL    ?? "gemma4:2b";

        const provider = stored.provider || "auto";
        const useGemini =
          provider === "gemini" ||
          (provider !== "ollama" && Boolean(geminiKey));

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

        // Ollama / OpenAI-compatible fallback
        const stream = new ReadableStream({
          async start(controller) {
            const enc = new TextEncoder();
            try {
              const headers: Record<string, string> = { "Content-Type": "application/json" };
              if (ollamaKey) headers["Authorization"] = `Bearer ${ollamaKey}`;

              const upstream = await fetch(`${ollamaUrl}/v1/chat/completions`, {
                method: "POST",
                headers,
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
