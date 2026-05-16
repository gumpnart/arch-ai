import express from "express";
import cors from "cors";
import { filesRouter } from "./routes/files.js";
import { krokiRouter } from "./routes/kroki.js";

const app = express();
const PORT = process.env.PORT ?? 3001;
const VAULT_PATH = process.env.VAULT_PATH ?? "../vault";

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.text({ limit: "10mb" }));

app.use((req, _res, next) => {
  (req as any).vaultPath = VAULT_PATH;
  next();
});

app.use("/api/files", filesRouter);
app.use("/api/kroki", krokiRouter);
app.get("/api/health", (_req, res) => res.json({ status: "ok", vault: VAULT_PATH }));

app.listen(PORT, () => {
  console.log(`arch-doc-web server on http://localhost:${PORT}`);
  console.log(`Vault: ${VAULT_PATH}`);
});
