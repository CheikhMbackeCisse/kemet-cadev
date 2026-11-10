import { z } from "zod";

const channelEventSchema = z.object({ channelId: z.string().uuid() });

/**
 * Identifiant de salon d'un événement Socket.IO, ou null si la charge est
 * invalide : un identifiant qui n'est pas un UUID ferait échouer la requête
 * Postgres, et une charge nulle la déstructuration.
 */
export function readChannelId(payload: unknown): string | null {
  const parsed = channelEventSchema.safeParse(payload);
  return parsed.success ? parsed.data.channelId : null;
}

/** Accusé de réception d'un client, ignoré s'il n'en a pas envoyé. */
export function acknowledge(ack: unknown, ok: boolean): void {
  if (typeof ack === "function") ack(ok);
}
