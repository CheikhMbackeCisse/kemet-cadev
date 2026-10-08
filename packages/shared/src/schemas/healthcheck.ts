import { z } from "zod";

/** Réponse commune des trois points d'entrée serveur (api, realtime, worker). */
export const healthcheckResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.enum(["api", "realtime", "worker"]),
});

export type HealthcheckResponse = z.infer<typeof healthcheckResponseSchema>;
