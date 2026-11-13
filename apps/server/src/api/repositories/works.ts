import { and, asc, desc, eq, getTableName, inArray, isNull, lt, or, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  channels,
  messages,
  posts,
  profiles,
  workAttachments,
  workAuthors,
  workExternalAuthors,
  workLinks,
  workMedia,
  WORK_DISCUSSIONS_SPACE_ID,
  works,
  type Db,
  type DbOrTx,
} from "@kemet/db";
import type {
  Level,
  WorkAuthorStatus,
  WorkLinkInput,
  WorkSort,
  WorkStatus,
  WorkType,
} from "@kemet/shared";
import { computeLevels } from "./points.js";

export type WorkRow = typeof works.$inferSelect;
export type ProfileRow = typeof profiles.$inferSelect;
export type WorkLinkRow = typeof workLinks.$inferSelect;
export type WorkAttachmentRow = typeof workAttachments.$inferSelect;

// Curseur composite : deux travaux créés dans la même milliseconde (le seed
// en crée plusieurs d'un coup) ne doivent pas faire sauter une page. Tri et
// comparaison à la milliseconde, la précision d'une date JavaScript : la
// microseconde stockée par Postgres ferait sinon sauter des lignes.
const createdAtMs = sql`date_trunc('milliseconds', ${works.createdAt})`;
const newestFirst = [sql`${createdAtMs} desc`, desc(works.id)];

function encodeCursor(row: WorkRow): string {
  return `${row.createdAt.toISOString()}_${row.id}`;
}

function cursorCondition(cursor: string | undefined): SQL | undefined {
  if (!cursor) return undefined;
  const separator = cursor.lastIndexOf("_");
  const createdAt = new Date(cursor.slice(0, separator));
  const id = cursor.slice(separator + 1);
  if (Number.isNaN(createdAt.getTime()) || !/^[0-9a-f-]{36}$/.test(id)) return sql`false`;
  return sql`(${createdAtMs}, ${works.id}) < (${createdAt.toISOString()}::timestamp, ${id}::uuid)`;
}

// Dans un select sur une seule table, Drizzle écrit les colonnes sans leur
// table : une sous-requête corrélée comparerait alors une colonne à elle-même.
function qualified(column: AnyPgColumn): SQL {
  return sql`${sql.identifier(getTableName(column.table))}.${sql.identifier(column.name)}`;
}

// Messages visibles de la discussion d'un travail : sert au tri "les plus
// discutés" et au compteur de chaque carte.
const messageCountSql = sql<number>`(
  select count(*)::int from ${messages}
  where ${qualified(messages.channelId)} = ${qualified(works.channelId)}
  and ${qualified(messages.deletedAt)} is null
)`;

