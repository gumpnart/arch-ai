import { createFileRoute } from "@tanstack/react-router";
import {
  readSettings,
  writeSettings,
  clearSettings,
} from "../../../lib/server/settings.js";

export const Route = (createFileRoute as any)("/api/settings")({
  server: {
    handlers: {
      GET: async () => {
        const s = readSettings();
        return Response.json({
          provider: s.provider,
          ollamaUrl: s.ollamaUrl,
          hasGeminiKey: Boolean(s.geminiApiKey),
          hasOllamaKey: Boolean(s.ollamaApiKey),
        });
      },

      POST: async ({ request }: { request: Request }) => {
        const body = (await request.json()) as {
          provider?: string;
          geminiApiKey?: string;
          ollamaUrl?: string;
          ollamaApiKey?: string;
        };
        writeSettings({
          ...(body.provider    !== undefined && { provider:    body.provider }),
          ...(body.ollamaUrl   !== undefined && { ollamaUrl:   body.ollamaUrl }),
          ...(body.geminiApiKey !== undefined && { geminiApiKey: body.geminiApiKey }),
          ...(body.ollamaApiKey !== undefined && { ollamaApiKey: body.ollamaApiKey }),
        });
        return Response.json({ ok: true });
      },

      DELETE: async () => {
        clearSettings();
        return Response.json({ ok: true });
      },
    },
  },
});
