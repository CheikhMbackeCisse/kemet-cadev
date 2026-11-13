import { and, asc, count, desc, eq, gt, inArray, isNull, lte, ne, or, sql, type SQL } from "drizzle-orm";
import {
  channels,
  conversationMembers,
  conversations,
  follows,
  messages,
  profileBlocks,
  profiles,
  readStates,
  spaceMembers,
  spaces,
  workAuthors,
  works,
  type Db,
  type DbOrTx,
} from "@kemet/db";
import type { ConversationBox, ConversationMemberStatus } from "@kemet/shared";

export type ConversationRow = typeof conversations.$inferSelect;
export type ConversationMemberRow = typeof conversationMembers.$inferSelect;

/** Clé d'une conversation à deux : les deux identifiants triés, l'ordre d'envoi n'y change rien. */
export function directKeyFor(firstProfileId: string, secondProfileId: string): string {
  return [firstProfileId, secondProfileId].sort().join(":");
}

export async function findConversationById(db: DbOrTx, conversationId: string) {
  const [conversation] = await db.select().from(conversations).where(eq(conversations.id, conversationId));
  return conversation ?? null;
}

export async function findConversationByDirectKey(db: DbOrTx, directKey: string) {
  const [conversation] = await db.select().from(conversations).where(eq(conversations.directKey, directKey));
  return conversation ?? null;
}

export async function findTeamConversation(db: DbOrTx, workId: string, createdBy: string) {
  const [conversation] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.workId, workId), eq(conversations.createdBy, createdBy)));
  return conversation ?? null;
}

export async function findConversationChannel(db: DbOrTx, conversationId: string) {
  const [channel] = await db.select().from(channels).where(eq(channels.conversationId, conversationId));
  return channel!;
}

export async function findConversationMember(db: DbOrTx, conversationId: string, profileId: string) {
  const [member] = await db
    .select()
    .from(conversationMembers)
    .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.profileId, profileId)));
  return member ?? null;
}

export async function listConversationMembers(db: DbOrTx, conversationIds: string[]) {
  if (conversationIds.length === 0) return [];
  return db
    .select({ member: conversationMembers, profile: profiles })
    .from(conversationMembers)
    .innerJoin(profiles, eq(profiles.id, conversationMembers.profileId))
    .where(inArray(conversationMembers.conversationId, conversationIds))
    .orderBy(asc(conversationMembers.joinedAt), asc(profiles.handle));
}

/**
 * Crée la conversation, son salon et ses membres. Pour une conversation à
 * deux, une création concurrente avec la même clé renvoie `null` : à
 * l'appelant de relire celle qui existe déjà.
 */
export async function insertConversation(
  tx: DbOrTx,
  input: {
    createdBy: string;
    directKey: string | null;
    workId?: string;
    members: { profileId: string; status: ConversationMemberStatus }[];
  },
) {
  const [conversation] = await tx
    .insert(conversations)
    .values({ createdBy: input.createdBy, directKey: input.directKey, workId: input.workId ?? null })
    .onConflictDoNothing({
      target: input.workId ? [conversations.workId, conversations.createdBy] : conversations.directKey,
    })
    .returning();
  if (!conversation) return null;
  await tx.insert(channels).values({ conversationId: conversation.id, name: "conversation", slug: "conversation" });
  await tx.insert(conversationMembers).values(
    input.members.map((member) => ({
      conversationId: conversation.id,
      profileId: member.profileId,
      status: member.status,
      respondedAt: member.status === "accepted" ? new Date() : null,
    })),
  );
  return conversation;
}

export async function setConversationMemberStatus(
  db: DbOrTx,
  conversationId: string,
  profileId: string,
  status: ConversationMemberStatus,
) {
  const [member] = await db
    .update(conversationMembers)
    .set({ status, respondedAt: new Date() })
    .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.profileId, profileId)))
    .returning();
  return member!;
}

/**
 * Le destinataire connaît déjà l'expéditeur : il le suit, ils partagent un
 * espace privé, ou ils ont signé ensemble un travail. Le premier message
 * arrive alors directement dans ses messages plutôt que dans ses demandes.
 * Un espace public ne compte pas : n'importe qui le rejoint en un clic, il ne
 * dit rien de qui se connaît. Une invitation de coauteur non acceptée non plus.
 */
