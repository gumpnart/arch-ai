FROM node:20-alpine AS builder
RUN npm install -g pnpm
WORKDIR /app
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.json ./
COPY src/ ./src/
RUN pnpm run build

FROM node:20-alpine
RUN apk add --no-cache git && \
    git config --global user.email "excalidraw-mcp@local" && \
    git config --global user.name "Excalidraw MCP"
RUN npm install -g pnpm
WORKDIR /app
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./
RUN pnpm install --prod --frozen-lockfile
COPY --from=builder /app/dist ./dist

ENV BRIDGE_URL=http://bridge:3001
ENV KROKI_URL=http://kroki:8000
ENV VAULT_PATH=/vault
ENV PORT=3002

EXPOSE 3002
CMD ["node", "dist/http-server.js"]
