import type { FastifyInstance } from "fastify";
import { LEVEL_THRESHOLDS, type Level, type LevelsResponse } from "@kemet/shared";
import {
  CREDENTIAL_POINTS,
  POINTS_ASSISTANT_SKILL_HELPFUL,
  POINTS_COMPETITION_PARTICIPATION,
  POINTS_COMPETITION_VICTORY_BY_RANK,
  POINTS_POST_FEEDBACK_GIVEN,
  POINTS_POST_REPLY_SOLUTION,
  POINTS_PROJECT_HELP_CONFIRMED,
} from "@kemet/db";
import { KEMET_ASSISTANT_PROFILE_ID } from "../../chat/kemet-assistant.js";
import {
  countMembersByLevel,
  POINTS_PARCOURS_CAP,
  POINTS_REGULARITE_CAP,
  POINTS_REGULARITE_DAILY_BONUS,
  POINTS_REGULARITE_WINDOW_DAYS,
} from "../repositories/points.js";
import type { AppDeps } from "../app.js";

// Le décompte relit tout le registre : gardé une minute en mémoire, il ne
// coûte qu'une lecture par processus, quel que soit le nombre de visites.
const COUNTS_TTL_MS = 60_000;

/** Barème affiché sur /niveaux, tiré des mêmes constantes que le calcul. */
export const POINTS_RULES: LevelsResponse["rules"] = {
  replySolution: POINTS_POST_REPLY_SOLUTION,
  feedbackGiven: POINTS_POST_FEEDBACK_GIVEN,
  assistantSkillHelpful: POINTS_ASSISTANT_SKILL_HELPFUL,
  projectHelpConfirmed: POINTS_PROJECT_HELP_CONFIRMED,
  competitionParticipation: POINTS_COMPETITION_PARTICIPATION,
  competitionPodium: [...POINTS_COMPETITION_VICTORY_BY_RANK],
  credentials: { ...CREDENTIAL_POINTS, cap: POINTS_PARCOURS_CAP },
  regularity: {
    perActiveDay: POINTS_REGULARITE_DAILY_BONUS,
    windowDays: POINTS_REGULARITE_WINDOW_DAYS,
    cap: POINTS_REGULARITE_CAP,
  },
};

export function registerLevelRoutes(app: FastifyInstance, { db }: AppDeps): void {
  let cached: { at: number; counts: Record<Level, number> } | null = null;

  // Public, comme les niveaux affichés à côté des noms : rien de personnel.
  app.get("/api/levels", async (): Promise<LevelsResponse> => {
    if (!cached || Date.now() - cached.at > COUNTS_TTL_MS) {
      cached = { at: Date.now(), counts: await countMembersByLevel(db, KEMET_ASSISTANT_PROFILE_ID) };
    }
    const counts = cached.counts;
    return {
      levels: LEVEL_THRESHOLDS.map(({ level, minPoints }) => ({ level, minPoints, memberCount: counts[level] })),
      rules: POINTS_RULES,
    };
  });
}
