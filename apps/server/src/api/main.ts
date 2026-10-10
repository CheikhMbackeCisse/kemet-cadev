import { createDb } from "@kemet/db";
import { runMigrations } from "@kemet/db/migrate";
import { createAuth } from "../auth/auth.js";
import { createChatPublisher } from "../chat/pubsub.js";
import { SmtpEmailSender } from "../email/smtp-email-sender.js";
import { loadAttachmentLimits } from "../storage/config.js";
import { LocalDiskStorage } from "../storage/file-storage.js";
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

const auth = createAuth({
  db,
  emailSender,
  baseUrl: process.env.BETTER_AUTH_URL ?? "http://localhost:3001",
  webAppUrl: process.env.WEB_APP_URL ?? "http://localhost:5173",
  secret: process.env.BETTER_AUTH_SECRET,
  // Désactivable uniquement pour l'environnement e2e (voir .env.example) :
  // une pile de test qui crée plusieurs comptes de suite depuis la même
  // adresse IP atteint vite la limite prévue pour un vrai utilisateur.
  rateLimitEnabled: process.env.AUTH_RATE_LIMIT_ENABLED !== "false",
  github:
    process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
      ? { clientId: process.env.GITHUB_CLIENT_ID, clientSecret: process.env.GITHUB_CLIENT_SECRET }
      : undefined,
});

const chat = createChatPublisher(process.env.VALKEY_URL ?? "redis://localhost:6379");
const storage = new LocalDiskStorage(process.env.UPLOADS_DIR ?? "/data/uploads");
const attachmentLimits = loadAttachmentLimits();

const app = buildApp({ db, auth, chat, storage, attachmentLimits });

const port = Number(process.env.API_PORT ?? 3001);
app.listen({ port, host: "0.0.0.0" }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
