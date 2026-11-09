import type { FastifyInstance } from "fastify";
import {
  createPostFeedbackSchema,
  createPostReplySchema,
  createPostSchema,
  editPostSchema,
  feedQuerySchema,
  markPostReplySolutionSchema,
  paginationQuerySchema,
  postBookmarkInputSchema,
  sharePostSchema,
} from "@kemet/shared";
import { z } from "zod";
import type { postReplies, posts } from "@kemet/db";
import { KEMET_ASSISTANT_PROFILE_ID, mentionsAssistant } from "../../chat/kemet-assistant.js";
import {
  findInvocationById,
  listInvocationsByResponseReplyIds,
} from "../repositories/assistant.js";
import { describeInvocation, loadReplyAssistantDetails } from "../post-reply-assistant.js";
import { getSessionUserId, requireSessionUserId } from "../../auth/session.js";
import { badRequest, conflict, forbidden, notFound } from "../../errors.js";
import {
  editPost,
  findPostById,
  findPostReplyById,
  hasProfileGivenFeedback,
  hydratePost,
  hydratePostReply,
  insertPost,
  insertPostFeedback,
  insertPostReply,
  listAbonnementsFeed,
  listBookmarkedPosts,
  listPostFeedback,
  listPostReplies,
  listPourToiFeed,
  setPostBookmark,
  setPostReplySolution,
  softDeletePost,
  softDeletePostReply,
  togglePostReaction,
} from "../repositories/posts.js";
import {
  attachToPost,
  findPendingPostAttachment,
  listAttachmentsForPosts,
} from "../repositories/post-attachments.js";
import { findProfileByUserId } from "../repositories/profiles.js";
import {
  awardPoints,
  computeLevels,
  computeProfilePoints,
  POINTS_POST_FEEDBACK_GIVEN,
  POINTS_POST_REPLY_SOLUTION,
} from "../repositories/points.js";
import {
  serializePostFeedbackEntry,
  serializePostReply,
  serializePostSummary,
} from "../post-serializers.js";
import type { ChatAppDeps } from "../app.js";
import { antiSpamMax } from "../../moderation/anti-spam.js";

const MAX_POSTS_PER_MINUTE = 20;
const MAX_SHARES_PER_MINUTE = 20;
const MAX_REPLIES_PER_MINUTE = 30;

async function requireOwnProfile(db: ChatAppDeps["db"], userId: string) {
  const profile = await findProfileByUserId(db, userId);
  if (!profile) throw badRequest("Complétez votre profil avant de publier dans le fil.");
  if (profile.suspendedAt) throw forbidden("Ce compte est suspendu.");
  return profile;
}

// `null` pour un visiteur : seule la lecture du fil "Pour toi" lui est ouverte.
async function findOwnProfile(db: ChatAppDeps["db"], userId: string | null) {
  return userId ? findProfileByUserId(db, userId) : null;
}

// Niveaux calculés une fois pour toute la page : deux requêtes au lieu de deux par post.
async function toSerializedPosts(
  db: ChatAppDeps["db"],
  rows: (typeof posts.$inferSelect)[],
  viewerProfileId: string | null,
) {
  const hydratedPosts = await Promise.all(rows.map((row) => hydratePost(db, row, viewerProfileId)));
  const authorIds = hydratedPosts.flatMap((hydrated) => [
    hydrated.author.id,
    ...(hydrated.sharedAuthor ? [hydrated.sharedAuthor.id] : []),
  ]);
  const levels = await computeLevels(db, [...new Set(authorIds)]);
  return hydratedPosts.map((hydrated) =>
    serializePostSummary(
      hydrated.row,
      hydrated.author,
      levels.get(hydrated.author.id)!,
      {
        utileCount: hydrated.utileCount,
        reactedByMe: hydrated.reactedByMe,
        savedByMe: hydrated.savedByMe,
        replyCount: hydrated.replyCount,
        feedbackCount: hydrated.feedbackCount,
      },
      hydrated.attachments,
      hydrated.sharedPost
        ? {
            row: hydrated.sharedPost,
            author: hydrated.sharedAuthor!,
            authorLevel: levels.get(hydrated.sharedAuthor!.id)!,
            attachments: hydrated.sharedAttachments,
          }
        : null,
      hydrated.work,
    ),
  );
}

