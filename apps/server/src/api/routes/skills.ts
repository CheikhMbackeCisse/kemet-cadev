import type { FastifyInstance } from "fastify";
import { createSkillSchema, rateSkillSchema, skillListQuerySchema, updateSkillSchema } from "@kemet/shared";
import { getSessionUserId, requireSessionUserId } from "../../auth/session.js";
import { badRequest, conflict, forbidden, notFound } from "../../errors.js";
import {
  canViewSkill,
  createSkill,
  deleteSkill,
  findAuthorProfile,
  findSkillBySlug,
  getSkillStats,
  listMemberSpaceIds,
  listSkillsForViewer,
  rateSkill,
  updateSkill,
} from "../repositories/skills.js";
import { findProfileByUserId } from "../repositories/profiles.js";
import { findSpaceMembership } from "../repositories/chat.js";
import { hasProfileUsedSkill } from "../repositories/assistant.js";
import { serializeSkillDetail, serializeSkillSummary } from "../skill-serializers.js";
import type { ChatAppDeps } from "../app.js";

async function requireOwnProfile(db: ChatAppDeps["db"], userId: string) {
  const profile = await findProfileByUserId(db, userId);
  if (!profile) throw badRequest("Complétez votre profil avant de publier un skill.");
  if (profile.suspendedAt) throw forbidden("Ce compte est suspendu.");
  return profile;
}

async function requireVisibleSkill(db: ChatAppDeps["db"], slug: string, profileId: string | null) {
  const skill = await findSkillBySlug(db, slug);
  if (!skill) throw notFound("Ce skill n'existe pas.");
  if (!(await canViewSkill(db, skill, profileId))) throw notFound("Ce skill n'existe pas.");
  return skill;
}

/**
 * Un skill limité à un espace n'est curé que par les membres de cet espace
 * (voir docs/CONTEXTE.md) : sans cette vérification, n'importe qui pourrait
 * faire apparaître un skill qu'il contrôle dans la liste d'un espace auquel
 * il n'appartient pas.
 */
async function requireSpaceMembershipForVisibility(
  db: ChatAppDeps["db"],
  profileId: string,
  visibility: string | undefined,
  spaceId: string | null | undefined,
) {
  if (visibility !== "space" || !spaceId) return;
  const membership = await findSpaceMembership(db, spaceId, profileId);
  if (!membership) throw forbidden("Seuls les membres de cet espace peuvent y limiter un skill.");
}

export function registerSkillRoutes(app: FastifyInstance, { db, auth }: ChatAppDeps): void {
  // Un visiteur lit les skills publics : la réponse de @kemet qu'il voit dans
  // un salon public cite un skill, le lien doit mener quelque part.
  // Un compte suspendu garde la lecture, comme ailleurs (ADR 0016).
  app.get("/api/skills", { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } }, async (request) => {
    const userId = await getSessionUserId(auth, request);
    const profile = userId ? await findProfileByUserId(db, userId) : null;
    const { q, beginner } = skillListQuerySchema.parse(request.query);
    const memberSpaceIds = profile ? await listMemberSpaceIds(db, profile.id) : [];
    const rows = await listSkillsForViewer(db, profile?.id ?? null, memberSpaceIds, q, beginner === "1");
    const items = await Promise.all(
      rows.map(async (skill) => {
        const [author, ratings] = await Promise.all([findAuthorProfile(db, skill.authorId), getSkillStats(db, skill.id)]);
        return serializeSkillSummary(skill, author, ratings);
      }),
    );
    return { items };
  });

  app.post("/api/skills", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request) => {
    const userId = await requireSessionUserId(auth, request);
    const profile = await requireOwnProfile(db, userId);
    const input = createSkillSchema.parse(request.body);
    const existing = await findSkillBySlug(db, input.slug);
    if (existing) throw conflict("Un skill avec cet identifiant existe déjà.");
    await requireSpaceMembershipForVisibility(db, profile.id, input.visibility, input.spaceId);
    const skill = await createSkill(db, profile.id, input);
    const ratings = await getSkillStats(db, skill.id);
    return { skill: serializeSkillDetail(skill, profile, ratings) };
  });

  app.get<{ Params: { slug: string } }>("/api/skills/:slug", async (request) => {
    const userId = await getSessionUserId(auth, request);
    const profile = userId ? await findProfileByUserId(db, userId) : null;
    const skill = await requireVisibleSkill(db, request.params.slug, profile?.id ?? null);
    const [author, ratings] = await Promise.all([findAuthorProfile(db, skill.authorId), getSkillStats(db, skill.id)]);
    return { skill: serializeSkillDetail(skill, author, ratings) };
  });

  app.patch<{ Params: { slug: string } }>(
    "/api/skills/:slug",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await requireOwnProfile(db, userId);
      const skill = await requireVisibleSkill(db, request.params.slug, profile.id);
      if (skill.authorId !== profile.id) throw forbidden("Seul l'auteur peut modifier ce skill.");
      const input = updateSkillSchema.parse(request.body);
      await requireSpaceMembershipForVisibility(
        db,
        profile.id,
        input.visibility ?? skill.visibility,
        input.spaceId !== undefined ? input.spaceId : skill.spaceId,
      );
      const updated = await updateSkill(db, skill.id, input);
      const ratings = await getSkillStats(db, skill.id);
      return { skill: serializeSkillDetail(updated, profile, ratings) };
    },
  );

  app.delete<{ Params: { slug: string } }>(
    "/api/skills/:slug",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await requireOwnProfile(db, userId);
      const skill = await requireVisibleSkill(db, request.params.slug, profile.id);
      if (skill.authorId !== profile.id) throw forbidden("Seul l'auteur peut supprimer ce skill.");
      await deleteSkill(db, skill.id);
      return { deleted: true };
    },
  );

  app.put<{ Params: { slug: string } }>(
    "/api/skills/:slug/rating",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await requireOwnProfile(db, userId);
      const skill = await requireVisibleSkill(db, request.params.slug, profile.id);
      if (!(await hasProfileUsedSkill(db, profile.id, skill.id))) {
        throw forbidden("Seuls ceux à qui ce skill a déjà servi peuvent lui donner des étoiles.");
      }
      const input = rateSkillSchema.parse(request.body);
      const ratings = await rateSkill(db, skill.id, profile.id, input.stars);
      return { ratings };
    },
  );
}
