import { customAlphabet } from "nanoid";
import { and, asc, count, desc, eq, gt, inArray, isNull, lt, or, sql } from "drizzle-orm";
import {
  channels,
  messageMentions,
  messageReactions,
  messages,
  profiles,
  readStates,
  spaceInvites,
  spaceMembers,
  spaces,
  type Db,
  type DbOrTx,
} from "@kemet/db";
import { listAttachmentsForMessages } from "./attachments.js";

const generateInviteCode = customAlphabet("23456789abcdefghjkmnpqrstuvwxyz", 24);

export const DEFAULT_CHANNELS = [
  { name: "général", slug: "general" },
  { name: "mèmes", slug: "memes" },
];

function toPage<T extends { createdAt: Date }>(rows: T[], limit: number) {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items.at(-1);
  return { items, nextCursor: hasMore && last ? last.createdAt.toISOString() : null };
}

export async function createSpaceWithDefaults(
  db: Db,
  input: {
    name: string;
    slug: string;
    description: string | null;
    visibility: "public" | "private";
    creatorProfileId: string;
  },
) {
  return db.transaction(async (tx) => {
    const [space] = await tx
      .insert(spaces)
      .values({
        name: input.name,
        slug: input.slug,
        description: input.description,
        visibility: input.visibility,
        createdBy: input.creatorProfileId,
      })
      .returning();
    await tx.insert(spaceMembers).values({
      spaceId: space!.id,
      profileId: input.creatorProfileId,
      role: "owner",
    });
    await tx.insert(channels).values(
      DEFAULT_CHANNELS.map((channel, index) => ({
        spaceId: space!.id,
        name: channel.name,
        slug: channel.slug,
        displayOrder: index,
      })),
    );
    return space!;
  });
}

export async function findSpaceById(db: Db, spaceId: string) {
  const [space] = await db.select().from(spaces).where(eq(spaces.id, spaceId));
  return space ?? null;
}

export async function findSpaceBySlug(db: Db, slug: string) {
  const [space] = await db.select().from(spaces).where(eq(spaces.slug, slug));
  return space ?? null;
}

export async function findSpaceMembership(db: Db, spaceId: string, profileId: string) {
  const [member] = await db
    .select()
    .from(spaceMembers)
    .where(and(eq(spaceMembers.spaceId, spaceId), eq(spaceMembers.profileId, profileId)));
  return member ?? null;
}

// `profileId` est `null` pour un visiteur : seuls les espaces publics sont visibles.
export async function listSpacesForViewer(
  db: Db,
  profileId: string | null,
  cursor: string | undefined,
  limit: number,
) {
  const memberIds = profileId
    ? (
        await db
          .select({ id: spaceMembers.spaceId })
          .from(spaceMembers)
          .where(eq(spaceMembers.profileId, profileId))
      ).map((row) => row.id)
    : [];
  const visibility =
    memberIds.length > 0
      ? or(eq(spaces.visibility, "public"), inArray(spaces.id, memberIds))
      : eq(spaces.visibility, "public");
  // L'espace système des discussions de travaux ne figure jamais dans la liste.
  const listed = and(visibility, isNull(spaces.archivedAt), eq(spaces.kind, "community"));
  const condition = cursor ? and(listed, lt(spaces.createdAt, new Date(cursor))) : listed;
  const rows = profileId
    ? await db
        .select({ space: spaces, role: spaceMembers.role })
        .from(spaces)
        .leftJoin(
          spaceMembers,
          and(eq(spaceMembers.spaceId, spaces.id), eq(spaceMembers.profileId, profileId)),
        )
        .where(condition)
        .orderBy(desc(spaces.createdAt))
        .limit(limit + 1)
    : (
        await db
          .select({ space: spaces })
          .from(spaces)
          .where(condition)
          .orderBy(desc(spaces.createdAt))
          .limit(limit + 1)
      ).map((row) => ({ ...row, role: null }));
  const page = toPage(
    rows.map((row) => ({ ...row.space, role: row.role })),
    limit,
  );
  return page;
}

