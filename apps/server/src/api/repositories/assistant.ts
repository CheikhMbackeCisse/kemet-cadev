import { eq, sql } from "drizzle-orm";
import { assistantInvocations, type Db } from "@kemet/db";
import type { LlmProviderName } from "../../ai/llm-provider.js";

export async function insertInvocation(
  db: Db,
  input: { channelId: string; triggerMessageId: string; requestedBy: string },
) {
  const [row] = await db.insert(assistantInvocations).values(input).returning();
  return row!;
}

export async function markInvocationStreaming(db: Db, id: string): Promise<void> {
  await db.update(assistantInvocations).set({ status: "streaming" }).where(eq(assistantInvocations.id, id));
}

export async function completeInvocation(
  db: Db,
  id: string,
  input: { responseMessageId: string; provider: LlmProviderName | null; skillIds: string[]; recorded: boolean },
): Promise<void> {
  await db
    .update(assistantInvocations)
    .set({
      status: "done",
      responseMessageId: input.responseMessageId,
      provider: input.provider,
      skillIds: input.skillIds,
      recorded: input.recorded,
      completedAt: new Date(),
    })
    .where(eq(assistantInvocations.id, id));
}

export async function failInvocation(db: Db, id: string, errorCode: string): Promise<void> {
  await db
    .update(assistantInvocations)
    .set({ status: "failed", errorCode, completedAt: new Date() })
    .where(eq(assistantInvocations.id, id));
}

export async function findInvocationById(db: Db, id: string) {
  const [row] = await db.select().from(assistantInvocations).where(eq(assistantInvocations.id, id));
  return row ?? null;
}

export async function findInvocationByResponseMessageId(db: Db, messageId: string) {
  const [row] = await db.select().from(assistantInvocations).where(eq(assistantInvocations.responseMessageId, messageId));
  return row ?? null;
}

export async function setInvocationHelpful(db: Db, id: string, helpful: boolean): Promise<void> {
  await db.update(assistantInvocations).set({ helpful }).where(eq(assistantInvocations.id, id));
}

/**
 * Les étoiles d'un skill ne peuvent être données que par quelqu'un à qui ce
 * skill a déjà servi de base à une réponse (voir docs/CONTEXTE.md, section
 * assistant). `skill_ids` est un tableau Postgres : la correspondance se
 * fait avec `any()`, pas avec une jointure classique.
 */
export async function hasProfileUsedSkill(db: Db, profileId: string, skillId: string): Promise<boolean> {
  const rows = await db.execute<{ used: boolean }>(sql`
    select exists(
      select 1 from assistant_invocations
      where requested_by = ${profileId} and status = 'done' and ${skillId} = any(skill_ids)
    ) as "used"
  `);
  return rows[0]?.used ?? false;
}
