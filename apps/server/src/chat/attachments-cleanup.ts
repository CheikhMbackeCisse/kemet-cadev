import type { Db } from "@kemet/db";
import type { FileStorage } from "../storage/file-storage.js";
import { deleteAttachmentRow, listOrphanAttachments } from "../api/repositories/attachments.js";

const GRACE_PERIOD_MS = 60 * 60 * 1000;

/** Supprime les fichiers restés sans message (composeur abandonné) depuis plus d'une heure. */
export async function cleanupOrphanAttachments(db: Db, storage: FileStorage): Promise<number> {
  const orphans = await listOrphanAttachments(db, new Date(Date.now() - GRACE_PERIOD_MS));
  for (const attachment of orphans) {
    await storage.delete(attachment.storageKey);
    await deleteAttachmentRow(db, attachment.id);
  }
  return orphans.length;
}