/** Échappe `%`, `_` et `\` pour une recherche par sous-chaîne. */
function likePattern(value: string): string {
  return `%${value.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

// Plein texte (français et anglais) sur titre, résumé, tags et stack, ou nom
// d'un auteur : publieur, coauteur accepté ou auteur sans compte.
function searchCondition(q: string): SQL {
  const pattern = likePattern(q);
  return sql`(
    ${qualified(works.searchVector)} @@ (websearch_to_tsquery('french', ${q}) || websearch_to_tsquery('english', ${q}))
    or exists (
      select 1 from ${profiles}
      where (${qualified(profiles.id)} = ${qualified(works.publisherId)} or ${qualified(profiles.id)} in (
        select ${qualified(workAuthors.profileId)} from ${workAuthors}
        where ${qualified(workAuthors.workId)} = ${qualified(works.id)} and ${qualified(workAuthors.status)} = 'accepted'
      ))
      and ${qualified(profiles.deletedAt)} is null
      and ${qualified(profiles.isFiller)} = false
      and (${qualified(profiles.displayName)} ilike ${pattern} or ${qualified(profiles.handle)} ilike ${pattern})
    )
    or exists (
      select 1 from ${workExternalAuthors}
      where ${qualified(workExternalAuthors.workId)} = ${qualified(works.id)} and ${qualified(workExternalAuthors.name)} ilike ${pattern}
    )
  )`;
}

function toPage(rows: WorkRow[], limit: number) {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items.at(-1);
  return { items, nextCursor: hasMore && last ? encodeCursor(last) : null };
}

export async function findWorkBySlug(db: DbOrTx, slug: string) {
  const [work] = await db.select().from(works).where(eq(works.slug, slug));
  return work ?? null;
}

export async function findWorkById(db: DbOrTx, id: string) {
  const [work] = await db.select().from(works).where(eq(works.id, id));
  return work ?? null;
}

export async function insertWork(
  db: DbOrTx,
  input: {
    publisherId: string;
    slug: string;
    title: string;
    type: WorkType;
    status: WorkStatus;
    summary: string;
    tags: string[];
    stack: string[];
    year: number | null;
    institution: string | null;
  },
) {
  const [work] = await db
    .insert(works)
    .values({ ...input, publishRightConfirmed: true })
    .onConflictDoNothing({ target: works.slug })
    .returning();
  return work ?? null;
}

export async function updateWorkFields(
  db: DbOrTx,
  workId: string,
  patch: Partial<
    Pick<
      WorkRow,
      "title" | "type" | "status" | "summary" | "tags" | "stack" | "year" | "institution"
    >
  >,
) {
  if (Object.keys(patch).length === 0) {
    // Toucher updated_at quand seuls les liens ou les auteurs changent.
    const [work] = await db
      .update(works)
      .set({ updatedAt: new Date() })
      .where(eq(works.id, workId))
      .returning();
    return work!;
  }
  const [work] = await db.update(works).set(patch).where(eq(works.id, workId)).returning();
  return work!;
}

export async function replaceWorkLinks(db: DbOrTx, workId: string, links: WorkLinkInput[]) {
  await db.delete(workLinks).where(eq(workLinks.workId, workId));
  if (links.length === 0) return;
  await db.insert(workLinks).values(
    links.map((link, position) => ({
      workId,
      type: link.type,
      url: link.url,
      label: link.label?.trim() ? link.label.trim() : null,
      position,
    })),
  );
}

export async function replaceExternalAuthors(db: DbOrTx, workId: string, names: string[]) {
  await db.delete(workExternalAuthors).where(eq(workExternalAuthors.workId, workId));
  if (names.length === 0) return;
  await db
    .insert(workExternalAuthors)
    .values(names.map((name, position) => ({ workId, name, position })));
}

/** Le post qui annonçait le travail disparaît avec lui. */
export async function softDeleteWork(db: Db, workId: string) {
  const now = new Date();
  await db.transaction(async (tx) => {
    const [work] = await tx
      .update(works)
      .set({ deletedAt: now })
      .where(eq(works.id, workId))
      .returning({ channelId: works.channelId });
    // La discussion part avec le travail : un titre masqué après signalement
    // ne doit pas rester public par son salon.
    if (work?.channelId) await tx.delete(channels).where(eq(channels.id, work.channelId));
    // Images et vidéos libérées : le nettoyage horaire les efface et elles
    // sortent du quota de l'auteur.
    await tx.update(workMedia).set({ workId: null, role: null }).where(eq(workMedia.workId, workId));
    await tx
      .update(posts)
      .set({ deletedAt: now })
      .where(and(eq(posts.workId, workId), isNull(posts.deletedAt)));
  });
}

export async function listWorks(
  db: Db,
  filters: {
    q?: string;
    type?: WorkType;
    status?: WorkStatus;
    tag?: string;
    sort: WorkSort;
    cursor?: string;
    limit: number;
  },
) {
  const conditions: (SQL | undefined)[] = [isNull(works.deletedAt)];
  if (filters.q) conditions.push(searchCondition(filters.q));
  if (filters.type) conditions.push(eq(works.type, filters.type));
  if (filters.status) conditions.push(eq(works.status, filters.status));
  if (filters.tag) conditions.push(sql`${works.tags} @> array[${filters.tag}]::text[]`);

  if (filters.sort === "discussed") {
    // Le nombre de messages change pendant qu'on pagine : un curseur par
    // position suffit ici, au prix d'un éventuel doublon en bord de page.
    const offset = /^\d{1,5}$/.test(filters.cursor ?? "") ? Number(filters.cursor) : 0;
    const rows = await db
      .select()
      .from(works)
      .where(and(...conditions))
      .orderBy(sql`${messageCountSql} desc`, ...newestFirst)
      .limit(filters.limit + 1)
      .offset(offset);
    const hasMore = rows.length > filters.limit;
    return {
      items: hasMore ? rows.slice(0, filters.limit) : rows,
      nextCursor: hasMore ? String(offset + filters.limit) : null,
    };
  }

  const rows = await db
    .select()
    .from(works)
    .where(and(...conditions, cursorCondition(filters.cursor)))
    .orderBy(...newestFirst)
    .limit(filters.limit + 1);
  return toPage(rows, filters.limit);
}

/** Nombre de personnes qui ont écrit dans la discussion d'un travail. */
export async function countDiscussionParticipants(db: DbOrTx, channelId: string | null) {
  if (!channelId) return 0;
  const [row] = await db
    .select({ count: sql<number>`count(distinct ${messages.authorId})::int` })
    .from(messages)
    .where(and(eq(messages.channelId, channelId), isNull(messages.deletedAt)));
  return row?.count ?? 0;
}

/**
 * Crée le salon public de la discussion d'un travail, dans l'espace système
 * des travaux. Il n'apparaît pas dans la liste des espaces mais réutilise tout
 * le module des salons : messages, réactions, fichiers, temps réel, non-lus.
 */
export async function createWorkDiscussion(
  tx: DbOrTx,
  work: { id: string; slug: string; title: string },
) {
  const [channel] = await tx
    .insert(channels)
    .values({
      spaceId: WORK_DISCUSSIONS_SPACE_ID,
      name: work.title,
      slug: work.slug,
      displayOrder: 0,
    })
    .returning();
  await tx.update(works).set({ channelId: channel!.id }).where(eq(works.id, work.id));
  return channel!;
}

export async function renameWorkDiscussion(tx: DbOrTx, channelId: string, title: string) {
  await tx.update(channels).set({ name: title }).where(eq(channels.id, channelId));
}

/** Travaux publiés par la personne, et ceux qu'elle a acceptés comme coauteur. */
export async function listProfileWorks(
  db: Db,
  profileId: string,
  cursor: string | undefined,
  limit: number,
) {
  const coauthored = db
    .select({ id: workAuthors.workId })
    .from(workAuthors)
    .where(and(eq(workAuthors.profileId, profileId), eq(workAuthors.status, "accepted")));
  const rows = await db
    .select()
    .from(works)
    .where(
      and(
        isNull(works.deletedAt),
        or(eq(works.publisherId, profileId), inArray(works.id, coauthored)),
        cursorCondition(cursor),
      ),
    )
    .orderBy(...newestFirst)
    .limit(limit + 1);
  return toPage(rows, limit);
}

/** Même périmètre que `listProfileWorks`, compté. */
export async function countProfileWorks(db: Db, profileId: string): Promise<number> {
  const coauthored = db
    .select({ id: workAuthors.workId })
    .from(workAuthors)
    .where(and(eq(workAuthors.profileId, profileId), eq(workAuthors.status, "accepted")));
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(works)
    .where(
      and(
        isNull(works.deletedAt),
        or(eq(works.publisherId, profileId), inArray(works.id, coauthored)),
      ),
    );
  return row?.count ?? 0;
}

export interface WorkPeople {
  publisher: ProfileRow;
  coauthors: ProfileRow[];
  externalAuthors: string[];
  hasPdf: boolean;
  coverMediaId: string | null;
  messageCount: number;
  levels: Map<string, Level>;
}

/** Publieur, coauteurs acceptés, auteurs sans compte et présence d'un PDF, pour une page de travaux. */
export async function loadWorkPeople(
  db: DbOrTx,
  rows: WorkRow[],
): Promise<Map<string, WorkPeople>> {
  const result = new Map<string, WorkPeople>();
  if (rows.length === 0) return result;
  const workIds = rows.map((row) => row.id);
  const [coauthorRows, externalRows, attachmentRows, countRows, coverRows] = await Promise.all([
    db
      .select({ workId: workAuthors.workId, profile: profiles })
      .from(workAuthors)
      .innerJoin(profiles, eq(profiles.id, workAuthors.profileId))
      .where(and(inArray(workAuthors.workId, workIds), eq(workAuthors.status, "accepted")))
      .orderBy(workAuthors.invitedAt),
    db
      .select()
      .from(workExternalAuthors)
      .where(inArray(workExternalAuthors.workId, workIds))
      .orderBy(workExternalAuthors.position),
    db
      .select({ workId: workAttachments.workId })
      .from(workAttachments)
      .where(inArray(workAttachments.workId, workIds)),
    db
      .select({ id: works.id, messageCount: messageCountSql })
      .from(works)
      .where(inArray(works.id, workIds)),
    db
      .select({ workId: workMedia.workId, id: workMedia.id })
      .from(workMedia)
      .where(and(inArray(workMedia.workId, workIds), eq(workMedia.role, "cover"))),
  ]);
  const publisherIds = [...new Set(rows.map((row) => row.publisherId))];
  const publishers = await db.select().from(profiles).where(inArray(profiles.id, publisherIds));
  const publisherById = new Map(publishers.map((profile) => [profile.id, profile]));
  const withPdf = new Set(attachmentRows.map((row) => row.workId));
  const coverById = new Map(coverRows.map((row) => [row.workId, row.id]));
  const messageCountById = new Map(countRows.map((row) => [row.id, row.messageCount]));
  const levels = await computeLevels(db, [
    ...publisherIds,
    ...coauthorRows.map((entry) => entry.profile.id),
  ]);

  for (const row of rows) {
    result.set(row.id, {
      publisher: publisherById.get(row.publisherId)!,
      coauthors: coauthorRows
        .filter((entry) => entry.workId === row.id)
        .map((entry) => entry.profile),
      externalAuthors: externalRows
        .filter((entry) => entry.workId === row.id)
        .map((entry) => entry.name),
      hasPdf: withPdf.has(row.id),
      coverMediaId: coverById.get(row.id) ?? null,
      messageCount: messageCountById.get(row.id) ?? 0,
      levels,
    });
  }
  return result;
}

export async function listWorkLinks(db: DbOrTx, workId: string) {
  return db
    .select()
    .from(workLinks)
    .where(eq(workLinks.workId, workId))
    .orderBy(workLinks.position);
}

export async function listWorkInvitations(db: DbOrTx, workId: string) {
  return db
    .select({ invitation: workAuthors, profile: profiles })
    .from(workAuthors)
    .innerJoin(profiles, eq(profiles.id, workAuthors.profileId))
    .where(eq(workAuthors.workId, workId))
    .orderBy(workAuthors.invitedAt);
}

/** Auteurs avec un compte encore actif : la personne qui publie et les coauteurs acceptés. */
export async function listWorkAccountAuthorIds(db: DbOrTx, work: { id: string; publisherId: string }) {
  const coauthors = await db
    .select({ profileId: workAuthors.profileId })
    .from(workAuthors)
    .innerJoin(profiles, eq(profiles.id, workAuthors.profileId))
    .where(and(eq(workAuthors.workId, work.id), eq(workAuthors.status, "accepted"), isNull(profiles.deletedAt)))
    .orderBy(asc(workAuthors.invitedAt));
  const [publisher] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(and(eq(profiles.id, work.publisherId), isNull(profiles.deletedAt)));
  const ids = [...(publisher ? [publisher.id] : []), ...coauthors.map((row) => row.profileId)];
  return [...new Set(ids)];
}

export async function findWorkAuthor(db: DbOrTx, workId: string, profileId: string) {
  const [row] = await db
    .select()
    .from(workAuthors)
    .where(and(eq(workAuthors.workId, workId), eq(workAuthors.profileId, profileId)));
  return row ?? null;
}

/** `null` si la personne a déjà une ligne sur ce travail, quel que soit son statut. */
export async function insertWorkInvitation(db: DbOrTx, workId: string, profileId: string) {
  const [row] = await db
    .insert(workAuthors)
    .values({ workId, profileId })
    .onConflictDoNothing({ target: [workAuthors.workId, workAuthors.profileId] })
    .returning();
  return row ?? null;
}

export async function setWorkAuthorStatus(db: DbOrTx, id: string, status: WorkAuthorStatus) {
  const [row] = await db
    .update(workAuthors)
    .set({ status, respondedAt: new Date() })
    .where(eq(workAuthors.id, id))
    .returning();
  return row!;
}

export async function deleteWorkAuthor(db: DbOrTx, id: string) {
  await db.delete(workAuthors).where(eq(workAuthors.id, id));
}

export async function listPendingWorkInvitations(db: Db, profileId: string) {
  return db
    .select({ invitation: workAuthors, work: works })
    .from(workAuthors)
    .innerJoin(works, eq(works.id, workAuthors.workId))
    .where(
      and(
        eq(workAuthors.profileId, profileId),
        eq(workAuthors.status, "pending"),
        isNull(works.deletedAt),
      ),
    )
    .orderBy(desc(workAuthors.invitedAt));
}

export async function findProfilesByHandles(db: DbOrTx, handles: string[]) {
  if (handles.length === 0) return [];
  return db.select().from(profiles).where(inArray(profiles.handle, handles));
}

export async function sumUserWorkAttachmentBytes(db: DbOrTx, authorId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${workAttachments.byteSize}), 0)` })
    .from(workAttachments)
    .where(eq(workAttachments.authorId, authorId));
  return Number(row?.total ?? 0);
}

