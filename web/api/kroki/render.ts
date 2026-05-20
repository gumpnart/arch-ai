export const config = { runtime: "edge" };

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const KROKI_URL = process.env.KROKI_URL ?? "https://kroki.io";

  let body: { diagramType?: string; dsl?: string; format?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { diagramType, dsl, format = "svg" } = body;
  if (!diagramType || !dsl) {
    return Response.json(
      { error: "diagramType and dsl are required" },
      { status: 400 }
    );
  }

  try {
    const upstream = await fetch(`${KROKI_URL}/${diagramType}/${format}`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: dsl,
    });
    if (!upstream.ok) {
      return Response.json(
        { error: `Kroki: ${upstream.statusText}` },
        { status: upstream.status }
      );
    }
    return new Response(await upstream.text(), {
      headers: { "Content-Type": "image/svg+xml" },
    });
  } catch (err) {
    return Response.json(
      { error: `Kroki unavailable: ${String(err)}` },
      { status: 500 }
    );
  }
}