export async function knowsSender(db: DbOrTx, recipientId: string, senderId: string): Promise<boolean> {
  const [follow] = await db
    .select({ id: follows.id })
    .from(follows)
    .where(and(eq(follows.followerId, recipientId), eq(follows.followeeId, senderId)))
    .limit(1);
  if (follow) return true;
  const recipientSpaces = db
    .select({ spaceId: spaceMembers.spaceId })
    .from(spaceMembers)
    .innerJoin(spaces, eq(spaces.id, spaceMembers.spaceId))
    .where(and(eq(spaceMembers.profileId, recipientId), eq(spaces.visibility, "private")));
  const [shared] = await db
    .select({ id: spaceMembers.id })
    .from(spaceMembers)
    .where(and(eq(spaceMembers.profileId, senderId), inArray(spaceMembers.spaceId, recipientSpaces)))
    .limit(1);
  if (shared) return true;
  const recipientWorks = await listSignedWorkIds(db, recipientId);
  if (recipientWorks.length === 0) return false;
  const senderWorks = new Set(await listSignedWorkIds(db, senderId));
  return recipientWorks.some((workId) => senderWorks.has(workId));
}

/** Travaux encore publiés que la personne a publiés ou co-signés (coauteur accepté). */
async function listSignedWorkIds(db: DbOrTx, profileId: string): Promise<string[]> {
  const published = await db
    .select({ id: works.id })
    .from(works)
    .where(and(eq(works.publisherId, profileId), isNull(works.deletedAt)));
  const coauthored = await db
    .select({ id: works.id })
    .from(workAuthors)
    .innerJoin(works, eq(works.id, workAuthors.workId))
    .where(and(eq(workAuthors.profileId, profileId), eq(workAuthors.status, "accepted"), isNull(works.deletedAt)));
  return [...published, ...coauthored].map((row) => row.id);
}

/** Vrai si l'un des deux a bloqué l'autre. */
export async function isBlockedEitherWay(db: DbOrTx, firstProfileId: string, secondProfileId: string) {
  const [row] = await db
    .select({ id: profileBlocks.id })
    .from(profileBlocks)
    .where(
      or(
        and(eq(profileBlocks.blockerId, firstProfileId), eq(profileBlocks.blockedId, secondProfileId)),
        and(eq(profileBlocks.blockerId, secondProfileId), eq(profileBlocks.blockedId, firstProfileId)),
      ),
    )
    .limit(1);
  return row != null;
}

/** Parmi `candidateIds`, ceux qui ont bloqué `profileId`. */
export async function listProfilesBlocking(db: DbOrTx, profileId: string, candidateIds: string[]) {
  if (candidateIds.length === 0) return new Set<string>();
  const rows = await db
    .select({ blockerId: profileBlocks.blockerId })
    .from(profileBlocks)
    .where(and(eq(profileBlocks.blockedId, profileId), inArray(profileBlocks.blockerId, candidateIds)));
  return new Set(rows.map((row) => row.blockerId));
}

export async function hasBlocked(db: Db, blockerId: string, blockedId: string) {
  const [row] = await db
    .select({ id: profileBlocks.id })
    .from(profileBlocks)
    .where(and(eq(profileBlocks.blockerId, blockerId), eq(profileBlocks.blockedId, blockedId)));
  return row != null;
}

/** Profils bloqués par une personne, du plus récent au plus ancien. */
export async function listBlockedProfiles(db: Db, blockerId: string) {
  return db
    .select({ profile: profiles })
    .from(profileBlocks)
    .innerJoin(profiles, eq(profiles.id, profileBlocks.blockedId))
    .where(eq(profileBlocks.blockerId, blockerId))
    .orderBy(desc(profileBlocks.createdAt));
}

export async function blockProfile(db: Db, blockerId: string, blockedId: string) {
  await db.insert(profileBlocks).values({ blockerId, blockedId }).onConflictDoNothing();
}

export async function unblockProfile(db: Db, blockerId: string, blockedId: string) {
  await db
    .delete(profileBlocks)
    .where(and(eq(profileBlocks.blockerId, blockerId), eq(profileBlocks.blockedId, blockedId)));
}

export async function findMessageByClientId(db: DbOrTx, authorId: string, clientId: string) {
  const [row] = await db
    .select({ id: messages.id })
    .from(messages)
    .where(and(eq(messages.authorId, authorId), eq(messages.clientId, clientId)));
  return row ?? null;
}

export async function countAuthorMessages(db: DbOrTx, channelId: string, authorId: string) {
  const [row] = await db
    .select({ value: count() })
    .from(messages)
    .where(and(eq(messages.channelId, channelId), eq(messages.authorId, authorId)));
  return row?.value ?? 0;
}

