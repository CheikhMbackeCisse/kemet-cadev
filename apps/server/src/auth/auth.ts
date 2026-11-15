import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { profiles, type Db } from "@kemet/db";
import { and, eq } from "drizzle-orm";
import { DEMO_EMAIL_REJECTED_CODE, isDemoEmailAddress } from "@kemet/shared";
import { DemoAddressFilter } from "../email/demo-address-filter.js";
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

/** En-tête posé par l'API (jamais par le client) avec l'adresse résolue par Fastify. */
export const CLIENT_IP_HEADER = "x-kemet-client-ip";

// Aucune boîte n'existe derrière ce domaine (voir DemoAddressFilter) : un
// compte créé avec une telle adresse ne pourrait jamais être vérifié.
function rejectDemoEmail(email: unknown) {
  if (typeof email === "string" && isDemoEmailAddress(email)) {
    throw new APIError("BAD_REQUEST", {
      code: DEMO_EMAIL_REJECTED_CODE,
      message: "Les adresses du domaine de démonstration ne peuvent pas créer de compte.",
    });
  }
}

// Un figurant du seed n'a ni mot de passe ni compte social, mais une
// réinitialisation de mot de passe ou une liaison sociale par adresse email
// créerait une ligne `account`. Aucune session ni aucun moyen de connexion
// ne doit jamais lui être donné, quel que soit le chemin.
async function rejectFillerUser(db: Db, userId: string) {
  const [filler] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(and(eq(profiles.userId, userId), eq(profiles.isFiller, true)));
  if (filler) throw new APIError("FORBIDDEN", { message: "Ce compte ne peut pas se connecter." });
}

export function createAuth(config: AuthConfig) {
  const emailSender = new DemoAddressFilter(config.emailSender);
  return betterAuth({
    database: drizzleAdapter(config.db, { provider: "pg" }),
    baseURL: config.baseUrl,
    secret: config.secret,
    trustedOrigins: [config.webAppUrl, ...(config.additionalTrustedOrigins ?? [])],
    emailAndPassword: {
      enabled: true,
      // On entre dès l'inscription : un juré pressé ou un mail parti dans les
      // spams ne doit pas bloquer l'accès. Le mail de confirmation part quand
      // même, et une adresse non confirmée ne rejoint jamais un compte social
      // (requireLocalEmailVerified plus bas).
      requireEmailVerification: false,
      autoSignIn: true,
      // Quelqu'un peut s'inscrire avec l'adresse d'un autre et garder une
      // session : la vraie personne la coupe en réinitialisant le mot de passe.
      revokeSessionsOnPasswordReset: true,
      password: { hash: hashPassword, verify: verifyPassword },
      // Volontairement pas de await ici : un relais SMTP lent ou injoignable
      // ne doit jamais faire attendre la réponse HTTP de demande de
      // réinitialisation. L'envoi se termine en arrière-plan ; une erreur
      // n'est que journalisée, l'utilisateur ne doit de toute façon pas
      // savoir si l'adresse existe (voir ForgotPasswordPage).
      sendResetPassword: async ({ user, url }) => {
        void emailSender
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
        void emailSender
          .send({
            to: user.email,
            subject: "Vérifiez votre adresse email Kemet",
            html: `<p>Confirmez votre adresse email en suivant <a href="${url}">ce lien</a>.</p>`,
          })
          .catch((error) => console.error("Échec de l'envoi de l'email de vérification", error));
      },
    },
    // Écrit en clair plutôt que laissé aux valeurs par défaut : une connexion
    // sociale rejoint le compte de même adresse seulement si le fournisseur
    // confirme l'adresse et si le compte l'a déjà vérifiée. Vérifié pour
    // Google par google-account-linking.integration.test.ts.
    account: {
      accountLinking: { enabled: true, requireLocalEmailVerified: true, trustedProviders: [] },
    },
    socialProviders: {
      ...(config.github && { github: config.github }),
      ...(config.google && { google: config.google }),
      ...(config.linkedin && { linkedin: config.linkedin }),
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path === "/sign-up/email") rejectDemoEmail(ctx.body?.email);
        if (ctx.path === "/change-email") rejectDemoEmail(ctx.body?.newEmail);
      }),
    },
    databaseHooks: {
      user: {
        create: {
          before: async (newUser) => {
            rejectDemoEmail(newUser.email);
          },
        },
      },
      account: {
        create: {
          before: async (account) => {
            await rejectFillerUser(config.db, account.userId);
          },
        },
      },
      session: {
        create: {
          before: async (session) => {
            await rejectFillerUser(config.db, session.userId);
          },
        },
      },
    },
    advanced: {
      ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] },
    },
    rateLimit: {
      enabled: config.rateLimitEnabled ?? true,
      // /request-password-reset garde la règle par défaut de Better Auth
      // (3 par minute), vérifiée par un test d'intégration.
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        // Le mot de passe actuel s'y vérifie : une session volée ne doit pas
        // servir à le deviner.
        "/change-password": { window: 60, max: 5 },
        "/link-social": { window: 60, max: 5 },
        "/unlink-account": { window: 60, max: 5 },
        // Le bandeau "Renvoyer le mail" ne doit pas servir à inonder une boîte.
        "/send-verification-email": { window: 60, max: 3 },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
