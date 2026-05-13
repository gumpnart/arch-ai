#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "./handlers.js";

async function main() {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `[excalidraw-mcp] stdio. Bridge: ${process.env.BRIDGE_URL ?? "http://localhost:3001"} | ` +
    `Kroki: ${process.env.KROKI_URL ?? "http://localhost:8000"} | ` +
    `Vault: ${process.env.VAULT_PATH || "(not set)"}`
  );
}

main().catch((e) => {
  console.error("[excalidraw-mcp] Fatal:", e);
  process.exit(1);
});
