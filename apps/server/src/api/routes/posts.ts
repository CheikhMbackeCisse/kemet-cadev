import type { FastifyInstance } from "fastify";
import {
  createPostFeedbackSchema,
  createPostReplySchema,
  createPostSchema,
  editPostSchema,
  feedQuerySchema,
  markPostReplySolutionSchema,
  paginationQuerySchema,
  sharePostSchema,
} from "@kemet/shared";
import type { posts } from "@kemet/db";
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
  listPostFeedback,
  listPostReplies,
  listPourToiFeed,
  setPostReplySolution,
  softDeletePost,
  softDeletePostReply,
  togglePostReaction,
} from "../repositories/posts.js";
import { attachToPost, findPendingPostAttachment, listAttachmentsForPosts } from "../repositories/post-attachments.js";
import { findProfileByUserId } from "../repositories/profiles.js";
import {
  awardPoints,
  computeLevels,
  computeProfilePoints,
  POINTS_POST_FEEDBACK_GIVEN,
  POINTS_POST_REPLY_SOLUTION,
} from "../repositories/points.js";
import { serializePostFeedbackEntry, serializePostReply, serializePostSummary } from "../post-serializers.js";
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
async function toSerializedPosts(db: ChatAppDeps["db"], rows: (typeof posts.$inferSelect)[], viewerProfileId: string | null) {
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

async function toSerializedPost(db: ChatAppDeps["db"], row: typeof posts.$inferSelect, viewerProfileId: string | null) {
  const [post] = await toSerializedPosts(db, [row], viewerProfileId);
  return post!;
}

export function registerPostRoutes(app: FastifyInstance, { db, auth, antiSpamConfig }: ChatAppDeps): void {
  app.get<{ Querystring: { tab?: string; cursor?: string; limit?: string } }>("/api/posts", async (request) => {
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
  });

  app.post(
    "/api/posts",
    { config: { rateLimit: { max: antiSpamMax(db, auth, antiSpamConfig, MAX_POSTS_PER_MINUTE), timeWindow: "1 minute" } } },
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
        if (attachments.length === 0) throw badRequest("Un post doit contenir du texte ou au moins une image.");
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
    { config: { rateLimit: { max: antiSpamMax(db, auth, antiSpamConfig, MAX_SHARES_PER_MINUTE), timeWindow: "1 minute" } } },
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

  app.get<{ Params: { id: string }; Querystring: { cursor?: string; limit?: string } }>(
    "/api/posts/:id/replies",
    async (request) => {
      // Aucune résolution de profil nécessaire, visiteur ou non : les
      // réponses à un post n'ont pas de notion de visibilité privée dans ce
      // module, à la différence des salons.
      const post = await findPostById(db, request.params.id);
      if (!post) throw notFound("Ce post n'existe pas.");
      const query = paginationQuerySchema.parse(request.query);
      const page = await listPostReplies(db, post.id, query.cursor, query.limit);
      const levels = await computeLevels(db, page.items.map((row) => row.authorId));
      const items = await Promise.all(
        page.items.map(async (row) => {
          const { author } = await hydratePostReply(db, row);
          return serializePostReply(row, author, levels.get(row.authorId)!);
        }),
      );
      return { items, nextCursor: page.nextCursor };
    },
  );

  app.post<{ Params: { id: string } }>(
    "/api/posts/:id/replies",
    { config: { rateLimit: { max: antiSpamMax(db, auth, antiSpamConfig, MAX_REPLIES_PER_MINUTE), timeWindow: "1 minute" } } },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await requireOwnProfile(db, userId);
      const post = await findPostById(db, request.params.id);
      if (!post || post.deletedAt) throw notFound("Ce post n'existe pas.");
      const input = createPostReplySchema.parse(request.body);
      const reply = await insertPostReply(db, { postId: post.id, authorId: profile.id, body: input.body });
      const { level } = await computeProfilePoints(db, profile.id);
      return { reply: serializePostReply(reply, profile, level) };
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
      if (reply.authorId !== profile.id) throw forbidden("Seul l'auteur peut supprimer cette réponse.");
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
      if (input.isSolution) {
        await awardPoints(db, {
          profileId: updated.authorId,
          source: "post_reply_solution",
          sourceId: updated.id,
          amount: POINTS_POST_REPLY_SOLUTION,
          givenByProfileId: profile.id,
        });
      }
      const { author } = await hydratePostReply(db, updated);
      const { level } = await computeProfilePoints(db, author.id);
      return { reply: serializePostReply(updated, author, level) };
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
      const feedback = await insertPostFeedback(db, { postId: post.id, authorId: profile.id, body: input.body });
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
    const levels = await computeLevels(db, rows.map((row) => row.author.id));
    return { items: rows.map((row) => serializePostFeedbackEntry(row.feedback, row.author, levels.get(row.author.id)!)) };
  });
}
