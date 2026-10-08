# Contexte de build : la racine du monorepo (besoin du lockfile et des
# paquets partagés). Voir infra/docker-compose.yml.

FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @kemet/shared build && pnpm --filter @kemet/web build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8080 WEB_ROOT=/app/dist
COPY --from=build /repo/apps/web/dist ./dist
COPY --from=build /repo/apps/web/server/static-server.mjs ./server/static-server.mjs
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/static-server.mjs"]
