import { and, asc, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import { postAttachments, type Db, type DbOrTx } from "@kemet/db";

export async function sumUserPostAttachmentBytes(db: DbOrTx, authorId: string): Promise<number> {
  const [row] = await db
    .select({
      total: sql<string>`coalesce(sum(${postAttachments.byteSize} + coalesce(${postAttachments.posterByteSize}, 0)), 0)`,
    })
    .from(postAttachments)
    .where(eq(postAttachments.authorId, authorId));
  return Number(row?.total ?? 0);
}

export async function insertPendingPostAttachment(
  db: DbOrTx,
  input: {
    authorId: string;
    storageKey: string;
    mimeType: string;
    originalName: string;
    byteSize: number;
    width: number | null;
    height: number | null;
    durationMs?: number;
    posterStorageKey?: string;
    posterMimeType?: string;
    posterByteSize?: number;
  },
) {
  const [attachment] = await db.insert(postAttachments).values(input).returning();
  return attachment!;
}

export async function findPendingPostAttachment(db: DbOrTx, id: string, authorId: string) {
  const [attachment] = await db
    .select()
    .from(postAttachments)
    .where(and(eq(postAttachments.id, id), eq(postAttachments.authorId, authorId), isNull(postAttachments.postId)));
  return attachment ?? null;
}

/** Le rang de chaque image suit l'ordre des identifiants, celui du carrousel. */
export async function attachToPost(db: DbOrTx, attachmentIds: string[], postId: string) {
  for (const [position, id] of attachmentIds.entries()) {
    await db.update(postAttachments).set({ postId, position }).where(eq(postAttachments.id, id));
  }
}

export async function listAttachmentsForPosts(db: DbOrTx, postIds: string[]) {
  if (postIds.length === 0) return [];
  return db
    .select()
    .from(postAttachments)
    .where(inArray(postAttachments.postId, postIds))
    .orderBy(asc(postAttachments.position), asc(postAttachments.createdAt), asc(postAttachments.id));
}

export async function findPostAttachmentById(db: Db, id: string) {
  const [attachment] = await db.select().from(postAttachments).where(eq(postAttachments.id, id));
  return attachment ?? null;
}

/** Images envoyées puis jamais rattachées à un post (composeur abandonné), au-delà du délai de grâce. */
export async function listOrphanPostAttachments(db: Db, olderThan: Date) {
  return db
    .select()
    .from(postAttachments)
    .where(and(isNull(postAttachments.postId), lt(postAttachments.createdAt, olderThan)));
}

export async function deletePostAttachmentRow(db: Db, id: string) {
  await db.delete(postAttachments).where(eq(postAttachments.id, id));
}
