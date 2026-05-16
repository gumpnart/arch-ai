const KROKI_URL = process.env.KROKI_URL ?? "http://localhost:8000";

export const SUPPORTED_FORMATS = [
  "mermaid",
  "plantuml",
  "graphviz",
  "d2",
  "c4plantuml",
  "structurizr",
  "bpmn",
  "erd",
  "nomnoml",
  "ditaa",
  "wavedrom",
  "vega",
  "vega-lite",
  "pikchr",
  "dbml",
] as const;

export type DiagramFormat = (typeof SUPPORTED_FORMATS)[number];

export async function renderDiagram(format: string, source: string): Promise<string> {
  const url = `${KROKI_URL}/${format}/svg`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: source,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Kroki render failed (HTTP ${res.status}): ${body.slice(0, 300)}`);
  }
  return res.text();
}
