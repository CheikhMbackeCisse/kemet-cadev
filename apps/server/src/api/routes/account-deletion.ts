import type { FastifyInstance } from "fastify";
import { ACCOUNT_DELETION_FRESH_LOGIN_MINUTES, deleteAccountSchema } from "@kemet/shared";
import { requireSession } from "../../auth/session.js";
import { verifyPassword } from "../../auth/password.js";
import { AppError } from "../../errors.js";
import { anonymizeAccount, findPasswordHash } from "../repositories/account-deletion.js";
import type { ChatAppDeps } from "../app.js";

const wrongPassword = () => new AppError("wrong_password", "Mot de passe incorrect.", 403);

const reauthenticationRequired = () =>
  new AppError(
    "reauthentication_required",
    `Reconnecte-toi, puis supprime ton compte dans les ${ACCOUNT_DELETION_FRESH_LOGIN_MINUTES} minutes.`,
    403,
  );

/**
 * Suppression du compte de la session, jamais d'un autre : aucun identifiant
 * en paramètre. Ne passe pas par requireOwnProfile, pour qu'un compte
 * suspendu puisse aussi partir (ADR 0023).
 */
export function registerAccountDeletionRoutes(
  app: FastifyInstance,
  { db, auth, storage }: ChatAppDeps,
): void {
  app.delete(
    "/api/me",
    { config: { rateLimit: { max: 5, timeWindow: "15 minutes" } } },
    async (request, reply) => {
      const { userId, signedInAt } = await requireSession(auth, request);
      const { password } = deleteAccountSchema.parse(request.body ?? {});

      const passwordHash = await findPasswordHash(db, userId);
      if (passwordHash) {
        if (!password || !(await verifyPassword({ hash: passwordHash, password })))
          throw wrongPassword();
      } else {
        const freshSince = Date.now() - ACCOUNT_DELETION_FRESH_LOGIN_MINUTES * 60_000;
        if (signedInAt.getTime() < freshSince) throw reauthenticationRequired();
      }

      const storageKeys = await anonymizeAccount(db, userId);
      const failures = await Promise.allSettled(storageKeys.map((key) => storage.delete(key)));
      for (const failure of failures) {
        // Le compte est déjà anonymisé et la ligne du fichier ne le sert plus :
        // un fichier resté sur le disque se signale sans annuler la suppression.
        if (failure.status === "rejected")
          request.log.error(failure.reason, "Fichier non effacé après suppression d'un compte");
      }
      return reply.status(204).send();
    },
  );
}