/** Espace public le plus actif sur la période, pour ouvrir les salons d'un visiteur. */
export async function findMostActivePublicSpaceId(db: Db, since: Date): Promise<string | null> {
  const [row] = await db
    .select({ id: spaces.id, total: count(messages.id) })
    .from(spaces)
    .innerJoin(channels, eq(channels.spaceId, spaces.id))
    .innerJoin(
      messages,
      and(
        eq(messages.channelId, channels.id),
        gt(messages.createdAt, since),
        isNull(messages.deletedAt),
      ),
    )
    .where(
      and(eq(spaces.visibility, "public"), isNull(spaces.archivedAt), eq(spaces.kind, "community")),
    )
    .groupBy(spaces.id)
    .orderBy(desc(count(messages.id)))
    .limit(1);
  return row?.id ?? null;
}

export async function addSpaceMember(
  db: Db,
  spaceId: string,
  profileId: string,
  role: "owner" | "admin" | "member" = "member",
) {
  await db.insert(spaceMembers).values({ spaceId, profileId, role }).onConflictDoNothing();
}

export async function removeSpaceMember(db: Db, spaceId: string, profileId: string) {
  await db
    .delete(spaceMembers)
    .where(and(eq(spaceMembers.spaceId, spaceId), eq(spaceMembers.profileId, profileId)));
}

export async function listSpaceMembers(
  db: Db,
  spaceId: string,
  cursor: string | undefined,
  limit: number,
) {
  // Les figurants du seed comptent dans le nombre de membres, jamais dans la liste.
  const visible = and(eq(spaceMembers.spaceId, spaceId), eq(profiles.isFiller, false));
  const condition = cursor ? and(visible, gt(spaceMembers.joinedAt, new Date(cursor))) : visible;
  const rows = await db
    .select({ profile: profiles, role: spaceMembers.role, joinedAt: spaceMembers.joinedAt })
    .from(spaceMembers)
    .innerJoin(profiles, eq(profiles.id, spaceMembers.profileId))
    .where(condition)
    .orderBy(asc(spaceMembers.joinedAt))
    .limit(limit + 1);
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items.at(-1);
  return { items, nextCursor: hasMore && last ? last.joinedAt.toISOString() : null };
}

export async function countSpaceMembers(db: Db, spaceId: string) {
  const [row] = await db
    .select({ value: count() })
    .from(spaceMembers)
    .where(eq(spaceMembers.spaceId, spaceId));
  return row?.value ?? 0;
}

// Pour l'affichage d'un nombre de membres sur une liste d'espaces : une
// requête groupée plutôt qu'un countSpaceMembers par espace.
export async function countSpaceMembersBatch(
  db: Db,
  spaceIds: string[],
): Promise<Map<string, number>> {
  if (spaceIds.length === 0) return new Map();
  const rows = await db
    .select({ spaceId: spaceMembers.spaceId, value: count() })
    .from(spaceMembers)
    .where(inArray(spaceMembers.spaceId, spaceIds))
    .groupBy(spaceMembers.spaceId);
  return new Map(rows.map((row) => [row.spaceId, row.value]));
}

// Même règle que countUnreadMessages : un message est non lu s'il est plus
// récent que la dernière lecture du salon, ou que l'arrivée dans l'espace.
export async function findSpacesWithUnread(
  db: Db,
  profileId: string,
  spaceIds: string[],
): Promise<Set<string>> {
  if (spaceIds.length === 0) return new Set();
  const rows = await db
    .selectDistinct({ spaceId: spaceMembers.spaceId })
    .from(messages)
    .innerJoin(channels, eq(channels.id, messages.channelId))
    .innerJoin(
      spaceMembers,
      and(eq(spaceMembers.spaceId, channels.spaceId), eq(spaceMembers.profileId, profileId)),
    )
    .leftJoin(
      readStates,
      and(eq(readStates.channelId, channels.id), eq(readStates.profileId, profileId)),
    )
    .where(
      and(
        inArray(channels.spaceId, spaceIds),
        gt(messages.createdAt, sql`coalesce(${readStates.lastReadAt}, ${spaceMembers.joinedAt})`),
      ),
    );
  return new Set(rows.map((row) => row.spaceId));
}

