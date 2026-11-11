import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import {
  assistantRecordingTrigger,
  CI_DOCKER_RECORDING,
  DESIGN_SYSTEM_RECORDING,
  FLUTTER_SYNC_RECORDING,
  type AssistantRecording,
} from "../assistant-recordings.js";
import type { DbOrTx } from "../client.js";
import { assistantInvocations, messages, pointsLedger, profiles, skills } from "../schema/index.js";
import type { DemoAccountIds } from "./accounts.js";
import { hoursAgo } from "./time.js";

// Profil système de l'assistant, créé par la migration 0003.
const ASSISTANT_HANDLE = "kemet";
// Montant de base d'un "Utile" (POINTS_ASSISTANT_SKILL_HELPFUL côté serveur),
// sans la pondération par niveau du donneur, qu'un seed n'a pas à rejouer.
const HELPFUL_POINTS = 5;
const RESPONSE_DELAY_HOURS = 20 / 3600;

interface Exchange {
  recording: AssistantRecording;
  askedBy: keyof DemoAccountIds;
  askedHoursAgo: number;
  helpful: boolean | null;
}

// Placés juste après les messages du salon qui posent déjà ces questions.
// Aucune personne n'interroge l'assistant sur son propre skill : un "Utile"
// donné à soi-même ne rapporterait aucun point.
const EXCHANGES: Exchange[] = [
  { recording: FLUTTER_SYNC_RECORDING, askedBy: "skanderJaziri", askedHoursAgo: 88.5, helpful: true },
  { recording: CI_DOCKER_RECORDING, askedBy: "kgomotsoMahlangu", askedHoursAgo: 71, helpful: true },
  { recording: DESIGN_SYSTEM_RECORDING, askedBy: "ahouKouadio", askedHoursAgo: 49.5, helpful: null },
];

/**
 * Échanges avec @kocc dans le salon "général" de CADEV 2026 : des invocations
 * enregistrées (`recorded`), affichées comme telles, jamais comme des réponses
 * générées en direct.
 */
export async function createAssistantExchanges(
  db: DbOrTx,
  ids: DemoAccountIds,
  generalChannelId: string,
): Promise<void> {
  const [assistant] = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.handle, ASSISTANT_HANDLE));
  if (!assistant) throw new Error("Profil système de l'assistant introuvable : migrations non appliquées ?");

  const slugs = EXCHANGES.map((exchange) => exchange.recording.skillSlug);
  const skillRows = await db
    .select({ id: skills.id, slug: skills.slug, authorId: skills.authorId })
    .from(skills)
    .where(inArray(skills.slug, slugs));
  const skillBySlug = new Map(skillRows.map((row) => [row.slug, row]));

  for (const exchange of EXCHANGES) {
    const skill = skillBySlug.get(exchange.recording.skillSlug);
    if (!skill) throw new Error(`Skill de démonstration introuvable : ${exchange.recording.skillSlug}`);
    const askedBy = ids[exchange.askedBy];
    const askedAt = hoursAgo(exchange.askedHoursAgo);
    const answeredAt = hoursAgo(exchange.askedHoursAgo - RESPONSE_DELAY_HOURS);

    const [trigger] = await db
      .insert(messages)
      .values({
        channelId: generalChannelId,
        authorId: askedBy,
        clientId: randomUUID(),
        body: assistantRecordingTrigger(exchange.recording),
        createdAt: askedAt,
      })
      .returning({ id: messages.id });
    const [response] = await db
      .insert(messages)
      .values({
        channelId: generalChannelId,
        authorId: assistant.id,
        clientId: randomUUID(),
        body: exchange.recording.answer,
        createdAt: answeredAt,
      })
      .returning({ id: messages.id });
    const [invocation] = await db
      .insert(assistantInvocations)
      .values({
        channelId: generalChannelId,
        triggerMessageId: trigger!.id,
        requestedBy: askedBy,
        responseMessageId: response!.id,
        skillIds: [skill.id],
        status: "done",
        recorded: true,
        helpful: exchange.helpful,
        createdAt: askedAt,
        completedAt: answeredAt,
      })
      .returning({ id: assistantInvocations.id });

    if (exchange.helpful) {
      await db.insert(pointsLedger).values({
        profileId: skill.authorId,
        source: "assistant_skill_helpful",
        sourceId: invocation!.id,
        amount: HELPFUL_POINTS,
        givenByProfileId: askedBy,
        createdAt: answeredAt,
      });
    }
  }
}
