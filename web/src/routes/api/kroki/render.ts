import { createFileRoute } from "@tanstack/react-router";

const KROKI_URL = process.env.KROKI_URL ?? "https://kroki.io";

export const Route = createFileRoute("/api/kroki/render")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { diagramType, dsl, format = "svg" } = (await request.json()) as {
          diagramType: string;
          dsl: string;
          format?: string;
        };
        if (!diagramType || !dsl)
          return Response.json(
            { error: "diagramType and dsl are required" },
            { status: 400 }
          );
        try {
          const upstream = await fetch(`${KROKI_URL}/${diagramType}/${format}`, {
            method: "POST",
            headers: { "Content-Type": "text/plain" },
            body: dsl,
          });
          if (!upstream.ok)
            return Response.json(
              { error: `Kroki: ${upstream.statusText}` },
              { status: upstream.status }
            );
          return new Response(await upstream.text(), {
            headers: { "Content-Type": "image/svg+xml" },
          });
        } catch (err) {
          return Response.json(
            { error: `Kroki unavailable: ${String(err)}` },
            { status: 500 }
          );
        }
      },
    },
  },
});