export interface ConversationListRow {
  id: string;
  directKey: string | null;
  createdBy: string;
  createdAt: Date;
  channelId: string;
  status: ConversationMemberStatus;
  joinedAt: Date;
  work: { slug: string; title: string } | null;
  lastMessage: {
    authorId: string;
    body: string;
    deletedAt: Date | null;
    createdAt: Date;
    hasAttachments: boolean;
    hasVoice: boolean;
  } | null;
}

interface RawConversationListRow extends Record<string, unknown> {
  id: string;
  direct_key: string | null;
  created_by: string;
  created_at: Date | string;
  channel_id: string;
  status: ConversationMemberStatus;
  joined_at: Date | string;
  work_slug: string | null;
  work_title: string | null;
  last_id: string | null;
  last_author_id: string | null;
  last_body: string | null;
  last_deleted_at: Date | string | null;
  last_created_at: Date | string | null;
  last_has_attachments: boolean | null;
  last_has_voice: boolean | null;
}

// Colonnes `timestamp` sans fuseau, écrites en UTC : même lecture que
// drizzle pour une requête SQL brute, qui ne passe pas par ses colonnes.
function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(`${value}+0000`);
}

function toListRow(row: RawConversationListRow): ConversationListRow {
  return {
    id: row.id,
    directKey: row.direct_key,
    createdBy: row.created_by,
    createdAt: toDate(row.created_at),
    channelId: row.channel_id,
    status: row.status,
    joinedAt: toDate(row.joined_at),
    work: row.work_slug && row.work_title ? { slug: row.work_slug, title: row.work_title } : null,
    lastMessage:
      row.last_id && row.last_author_id && row.last_created_at
        ? {
            authorId: row.last_author_id,
            body: row.last_body ?? "",
            deletedAt: row.last_deleted_at ? toDate(row.last_deleted_at) : null,
            createdAt: toDate(row.last_created_at),
            hasAttachments: row.last_has_attachments ?? false,
            hasVoice: row.last_has_voice ?? false,
          }
        : null,
  };
}

/** Conversations de `viewerId` avec leur dernier message, filtrées par `condition` (alias c, cm, lm, w). */
function conversationRowsQuery(viewerId: string, condition: SQL) {
  return sql`
    select
      c.id, c.direct_key, c.created_by, c.created_at, ch.id as channel_id, cm.status, cm.joined_at,
      w.slug as work_slug, w.title as work_title,
      lm.id as last_id, lm.author_id as last_author_id, lm.body as last_body,
      lm.deleted_at as last_deleted_at, lm.created_at as last_created_at,
      exists (select 1 from message_attachments a where a.message_id = lm.id) as last_has_attachments,
      exists (select 1 from message_attachments a where a.message_id = lm.id and a.kind = 'voice') as last_has_voice,
      coalesce(lm.created_at, c.created_at) as activity_at
    from conversation_members cm
    join conversations c on c.id = cm.conversation_id
    join channels ch on ch.conversation_id = c.id
    left join works w on w.id = c.work_id and w.deleted_at is null
    left join lateral (
      select m.id, m.author_id, m.body, m.deleted_at, m.created_at
      from messages m
      where m.channel_id = ch.id and m.parent_message_id is null
      order by m.created_at desc, m.id desc
      limit 1
    ) lm on true
    where cm.profile_id = ${viewerId} and ${condition}
  `;
}

/**
 * Conversations de `viewerId`, de la plus récemment active à la plus
 * ancienne. Une conversation sans message n'apparaît que chez qui l'a
 * ouverte : son destinataire ne la voit qu'au premier message. Le curseur
 * est l'identifiant de la dernière conversation de la page précédente,
 * comparé sur (activité, id) comme l'historique des salons.
 */
export async function listConversationsForViewer(
  db: Db,
  viewerId: string,
  box: ConversationBox,
  cursor: string | undefined,
  limit: number,
): Promise<{ items: ConversationListRow[]; nextCursor: string | null }> {
  const status: ConversationMemberStatus = box === "inbox" ? "accepted" : "pending";
  const condition = sql`cm.status = ${status} and (lm.id is not null or c.created_by = ${viewerId})`;
  const cursorCondition = cursor
    ? sql`and (activity_at, id) < (select activity_at, id from visible where id = ${cursor})`
    : sql``;
  const result = await db.execute<RawConversationListRow>(sql`
    with visible as (${conversationRowsQuery(viewerId, condition)})
    select * from visible
    where true ${cursorCondition}
    order by activity_at desc, id desc
    limit ${limit + 1}
  `);
  const rows = [...result];
  const hasMore = rows.length > limit;
  const items = (hasMore ? rows.slice(0, limit) : rows).map(toListRow);
  return { items, nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null };
}

