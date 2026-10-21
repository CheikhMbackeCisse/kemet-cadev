import type { Db } from "@kemet/db";
import type { FileStorage } from "../storage/file-storage.js";
import { deletePostAttachmentRow, listOrphanPostAttachments } from "../api/repositories/post-attachments.js";

const GRACE_PERIOD_MS = 60 * 60 * 1000;

/**
 * Une image envoyée avant que son post ne parte (composeur abandonné, onglet
 * fermé) reste sans `post_id`. Ce nettoyage, rejoué chaque heure par le
 * worker, supprime celles laissées orphelines depuis plus d'une heure : même
 * logique que cleanupOrphanAttachments pour les fichiers de salon
 * (apps/server/src/chat/attachments-cleanup.ts), voir
 * docs/adr/0017-images-sur-les-posts.md.
 */
export async function cleanupOrphanPostAttachments(db: Db, storage: FileStorage): Promise<number> {
  const orphans = await listOrphanPostAttachments(db, new Date(Date.now() - GRACE_PERIOD_MS));
  for (const attachment of orphans) {
    await storage.delete(attachment.storageKey);
    await deletePostAttachmentRow(db, attachment.id);
  }
  return orphans.length;
}