export async function listChannelsBySpace(db: Db, spaceId: string) {
  return db
    .select()
    .from(channels)
    .where(eq(channels.spaceId, spaceId))
    .orderBy(asc(channels.displayOrder));
}

export async function findChannelById(db: Db, channelId: string) {
  const [channel] = await db.select().from(channels).where(eq(channels.id, channelId));
  return channel ?? null;
}

export async function createChannel(
  db: Db,
  spaceId: string,
  name: string,
  slug: string,
  displayOrder: number,
) {
  const [channel] = await db
    .insert(channels)
    .values({ spaceId, name, slug, displayOrder })
    .returning();
  return channel!;
}

export async function renameChannel(db: Db, channelId: string, name: string) {
  const [channel] = await db
    .update(channels)
    .set({ name })
    .where(eq(channels.id, channelId))
    .returning();
  return channel!;
}

export async function getReadState(db: Db, channelId: string, profileId: string) {
  const [state] = await db
    .select()
    .from(readStates)
    .where(and(eq(readStates.channelId, channelId), eq(readStates.profileId, profileId)));
  return state ?? null;
}

export async function countUnreadMessages(
  db: Db,
  channelId: string,
  profileId: string,
  sinceFallback: Date,
) {
  const state = await getReadState(db, channelId, profileId);
  const since = state?.lastReadAt ?? sinceFallback;
  const rows = await db
    .select({ id: messages.id })
    .from(messages)
    .where(and(eq(messages.channelId, channelId), gt(messages.createdAt, since)));
  return rows.length;
}

export async function markChannelRead(
  db: Db,
  channelId: string,
  profileId: string,
  messageId: string,
) {
  await db
    .insert(readStates)
    .values({ channelId, profileId, lastReadMessageId: messageId, lastReadAt: new Date() })
    .onConflictDoUpdate({
      target: [readStates.channelId, readStates.profileId],
      set: { lastReadMessageId: messageId, lastReadAt: new Date() },
    });
}

export async function insertMessage(
  db: DbOrTx,
  input: {
    channelId: string;
    authorId: string;
    clientId: string;
    body: string;
    parentMessageId: string | null;
  },
) {
  const [inserted] = await db
    .insert(messages)
    .values(input)
    .onConflictDoNothing({ target: [messages.authorId, messages.clientId] })
    .returning();
  if (inserted) return { message: inserted, created: true as const };
  const [existing] = await db
    .select()
    .from(messages)
    .where(and(eq(messages.authorId, input.authorId), eq(messages.clientId, input.clientId)));
  return { message: existing!, created: false as const };
}

export async function findMessageById(db: Db, messageId: string) {
  const [message] = await db.select().from(messages).where(eq(messages.id, messageId));
  return message ?? null;
}

export async function editMessage(db: Db, messageId: string, body: string) {
  const [message] = await db
    .update(messages)
    .set({ body, editedAt: new Date() })
    .where(eq(messages.id, messageId))
    .returning();
  return message!;
}

export async function softDeleteMessage(db: Db, messageId: string) {
  const [message] = await db
    .update(messages)
    .set({ deletedAt: new Date() })
    .where(eq(messages.id, messageId))
    .returning();
  return message!;
}

/**
 * Du plus récent au plus ancien. Le curseur est un identifiant de message,
 * comparé sur (created_at, id) : une date seule, arrondie à la milliseconde
 * en JavaScript, faisait sauter des messages en bord de page.
 */
