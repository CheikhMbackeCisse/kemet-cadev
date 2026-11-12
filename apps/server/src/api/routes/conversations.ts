import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  conversationListQuerySchema,
  createConversationSchema,
  createTeamConversationSchema,
  MAX_CONVERSATION_MEMBERS,
  type ConversationMemberStatus,
} from "@kemet/shared";
import { requireSessionUserId } from "../../auth/session.js";
import { badRequest, conflict, forbidden, notFound } from "../../errors.js";
import { antiSpamMax } from "../../moderation/anti-spam.js";
import { findWriteBlock } from "../../messaging/write-block.js";
import { publishConversationActivity } from "../../messaging/activity.js";
import {
  blockProfile,
  countConversationUnreadSummary,
  countUnreadByChannel,
  directKeyFor,
  findConversationByDirectKey,
  findConversationById,
  findConversationChannel,
  findConversationMember,
  findConversationRowForViewer,
  findTeamConversation,
  hasBlocked,
  insertConversation,
  isBlockedEitherWay,
  listBlockedProfiles,
  knowsSender,
  listConversationMembers,
  listConversationsForViewer,
  setConversationMemberStatus,
  unblockProfile,
  type ConversationListRow,
} from "../repositories/conversations.js";
import { findProfileByHandle, findProfileByUserId } from "../repositories/profiles.js";
import { findWorkBySlug, listWorkAccountAuthorIds } from "../repositories/works.js";
import { computeLevels } from "../repositories/points.js";
import { serializeConversation } from "../conversation-serializers.js";
import { serializeProfileSummary } from "../serializers.js";
import type { ChatAppDeps } from "../app.js";

const MAX_CONVERSATIONS_PER_MINUTE = 10;

// Un identifiant mal formé donnerait une erreur de PostgreSQL : 400 plutôt que 500.
const conversationIdSchema = z.string().uuid();

async function requireViewer(db: ChatAppDeps["db"], userId: string) {
  const profile = await findProfileByUserId(db, userId);
  if (!profile) throw badRequest("Complétez votre profil avant d'utiliser la messagerie.");
  return profile;
}

async function requireWriter(db: ChatAppDeps["db"], userId: string) {
  const profile = await requireViewer(db, userId);
  if (profile.suspendedAt) throw forbidden("Ce compte est suspendu.");
  return profile;
}

/** Membre encore présent, ou 404 : une conversation quittée n'existe plus pour soi. */
async function requireMembership(db: ChatAppDeps["db"], conversationId: string, profileId: string) {
  const member = await findConversationMember(db, conversationId, profileId);
  if (!member || member.status === "left") throw notFound("Cette conversation n'existe pas.");
  return member;
}

async function serializeRows(db: ChatAppDeps["db"], viewerId: string, rows: ConversationListRow[]) {
  const members = await listConversationMembers(
    db,
    rows.map((row) => row.id),
  );
  const levels = await computeLevels(db, [...new Set(members.map((entry) => entry.profile.id))]);
  const unread = await countUnreadByChannel(
    db,
    viewerId,
    rows.map((row) => ({ channelId: row.channelId, joinedAt: row.joinedAt })),
  );
  return rows.map((row) =>
    serializeConversation(
      row,
      members.filter((entry) => entry.member.conversationId === row.id),
      levels,
      viewerId,
      unread.get(row.channelId) ?? 0,
    ),
  );
}

async function serializeDetail(db: ChatAppDeps["db"], viewerId: string, conversationId: string) {
  const row = await findConversationRowForViewer(db, viewerId, conversationId);
  if (!row) throw notFound("Cette conversation n'existe pas.");
  const [summary] = await serializeRows(db, viewerId, [row]);
  const conversation = await findConversationById(db, conversationId);
  const member = await findConversationMember(db, conversationId, viewerId);
  const writeBlock = await findWriteBlock(db, conversation!, member!, row.channelId);
  const other = summary!.participants[0];
  const blockedByViewer = !summary!.isGroup && other ? await hasBlocked(db, viewerId, other.profileId) : false;
  return { ...summary!, writeBlock, blockedByViewer };
}

