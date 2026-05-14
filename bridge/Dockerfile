FROM node:20-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml tsconfig.json ./
RUN pnpm install --frozen-lockfile
COPY src ./src
RUN pnpm run build

FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache git && \
    git config --global --add safe.directory '*'
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile
COPY --from=builder /app/dist ./dist
RUN mkdir -p /scenes
EXPOSE 3001
CMD ["node", "dist/index.js"]
