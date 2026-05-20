export const config = { runtime: "edge" };

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
};

function sseChunk(text: string): string {
  return `data: ${JSON.stringify({ text })}\n\n`;
}

function sseError(error: string): string {
  return `data: ${JSON.stringify({ error })}\n\n`;
}

const SSE_DONE = "data: [DONE]\n\n";

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";
  const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemma-4-31b-it";
  const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
  const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "gemma4:2b";

  let body: { prompt?: string; context?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { prompt, context } = body;
  if (!prompt?.trim()) {
    return Response.json({ error: "prompt is required" }, { status: 400 });
  }

  const systemInstruction = context
    ? `You are a technical writing assistant. Use the following stable project documentation as context when answering:\n\n${context}\n\nNow fulfill the user's request.`
    : "You are a technical writing assistant. Help the user write clear, structured technical documentation.";

  const fullPrompt = `${systemInstruction}\n\nUser request: ${prompt}`;

  if (GEMINI_API_KEY) {
    const stream = new ReadableStream({
      async start(controller) {
        const enc = new TextEncoder();
        try {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?key=${GEMINI_API_KEY}&alt=sse`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ contents: [{ parts: [{ text: fullPrompt }] }] }),
            }
          );
          if (!res.ok || !res.body) {
            controller.enqueue(enc.encode(sseError(`Gemini: ${res.statusText}`)));
            return;
          }
          const reader = res.body.getReader();
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
                  candidates?: { content?: { parts?: { text?: string }[] } }[];
                };
                const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
                if (text) controller.enqueue(enc.encode(sseChunk(text)));
              } catch {
                // skip malformed SSE lines
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
              // skip malformed SSE lines
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
}
