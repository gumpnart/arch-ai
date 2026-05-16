import { Router, Request, Response } from "express";

export const krokiRouter = Router();
const KROKI_URL = process.env.KROKI_URL ?? "http://localhost:8000";

krokiRouter.post("/render", async (req: Request, res: Response) => {
  const { diagramType, dsl, format = "svg" } = req.body as {
    diagramType: string;
    dsl: string;
    format?: string;
  };
  if (!diagramType || !dsl)
    return void res.status(400).json({ error: "diagramType and dsl are required" });
  try {
    const response = await fetch(`${KROKI_URL}/${diagramType}/${format}`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: dsl,
    });
    if (!response.ok)
      return void res.status(response.status).json({ error: `Kroki: ${response.statusText}` });
    res.set("Content-Type", "image/svg+xml");
    res.send(await response.text());
  } catch (err) {
    res.status(500).json({ error: `Kroki unavailable: ${String(err)}` });
  }
});
