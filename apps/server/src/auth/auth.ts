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
  /** Origines web supplémentaires acceptées par Better Auth, en plus de webAppUrl (ex. l'adresse réseau locale pour tester depuis un téléphone). */
  additionalTrustedOrigins?: string[];
  secret: string;
  github?: { clientId: string; clientSecret: string };
  google?: { clientId: string; clientSecret: string };
  linkedin?: { clientId: string; clientSecret: string };
  /** Désactivé dans les tests d'intégration, qui créent plusieurs comptes en rafale. */
  rateLimitEnabled?: boolean;
}

export function createAuth(config: AuthConfig) {
  return betterAuth({
    database: drizzleAdapter(config.db, { provider: "pg" }),
    baseURL: config.baseUrl,
    secret: config.secret,
    trustedOrigins: [config.webAppUrl, ...(config.additionalTrustedOrigins ?? [])],
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      password: { hash: hashPassword, verify: verifyPassword },
      // Volontairement pas de await ici : un relais SMTP lent ou injoignable
      // ne doit jamais faire attendre la réponse HTTP de demande de
      // réinitialisation. L'envoi se termine en arrière-plan ; une erreur
      // n'est que journalisée, l'utilisateur ne doit de toute façon pas
      // savoir si l'adresse existe (voir ForgotPasswordPage).
      sendResetPassword: async ({ user, url }) => {
        void config.emailSender
          .send({
            to: user.email,
            subject: "Réinitialisation de votre mot de passe Kemet",
            html: `<p>Réinitialisez votre mot de passe en suivant <a href="${url}">ce lien</a>. Il expire dans une heure.</p>`,
          })
          .catch((error) => console.error("Échec de l'envoi de l'email de réinitialisation", error));
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      // Même raison que sendResetPassword ci-dessus : ne pas faire dépendre
      // la création de compte de la rapidité du relais SMTP.
      sendVerificationEmail: async ({ user, url }) => {
        void config.emailSender
          .send({
            to: user.email,
            subject: "Vérifiez votre adresse email Kemet",
            html: `<p>Confirmez votre adresse email en suivant <a href="${url}">ce lien</a>.</p>`,
          })
          .catch((error) => console.error("Échec de l'envoi de l'email de vérification", error));
      },
    },
    socialProviders: {
      ...(config.github && { github: config.github }),
      ...(config.google && { google: config.google }),
      ...(config.linkedin && { linkedin: config.linkedin }),
    },
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
