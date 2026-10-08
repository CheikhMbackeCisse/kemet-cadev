import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { Db } from "@kemet/db";
import type { EmailSender } from "../email/email-sender.js";
import { hashPassword, verifyPassword } from "./password.js";

export interface AuthConfig {
  db: Db;
  emailSender: EmailSender;
  baseUrl: string;
  webAppUrl: string;
  secret: string;
  github?: { clientId: string; clientSecret: string };
  /** Désactivé dans les tests d'intégration, qui créent plusieurs comptes en rafale. */
  rateLimitEnabled?: boolean;
}

export function createAuth(config: AuthConfig) {
  return betterAuth({
    database: drizzleAdapter(config.db, { provider: "pg" }),
    baseURL: config.baseUrl,
    secret: config.secret,
    trustedOrigins: [config.webAppUrl],
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      password: { hash: hashPassword, verify: verifyPassword },
      sendResetPassword: async ({ user, url }) => {
        await config.emailSender.send({
          to: user.email,
          subject: "Réinitialisation de votre mot de passe Kemet",
          html: `<p>Réinitialisez votre mot de passe en suivant <a href="${url}">ce lien</a>. Il expire dans une heure.</p>`,
        });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendVerificationEmail: async ({ user, url }) => {
        await config.emailSender.send({
          to: user.email,
          subject: "Vérifiez votre adresse email Kemet",
          html: `<p>Confirmez votre adresse email en suivant <a href="${url}">ce lien</a>.</p>`,
        });
      },
    },
    socialProviders: config.github
      ? {
          github: {
            clientId: config.github.clientId,
            clientSecret: config.github.clientSecret,
          },
        }
      : undefined,
    rateLimit: {
      enabled: config.rateLimitEnabled ?? true,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/forget-password": { window: 60, max: 3 },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
