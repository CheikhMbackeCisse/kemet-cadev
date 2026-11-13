import { and, asc, eq, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { workMedia, type Db, type DbOrTx } from "@kemet/db";

export type WorkMediaRow = typeof workMedia.$inferSelect;

export async function insertPendingWorkMedia(
  db: DbOrTx,
  input: {
    authorId: string;
    kind: "image" | "video";
    storageKey: string;
    mimeType: string;
    originalName: string;
    byteSize: number;
  },
) {
  const [row] = await db.insert(workMedia).values(input).returning();
  return row!;
}

export async function sumUserWorkMediaBytes(db: DbOrTx, authorId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${workMedia.byteSize}), 0)` })
    .from(workMedia)
    .where(eq(workMedia.authorId, authorId));
  return Number(row?.total ?? 0);
}

/** Fichiers envoyés par `authorId`, encore libres ou déjà sur ce travail. */
export async function findAttachableWorkMedia(db: DbOrTx, ids: string[], authorId: string, workId: string) {
  if (ids.length === 0) return [];
  return db
    .select()
    .from(workMedia)
    .where(
      and(
        inArray(workMedia.id, ids),
        eq(workMedia.authorId, authorId),
        isNotNull(workMedia.storageKey),
        or(isNull(workMedia.workId), eq(workMedia.workId, workId)),
      ),
    )
    // Deux travaux enregistrés en même temps ne prennent pas le même fichier.
    .for("update");
}

/**
 * Remplace les médias d'un travail. Les fichiers retirés redeviennent libres
 * et partent avec le nettoyage des orphelins ; les liens YouTube sont recréés.
 * Rôles et nombres déjà vérifiés par l'appelant.
 */
export async function replaceWorkMedia(
  tx: DbOrTx,
  workId: string,
  authorId: string,
  files: { id: string; role: "cover" | "gallery" | "video" }[],
  youtubeIds: string[],
) {
  await tx.delete(workMedia).where(and(eq(workMedia.workId, workId), eq(workMedia.kind, "youtube")));
  await tx.update(workMedia).set({ workId: null, role: null }).where(eq(workMedia.workId, workId));
  for (const [position, file] of files.entries()) {
    await tx.update(workMedia).set({ workId, role: file.role, position }).where(eq(workMedia.id, file.id));
  }
  if (youtubeIds.length > 0) {
    await tx.insert(workMedia).values(
      youtubeIds.map((youtubeId, index) => ({
        workId,
        authorId,
        kind: "youtube" as const,
        role: "video" as const,
        youtubeId,
        position: files.length + index,
      })),
    );
  }
}

export async function listWorkMedia(db: DbOrTx, workId: string) {
  return db.select().from(workMedia).where(eq(workMedia.workId, workId)).orderBy(asc(workMedia.position));
}

export async function findWorkMediaById(db: DbOrTx, id: string) {
  const [row] = await db.select().from(workMedia).where(eq(workMedia.id, id));
  return row ?? null;
}

export async function listOrphanWorkMedia(db: Db, olderThan: Date) {
  return db
    .select()
    .from(workMedia)
    .where(and(isNull(workMedia.workId), lt(workMedia.createdAt, olderThan)));
}

export async function deleteWorkMediaRow(db: Db, id: string) {
  await db.delete(workMedia).where(eq(workMedia.id, id));
}