export async function listChannelMessages(
  db: Db,
  channelId: string,
  cursor: string | undefined,
  limit: number,
) {
  const topLevelInChannel = and(
    eq(messages.channelId, channelId),
    isNull(messages.parentMessageId),
  );
  const condition = cursor
    ? and(
        topLevelInChannel,
        sql`(${messages.createdAt}, ${messages.id}) < (select c.created_at, c.id from messages c where c.id = ${cursor} and c.channel_id = ${channelId})`,
      )
    : topLevelInChannel;
  const rows = await db
    .select()
    .from(messages)
    .where(condition)
    .orderBy(desc(messages.createdAt), desc(messages.id))
    .limit(limit + 1);
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return { items, nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null };
}

/**
 * Premier message non lu, avec la même règle que le compteur de non-lus
 * (countUnreadMessages) : postérieur à la dernière lecture, ou à l'arrivée
 * dans l'espace pour un salon jamais ouvert.
 */
export async function findFirstUnreadMessageId(
  db: Db,
  channelId: string,
  profileId: string,
  joinedAt: Date,
) {
  const state = await getReadState(db, channelId, profileId);
  const since = state?.lastReadAt ?? joinedAt;
  const [row] = await db
    .select({ id: messages.id })
    .from(messages)
    .where(
      and(
        eq(messages.channelId, channelId),
        isNull(messages.parentMessageId),
        gt(messages.createdAt, since),
      ),
    )
    .orderBy(asc(messages.createdAt), asc(messages.id))
    .limit(1);
  return row?.id ?? null;
}

export async function listThreadReplies(
  db: Db,
  parentMessageId: string,
  cursor: string | undefined,
  limit: number,
) {
  const rows = await db
    .select()
    .from(messages)
    .where(
      cursor
        ? and(
            eq(messages.parentMessageId, parentMessageId),
            gt(messages.createdAt, new Date(cursor)),
          )
        : eq(messages.parentMessageId, parentMessageId),
    )
    .orderBy(asc(messages.createdAt))
    .limit(limit + 1);
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items.at(-1);
  return { items, nextCursor: hasMore && last ? last.createdAt.toISOString() : null };
}

export async function countReplies(db: Db, parentMessageId: string) {
  const rows = await db
    .select({ id: messages.id })
    .from(messages)
    .where(eq(messages.parentMessageId, parentMessageId));
  return rows.length;
}

export async function insertMentions(db: DbOrTx, messageId: string, profileIds: string[]) {
  if (profileIds.length === 0) return;
  await db
    .insert(messageMentions)
    .values(profileIds.map((profileId) => ({ messageId, profileId })))
    .onConflictDoNothing();
}

export async function listMentionedHandles(db: Db, messageId: string) {
  const rows = await db
    .select({ handle: profiles.handle })
    .from(messageMentions)
    .innerJoin(profiles, eq(profiles.id, messageMentions.profileId))
    .where(eq(messageMentions.messageId, messageId));
  return rows.map((row) => row.handle);
}

export async function resolveMentionableProfiles(db: DbOrTx, spaceId: string, handles: string[]) {
  if (handles.length === 0) return [];
  const rows = await db
    .select({ id: profiles.id, handle: profiles.handle })
    .from(spaceMembers)
    .innerJoin(profiles, eq(profiles.id, spaceMembers.profileId))
    .where(
      and(
        eq(spaceMembers.spaceId, spaceId),
        inArray(profiles.handle, handles),
        eq(profiles.isFiller, false),
      ),
    );
  return rows;
}

export async function getMessageReactions(db: Db, messageId: string) {
  const rows = await db
    .select()
    .from(messageReactions)
    .where(eq(messageReactions.messageId, messageId));
  const byEmoji = new Map<string, string[]>();
  for (const row of rows) {
    const entry = byEmoji.get(row.emoji) ?? [];
    entry.push(row.profileId);
    byEmoji.set(row.emoji, entry);
  }
  return Array.from(byEmoji.entries()).map(([emoji, profileIds]) => ({ emoji, profileIds }));
}

export async function toggleReaction(db: Db, messageId: string, profileId: string, emoji: string) {
  const [existing] = await db
    .select()
    .from(messageReactions)
    .where(
      and(
        eq(messageReactions.messageId, messageId),
        eq(messageReactions.profileId, profileId),
        eq(messageReactions.emoji, emoji),
      ),
    );
  if (existing) {
    await db.delete(messageReactions).where(eq(messageReactions.id, existing.id));
  } else {
    await db.insert(messageReactions).values({ messageId, profileId, emoji }).onConflictDoNothing();
  }
  return getMessageReactions(db, messageId);
}

