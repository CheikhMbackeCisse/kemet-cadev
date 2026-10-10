import Fastify, { type FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import { toNodeHandler } from "better-auth/node";
import { healthcheckResponseSchema } from "@kemet/shared";
import type { Db } from "@kemet/db";
import type { Auth } from "../auth/auth.js";
import { createNoopChatPublisher, type ChatPublisher } from "../chat/pubsub.js";
import { AppError } from "../errors.js";
import { loadAttachmentLimits, type AttachmentLimits } from "../storage/config.js";
import { InMemoryStorage, type FileStorage } from "../storage/file-storage.js";
import { registerMeRoutes } from "./routes/me.js";
import { registerUserRoutes } from "./routes/users.js";
import { registerSpaceRoutes } from "./routes/spaces.js";
import { registerChannelRoutes } from "./routes/channels.js";
import { registerMessageRoutes } from "./routes/messages.js";
import { registerAttachmentRoutes } from "./routes/attachments.js";
import { registerReadStateRoutes } from "./routes/read-states.js";
import { registerInviteRoutes } from "./routes/invites.js";

export interface AppDeps {
  db: Db;
  auth: Auth;
  chat?: ChatPublisher;
  storage?: FileStorage;
  attachmentLimits?: AttachmentLimits;
}

export function buildApp(deps: AppDeps): FastifyInstance {
  const app = Fastify({ logger: true });
  const chat = deps.chat ?? createNoopChatPublisher();
  const storage = deps.storage ?? new InMemoryStorage();
  const attachmentLimits = deps.attachmentLimits ?? loadAttachmentLimits();

  void app.register(rateLimit, { global: false });
  void app.register(multipart, { limits: { fileSize: attachmentLimits.maxAttachmentBytes, files: 1 } });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      reply.status(error.statusCode).send({ error: { code: error.code, message: error.message } });
      return;
    }
    app.log.error(error);
    reply.status(500).send({ error: { code: "internal_error", message: "Erreur interne." } });
  });

  const health = async () => healthcheckResponseSchema.parse({ status: "ok", service: "api" });
  app.get("/health", health);
  // Caddy ne tronque plus le préfixe /api (voir infra/Caddyfile) : toutes les
  // routes atteintes depuis le navigateur le gardent, y compris celle-ci.
  // /health reste accessible sans préfixe pour le healthcheck Docker, qui
  // interroge le conteneur directement.
  app.get("/api/health", health);

  const authHandler = toNodeHandler(deps.auth);
  app.register(async (scope) => {
    // Le handler Better Auth lit lui-même le flux brut de la requête : le
    // parseur JSON de Fastify ne doit pas consommer le corps avant lui. La
    // portée du plugin limite ce changement à ces seules routes.
    scope.addContentTypeParser("application/json", (_request, _payload, done) => done(null));
    scope.all("/api/auth/*", async (request, reply) => {
      reply.hijack();
      await authHandler(request.raw, reply.raw);
    });
  });

  registerMeRoutes(app, deps);
  registerUserRoutes(app, deps);

  const chatDeps: ChatAppDeps = { db: deps.db, auth: deps.auth, chat, storage, attachmentLimits };
  registerSpaceRoutes(app, chatDeps);
  registerChannelRoutes(app, chatDeps);
  registerMessageRoutes(app, chatDeps);
  registerAttachmentRoutes(app, chatDeps);
  registerReadStateRoutes(app, chatDeps);
  registerInviteRoutes(app, chatDeps);

  return app;
}

export interface ChatAppDeps {
  db: Db;
  auth: Auth;
  chat: ChatPublisher;
  storage: FileStorage;
  attachmentLimits: AttachmentLimits;
}
