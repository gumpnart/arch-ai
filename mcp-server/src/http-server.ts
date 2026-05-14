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

import { randomUUID } from "crypto";
import express, { Request, Response, NextFunction } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { mcpAuthRouter } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { InvalidRequestError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import type { OAuthServerProvider, AuthorizationParams } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import type { OAuthClientInformationFull, OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { createMcpServer } from "./handlers.js";

const PORT = parseInt(process.env.PORT ?? "3002", 10);

// The public-facing HTTPS URL (via nginx TLS proxy). Used as the OAuth issuer.
// Claude Desktop connects to https://localhost:3443 which proxies to this server.
const ISSUER_URL = new URL("https://localhost:3443");

// The MCP resource server URL — the canonical endpoint clients connect to.
// Per RFC 9728, protected resource metadata is served at /.well-known/oauth-protected-resource/mcp.
const RESOURCE_URL = new URL("https://localhost:3443/mcp");
const RESOURCE_METADATA_URL = `${ISSUER_URL.href.replace(/\/$/, "")}/.well-known/oauth-protected-resource/mcp`;

// ─── In-memory OAuth stores ───────────────────────────────────────────────────

const clients = new Map<string, OAuthClientInformationFull>();
const authCodes = new Map<string, { params: AuthorizationParams; client: OAuthClientInformationFull }>();
const accessTokens = new Map<string, AuthInfo>();

const clientsStore: OAuthRegisteredClientsStore = {
  getClient(clientId: string) {
    return clients.get(clientId);
  },
  // The SDK's register handler generates client_id / client_id_issued_at before calling this.
  // Cast and store the full object as-is.
  registerClient(clientInfo: Omit<OAuthClientInformationFull, "client_id" | "client_id_issued_at">) {
    const fullClient = clientInfo as OAuthClientInformationFull;
    clients.set(fullClient.client_id, fullClient);
    return fullClient;
  },
};

const provider: OAuthServerProvider = {
  clientsStore,

  async authorize(client: OAuthClientInformationFull, params: AuthorizationParams, res: Response) {
    if (!client.redirect_uris.includes(params.redirectUri)) {
      throw new InvalidRequestError("Unregistered redirect_uri");
    }
    // Auto-approve: immediately redirect to the callback with an auth code.
    const code = randomUUID();
    authCodes.set(code, { params, client });

    const redirect = new URL(params.redirectUri);
    redirect.searchParams.set("code", code);
    if (params.state) redirect.searchParams.set("state", params.state);
    res.redirect(302, redirect.href);
  },

  async challengeForAuthorizationCode(client: OAuthClientInformationFull, authorizationCode: string) {
    const entry = authCodes.get(authorizationCode);
    if (!entry || entry.client.client_id !== client.client_id) throw new Error("Invalid authorization code");
    return entry.params.codeChallenge;
  },

  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
    _codeVerifier?: string,
    _redirectUri?: string,
    resource?: URL,
  ): Promise<OAuthTokens> {
    const entry = authCodes.get(authorizationCode);
    if (!entry || entry.client.client_id !== client.client_id) throw new Error("Invalid authorization code");
    authCodes.delete(authorizationCode);

    const token = randomUUID();
    const expiresAt = Math.floor(Date.now() / 1000) + 365 * 24 * 3600; // 1 year (seconds)

    accessTokens.set(token, {
      token,
      clientId: client.client_id,
      scopes: entry.params.scopes ?? [],
      expiresAt,
      resource: resource ?? entry.params.resource,
    });

    return {
      access_token: token,
      token_type: "bearer",
      expires_in: 365 * 24 * 3600,
      scope: (entry.params.scopes ?? []).join(" "),
    };
  },

  async exchangeRefreshToken(
    _client: OAuthClientInformationFull,
    _refreshToken: string,
    _scopes?: string[],
    _resource?: URL,
  ): Promise<OAuthTokens> {
    throw new Error("Refresh tokens are not supported");
  },

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const info = accessTokens.get(token);
    if (!info) throw new Error("Invalid access token");
    if (info.expiresAt && info.expiresAt < Math.floor(Date.now() / 1000)) {
      throw new Error("Access token has expired");
    }
    return info;
  },
};

