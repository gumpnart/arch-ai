FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

COPY package.json ./
RUN pnpm install --frozen-lockfile --ignore-scripts 2>/dev/null || pnpm install --ignore-scripts

COPY tsconfig.json ./
COPY src ./src

RUN pnpm run build

# ── Runtime image ─────────────────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

RUN npm install -g pnpm

COPY package.json ./
RUN pnpm install --prod --ignore-scripts 2>/dev/null || pnpm install --prod

COPY --from=builder /app/dist ./dist

EXPOSE 3002

# Default: HTTP mode on PORT.
# For stdio (Claude Desktop docker exec): override CMD with --stdio
CMD ["node", "dist/index.js"]