export async function insertPendingWorkAttachment(
  db: DbOrTx,
  input: {
    authorId: string;
    storageKey: string;
    mimeType: string;
    originalName: string;
    byteSize: number;
  },
) {
  const [attachment] = await db.insert(workAttachments).values(input).returning();
  return attachment!;
}

export async function findPendingWorkAttachment(db: DbOrTx, id: string, authorId: string) {
  const [attachment] = await db
    .select()
    .from(workAttachments)
    .where(
      and(
        eq(workAttachments.id, id),
        eq(workAttachments.authorId, authorId),
        isNull(workAttachments.workId),
      ),
    );
  return attachment ?? null;
}

/**
 * Remplace le PDF d'un travail. L'ancien redevient orphelin et part avec le
 * nettoyage horaire, comme un envoi abandonné.
 */
export async function setWorkAttachment(db: DbOrTx, workId: string, attachmentId: string | null) {
  await db.update(workAttachments).set({ workId: null }).where(eq(workAttachments.workId, workId));
  if (attachmentId) {
    await db.update(workAttachments).set({ workId }).where(eq(workAttachments.id, attachmentId));
  }
}

export async function findWorkAttachmentForWork(db: DbOrTx, workId: string) {
  const [attachment] = await db
    .select()
    .from(workAttachments)
    .where(eq(workAttachments.workId, workId));
  return attachment ?? null;
}

export async function findWorkAttachmentById(db: Db, id: string) {
  const [attachment] = await db.select().from(workAttachments).where(eq(workAttachments.id, id));
  return attachment ?? null;
}

/** PDF envoyés puis jamais rattachés à un travail, ou remplacés, au-delà du délai de grâce. */
export async function listOrphanWorkAttachments(db: Db, olderThan: Date) {
  return db
    .select()
    .from(workAttachments)
    .where(and(isNull(workAttachments.workId), lt(workAttachments.createdAt, olderThan)));
}

export async function deleteWorkAttachmentRow(db: Db, id: string) {
  await db.delete(workAttachments).where(eq(workAttachments.id, id));
}

export async function findWorkPost(db: DbOrTx, workId: string) {
  const [post] = await db.select().from(posts).where(eq(posts.workId, workId));
  return post ?? null;
}

export async function findWorksByIds(db: DbOrTx, ids: string[]) {
  if (ids.length === 0) return [];
  return db.select().from(works).where(inArray(works.id, ids));
}