export async function findConversationRowForViewer(db: DbOrTx, viewerId: string, conversationId: string) {
  const result = await db.execute<RawConversationListRow>(
    conversationRowsQuery(viewerId, sql`c.id = ${conversationId}`),
  );
  const [row] = [...result];
  return row ? toListRow(row) : null;
}

/** Messages des autres membres postérieurs à la dernière lecture (ou à l'arrivée), par salon. */
export async function countUnreadByChannel(
  db: Db,
  viewerId: string,
  channelsWithJoin: { channelId: string; joinedAt: Date }[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  await Promise.all(
    channelsWithJoin.map(async ({ channelId, joinedAt }) => {
      const [state] = await db
        .select({ lastReadAt: readStates.lastReadAt })
        .from(readStates)
        .where(and(eq(readStates.channelId, channelId), eq(readStates.profileId, viewerId)));
      const since = state?.lastReadAt ?? joinedAt;
      const [row] = await db
        .select({ value: count() })
        .from(messages)
        .where(
          and(
            eq(messages.channelId, channelId),
            ne(messages.authorId, viewerId),
            isNull(messages.deletedAt),
            gt(messages.createdAt, since),
          ),
        );
      counts.set(channelId, row?.value ?? 0);
    }),
  );
  return counts;
}

/** Pour les pastilles : conversations acceptées avec un non-lu, et demandes en attente. */
export async function countConversationUnreadSummary(db: Db, viewerId: string) {
  const result = await db.execute<{ unread_conversations: number; pending_requests: number }>(sql`
    select
      (
        select count(*)::int
        from conversation_members cm
        join channels ch on ch.conversation_id = cm.conversation_id
        left join read_states rs on rs.channel_id = ch.id and rs.profile_id = cm.profile_id
        where cm.profile_id = ${viewerId}
          and cm.status = 'accepted'
          and exists (
            select 1 from messages m
            where m.channel_id = ch.id
              and m.author_id <> ${viewerId}
              and m.deleted_at is null
              and m.created_at > coalesce(rs.last_read_at, cm.joined_at)
          )
      ) as unread_conversations,
      (
        select count(*)::int
        from conversation_members cm
        join channels ch on ch.conversation_id = cm.conversation_id
        where cm.profile_id = ${viewerId}
          and cm.status = 'pending'
          and exists (select 1 from messages m where m.channel_id = ch.id)
      ) as pending_requests
  `);
  const [row] = [...result];
  return { unreadConversations: row?.unread_conversations ?? 0, pendingRequests: row?.pending_requests ?? 0 };
}

/** Membres encore présents (acceptés ou en attente), à prévenir d'une activité. */
export async function listActiveMemberIds(db: DbOrTx, conversationId: string) {
  const rows = await db
    .select({ profileId: conversationMembers.profileId })
    .from(conversationMembers)
    .where(and(eq(conversationMembers.conversationId, conversationId), ne(conversationMembers.status, "left")));
  return rows.map((row) => row.profileId);
}

/** Derniers messages d'une conversation, du plus ancien au plus récent, pour la modération. */
export async function listRecentConversationMessages(db: Db, channelId: string, before: Date, limit: number) {
  const rows = await db
    .select({ message: messages, handle: profiles.handle })
    .from(messages)
    .innerJoin(profiles, eq(profiles.id, messages.authorId))
    .where(and(eq(messages.channelId, channelId), lte(messages.createdAt, before)))
    .orderBy(desc(messages.createdAt), desc(messages.id))
    .limit(limit);
  return rows.reverse();
}

/** Auteur le plus récent autre que `excludedProfileId`, pour savoir qui est signalé dans un groupe. */
export async function findLatestOtherAuthor(db: Db, channelId: string, excludedProfileId: string, before: Date) {
  const [row] = await db
    .select({ authorId: messages.authorId })
    .from(messages)
    .where(
      and(eq(messages.channelId, channelId), ne(messages.authorId, excludedProfileId), lte(messages.createdAt, before)),
    )
    .orderBy(desc(messages.createdAt), desc(messages.id))
    .limit(1);
  return row?.authorId ?? null;
}
