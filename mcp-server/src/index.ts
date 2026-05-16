#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express, { type Request, type Response } from "express";
import { createServer } from "./server.js";

const PORT = parseInt(process.env.PORT ?? "3002", 10);

const KROKI_URL = process.env.KROKI_URL ?? "http://localhost:8000";
const VAULT_PATH = process.env.VAULT_PATH ?? "./diagrams-vault";

console.error(`[diagram-mcp] KROKI_URL=${KROKI_URL}  VAULT_PATH=${VAULT_PATH}`);

if (process.argv.includes("--stdio")) {
  // Claude Desktop: docker exec -i excalidraw-mcp node /app/dist/index.js --stdio
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
} else {
  // Claude Code / HTTP connector: serves /mcp with StreamableHTTP
  const app = express();
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "diagram-mcp" });
  });

  app.all("/mcp", async (req: Request, res: Response) => {
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless — new session per request
    });

    res.on("close", () => {
      transport.close().catch(() => {});
      server.close().catch(() => {});
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      console.error("[diagram-mcp] request error:", err);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  });

  const httpServer = app.listen(PORT, "0.0.0.0", () => {
    console.error(`[diagram-mcp] HTTP server listening on port ${PORT} — /mcp`);
  });

  const shutdown = () => {
    console.error("[diagram-mcp] shutting down…");
    httpServer.close(() => process.exit(0));
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
