import { createFileRoute } from "@tanstack/react-router";
import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";
const GEMINI_MODEL   = process.env.GEMINI_MODEL   ?? "gemma-4-31b-it";
const OLLAMA_URL     = process.env.OLLAMA_URL      ?? "http://localhost:11434";
const OLLAMA_MODEL   = process.env.OLLAMA_MODEL    ?? "gemma4:2b";

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

        const systemInstruction = context
          ? `You are a technical writing assistant. Use the following stable project documentation as context when answering:\n\n${context}\n\nNow fulfill the user's request.`
          : "You are a technical writing assistant. Help the user write clear, structured technical documentation.";

        const fullPrompt = `${systemInstruction}\n\nUser request: ${prompt}`;

        if (GEMINI_API_KEY) {
          const stream = new ReadableStream({
            async start(controller) {
              const enc = new TextEncoder();
              try {
                const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
                const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
                const result = await model.generateContentStream(fullPrompt);
                for await (const chunk of result.stream) {
                  const text = chunk.text();
                  if (text) controller.enqueue(enc.encode(sseChunk(text)));
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
        }

        // Ollama fallback (OpenAI-compatible streaming)
        const stream = new ReadableStream({
          async start(controller) {
            const enc = new TextEncoder();
            try {
              const upstream = await fetch(`${OLLAMA_URL}/v1/chat/completions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  model: OLLAMA_MODEL,
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
