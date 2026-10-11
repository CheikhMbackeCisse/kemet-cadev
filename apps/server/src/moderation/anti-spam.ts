import type { FastifyRequest } from "fastify";
import type { Db } from "@kemet/db";
import type { Auth } from "../auth/auth.js";
import { getSessionUserId } from "../auth/session.js";
import { findProfileByUserId } from "../api/repositories/profiles.js";
import type { AntiSpamConfig } from "./anti-spam-config.js";

export function isNewAccount(createdAt: Date, config: AntiSpamConfig, now: Date = new Date()): boolean {
  return now.getTime() - createdAt.getTime() < config.newAccountWindowHours * 60 * 60 * 1000;
}

/**
 * Limite dynamique pour `config.rateLimit.max` (@fastify/rate-limit) : un
 * compte créé depuis moins de `newAccountWindowHours` reçoit une fraction
 * (`newAccountFactor`) de la limite normale, pour ralentir un compte flambant
 * neuf qui spammerait sans pénaliser les comptes établis. Sans session ou
 * sans profil, la limite normale s'applique : la route elle-même refusera la
 * requête juste après pour absence de session, le préhandler de limite de
 * débit n'a pas à anticiper cette erreur.
 */
export function antiSpamMax(db: Db, auth: Auth, config: AntiSpamConfig, baseMax: number) {
  return async (request: FastifyRequest): Promise<number> => {
    const userId = await getSessionUserId(auth, request);
    if (!userId) return baseMax;
    const profile = await findProfileByUserId(db, userId);
    if (!profile) return baseMax;
    return isNewAccount(profile.createdAt, config)
      ? Math.max(1, Math.round(baseMax * config.newAccountFactor))
      : baseMax;
  };
}
