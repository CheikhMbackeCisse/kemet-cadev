import { createDb } from "@kemet/db";
import { runMigrations } from "@kemet/db/migrate";
import { createAuth } from "../auth/auth.js";
import { createChatPublisher } from "../chat/pubsub.js";
import { SmtpEmailSender } from "../email/smtp-email-sender.js";
import { loadAttachmentLimits } from "../storage/config.js";
import { LocalDiskStorage } from "../storage/file-storage.js";
import { createLlmProviderFromEnv } from "../ai/create-llm-provider.js";
import { UnavailableLlmProvider } from "../ai/llm-provider.js";
import { FullTextRetriever } from "../ai/skill-retriever.js";
import { RedisResponseCache } from "../ai/response-cache.js";
import { KemetAssistantOrchestrator, RECORDED_ANSWER_REPLAY_DELAY_MS } from "../ai/assistant-orchestrator.js";
import { buildApp } from "./app.js";

if (!process.env.BETTER_AUTH_SECRET) {
  throw new Error(
    "BETTER_AUTH_SECRET n'est pas définie : elle signe les sessions, aucune valeur par défaut n'est acceptable.",
  );
}

const databaseUrl = process.env.DATABASE_URL ?? "postgres://kemet:kemet@localhost:5432/kemet";
await runMigrations(databaseUrl);
const db = createDb(databaseUrl);

const emailSender = new SmtpEmailSender({
  host: process.env.SMTP_HOST ?? "localhost",
  port: Number(process.env.SMTP_PORT ?? 1025),
  user: process.env.SMTP_USER,
  password: process.env.SMTP_PASSWORD,
  from: process.env.EMAIL_FROM ?? "kemet@example.com",
});

const additionalTrustedOrigins = (process.env.EXTRA_TRUSTED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const auth = createAuth({
  db,
  emailSender,
  baseUrl: process.env.BETTER_AUTH_URL ?? "http://localhost:3001",
  webAppUrl: process.env.WEB_APP_URL ?? "http://localhost:5173",
  additionalTrustedOrigins,
  secret: process.env.BETTER_AUTH_SECRET,
  // Désactivable uniquement pour l'environnement e2e (voir .env.example) :
  // une pile de test qui crée plusieurs comptes de suite depuis la même
  // adresse IP atteint vite la limite prévue pour un vrai utilisateur.
  rateLimitEnabled: process.env.AUTH_RATE_LIMIT_ENABLED !== "false",
  github:
    process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
      ? { clientId: process.env.GITHUB_CLIENT_ID, clientSecret: process.env.GITHUB_CLIENT_SECRET }
      : undefined,
  google:
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET }
      : undefined,
  linkedin:
    process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET
      ? { clientId: process.env.LINKEDIN_CLIENT_ID, clientSecret: process.env.LINKEDIN_CLIENT_SECRET }
      : undefined,
});

const valkeyUrl = process.env.VALKEY_URL ?? "redis://localhost:6379";
const chat = createChatPublisher(valkeyUrl);
const storage = new LocalDiskStorage(process.env.UPLOADS_DIR ?? "/data/uploads");
const attachmentLimits = loadAttachmentLimits();

// Sans les deux clés, l'assistant reste inerte (NoopAssistantOrchestrator,
// voir buildApp) plutôt que de faire échouer le démarrage du serveur :
// utile en développement local avant d'avoir créé les comptes Gemini et
// OpenRouter. Avec ASSISTANT_RECORDED_ANSWERS, il répond quand même aux
// questions de démo connues, par leur réponse enregistrée.
const hasLlmKeys = Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY && process.env.OPENROUTER_API_KEY);
const recordedAnswersEnabled = process.env.ASSISTANT_RECORDED_ANSWERS === "true";
const assistant =
  hasLlmKeys || recordedAnswersEnabled
    ? new KemetAssistantOrchestrator(
        db,
        chat,
        hasLlmKeys ? createLlmProviderFromEnv(process.env) : new UnavailableLlmProvider(),
        new FullTextRetriever(db),
        new RedisResponseCache(valkeyUrl),
        undefined,
        { enabled: recordedAnswersEnabled, replayDelayMs: RECORDED_ANSWER_REPLAY_DELAY_MS },
      )
    : undefined;

const app = buildApp({ db, auth, chat, storage, attachmentLimits, assistant });

const port = Number(process.env.API_PORT ?? 3001);
app.listen({ port, host: "0.0.0.0" }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
