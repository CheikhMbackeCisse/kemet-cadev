import { loadSiteConfig, type SiteConfig } from "../config/site-config.js";
import Fastify, { type FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import { MULTIPART_FIELD_LIMITS } from "./multipart-limits.js";
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
import { getSessionUserId } from "../auth/session.js";
import { registerRateLimit } from "./rate-limit.js";
import { registerMeRoutes } from "./routes/me.js";
import { registerOnboardingRoutes } from "./routes/onboarding.js";
import { registerAccountDeletionRoutes } from "./routes/account-deletion.js";
import { registerUserRoutes } from "./routes/users.js";
import { registerLibraryRoutes } from "./routes/library.js";
import { registerLevelRoutes } from "./routes/levels.js";
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
import { registerConversationRoutes } from "./routes/conversations.js";
import { NoopAssistantOrchestrator, type AssistantOrchestrator } from "../ai/assistant-orchestrator.js";
import { NoopPostAssistant, type PostAssistant } from "../ai/post-assistant.js";
import { UnavailableLlmProvider } from "../ai/llm-provider.js";
import { WorkMatcher } from "../ai/work-matcher.js";
import { FullTextWorkRetriever } from "../ai/work-retriever.js";
import { registerWorkRoutes } from "./routes/works.js";
import { registerWorkMediaRoutes } from "./routes/work-media.js";
import { registerWorkMatchRoutes } from "./routes/work-matches.js";
import { registerRelatedPeopleRoutes } from "./routes/related-people.js";

export interface AppDeps {
  db: Db;
  auth: Auth;
  chat?: ChatPublisher;
  storage?: FileStorage;
  attachmentLimits?: AttachmentLimits;
  assistant?: AssistantOrchestrator;
  postAssistant?: PostAssistant;
  authConfig?: AuthConfig;
  privacyContact?: PrivacyContact | null;
  siteConfig?: SiteConfig;
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
  const postAssistant = deps.postAssistant ?? new NoopPostAssistant();
  // Une réponse en cours de rédaction n'est pas abandonnée à l'arrêt du serveur.
  app.addHook("onClose", async () => postAssistant.idle());
  const authConfig = deps.authConfig ?? loadAuthConfig();
  const privacyContact = deps.privacyContact === undefined ? loadPrivacyContact() : deps.privacyContact;
  const antiSpamConfig = deps.antiSpamConfig ?? loadAntiSpamConfig();
  const siteConfig = deps.siteConfig ?? loadSiteConfig();
  // Sans fournisseur d'IA, la mise en relation garde la recherche plein texte.
  const workMatcher =
    deps.workMatcher ?? new WorkMatcher(deps.db, new UnavailableLlmProvider(), new FullTextWorkRetriever(deps.db));

  registerRateLimit(app, {
    resolveUserId: (request) => getSessionUserId(deps.auth, request),
    anonymousFactor: antiSpamConfig.anonymousIpFactor,
  });
  // Aucune route n'attend plus d'un petit champ avant son fichier : sans ces
  // bornes, busboy garderait en mémoire jusqu'à mille champs d'un Mo.
  void app.register(multipart, {
    limits: { fileSize: attachmentLimits.maxAttachmentBytes, files: 1, ...MULTIPART_FIELD_LIMITS },
  });
  // API JSON seulement : default-src 'none' ne coûte rien. Sans
  // `useDefaults: false`, helmet fusionnerait ses directives par défaut,
  // plus permissives, au lieu de les remplacer.
  void app.register(helmet, {
    contentSecurityPolicy: { useDefaults: false, directives: { defaultSrc: ["'none'"] } },
  });

  // Une réponse sans consigne pourrait être gardée par le navigateur ou un
  // proxy : seules les routes qui en posent une (fichiers) sont mises en cache.
  app.addHook("onSend", async (_request, reply, payload) => {
    if (!reply.hasHeader("cache-control")) reply.header("Cache-Control", "no-store");
    return payload;
  });

  app.setErrorHandler((error, _request, reply) => {
    // Une route de fichier pose ses en-têtes avant de lire le disque : une
    // erreur survenue ensuite ne doit ni rester en cache un an, ni partir
    // avec le type et la longueur du fichier (Fastify refuserait le JSON).
    reply
      .removeHeader("content-length")
      .removeHeader("content-disposition")
      .removeHeader("content-range")
      .header("Cache-Control", "no-store")
      .type("application/json; charset=utf-8");
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

    // Public : réglages d'affichage valables pour tous, visiteur compris.
    app.get("/api/site-config", async () => siteConfig);

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
    registerOnboardingRoutes(app, deps);
    registerUserRoutes(app, deps);
    registerLevelRoutes(app, deps);

    const chatDeps: ChatAppDeps = {
      db: deps.db,
      auth: deps.auth,
      chat,
      storage,
      attachmentLimits,
      assistant,
      postAssistant,
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
    registerLibraryRoutes(app, chatDeps);
    registerWorkMediaRoutes(app, chatDeps);
    registerWorkMatchRoutes(app, chatDeps);
    registerRelatedPeopleRoutes(app, chatDeps);
    registerConversationRoutes(app, chatDeps);
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
  postAssistant: PostAssistant;
  antiSpamConfig: AntiSpamConfig;
  workMatcher: WorkMatcher;
}
