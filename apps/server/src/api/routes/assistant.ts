import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { assistantFeedbackSchema, type SkillCitation } from "@kemet/shared";
import { getSessionUserId, requireSessionUserId } from "../../auth/session.js";
import { badRequest, forbidden, notFound } from "../../errors.js";
import { findPostById, findPostReplyById } from "../repositories/posts.js";
import { findMessageById } from "../repositories/chat.js";
import {
  findInvocationById,
  findInvocationByResponseMessageId,
  setInvocationHelpful,
} from "../repositories/assistant.js";
import { canViewSkill, findAuthorProfile, findSkillsByIds } from "../repositories/skills.js";
import { serializeSkillCitation } from "../skill-serializers.js";
import { findProfileByUserId } from "../repositories/profiles.js";
import {
  awardPoints,
  computeUtileAwardAmount,
  POINTS_ASSISTANT_SKILL_HELPFUL,
} from "../repositories/points.js";
import type { ChatAppDeps } from "../app.js";
import { canActForAuthor } from "../repositories/organization-accounts.js";
import { requireChannelAccess, requireWritableSpace } from "./channels.js";

const messageIdParamsSchema = z.object({ id: z.string().uuid() });

type Invocation = NonNullable<Awaited<ReturnType<typeof findInvocationById>>>;

/** Question ou réponse supprimée : la réponse n'est plus montrée, elle ne se note plus. */
async function isAnswerRemoved(db: ChatAppDeps["db"], invocation: Invocation): Promise<boolean> {
  const [trigger, response] = await Promise.all(
    invocation.channelId
      ? [
          invocation.triggerMessageId ? findMessageById(db, invocation.triggerMessageId) : null,
          invocation.responseMessageId ? findMessageById(db, invocation.responseMessageId) : null,
        ]
      : [
          invocation.triggerReplyId ? findPostReplyById(db, invocation.triggerReplyId) : null,
          invocation.responseReplyId ? findPostReplyById(db, invocation.responseReplyId) : null,
        ],
  );
  return !trigger || trigger.deletedAt !== null || !response || response.deletedAt !== null;
}

export function registerAssistantRoutes(app: FastifyInstance, { db, auth }: ChatAppDeps): void {
  // Pour réafficher la citation d'un skill, l'état "Utile" et la marque
  // "réponse enregistrée" après un rechargement de page : rien de tout cela
  // n'est stocké sur le message lui-même, l'invocation reste la seule source.
  // Lisible par un visiteur, comme les messages d'un salon public.
  app.get<{ Params: { id: string } }>("/api/messages/:id/assistant-invocation", async (request) => {
    const userId = await getSessionUserId(auth, request);
    const profile = userId ? await findProfileByUserId(db, userId) : null;
    const profileId = profile?.id ?? null;
    const params = messageIdParamsSchema.safeParse(request.params);
    if (!params.success) throw notFound("Cette réponse n'a pas d'invocation associée.");
    const invocation = await findInvocationByResponseMessageId(db, params.data.id);
    if (!invocation?.channelId) throw notFound("Cette réponse n'a pas d'invocation associée.");
    await requireChannelAccess(db, invocation.channelId, profileId);
    const [citedSkill] = await findSkillsByIds(db, invocation.skillIds);
    let skill: SkillCitation | null = null;
    // Défense en profondeur : si la visibilité du skill a changé depuis la
    // réponse (passé de public à privé, retiré d'un espace), on ne la
    // révèle plus ici même si elle apparaît toujours dans le message déjà
    // posté.
    if (citedSkill && (await canViewSkill(db, citedSkill, profileId))) {
      skill = serializeSkillCitation(citedSkill, await findAuthorProfile(db, citedSkill.authorId));
    }
    return {
      invocationId: invocation.id,
      skill,
      helpful: invocation.helpful,
      recorded: invocation.recorded,
    };
  });

  // Tout lecteur peut marquer la réponse Utile, ce qui rapporte des points à
  // l'auteur du skill. Retirer la marque ne retire pas les points
  // (docs/adr/0011-points-et-niveaux.md).
  app.put<{ Params: { id: string } }>(
    "/api/assistant-invocations/:id/feedback",
    { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await findProfileByUserId(db, userId);
      if (!profile) throw badRequest("Complétez votre profil avant de donner votre avis.");
      const invocation = await findInvocationById(db, request.params.id);
      if (!invocation || invocation.status !== "done")
        throw notFound("Cette réponse n'existe pas.");
      if (invocation.channelId) {
        const access = await requireChannelAccess(db, invocation.channelId, profile.id);
        if (access.kind !== "space") throw notFound("Cette réponse n'existe pas.");
        requireWritableSpace(access.space);
      } else {
        // Sous un post : lisible par tous, mais un compte suspendu n'écrit plus.
        const post = invocation.postId ? await findPostById(db, invocation.postId) : null;
        if (!post || post.deletedAt) throw notFound("Cette réponse n'existe pas.");
        if (profile.suspendedAt) throw forbidden("Ce compte est suspendu.");
        // Réponse lisible par tous : l'avis, qui rapporte des points à
        // l'auteur du skill, revient à qui a posé la question ou à l'auteur du post.
        if (
          invocation.requestedBy !== profile.id &&
          !(await canActForAuthor(db, profile.id, post.authorId))
        ) {
          throw forbidden(
            "Seuls la personne qui a posé la question et l'auteur du post donnent leur avis.",
          );
        }
      }
      if (await isAnswerRemoved(db, invocation)) throw notFound("Cette réponse n'existe pas.");
      const input = assistantFeedbackSchema.parse(request.body);
      if (input.helpful && invocation.helpful !== true) {
        const citedSkills = await findSkillsByIds(db, invocation.skillIds);
        const authorIds = [...new Set(citedSkills.map((skill) => skill.authorId))].filter(
          (id) => id !== profile.id,
        );
        if (authorIds.length > 0) {
          const amount = await computeUtileAwardAmount(db, POINTS_ASSISTANT_SKILL_HELPFUL, profile);
          for (const authorId of authorIds) {
            await awardPoints(db, {
              profileId: authorId,
              source: "assistant_skill_helpful",
              sourceId: invocation.id,
              amount,
              givenByProfileId: profile.id,
            });
          }
        }
      }
      await setInvocationHelpful(db, invocation.id, input.helpful);
      return { helpful: input.helpful };
    },
  );
}