// ─── Active MCP sessions ──────────────────────────────────────────────────────

const sessions = new Map<string, StreamableHTTPServerTransport>();

// ─── Express app ──────────────────────────────────────────────────────────────

const app = express();

// Global JSON body parser (needed before requireBearerAuth and MCP routes)
app.use(express.json());

// CORS — applied before all routes so preflight and error responses include headers
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers["origin"] ?? "*";
  res.setHeader("Access-Control-Allow-Origin", origin as string);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Expose-Headers", "mcp-session-id");
  // Required for Chrome Private Network Access (browser → localhost)
  res.setHeader("Access-Control-Allow-Private-Network", "true");
  next();
});

// OAuth preflight for /mcp (non-OAuth routes get CORS from the global hook above)
app.options("/mcp", (_req: Request, res: Response) => {
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, mcp-session-id, mcp-protocol-version, authorization");
  res.setHeader("Access-Control-Allow-Private-Network", "true");
  res.setHeader("Access-Control-Max-Age", "86400");
  res.status(204).send();
});

// Mount OAuth authorization server endpoints:
//   GET/POST /.well-known/oauth-authorization-server
//   GET      /.well-known/oauth-protected-resource
//   GET/POST /authorize
//   POST     /token
//   POST     /register  (dynamic client registration)
app.use(
  mcpAuthRouter({
    provider,
    issuerUrl: ISSUER_URL,
    baseUrl: ISSUER_URL,
    resourceServerUrl: RESOURCE_URL,
    resourceName: "Excalidraw MCP Server",
    scopesSupported: ["mcp:tools"],
  })
);

const bearerAuth = requireBearerAuth({
  verifier: provider,
  resourceMetadataUrl: RESOURCE_METADATA_URL,
});

// POST /mcp — handles all MCP RPC calls (session init + subsequent calls)
app.post("/mcp", bearerAuth, async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  if (sessionId && sessions.has(sessionId)) {
    await sessions.get(sessionId)!.handleRequest(req, res, req.body);
    return;
  }

  if (!sessionId && isInitializeRequest(req.body)) {
    const sid = randomUUID();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => sid });
    sessions.set(sid, transport);
    transport.onclose = () => sessions.delete(sid);

    const server = createMcpServer();
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    return;
  }

  res.status(400).json({ error: "Missing or invalid session. Send an initialize request first." });
});

// GET /mcp — opens the SSE stream for server-to-client messages
app.get("/mcp", bearerAuth, async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  if (!sessionId || !sessions.has(sessionId)) {
    // 405 causes MCP SDK clients to fall back to POST-only mode gracefully (400 throws fatal error)
    res.setHeader("Allow", "POST");
    res.status(405).send();
    return;
  }

  await sessions.get(sessionId)!.handleRequest(req, res);
});

// DELETE /mcp — closes the session
app.delete("/mcp", bearerAuth, async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (sessionId && sessions.has(sessionId)) {
    await sessions.get(sessionId)!.close();
    sessions.delete(sessionId);
  }
  res.status(200).send();
});

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", sessions: sessions.size });
});

app.get("/", (_req: Request, res: Response) => {
  res.json({
    name: "excalidraw-mcp",
    version: "1.3.0",
    transport: "streamable-http",
    endpoint: "/mcp",
    note: "Use Claude Desktop (stdio or HTTPS connector) to connect. claude.ai web requires a public URL.",
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.error(
    `[excalidraw-mcp-http] Listening on :${PORT}\n` +
    `  Endpoint:  http://localhost:${PORT}/mcp\n` +
    `  OAuth:     https://localhost:3443/.well-known/oauth-authorization-server\n` +
    `  Health:    http://localhost:${PORT}/health\n` +
    `  Bridge:    ${process.env.BRIDGE_URL ?? "http://localhost:3001"}\n` +
    `  Kroki:     ${process.env.KROKI_URL ?? "http://localhost:8000"}\n` +
    `  Vault:     ${process.env.VAULT_PATH || "(not set)"}`
  );
});
