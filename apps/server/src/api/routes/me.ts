import type { FastifyInstance } from "fastify";
import { updateProfileSchema } from "@kemet/shared";
import { requireSessionUserId } from "../../auth/session.js";
import { badRequest, conflict } from "../../errors.js";
import {
  findAccountById,
  findProfileByHandle,
  findProfileByUserId,
  listCredentials,
  upsertProfile,
} from "../repositories/profiles.js";
import { serializeCredential, serializeProfile } from "../serializers.js";
import type { AppDeps } from "../app.js";

export function registerMeRoutes(app: FastifyInstance, { db, auth }: AppDeps): void {
  app.get("/api/me", async (request) => {
    const userId = await requireSessionUserId(auth, request);
    const account = await findAccountById(db, userId);
    const profile = await findProfileByUserId(db, userId);
    const credentials = profile ? await listCredentials(db, profile.id) : [];
    return {
      user: { id: account.id, email: account.email, emailVerified: account.emailVerified },
      profile: profile ? serializeProfile(profile) : null,
      credentials: credentials.map(serializeCredential),
    };
  });

  app.patch("/api/me/profile", async (request) => {
    const userId = await requireSessionUserId(auth, request);
    const patch = updateProfileSchema.parse(request.body);
    const existing = await findProfileByUserId(db, userId);

    if (!existing && (!patch.handle || !patch.country || !patch.displayName)) {
      throw badRequest("L'identifiant, le pays et le nom affiché sont requis à la création du profil.");
    }

    if (patch.handle) {
      const owner = await findProfileByHandle(db, patch.handle);
      if (owner && owner.userId !== userId) {
        throw conflict("Cet identifiant est déjà pris.");
      }
    }

    const profile = await upsertProfile(db, userId, patch);
    return { profile: serializeProfile(profile) };
  });
}
