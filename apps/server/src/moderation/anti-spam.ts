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
 * Limite pour `config.rateLimit.max` : un compte de moins de
 * `newAccountWindowHours` n'a droit qu'à `newAccountFactor` fois la limite.
 * Sans session, limite normale : la route refusera la requête ensuite.
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
