#!/usr/bin/env node
/**
 * HTTP transport entry point for Claude connectors.
 * Exposes the same MCP tools as index.ts (stdio) but over Streamable HTTP.
 * Claude Code: add via Settings > Connectors > URL: http://localhost:3002/mcp
 */

import { randomUUID } from "crypto";
import Fastify from "fastify";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer } from "./handlers.js";

const PORT = parseInt(process.env.PORT ?? "3002", 10);

// Active sessions: sessionId → transport
const sessions = new Map<string, StreamableHTTPServerTransport>();

function isInitializeRequest(body: unknown): boolean {
  return (
    typeof body === "object" &&
    body !== null &&
    "method" in body &&
    (body as Record<string, unknown>).method === "initialize"
  );
}

const app = Fastify({ logger: false });

// Streamable HTTP — POST handles all RPC calls and session init
app.post("/mcp", async (request, reply) => {
  reply.hijack();
  const req = request.raw;
  const res = reply.raw;

  const sessionId = request.headers["mcp-session-id"] as string | undefined;

  if (sessionId && sessions.has(sessionId)) {
    await sessions.get(sessionId)!.handleRequest(req, res, request.body);
    return;
  }

  if (!sessionId && isInitializeRequest(request.body)) {
    const sid = randomUUID();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => sid,
    });

    sessions.set(sid, transport);
    transport.onclose = () => sessions.delete(sid);

    const server = createMcpServer();
    await server.connect(transport);
    await transport.handleRequest(req, res, request.body);
    return;
  }

  res.writeHead(400, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Missing or invalid session. Send an initialize request first." }));
});

// Streamable HTTP — GET opens the SSE stream for server-to-client messages
app.get("/mcp", async (request, reply) => {
  reply.hijack();
  const req = request.raw;
  const res = reply.raw;

  const sessionId = request.headers["mcp-session-id"] as string | undefined;
  if (!sessionId || !sessions.has(sessionId)) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid or missing mcp-session-id header." }));
    return;
  }

  await sessions.get(sessionId)!.handleRequest(req, res);
});

// Streamable HTTP — DELETE closes the session
app.delete("/mcp", async (request, reply) => {
  const sessionId = request.headers["mcp-session-id"] as string | undefined;
  if (sessionId && sessions.has(sessionId)) {
    await sessions.get(sessionId)!.close();
    sessions.delete(sessionId);
  }
  reply.status(200).send();
});

app.get("/health", async (_, reply) => {
  reply.send({ status: "ok", sessions: sessions.size });
});

await app.listen({ port: PORT, host: "0.0.0.0" });
console.error(
  `[excalidraw-mcp-http] Listening on :${PORT}\n` +
  `  Endpoint:  http://localhost:${PORT}/mcp\n` +
  `  Health:    http://localhost:${PORT}/health\n` +
  `  Bridge:    ${process.env.BRIDGE_URL ?? "http://localhost:3001"}\n` +
  `  Kroki:     ${process.env.KROKI_URL ?? "http://localhost:8000"}\n` +
  `  Vault:     ${process.env.VAULT_PATH || "(not set)"}`
);
