import type { Db } from "@kemet/db";
import type { FileStorage } from "../storage/file-storage.js";
import { deleteWorkAttachmentRow, listOrphanWorkAttachments } from "../api/repositories/works.js";
import { deleteWorkMediaRow, listOrphanWorkMedia } from "../api/repositories/work-media.js";

const GRACE_PERIOD_MS = 60 * 60 * 1000;

/** Supprime les PDF restés sans travail (formulaire abandonné ou PDF remplacé) depuis plus d'une heure. */
export async function cleanupOrphanWorkAttachments(db: Db, storage: FileStorage): Promise<number> {
  const orphans = await listOrphanWorkAttachments(db, new Date(Date.now() - GRACE_PERIOD_MS));
  for (const attachment of orphans) {
    await storage.delete(attachment.storageKey);
    await deleteWorkAttachmentRow(db, attachment.id);
  }
  return orphans.length;
}

/** Même règle pour les images et vidéos envoyées puis jamais posées sur un travail, ou retirées. */
export async function cleanupOrphanWorkMedia(db: Db, storage: FileStorage): Promise<number> {
  const orphans = await listOrphanWorkMedia(db, new Date(Date.now() - GRACE_PERIOD_MS));
  for (const media of orphans) {
    if (media.storageKey) await storage.delete(media.storageKey);
    await deleteWorkMediaRow(db, media.id);
  }
  return orphans.length;
}