async function toSerializedPost(
  db: ChatAppDeps["db"],
  row: typeof posts.$inferSelect,
  viewerProfileId: string | null,
) {
  const [post] = await toSerializedPosts(db, [row], viewerProfileId);
  return post!;
}

async function toSerializedReplies(
  db: ChatAppDeps["db"],
  rows: (typeof postReplies.$inferSelect)[],
  viewerProfileId: string | null,
) {
  const [levels, assistantDetails] = await Promise.all([
    computeLevels(db, [...new Set(rows.map((row) => row.authorId))]),
    loadReplyAssistantDetails(
      db,
      rows.map((row) => row.id),
      viewerProfileId,
    ),
  ]);
  return Promise.all(
    rows.map(async (row) => {
      const { author } = await hydratePostReply(db, row);
      return serializePostReply(
        row,
        author,
        levels.get(row.authorId)!,
        assistantDetails.get(row.id) ?? null,
      );
    }),
  );
}

const invocationIdParamsSchema = z.object({ id: z.string().uuid() });

export function registerPostRoutes(
  app: FastifyInstance,
  { db, auth, antiSpamConfig, postAssistant }: ChatAppDeps,
): void {
  app.get<{ Querystring: { tab?: string; cursor?: string; limit?: string } }>(
    "/api/posts",
    async (request) => {
      const userId = await getSessionUserId(auth, request);
      const profile = await findOwnProfile(db, userId);
      const query = feedQuerySchema.parse(request.query);
      // Un visiteur n'a pas d'abonnements : l'onglet "Pour toi" lui est servi
      // quel que soit l'onglet demandé, l'interface ne lui proposant que celui-là.
      const page =
        query.tab === "pour-toi" || !profile
          ? await listPourToiFeed(db, query.limit)
          : await listAbonnementsFeed(db, profile.id, query.cursor, query.limit);
      const items = await toSerializedPosts(db, page.items, profile?.id ?? null);
      return { items, nextCursor: page.nextCursor };
    },
  );

  app.post(
    "/api/posts",
    {
      config: {
        rateLimit: {
          max: antiSpamMax(db, auth, antiSpamConfig, MAX_POSTS_PER_MINUTE),
          timeWindow: "1 minute",
        },
      },
    },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await requireOwnProfile(db, userId);
      const input = createPostSchema.parse(request.body);
      // Transaction : une image qui n'est plus disponible annule le post.
      const post = await db.transaction(async (tx) => {
        const attachmentIds = input.attachmentIds ?? [];
        for (const attachmentId of attachmentIds) {
          const pending = await findPendingPostAttachment(tx, attachmentId, profile.id);
          if (!pending) throw badRequest("Une image envoyée n'est plus disponible pour ce post.");
        }
        const created = await insertPost(tx, {
          authorId: profile.id,
          body: input.body.trim(),
          format: input.format ?? null,
          testUrl: input.testUrl ?? null,
          testAsk: input.testAsk ?? null,
          sharedPostId: null,
        });
        await attachToPost(tx, attachmentIds, created.id);
        return created;
      });
      return { post: await toSerializedPost(db, post, profile.id) };
    },
  );

  app.get<{ Params: { id: string } }>("/api/posts/:id", async (request) => {
    const userId = await getSessionUserId(auth, request);
    const profile = await findOwnProfile(db, userId);
    const post = await findPostById(db, request.params.id);
    if (!post) throw notFound("Ce post n'existe pas.");
    return { post: await toSerializedPost(db, post, profile?.id ?? null) };
  });

  app.patch<{ Params: { id: string } }>(
    "/api/posts/:id",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await requireOwnProfile(db, userId);
      const post = await findPostById(db, request.params.id);
      if (!post || post.deletedAt) throw notFound("Ce post n'existe pas.");
      if (post.authorId !== profile.id) throw forbidden("Seul l'auteur peut modifier ce post.");
      const input = editPostSchema.parse(request.body);
      const body = input.body.trim();
      if (body.length === 0 && !post.sharedPostId) {
        const attachments = await listAttachmentsForPosts(db, [post.id]);
        if (attachments.length === 0)
          throw badRequest("Un post doit contenir du texte ou au moins une image.");
      }
      const updated = await editPost(db, post.id, body);
      return { post: await toSerializedPost(db, updated, profile.id) };
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/api/posts/:id",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await requireOwnProfile(db, userId);
      const post = await findPostById(db, request.params.id);
      if (!post || post.deletedAt) throw notFound("Ce post n'existe pas.");
      if (post.authorId !== profile.id) throw forbidden("Seul l'auteur peut supprimer ce post.");
      await softDeletePost(db, post.id);
      return { deleted: true };
    },
  );

  app.post<{ Params: { id: string } }>(
    "/api/posts/:id/share",
    {
      config: {
        rateLimit: {
          max: antiSpamMax(db, auth, antiSpamConfig, MAX_SHARES_PER_MINUTE),
          timeWindow: "1 minute",
        },
      },
    },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await requireOwnProfile(db, userId);
      const original = await findPostById(db, request.params.id);
      if (!original) throw notFound("Ce post n'existe pas.");
      const input = sharePostSchema.parse(request.body ?? {});
      const post = await insertPost(db, {
        authorId: profile.id,
        body: input.body.trim(),
        format: null,
        testUrl: null,
        testAsk: null,
        sharedPostId: original.id,
      });
      return { post: await toSerializedPost(db, post, profile.id) };
    },
  );

  app.put<{ Params: { id: string } }>(
    "/api/posts/:id/reactions",
    { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await requireOwnProfile(db, userId);
      const post = await findPostById(db, request.params.id);
      if (!post || post.deletedAt) throw notFound("Ce post n'existe pas.");
      return togglePostReaction(db, post.id, profile.id);
    },
  );

  // Un état posé plutôt qu'une bascule : deux appuis rapides ou un envoi
  // rejoué donnent le même résultat.
  app.put<{ Params: { id: string } }>(
    "/api/posts/:id/bookmark",
    { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await requireOwnProfile(db, userId);
      const input = postBookmarkInputSchema.parse(request.body);
      const post = await findPostById(db, request.params.id);
      if (!post || (post.deletedAt && input.saved)) throw notFound("Ce post n'existe pas.");
      return setPostBookmark(db, post.id, profile.id, input.saved);
    },
  );

  app.get<{ Querystring: { cursor?: string; limit?: string } }>(
    "/api/me/bookmarks",
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await findProfileByUserId(db, userId);
      if (!profile)
        throw badRequest("Complétez votre profil avant de consulter vos enregistrements.");
      const query = paginationQuerySchema.parse(request.query);
      const page = await listBookmarkedPosts(db, profile.id, query.cursor, query.limit);
      return {
        items: await toSerializedPosts(db, page.items, profile.id),
        nextCursor: page.nextCursor,
      };
    },
  );

  app.get<{ Params: { id: string }; Querystring: { cursor?: string; limit?: string } }>(
    "/api/posts/:id/replies",
    async (request) => {
      // Les réponses à un post n'ont pas de visibilité privée, à la
      // différence des salons. Le profil ne sert qu'à décider si le skill
      // cité par une réponse de @kemet est encore visible pour ce lecteur.
      const userId = await getSessionUserId(auth, request);
      const profile = await findOwnProfile(db, userId);
      const post = await findPostById(db, request.params.id);
      if (!post) throw notFound("Ce post n'existe pas.");
      const query = paginationQuerySchema.parse(request.query);
      const page = await listPostReplies(db, post.id, query.cursor, query.limit);
      const items = await toSerializedReplies(db, page.items, profile?.id ?? null);
      return { items, nextCursor: page.nextCursor };
    },
  );

  app.post<{ Params: { id: string } }>(
    "/api/posts/:id/replies",
    {
      config: {
        rateLimit: {
          max: antiSpamMax(db, auth, antiSpamConfig, MAX_REPLIES_PER_MINUTE),
          timeWindow: "1 minute",
        },
      },
    },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await requireOwnProfile(db, userId);
      const post = await findPostById(db, request.params.id);
      if (!post || post.deletedAt) throw notFound("Ce post n'existe pas.");
      const input = createPostReplySchema.parse(request.body);
      const reply = await insertPostReply(db, {
        postId: post.id,
        authorId: profile.id,
        body: input.body,
      });
      const { level } = await computeProfilePoints(db, profile.id);
      // @kemet ne répond que s'il est appelé dans la réponse elle-même,
      // jamais au post seul. Sa réponse arrive plus tard, voir la route
      // GET /api/post-assistant-invocations/:id.
      const assistant = mentionsAssistant(input.body)
        ? await postAssistant.start({
            postId: post.id,
            triggerReplyId: reply.id,
            triggerCreatedAt: reply.createdAt,
            requestedBy: profile.id,
            body: input.body,
          })
        : null;
      return { reply: serializePostReply(reply, profile, level), assistant };
    },
  );

  // Lue seulement par la personne qui a appelé @kemet : un échec ou un quota
  // atteint ne regardent qu'elle, et la réponse finale est de toute façon
  // publique dans la liste des réponses.
  // Une réponse de @kemet n'a pas d'auteur humain : la personne qui l'a
  // demandée et l'auteur du post peuvent la retirer, par exemple quand un
  // post piégé lui a fait écrire n'importe quoi.
  async function canRemoveAssistantReply(
    reply: typeof postReplies.$inferSelect,
    profileId: string,
  ) {
    if (reply.authorId !== KEMET_ASSISTANT_PROFILE_ID) return false;
    const [invocation] = await listInvocationsByResponseReplyIds(db, [reply.id]);
    if (invocation?.requestedBy === profileId) return true;
    const post = await findPostById(db, reply.postId);
    return post?.authorId === profileId;
  }

  async function findOwnPostInvocation(profileId: string, rawId: unknown) {
    const params = invocationIdParamsSchema.safeParse(rawId);
    const invocation = params.success ? await findInvocationById(db, params.data.id) : null;
    if (
      !invocation ||
      !invocation.postId ||
      !invocation.triggerReplyId ||
      invocation.requestedBy !== profileId
    ) {
      throw notFound("Cette demande à @kemet n'existe pas.");
    }
    return invocation;
  }

  // Relance sur la même question, sans republier la réponse qui l'a posée.
  app.post<{ Params: { id: string } }>(
    "/api/post-assistant-invocations/:id/retry",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await requireOwnProfile(db, userId);
      const invocation = await findOwnPostInvocation(profile.id, request.params);
      if (invocation.status !== "failed") throw conflict("Cette demande à @kemet n'a pas échoué.");
      const [post, trigger] = await Promise.all([
        findPostById(db, invocation.postId!),
        findPostReplyById(db, invocation.triggerReplyId!),
      ]);
      if (!post || post.deletedAt || !trigger || trigger.deletedAt)
        throw notFound("Cette question n'existe plus.");
      const assistant = await postAssistant.start({
        postId: post.id,
        triggerReplyId: trigger.id,
        triggerCreatedAt: trigger.createdAt,
        requestedBy: profile.id,
        body: trigger.body,
      });
      return { assistant };
    },
  );

  app.get<{ Params: { id: string } }>(
    "/api/post-assistant-invocations/:id",
    // Relue toutes les 1,5 s pendant une attente : large, mais bornée.
    { config: { rateLimit: { max: 120, timeWindow: "1 minute" } } },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await findProfileByUserId(db, userId);
      if (!profile) throw notFound("Cette demande à @kemet n'existe pas.");
      const invocation = await findOwnPostInvocation(profile.id, request.params);
      const replyRow = invocation.responseReplyId
        ? await findPostReplyById(db, invocation.responseReplyId)
        : null;
      let reply = null;
      if (replyRow) {
        const { author } = await hydratePostReply(db, replyRow);
        const { level } = await computeProfilePoints(db, author.id);
        reply = serializePostReply(
          replyRow,
          author,
          level,
          await describeInvocation(db, invocation, profile.id),
        );
      }
      return { status: invocation.status, errorCode: invocation.errorCode, reply };
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/api/post-replies/:id",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await requireOwnProfile(db, userId);
      const reply = await findPostReplyById(db, request.params.id);
      if (!reply || reply.deletedAt) throw notFound("Cette réponse n'existe pas.");
      if (reply.authorId !== profile.id && !(await canRemoveAssistantReply(reply, profile.id))) {
        throw forbidden("Seul l'auteur peut supprimer cette réponse.");
      }
      await softDeletePostReply(db, reply.id);
      return { deleted: true };
    },
  );

  app.put<{ Params: { id: string } }>(
    "/api/post-replies/:id/solution",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await requireOwnProfile(db, userId);
      const reply = await findPostReplyById(db, request.params.id);
      if (!reply || reply.deletedAt) throw notFound("Cette réponse n'existe pas.");
      const post = await findPostById(db, reply.postId);
      if (!post || post.deletedAt) throw notFound("Ce post n'existe pas.");
      if (post.authorId !== profile.id) {
        throw forbidden("Seul l'auteur du post peut marquer une réponse comme solution.");
      }
      if (post.format !== "question") {
        throw badRequest("Seuls les posts de format Question ont une réponse solution.");
      }
      const input = markPostReplySolutionSchema.parse(request.body);
      const updated = await setPostReplySolution(db, post.id, reply.id, input.isSolution);
      // Une réponse de @kemet peut être la solution, sans points : le
      // registre ne crédite jamais le profil de l'assistant.
      if (input.isSolution && updated.authorId !== KEMET_ASSISTANT_PROFILE_ID) {
        await awardPoints(db, {
          profileId: updated.authorId,
          source: "post_reply_solution",
          sourceId: updated.id,
          amount: POINTS_POST_REPLY_SOLUTION,
          givenByProfileId: profile.id,
        });
      }
      const [serialized] = await toSerializedReplies(db, [updated], profile.id);
      return { reply: serialized! };
    },
  );

  app.post<{ Params: { id: string } }>(
    "/api/posts/:id/feedback",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await requireOwnProfile(db, userId);
      const post = await findPostById(db, request.params.id);
      if (!post || post.deletedAt) throw notFound("Ce post n'existe pas.");
      if (post.format !== "a_tester") {
        throw badRequest("Seuls les posts À tester reçoivent un retour structuré.");
      }
      if (post.authorId === profile.id) {
        throw badRequest("L'auteur d'un post ne peut pas se donner son propre retour.");
      }
      if (await hasProfileGivenFeedback(db, post.id, profile.id)) {
        throw conflict("Vous avez déjà donné un retour sur ce post.");
      }
      const input = createPostFeedbackSchema.parse(request.body);
      const feedback = await insertPostFeedback(db, {
        postId: post.id,
        authorId: profile.id,
        body: input.body,
      });
      if (!feedback) throw conflict("Vous avez déjà donné un retour sur ce post.");
      await awardPoints(db, {
        profileId: profile.id,
        source: "post_feedback_given",
        sourceId: feedback.id,
        amount: POINTS_POST_FEEDBACK_GIVEN,
        givenByProfileId: null,
      });
      const { level } = await computeProfilePoints(db, profile.id);
      return { feedback: serializePostFeedbackEntry(feedback, profile, level) };
    },
  );

  app.get<{ Params: { id: string } }>("/api/posts/:id/feedback", async (request) => {
    const userId = await requireSessionUserId(auth, request);
    await requireOwnProfile(db, userId);
    const post = await findPostById(db, request.params.id);
    if (!post) throw notFound("Ce post n'existe pas.");
    const rows = await listPostFeedback(db, post.id);
    const levels = await computeLevels(
      db,
      rows.map((row) => row.author.id),
    );
    return {
      items: rows.map((row) =>
        serializePostFeedbackEntry(row.feedback, row.author, levels.get(row.author.id)!),
      ),
    };
  });
}