export async function createInvite(
  db: Db,
  input: { spaceId: string; createdBy: string; maxUses: number | null; expiresInDays: number },
) {
  const expiresAt = new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000);
  const [invite] = await db
    .insert(spaceInvites)
    .values({
      spaceId: input.spaceId,
      code: generateInviteCode(),
      createdBy: input.createdBy,
      maxUses: input.maxUses,
      expiresAt,
    })
    .returning();
  return invite!;
}

export async function listSpaceInvites(db: Db, spaceId: string) {
  return db
    .select({ invite: spaceInvites, createdByHandle: profiles.handle })
    .from(spaceInvites)
    .innerJoin(profiles, eq(profiles.id, spaceInvites.createdBy))
    .where(eq(spaceInvites.spaceId, spaceId))
    .orderBy(desc(spaceInvites.createdAt));
}

export async function findInviteById(db: Db, inviteId: string) {
  const [invite] = await db.select().from(spaceInvites).where(eq(spaceInvites.id, inviteId));
  return invite ?? null;
}

export async function revokeInvite(db: Db, inviteId: string) {
  await db.update(spaceInvites).set({ revokedAt: new Date() }).where(eq(spaceInvites.id, inviteId));
}

export async function findInviteByCode(db: Db, code: string) {
  const [invite] = await db.select().from(spaceInvites).where(eq(spaceInvites.code, code));
  return invite ?? null;
}

export type InviteRedemptionResult =
  { status: "ok"; spaceId: string } | { status: "not_found" | "expired" | "revoked" | "exhausted" };

export async function findProfileById(db: Db, profileId: string) {
  const [profile] = await db.select().from(profiles).where(eq(profiles.id, profileId));
  return profile ?? null;
}

export async function hydrateMessage(db: Db, row: typeof messages.$inferSelect) {
  const [author, mentionedHandles, reactions, replyCount, attachments] = await Promise.all([
    findProfileById(db, row.authorId),
    listMentionedHandles(db, row.id),
    getMessageReactions(db, row.id),
    countReplies(db, row.id),
    listAttachmentsForMessages(db, [row.id]),
  ]);
  return { row, author: author!, mentionedHandles, reactions, replyCount, attachments };
}

export async function redeemInvite(
  db: Db,
  code: string,
  profileId: string,
): Promise<InviteRedemptionResult> {
  return db.transaction(async (tx) => {
    // Un seul UPDATE conditionnel : le verrou de ligne sérialise les essais
    // concurrents. Un SELECT puis UPDATE pourrait dépasser max_uses.
    const [updated] = await tx
      .update(spaceInvites)
      .set({ useCount: sql`${spaceInvites.useCount} + 1` })
      .where(
        and(
          eq(spaceInvites.code, code),
          isNull(spaceInvites.revokedAt),
          gt(spaceInvites.expiresAt, new Date()),
          or(isNull(spaceInvites.maxUses), lt(spaceInvites.useCount, spaceInvites.maxUses)),
          sql`not exists (select 1 from ${spaces} where ${spaces.id} = ${spaceInvites.spaceId} and ${spaces.archivedAt} is not null)`,
        ),
      )
      .returning();

    if (!updated) {
      const [invite] = await tx.select().from(spaceInvites).where(eq(spaceInvites.code, code));
      if (!invite) return { status: "not_found" };
      if (invite.revokedAt) return { status: "revoked" };
      if (invite.expiresAt.getTime() < Date.now()) return { status: "expired" };
      return { status: "exhausted" };
    }

    await tx
      .insert(spaceMembers)
      .values({ spaceId: updated.spaceId, profileId, role: "member" })
      .onConflictDoNothing();
    return { status: "ok", spaceId: updated.spaceId };
  });
}
