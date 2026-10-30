import type { Db } from "@kemet/db";
import type { FileStorage } from "../storage/file-storage.js";
import { deletePostAttachmentRow, listOrphanPostAttachments } from "../api/repositories/post-attachments.js";

const GRACE_PERIOD_MS = 60 * 60 * 1000;

/** Supprime les images restées sans post (composeur abandonné) depuis plus d'une heure. */
export async function cleanupOrphanPostAttachments(db: Db, storage: FileStorage): Promise<number> {
  const orphans = await listOrphanPostAttachments(db, new Date(Date.now() - GRACE_PERIOD_MS));
  for (const attachment of orphans) {
    await storage.delete(attachment.storageKey);
    await deletePostAttachmentRow(db, attachment.id);
  }
  return orphans.length;
}
