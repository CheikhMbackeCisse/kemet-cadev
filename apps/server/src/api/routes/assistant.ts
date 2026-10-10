import type { FastifyInstance } from "fastify";
import { assistantFeedbackSchema } from "@kemet/shared";
import { requireSessionUserId } from "../../auth/session.js";
import { badRequest, notFound } from "../../errors.js";
import { findInvocationById, findInvocationByResponseMessageId, setInvocationHelpful } from "../repositories/assistant.js";
import { canViewSkill, findAuthorProfile, findSkillsByIds } from "../repositories/skills.js";
import { findProfileByUserId } from "../repositories/profiles.js";
import type { ChatAppDeps } from "../app.js";
import { requireChannelAccess } from "./channels.js";

export function registerAssistantRoutes(app: FastifyInstance, { db, auth }: ChatAppDeps): void {
  // Pour réafficher la citation d'un skill et l'état "Utile" après un
  // rechargement de page : rien de tout cela n'est stocké sur le message
  // lui-même, l'invocation reste la seule source.
  app.get<{ Params: { id: string } }>("/api/messages/:id/assistant-invocation", async (request) => {
    const userId = await requireSessionUserId(auth, request);
    const profile = await findProfileByUserId(db, userId);
    if (!profile) throw badRequest("Complétez votre profil avant d'accéder à ce salon.");
    const invocation = await findInvocationByResponseMessageId(db, request.params.id);
    if (!invocation) throw notFound("Cette réponse n'a pas d'invocation associée.");
    await requireChannelAccess(db, invocation.channelId, profile.id);
    const [citedSkill] = await findSkillsByIds(db, invocation.skillIds);
    let skill: { slug: string; name: string; authorHandle: string; authorDisplayName: string } | null = null;
    // Défense en profondeur : si la visibilité du skill a changé depuis la
    // réponse (passé de public à privé, retiré d'un espace), on ne la
    // révèle plus ici même si elle apparaît toujours dans le message déjà
    // posté.
    if (citedSkill && (await canViewSkill(db, citedSkill, profile.id))) {
      const author = await findAuthorProfile(db, citedSkill.authorId);
      skill = {
        slug: citedSkill.slug,
        name: citedSkill.name,
        authorHandle: author.handle,
        authorDisplayName: author.displayName,
      };
    }
    return { invocationId: invocation.id, skill, helpful: invocation.helpful };
  });

  // Donnée par qui lit la réponse, pas seulement par qui a posé la question
  // (voir docs/CONTEXTE.md, section assistant : "les lecteurs peuvent
  // marquer la réponse Utile"). Le câblage vers les points de l'auteur du
  // skill attend le lot 8 (points et niveaux), pas encore posé.
  app.put<{ Params: { id: string } }>("/api/assistant-invocations/:id/feedback", async (request) => {
    const userId = await requireSessionUserId(auth, request);
    const profile = await findProfileByUserId(db, userId);
    if (!profile) throw badRequest("Complétez votre profil avant de donner votre avis.");
    const invocation = await findInvocationById(db, request.params.id);
    if (!invocation || invocation.status !== "done") throw notFound("Cette réponse n'existe pas.");
    await requireChannelAccess(db, invocation.channelId, profile.id);
    const input = assistantFeedbackSchema.parse(request.body);
    await setInvocationHelpful(db, invocation.id, input.helpful);
    return { helpful: input.helpful };
  });
}
