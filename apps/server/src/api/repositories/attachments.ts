import { and, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import { messageAttachments, type Db, type DbOrTx, type Transaction } from "@kemet/db";

export async function sumUserStorageBytes(db: DbOrTx, authorId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${messageAttachments.byteSize}), 0)` })
    .from(messageAttachments)
    .where(eq(messageAttachments.authorId, authorId));
  return Number(row?.total ?? 0);
}

/**
 * Sérialise les envois concurrents d'un même utilisateur : sans ce verrou,
 * deux envois proches de la limite pourraient tous les deux lire un quota
 * encore disponible avant que l'un des deux ne committe. Relâché
 * automatiquement à la fin de la transaction.
 */
export async function lockUserStorageQuota(tx: Transaction, authorId: string): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${authorId}))`);
}

export async function insertPendingAttachment(
  db: DbOrTx,
  input: {
    channelId: string;
    authorId: string;
    storageKey: string;
    kind: "image" | "file" | "voice";
    mimeType: string;
    originalName: string;
    byteSize: number;
    durationMs?: number;
  },
) {
  const [attachment] = await db.insert(messageAttachments).values(input).returning();
  return attachment!;
}

export async function findPendingAttachment(db: DbOrTx, id: string, authorId: string, channelId: string) {
  const [attachment] = await db
    .select()
    .from(messageAttachments)
    .where(
      and(
        eq(messageAttachments.id, id),
        eq(messageAttachments.authorId, authorId),
        eq(messageAttachments.channelId, channelId),
        isNull(messageAttachments.messageId),
      ),
    );
  return attachment ?? null;
}

export async function attachToMessage(db: DbOrTx, attachmentIds: string[], messageId: string) {
  if (attachmentIds.length === 0) return;
  await db.update(messageAttachments).set({ messageId }).where(inArray(messageAttachments.id, attachmentIds));
}

export async function listAttachmentsForMessages(db: DbOrTx, messageIds: string[]) {
  if (messageIds.length === 0) return [];
  return db
    .select()
    .from(messageAttachments)
    .where(inArray(messageAttachments.messageId, messageIds));
}

export async function findAttachmentById(db: Db, id: string) {
  const [attachment] = await db.select().from(messageAttachments).where(eq(messageAttachments.id, id));
  return attachment ?? null;
}

/** Fichiers envoyés puis jamais rattachés à un message (composeur abandonné), au-delà du délai de grâce. */
export async function listOrphanAttachments(db: Db, olderThan: Date) {
  return db
    .select()
    .from(messageAttachments)
    .where(and(isNull(messageAttachments.messageId), lt(messageAttachments.createdAt, olderThan)));
}

export async function deleteAttachmentRow(db: Db, id: string) {
  await db.delete(messageAttachments).where(eq(messageAttachments.id, id));
}
