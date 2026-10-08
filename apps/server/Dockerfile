# Contexte de build : la racine du monorepo. Voir infra/docker-compose.yml.
# Une seule image construite, avec un stage final par point d'entrée
# (api, realtime, worker) : même code, seule la commande de démarrage change.

FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @kemet/shared build && pnpm --filter @kemet/server build
RUN pnpm --filter @kemet/server deploy --prod /prod/server

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /prod/server ./
USER node
EXPOSE 3001 3002 3003

FROM runtime AS api
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.API_PORT||3001)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/api/main.js"]

FROM runtime AS realtime
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.REALTIME_PORT||3002)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/realtime/main.js"]

FROM runtime AS worker
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.WORKER_PORT||3003)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/worker/main.js"]
