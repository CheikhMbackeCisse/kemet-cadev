import type { FastifyInstance } from "fastify";
import { isLevelAtLeast, OPEN_TO_OPPORTUNITIES_MIN_LEVEL, updateProfileSchema } from "@kemet/shared";
import { requireSessionUserId } from "../../auth/session.js";
import { badRequest, conflict, forbidden } from "../../errors.js";
import {
  findAccountById,
  findProfileOwningHandle,
  findProfileByUserId,
  listCredentials,
  upsertProfile,
} from "../repositories/profiles.js";
import { computeProfilePoints } from "../repositories/points.js";
import { buildAccountExport } from "../repositories/account-export.js";
import { findPasswordHash, listSocialProviders } from "../repositories/account-deletion.js";
import { serializeCredential, serializeProfile } from "../serializers.js";
import type { AppDeps } from "../app.js";
import { serializeOnboarding } from "./onboarding.js";

export function registerMeRoutes(app: FastifyInstance, { db, auth }: AppDeps): void {
  app.get("/api/me", async (request) => {
    const userId = await requireSessionUserId(auth, request);
    const account = await findAccountById(db, userId);
    const profile = await findProfileByUserId(db, userId);
    const credentials = profile ? await listCredentials(db, profile.id) : [];
    // Le total de points reste discret à l'affichage (DESIGN.md), mais
    // reste accessible à chacun pour son propre profil.
    const points = profile ? await computeProfilePoints(db, profile.id) : null;
    const [passwordHash, socialProviders] = await Promise.all([
      findPasswordHash(db, userId),
      listSocialProviders(db, userId),
    ]);
    return {
      user: { id: account.id, email: account.email, emailVerified: account.emailVerified },
      profile: profile && points ? serializeProfile(profile, points.level) : null,
      points: points?.totalPoints ?? 0,
      credentials: credentials.map(serializeCredential),
      isPlatformAdmin: profile?.isPlatformAdmin ?? false,
      isSuspended: profile?.suspendedAt != null,
      hasPassword: passwordHash !== null,
      socialProviders,
      onboarding: profile ? serializeOnboarding(profile) : null,
    };
  });

  // Toujours son propre compte : l'identité vient de la session, jamais d'un
  // paramètre. Débit bas, la réponse lit une trentaine de tables.
  app.get(
    "/api/me/export",
    { config: { rateLimit: { max: 3, timeWindow: "1 hour" } } },
    async (request, reply) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await findProfileByUserId(db, userId);
      const data = await buildAccountExport(db, userId, profile?.id ?? null);
      const fileName = `kemet-${profile?.handle ?? "compte"}-${new Date().toISOString().slice(0, 10)}.json`;
      reply.header("content-disposition", `attachment; filename="${fileName}"`);
      reply.header("cache-control", "no-store");
      return data;
    },
  );

  app.patch(
    "/api/me/profile",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const patch = updateProfileSchema.parse(request.body);
      const existing = await findProfileByUserId(db, userId);

      // La création initiale du profil reste autorisée (un compte flambant
      // neuf ne peut pas déjà être suspendu) ; seule la modification d'un
      // profil existant est bloquée, comme toute autre écriture.
      if (existing?.suspendedAt) throw forbidden("Ce compte est suspendu.");

      // Le pays se choisit au premier écran de l'onboarding, qui peut se
      // passer : il n'est pas requis ici.
      if (!existing && (!patch.handle || !patch.displayName)) {
        throw badRequest("L'identifiant et le nom affiché sont requis à la création du profil.");
      }

      if (patch.openToOpportunities) {
        const level = existing ? (await computeProfilePoints(db, existing.id)).level : "apprenti";
        if (!isLevelAtLeast(level, OPEN_TO_OPPORTUNITIES_MIN_LEVEL)) {
          throw forbidden("« Disponible pour des opportunités » se débloque au niveau Artisan.");
        }
      }

      if (patch.handle) {
        const owner = await findProfileOwningHandle(db, patch.handle);
        if (owner && owner.userId !== userId) {
          throw conflict("Cet identifiant est déjà pris.");
        }
      }

      const profile = await upsertProfile(db, userId, patch);
      const { level } = await computeProfilePoints(db, profile.id);
      return { profile: serializeProfile(profile, level) };
    },
  );
}
