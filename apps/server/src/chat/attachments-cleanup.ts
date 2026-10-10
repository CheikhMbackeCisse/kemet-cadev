import type { Db } from "@kemet/db";
import type { FileStorage } from "../storage/file-storage.js";
import { deleteAttachmentRow, listOrphanAttachments } from "../api/repositories/attachments.js";

const GRACE_PERIOD_MS = 60 * 60 * 1000;

/**
 * Un fichier envoyé avant que son message ne parte (composeur abandonné,
 * onglet fermé) reste sans `message_id`. Ce nettoyage, rejoué chaque heure
 * par le worker, supprime ceux laissés orphelins depuis plus d'une heure :
 * voir docs/adr/0008-fichiers-messages.md.
 */
export async function cleanupOrphanAttachments(db: Db, storage: FileStorage): Promise<number> {
  const orphans = await listOrphanAttachments(db, new Date(Date.now() - GRACE_PERIOD_MS));
  for (const attachment of orphans) {
    await storage.delete(attachment.storageKey);
    await deleteAttachmentRow(db, attachment.id);
  }
  return orphans.length;
}
