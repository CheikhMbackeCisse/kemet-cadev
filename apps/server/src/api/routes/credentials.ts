import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { verifyCredentialSchema } from "@kemet/shared";
import { requireSessionUserId } from "../../auth/session.js";
import { badRequest, conflict, forbidden, notFound } from "../../errors.js";
import { findCredentialById, verifyCredential } from "../repositories/credentials.js";
import { findProfileByUserId } from "../repositories/profiles.js";
import { serializeCredential } from "../serializers.js";
import type { ChatAppDeps } from "../app.js";

const credentialParamsSchema = z.object({ id: z.string().uuid() });

async function requireAdmin(db: ChatAppDeps["db"], userId: string) {
  const profile = await findProfileByUserId(db, userId);
  if (!profile) throw badRequest("Complétez votre profil avant de continuer.");
  if (profile.suspendedAt) throw forbidden("Ce compte est suspendu.");
  if (!profile.isPlatformAdmin) throw forbidden("Réservé aux administrateurs.");
  return profile;
}

export function registerCredentialRoutes(app: FastifyInstance, { db, auth }: ChatAppDeps): void {
  // Un administrateur vérifie l'attestation hors de l'app, puis la confirme
  // ici : seul un élément vérifié rapporte des points.
  app.post<{ Params: { id: string } }>(
    "/api/credentials/:id/verification",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const admin = await requireAdmin(db, userId);
      const params = credentialParamsSchema.safeParse(request.params);
      if (!params.success) throw notFound("Cet élément de parcours n'existe pas.");
      const input = verifyCredentialSchema.parse(request.body);
      const credential = await findCredentialById(db, params.data.id);
      if (!credential) throw notFound("Cet élément de parcours n'existe pas.");
      if (credential.profileId === admin.id) throw forbidden("Impossible de vérifier son propre parcours.");
      const verified = await verifyCredential(db, credential.id, {
        method: input.verificationMethod,
        verifiedByProfileId: admin.id,
      });
      if (!verified) throw conflict("Cet élément de parcours est déjà vérifié.");
      return { credential: serializeCredential(verified) };
    },
  );
}
