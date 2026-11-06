import Fastify, { type FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import helmet from "@fastify/helmet";
import { toNodeHandler } from "better-auth/node";
import { ZodError } from "zod";
import { healthcheckResponseSchema } from "@kemet/shared";
import type { Db } from "@kemet/db";
import { CLIENT_IP_HEADER, type Auth } from "../auth/auth.js";
import { createNoopChatPublisher, type ChatPublisher } from "../chat/pubsub.js";
import { AppError } from "../errors.js";
import { loadAuthConfig, type AuthConfig } from "../config/auth-config.js";
import { loadPrivacyContact, type PrivacyContact } from "../config/privacy-config.js";
import { loadAttachmentLimits, type AttachmentLimits } from "../storage/config.js";
import { InMemoryStorage, type FileStorage } from "../storage/file-storage.js";
import { loadAntiSpamConfig, type AntiSpamConfig } from "../moderation/anti-spam-config.js";
import { registerMeRoutes } from "./routes/me.js";
import { registerAccountDeletionRoutes } from "./routes/account-deletion.js";
import { registerUserRoutes } from "./routes/users.js";
import { registerSpaceRoutes } from "./routes/spaces.js";
import { registerChannelRoutes } from "./routes/channels.js";
import { registerMessageRoutes } from "./routes/messages.js";
import { registerAttachmentRoutes } from "./routes/attachments.js";
import { registerReadStateRoutes } from "./routes/read-states.js";
import { registerInviteRoutes } from "./routes/invites.js";
import { registerSkillRoutes } from "./routes/skills.js";
import { registerAssistantRoutes } from "./routes/assistant.js";
import { registerPostRoutes } from "./routes/posts.js";
import { registerPostAttachmentRoutes } from "./routes/post-attachments.js";
import { registerProjectRoutes } from "./routes/projects.js";
import { registerCompetitionRoutes } from "./routes/competitions.js";
import { registerModerationRoutes } from "./routes/moderation.js";
import { registerCredentialRoutes } from "./routes/credentials.js";
import { NoopAssistantOrchestrator, type AssistantOrchestrator } from "../ai/assistant-orchestrator.js";
import { UnavailableLlmProvider } from "../ai/llm-provider.js";
import { WorkMatcher } from "../ai/work-matcher.js";
import { FullTextWorkRetriever } from "../ai/work-retriever.js";
import { registerWorkRoutes } from "./routes/works.js";
import { registerWorkMatchRoutes } from "./routes/work-matches.js";

export interface AppDeps {
  db: Db;
  auth: Auth;
  chat?: ChatPublisher;
  storage?: FileStorage;
  attachmentLimits?: AttachmentLimits;
  assistant?: AssistantOrchestrator;
  authConfig?: AuthConfig;
  privacyContact?: PrivacyContact | null;
  antiSpamConfig?: AntiSpamConfig;
  workMatcher?: WorkMatcher;
}

const TRUSTED_PROXY_RANGES = ["loopback", "uniquelocal"];

export function buildApp(deps: AppDeps): FastifyInstance {
  // L'API n'est jamais publiée hors du réseau Docker : en production, seul
  // Caddy lui parle. Sans ce réglage, request.ip vaut l'adresse de Caddy et
  // toutes les limites de débit sont partagées entre tous les utilisateurs.
  // Tout appelant d'une adresse privée peut poser son X-Forwarded-For (un
  // autre conteneur, ou le réseau local en développement).
  const app = Fastify({ logger: true, trustProxy: TRUSTED_PROXY_RANGES });
  const chat = deps.chat ?? createNoopChatPublisher();
  const storage = deps.storage ?? new InMemoryStorage();
  const attachmentLimits = deps.attachmentLimits ?? loadAttachmentLimits();
  const assistant = deps.assistant ?? new NoopAssistantOrchestrator();
  const authConfig = deps.authConfig ?? loadAuthConfig();
  const privacyContact = deps.privacyContact === undefined ? loadPrivacyContact() : deps.privacyContact;
  const antiSpamConfig = deps.antiSpamConfig ?? loadAntiSpamConfig();
  // Sans fournisseur d'IA, la mise en relation garde la recherche plein texte.
  const workMatcher =
    deps.workMatcher ?? new WorkMatcher(deps.db, new UnavailableLlmProvider(), new FullTextWorkRetriever(deps.db));

  void app.register(rateLimit, { global: false });
  void app.register(multipart, { limits: { fileSize: attachmentLimits.maxAttachmentBytes, files: 1 } });
  // API JSON seulement : default-src 'none' ne coûte rien. Sans
  // `useDefaults: false`, helmet fusionnerait ses directives par défaut,
  // plus permissives, au lieu de les remplacer.
  void app.register(helmet, {
    contentSecurityPolicy: { useDefaults: false, directives: { defaultSrc: ["'none'"] } },
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      reply.status(error.statusCode).send({ error: { code: error.code, message: error.message } });
      return;
    }
    // Les routes valident avec schema.parse() : une entrée refusée par Zod
    // tomberait sinon dans la branche 500.
    if (error instanceof ZodError) {
      reply.status(400).send({ error: { code: "invalid_input", message: "Les données envoyées ne sont pas valides." } });
      return;
    }
    // @fastify/rate-limit (429) et Fastify posent un statusCode 4xx sur
    // leurs erreurs : le garder évite de masquer une limite derrière un 500.
    if (error instanceof Error) {
      const statusCode = (error as { statusCode?: unknown }).statusCode;
      if (typeof statusCode === "number" && statusCode >= 400 && statusCode < 500) {
        reply.status(statusCode).send({ error: { code: "request_error", message: error.message } });
        return;
      }
    }
    app.log.error(error);
    reply.status(500).send({ error: { code: "internal_error", message: "Erreur interne." } });
  });

  // Sans `after()`, les routes seraient déclarées avant le chargement de
  // rateLimit, et `config.rateLimit` resterait sans effet, sans erreur.
  app.after(() => {
    const health = async () => healthcheckResponseSchema.parse({ status: "ok", service: "api" });
    app.get("/health", health);
    // /health sans préfixe sert au healthcheck Docker, qui ne passe pas par Caddy.
    app.get("/api/health", health);

    // Public : la page de connexion y lit les fournisseurs sociaux à proposer.
    app.get("/api/auth-config", async () => authConfig);

    // Public : la page de confidentialité est lisible avant l'inscription.
    app.get("/api/privacy-contact", async () => ({ contact: privacyContact }));

    const authHandler = toNodeHandler(deps.auth);
    app.register(async (scope) => {
      // Le handler Better Auth lit lui-même le flux brut de la requête : le
      // parseur JSON de Fastify ne doit pas consommer le corps avant lui. La
      // portée du plugin limite ce changement à ces seules routes.
      scope.addContentTypeParser("application/json", (_request, _payload, done) => done(null));
      scope.all("/api/auth/*", async (request, reply) => {
        reply.hijack();
        // Better Auth ne voit que les en-têtes bruts : on lui transmet
        // l'adresse déjà résolue par Fastify, en écrasant toute valeur
        // envoyée par le client.
        request.raw.headers[CLIENT_IP_HEADER] = request.ip;
        await authHandler(request.raw, reply.raw);
      });
    });

    registerMeRoutes(app, deps);
    registerUserRoutes(app, deps);

    const chatDeps: ChatAppDeps = {
      db: deps.db,
      auth: deps.auth,
      chat,
      storage,
      attachmentLimits,
      assistant,
      antiSpamConfig,
      workMatcher,
    };
    registerSpaceRoutes(app, chatDeps);
    registerChannelRoutes(app, chatDeps);
    registerMessageRoutes(app, chatDeps);
    registerAttachmentRoutes(app, chatDeps);
    registerReadStateRoutes(app, chatDeps);
    registerInviteRoutes(app, chatDeps);
    registerSkillRoutes(app, chatDeps);
    registerAssistantRoutes(app, chatDeps);
    registerPostRoutes(app, chatDeps);
    registerPostAttachmentRoutes(app, chatDeps);
    registerProjectRoutes(app, chatDeps);
    registerCompetitionRoutes(app, chatDeps);
    registerModerationRoutes(app, chatDeps);
    registerCredentialRoutes(app, chatDeps);
    registerAccountDeletionRoutes(app, chatDeps);
    registerWorkRoutes(app, chatDeps);
    registerWorkMatchRoutes(app, chatDeps);
  });

  return app;
}

export interface ChatAppDeps {
  db: Db;
  auth: Auth;
  chat: ChatPublisher;
  storage: FileStorage;
  attachmentLimits: AttachmentLimits;
  assistant: AssistantOrchestrator;
  antiSpamConfig: AntiSpamConfig;
  workMatcher: WorkMatcher;
}