export function registerConversationRoutes(app: FastifyInstance, { db, auth, chat, antiSpamConfig }: ChatAppDeps): void {
  app.get("/api/conversations", async (request) => {
    const userId = await requireSessionUserId(auth, request);
    const viewer = await requireViewer(db, userId);
    const query = conversationListQuerySchema.parse(request.query);
    const page = await listConversationsForViewer(db, viewer.id, query.box, query.cursor, query.limit);
    return { items: await serializeRows(db, viewer.id, page.items), nextCursor: page.nextCursor };
  });

  app.get("/api/conversations/unread", async (request) => {
    const userId = await requireSessionUserId(auth, request);
    const viewer = await requireViewer(db, userId);
    return countConversationUnreadSummary(db, viewer.id);
  });

  app.post(
    "/api/conversations",
    {
      config: {
        rateLimit: { max: antiSpamMax(db, auth, antiSpamConfig, MAX_CONVERSATIONS_PER_MINUTE), timeWindow: "1 minute" },
      },
    },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const viewer = await requireWriter(db, userId);
      const input = createConversationSchema.parse(request.body);

      const recipients = [];
      for (const handle of input.handles) {
        const recipient = await findProfileByHandle(db, handle);
        if (!recipient) throw notFound(`Le profil @${handle} n'existe pas.`);
        if (recipient.id === viewer.id) throw badRequest("Vous ne pouvez pas vous écrire à vous-même.");
        // Profil sans compte de connexion (organisation du seed) : personne ne lirait la demande.
        if (recipient.userId === null) throw forbidden(`@${handle} ne reçoit pas de messages.`);
        if (await isBlockedEitherWay(db, viewer.id, recipient.id)) {
          throw forbidden(`Vous ne pouvez pas écrire à @${handle}.`);
        }
        recipients.push(recipient);
      }

      const isGroup = recipients.length > 1;
      if (isGroup) {
        // Un groupe ne passe pas par les demandes : sinon un complice qui a
        // accepté lèverait la limite d'un message pour tous les autres.
        for (const recipient of recipients) {
          if (!(await knowsSender(db, recipient.id, viewer.id))) {
            throw forbidden(
              `@${recipient.handle} ne vous connaît pas encore : écrivez-lui d'abord seul à seul.`,
            );
          }
        }
        for (const [index, first] of recipients.entries()) {
          for (const second of recipients.slice(index + 1)) {
            if (await isBlockedEitherWay(db, first.id, second.id)) {
              throw forbidden(`@${first.handle} et @${second.handle} ne peuvent pas être dans le même groupe.`);
            }
          }
        }
      }

      const directKey = isGroup ? null : directKeyFor(viewer.id, recipients[0]!.id);
      if (directKey) {
        const existing = await findConversationByDirectKey(db, directKey);
        if (existing) {
          // Écrire à quelqu'un dont on avait refusé ou quitté la conversation la rouvre.
          const member = await findConversationMember(db, existing.id, viewer.id);
          if (member?.status === "left") await setConversationMemberStatus(db, existing.id, viewer.id, "accepted");
          return { conversation: await serializeDetail(db, viewer.id, existing.id) };
        }
      }

      const members: { profileId: string; status: ConversationMemberStatus }[] = [
        { profileId: viewer.id, status: "accepted" },
      ];
      for (const recipient of recipients) {
        const known = await knowsSender(db, recipient.id, viewer.id);
        members.push({ profileId: recipient.id, status: known ? "accepted" : "pending" });
      }
      const created = await db.transaction((tx) => insertConversation(tx, { createdBy: viewer.id, directKey, members }));
      // Création concurrente de la même conversation à deux : on rend celle qui a gagné.
      const conversationId = created?.id ?? (await findConversationByDirectKey(db, directKey!))!.id;
      return { conversation: await serializeDetail(db, viewer.id, conversationId) };
    },
  );

  // Exception à la règle des groupes : les membres sont fixés par le travail
  // (la personne qui écrit et ses auteurs), aucun complice ne peut y faire
  // entrer un inconnu. Chaque auteur le reçoit dans ses demandes, même s'il
  // connaît la personne : un auteur accepté d'office lèverait sinon la limite
  // d'un message pour tous les autres.
  app.post(
    "/api/conversations/team",
    {
      config: {
        rateLimit: { max: antiSpamMax(db, auth, antiSpamConfig, MAX_CONVERSATIONS_PER_MINUTE), timeWindow: "1 minute" },
      },
    },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const viewer = await requireWriter(db, userId);
      const input = createTeamConversationSchema.parse(request.body);
      const work = await findWorkBySlug(db, input.workSlug);
      if (!work || work.deletedAt) throw notFound("Ce travail n'existe pas.");

      const existing = await findTeamConversation(db, work.id, viewer.id);
      if (existing) {
        const member = await findConversationMember(db, existing.id, viewer.id);
        if (member?.status === "left") await setConversationMemberStatus(db, existing.id, viewer.id, "accepted");
        return { conversation: await serializeDetail(db, viewer.id, existing.id) };
      }

      const authorIds = (await listWorkAccountAuthorIds(db, work)).filter((id) => id !== viewer.id);
      if (authorIds.length === 0) throw badRequest("Ce travail n'a pas d'autre auteur à qui écrire.");
      if (authorIds.length + 1 > MAX_CONVERSATION_MEMBERS) {
        throw badRequest("Cette équipe est trop grande pour une conversation privée : écrivez dans la discussion.");
      }
      // Un blocage entre deux auteurs ne regarde pas le lecteur : le lui
      // opposer révélerait un blocage entre des tiers.
      for (const authorId of authorIds) {
        if (await isBlockedEitherWay(db, viewer.id, authorId)) {
          throw forbidden("Vous ne pouvez pas écrire en privé à l'équipe de ce travail.");
        }
      }

      const members: { profileId: string; status: ConversationMemberStatus }[] = [
        { profileId: viewer.id, status: "accepted" },
        ...authorIds.map((profileId) => ({ profileId, status: "pending" as const })),
      ];
      const created = await db.transaction((tx) =>
        insertConversation(tx, { createdBy: viewer.id, directKey: null, workId: work.id, members }),
      );
      const conversationId = created?.id ?? (await findTeamConversation(db, work.id, viewer.id))!.id;
      return { conversation: await serializeDetail(db, viewer.id, conversationId) };
    },
  );

  app.get<{ Params: { id: string } }>("/api/conversations/:id", async (request) => {
    const userId = await requireSessionUserId(auth, request);
    const viewer = await requireViewer(db, userId);
    const conversationId = conversationIdSchema.parse(request.params.id);
    await requireMembership(db, conversationId, viewer.id);
    return { conversation: await serializeDetail(db, viewer.id, conversationId) };
  });

  app.post<{ Params: { id: string } }>(
    "/api/conversations/:id/accept",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const viewer = await requireWriter(db, userId);
      const conversationId = conversationIdSchema.parse(request.params.id);
      const member = await requireMembership(db, conversationId, viewer.id);
      if (member.status === "accepted") throw conflict("Cette conversation est déjà acceptée.");
      await setConversationMemberStatus(db, conversationId, viewer.id, "accepted");
      await publishConversationActivity(db, chat, conversationId);
      return { conversation: await serializeDetail(db, viewer.id, conversationId) };
    },
  );

  // Refuser une demande et quitter une conversation : la personne n'y a plus accès.
  app.post<{ Params: { id: string } }>(
    "/api/conversations/:id/leave",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const viewer = await requireViewer(db, userId);
      const conversationId = conversationIdSchema.parse(request.params.id);
      await requireMembership(db, conversationId, viewer.id);
      // Les autres sont prévenus avant le départ : la liste des destinataires
      // exclut déjà les membres partis.
      await publishConversationActivity(db, chat, conversationId);
      await setConversationMemberStatus(db, conversationId, viewer.id, "left");
      const channel = await findConversationChannel(db, conversationId);
      await chat.publish({ type: "conversation:member-left", channelId: channel.id, profileId: viewer.id });
      return { left: true };
    },
  );

  app.get("/api/me/blocks", async (request) => {
    const userId = await requireSessionUserId(auth, request);
    const viewer = await requireViewer(db, userId);
    const rows = await listBlockedProfiles(db, viewer.id);
    return { items: rows.map((row) => serializeProfileSummary(row.profile)) };
  });

  app.get<{ Params: { handle: string } }>("/api/users/:handle/block", async (request) => {
    const userId = await requireSessionUserId(auth, request);
    const viewer = await requireViewer(db, userId);
    const target = await findProfileByHandle(db, request.params.handle);
    if (!target) throw notFound("Ce profil n'existe pas.");
    return { blocked: await hasBlocked(db, viewer.id, target.id) };
  });

  app.put<{ Params: { handle: string } }>(
    "/api/users/:handle/block",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const viewer = await requireViewer(db, userId);
      const target = await findProfileByHandle(db, request.params.handle);
      if (!target) throw notFound("Ce profil n'existe pas.");
      if (target.id === viewer.id) throw badRequest("Vous ne pouvez pas vous bloquer vous-même.");
      await blockProfile(db, viewer.id, target.id);
      // Une demande en attente de cette personne disparaît avec le blocage.
      const direct = await findConversationByDirectKey(db, directKeyFor(viewer.id, target.id));
      if (direct) {
        const member = await findConversationMember(db, direct.id, viewer.id);
        if (member?.status === "pending") {
          await setConversationMemberStatus(db, direct.id, viewer.id, "left");
          const channel = await findConversationChannel(db, direct.id);
          await chat.publish({ type: "conversation:member-left", channelId: channel.id, profileId: viewer.id });
        }
        await publishConversationActivity(db, chat, direct.id);
      }
      return { blocked: true };
    },
  );

  app.delete<{ Params: { handle: string } }>(
    "/api/users/:handle/block",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const viewer = await requireViewer(db, userId);
      const target = await findProfileByHandle(db, request.params.handle);
      if (!target) throw notFound("Ce profil n'existe pas.");
      await unblockProfile(db, viewer.id, target.id);
      return { blocked: false };
    },
  );
}
