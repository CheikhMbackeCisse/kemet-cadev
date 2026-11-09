import type { assistantInvocations, Db } from "@kemet/db";
import type { AssistantInvocationDetail } from "@kemet/shared";
import { listInvocationsByResponseReplyIds } from "./repositories/assistant.js";
import { canViewSkill, findAuthorProfile, findSkillsByIds } from "./repositories/skills.js";

type InvocationRow = typeof assistantInvocations.$inferSelect;

/**
 * Détail affiché sous une réponse de @kemet. Un skill devenu invisible pour
 * ce lecteur depuis la réponse n'est plus cité, comme dans un salon.
 */
export async function describeInvocation(
  db: Db,
  invocation: InvocationRow,
  viewerProfileId: string | null,
): Promise<AssistantInvocationDetail> {
  const [citedSkill] = await findSkillsByIds(db, invocation.skillIds);
  let skill: AssistantInvocationDetail["skill"] = null;
  if (citedSkill && (await canViewSkill(db, citedSkill, viewerProfileId))) {
    const author = await findAuthorProfile(db, citedSkill.authorId);
    skill = {
      slug: citedSkill.slug,
      name: citedSkill.name,
      authorHandle: author.handle,
      authorDisplayName: author.displayName,
    };
  }
  return {
    invocationId: invocation.id,
    skill,
    helpful: invocation.helpful,
    recorded: invocation.recorded,
    requestedBy: invocation.requestedBy,
  };
}

/** Détails des réponses de @kemet parmi `replyIds`, indexés par identifiant de réponse. */
export async function loadReplyAssistantDetails(
  db: Db,
  replyIds: string[],
  viewerProfileId: string | null,
): Promise<Map<string, AssistantInvocationDetail>> {
  const invocations = await listInvocationsByResponseReplyIds(db, replyIds);
  const entries = await Promise.all(
    invocations.map(async (invocation) => [invocation.responseReplyId!, await describeInvocation(db, invocation, viewerProfileId)] as const),
  );
  return new Map(entries);
}
