# stage 1: build client
FROM oven/bun:1-alpine AS client-build
WORKDIR /app/client
COPY client/package.json client/bun.lock ./
RUN bun install --frozen-lockfile
COPY client/ ./
COPY server/types/ /app/server/types/
RUN bun --bun run build

# stage 2: server runtime
FROM oven/bun:1-alpine
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY server/ ./server/
COPY --from=client-build /app/client/dist ./client/dist
ENV NODE_ENV=production
EXPOSE 3000
CMD ["bun", "run", "server/index.ts"]
