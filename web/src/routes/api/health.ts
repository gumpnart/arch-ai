import { createFileRoute } from "@tanstack/react-router";

const VAULT_PATH = process.env.VAULT_PATH ?? "../vault";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => Response.json({ status: "ok", vault: VAULT_PATH }),
    },
  },
});
