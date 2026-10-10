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
import { requireSessionUserId } from "../../auth/session.js";
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
import { findProfileByUserId } from "../repositories/profiles.js";
import { awardPoints, POINTS_POST_FEEDBACK_GIVEN, POINTS_POST_REPLY_SOLUTION } from "../repositories/points.js";
import { serializePostFeedbackEntry, serializePostReply, serializePostSummary } from "../post-serializers.js";
import type { ChatAppDeps } from "../app.js";

async function requireOwnProfile(db: ChatAppDeps["db"], userId: string) {
  const profile = await findProfileByUserId(db, userId);
  if (!profile) throw badRequest("Complétez votre profil avant de publier dans le fil.");
  return profile;
}

async function toSerializedPost(db: ChatAppDeps["db"], row: typeof posts.$inferSelect, viewerProfileId: string) {
  const hydrated = await hydratePost(db, row, viewerProfileId);
  return serializePostSummary(
    hydrated.row,
    hydrated.author,
    {
      utileCount: hydrated.utileCount,
      reactedByMe: hydrated.reactedByMe,
      replyCount: hydrated.replyCount,
      feedbackCount: hydrated.feedbackCount,
    },
    hydrated.sharedPost ? { row: hydrated.sharedPost, author: hydrated.sharedAuthor! } : null,
  );
}

export function registerPostRoutes(app: FastifyInstance, { db, auth }: ChatAppDeps): void {
  app.get<{ Querystring: { tab?: string; cursor?: string; limit?: string } }>("/api/posts", async (request) => {
    const userId = await requireSessionUserId(auth, request);
    const profile = await requireOwnProfile(db, userId);
    const query = feedQuerySchema.parse(request.query);
    const page =
      query.tab === "pour-toi"
        ? await listPourToiFeed(db, query.limit)
        : await listAbonnementsFeed(db, profile.id, query.cursor, query.limit);
    const items = await Promise.all(page.items.map((row) => toSerializedPost(db, row, profile.id)));
    return { items, nextCursor: page.nextCursor };
  });

  app.post("/api/posts", { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request) => {
    const userId = await requireSessionUserId(auth, request);
    const profile = await requireOwnProfile(db, userId);
    const input = createPostSchema.parse(request.body);
    const post = await insertPost(db, {
      authorId: profile.id,
      body: input.body.trim(),
      format: input.format ?? null,
      testUrl: input.testUrl ?? null,
      testAsk: input.testAsk ?? null,
      sharedPostId: null,
    });
    return { post: await toSerializedPost(db, post, profile.id) };
  });

  app.get<{ Params: { id: string } }>("/api/posts/:id", async (request) => {
    const userId = await requireSessionUserId(auth, request);
    const profile = await requireOwnProfile(db, userId);
    const post = await findPostById(db, request.params.id);
    if (!post) throw notFound("Ce post n'existe pas.");
    return { post: await toSerializedPost(db, post, profile.id) };
  });

  app.patch<{ Params: { id: string } }>("/api/posts/:id", async (request) => {
    const userId = await requireSessionUserId(auth, request);
    const profile = await requireOwnProfile(db, userId);
    const post = await findPostById(db, request.params.id);
    if (!post || post.deletedAt) throw notFound("Ce post n'existe pas.");
    if (post.authorId !== profile.id) throw forbidden("Seul l'auteur peut modifier ce post.");
    const input = editPostSchema.parse(request.body);
    const body = input.body.trim();
    if (body.length === 0 && !post.sharedPostId) throw badRequest("Un post doit contenir du texte.");
    const updated = await editPost(db, post.id, body);
    return { post: await toSerializedPost(db, updated, profile.id) };
  });

  app.delete<{ Params: { id: string } }>("/api/posts/:id", async (request) => {
    const userId = await requireSessionUserId(auth, request);
    const profile = await requireOwnProfile(db, userId);
    const post = await findPostById(db, request.params.id);
    if (!post || post.deletedAt) throw notFound("Ce post n'existe pas.");
    if (post.authorId !== profile.id) throw forbidden("Seul l'auteur peut supprimer ce post.");
    await softDeletePost(db, post.id);
    return { deleted: true };
  });

  app.post<{ Params: { id: string } }>(
    "/api/posts/:id/share",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
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

  app.put<{ Params: { id: string } }>("/api/posts/:id/reactions", async (request) => {
    const userId = await requireSessionUserId(auth, request);
    const profile = await requireOwnProfile(db, userId);
    const post = await findPostById(db, request.params.id);
    if (!post || post.deletedAt) throw notFound("Ce post n'existe pas.");
    return togglePostReaction(db, post.id, profile.id);
  });

  app.get<{ Params: { id: string }; Querystring: { cursor?: string; limit?: string } }>(
    "/api/posts/:id/replies",
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      await requireOwnProfile(db, userId);
      const post = await findPostById(db, request.params.id);
      if (!post) throw notFound("Ce post n'existe pas.");
      const query = paginationQuerySchema.parse(request.query);
      const page = await listPostReplies(db, post.id, query.cursor, query.limit);
      const items = await Promise.all(
        page.items.map(async (row) => {
          const { author } = await hydratePostReply(db, row);
          return serializePostReply(row, author);
        }),
      );
      return { items, nextCursor: page.nextCursor };
    },
  );

  app.post<{ Params: { id: string } }>(
    "/api/posts/:id/replies",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await requireOwnProfile(db, userId);
      const post = await findPostById(db, request.params.id);
      if (!post || post.deletedAt) throw notFound("Ce post n'existe pas.");
      const input = createPostReplySchema.parse(request.body);
      const reply = await insertPostReply(db, { postId: post.id, authorId: profile.id, body: input.body });
      return { reply: serializePostReply(reply, profile) };
    },
  );

  app.delete<{ Params: { id: string } }>("/api/post-replies/:id", async (request) => {
    const userId = await requireSessionUserId(auth, request);
    const profile = await requireOwnProfile(db, userId);
    const reply = await findPostReplyById(db, request.params.id);
    if (!reply || reply.deletedAt) throw notFound("Cette réponse n'existe pas.");
    if (reply.authorId !== profile.id) throw forbidden("Seul l'auteur peut supprimer cette réponse.");
    await softDeletePostReply(db, reply.id);
    return { deleted: true };
  });

  app.put<{ Params: { id: string } }>("/api/post-replies/:id/solution", async (request) => {
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
    return { reply: serializePostReply(updated, author) };
  });

  app.post<{ Params: { id: string } }>("/api/posts/:id/feedback", async (request) => {
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
    return { feedback: serializePostFeedbackEntry(feedback, profile) };
  });

  app.get<{ Params: { id: string } }>("/api/posts/:id/feedback", async (request) => {
    const userId = await requireSessionUserId(auth, request);
    await requireOwnProfile(db, userId);
    const post = await findPostById(db, request.params.id);
    if (!post) throw notFound("Ce post n'existe pas.");
    const rows = await listPostFeedback(db, post.id);
    return { items: rows.map((row) => serializePostFeedbackEntry(row.feedback, row.author)) };
  });
}
