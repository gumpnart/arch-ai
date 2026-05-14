#!/usr/bin/env node
/**
 * HTTP transport entry point for Claude connectors.
 * Exposes the same MCP tools as index.ts (stdio) but over Streamable HTTP with OAuth 2.0.
 * Claude Desktop / Claude Code: use the mcp-tls HTTPS proxy at https://localhost:3443/mcp
 *
 * OAuth flow:
 *   1. Claude discovers /.well-known/oauth-authorization-server
 *   2. Claude registers a client via POST /register
 *   3. Claude opens GET /authorize → auto-approved → redirects with code
 *   4. Claude exchanges code for token via POST /token
 *   5. Claude sends MCP requests with Authorization: Bearer <token>
 */
export {};
//# sourceMappingURL=http-server.d.ts.map