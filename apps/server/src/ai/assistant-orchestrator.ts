import { randomUUID } from "node:crypto";
import type { Db } from "@kemet/db";
import type { ChatPublisher } from "../chat/pubsub.js";
import { KEMET_ASSISTANT_PROFILE_ID, parseAssistantRequest } from "../chat/kemet-assistant.js";
import { hydrateMessage, insertMessage, listChannelMessages } from "../api/repositories/chat.js";
import { serializeMessage } from "../api/chat-serializers.js";
import { computeProfilePoints } from "../api/repositories/points.js";
import { completeInvocation, failInvocation, insertInvocation, markInvocationStreaming } from "../api/repositories/assistant.js";
import { AssistantAnswerer, isProviderUnavailable, type ContextBlock, type RecordedAnswersOptions } from "./assistant-answerer.js";
import type { StreamingLlmProvider } from "./llm-provider.js";
import { localAssistantRuntime, type AssistantRuntime } from "./assistant-runtime.js";
import { checkDailyQuota } from "./quota.js";
import type { ResponseCache } from "./response-cache.js";
import type { SkillRetriever } from "./skill-retriever.js";

export { SYSTEM_PROMPT_PREFIX, type RecordedAnswersOptions } from "./assistant-answerer.js";

export interface AssistantMentionInput {
  channelId: string;
  triggerMessageId: string;
  requestedBy: string;
  body: string;
}

export interface AssistantOrchestrator {
  handleMention(input: AssistantMentionInput): Promise<void>;
}

/**
 * Utilisé quand aucune clé d'API de fournisseur d'IA n'est configurée
 * (tests, environnement de développement sans ces clés) : une mention de
 * l'assistant ne fait rien plutôt que de faire échouer l'envoi du message.
 */
export class NoopAssistantOrchestrator implements AssistantOrchestrator {
  async handleMention(): Promise<void> {}
}

const CONVERSATION_HISTORY_SIZE = 10;

export const RECORDED_ANSWER_REPLAY_DELAY_MS = 40;

export class KemetAssistantOrchestrator implements AssistantOrchestrator {
  private readonly answerer: AssistantAnswerer;

  constructor(
    private readonly db: Db,
    private readonly chat: ChatPublisher,
    provider: StreamingLlmProvider,
    retriever: SkillRetriever,
    cache: ResponseCache,
    // Limite fixe utilisée seulement par les tests ; en production, le
    // quota se calcule par niveau (apps/server/src/ai/quota.ts).
    private readonly dailyQuotaOverride?: number,
    recordedAnswers: RecordedAnswersOptions = { enabled: false, replayDelayMs: 0 },
    private readonly runtime: AssistantRuntime = localAssistantRuntime(),
  ) {
    this.answerer = new AssistantAnswerer(db, provider, retriever, cache, recordedAnswers);
  }

  async handleMention(input: AssistantMentionInput): Promise<void> {
    const { question, requestedSlugs } = parseAssistantRequest(input.body);

    // Le quota se vérifie avant de créer la ligne d'invocation : sinon elle
    // compterait dans son propre total (toujours au moins une de trop) et
    // rejetterait une personne qui n'a encore jamais dépassé la limite.
    const quota = await checkDailyQuota(
      this.db,
      input.requestedBy,
      this.dailyQuotaOverride,
      this.runtime.quotaCounter,
    );
    if (!quota.allowed) {
      await this.chat.publish({
        type: "assistant:failed",
        channelId: input.channelId,
        invocationId: randomUUID(),
        errorCode: "quota_exceeded",
        requestedBy: input.requestedBy,
        triggerMessageId: input.triggerMessageId,
      });
      return;
    }

    const invocation = await insertInvocation(this.db, {
      channelId: input.channelId,
      triggerMessageId: input.triggerMessageId,
      requestedBy: input.requestedBy,
    });
    // L'invocation reste "pending" tant qu'elle attend une place dans la file.
    await this.runtime.limiter.run(() => this.respond(invocation.id, input, question, requestedSlugs));
  }

  private async respond(
    invocationId: string,
    input: AssistantMentionInput,
    question: string,
    requestedSlugs: string[],
  ): Promise<void> {
    try {
      await markInvocationStreaming(this.db, invocationId);
      const answer = await this.answerer.answer({
        question,
        requestedSlugs,
        requestedBy: input.requestedBy,
        cacheScope: input.channelId,
        loadContext: () => this.loadHistory(input.channelId),
        onDelta: (delta, recorded) => this.publishChunk(input.channelId, invocationId, delta, recorded),
      });

      const body = answer.text.trim() || "Je n'ai pas de réponse utile pour cette question.";
      const { message } = await insertMessage(this.db, {
        channelId: input.channelId,
        authorId: KEMET_ASSISTANT_PROFILE_ID,
        clientId: randomUUID(),
        body,
        parentMessageId: null,
      });
      const hydrated = await hydrateMessage(this.db, message);
      const { level } = await computeProfilePoints(this.db, hydrated.row.authorId);
      const serialized = serializeMessage(
        hydrated.row,
        hydrated.author,
        hydrated.mentionedHandles,
        hydrated.reactions,
        hydrated.replyCount,
        hydrated.attachments,
        level,
      );

      await completeInvocation(this.db, invocationId, {
        responseMessageId: message.id,
        provider: answer.provider,
        skillIds: answer.skills.map((skill) => skill.id),
        recorded: answer.recorded,
      });
      await this.chat.publish({
        type: "assistant:done",
        channelId: input.channelId,
        invocationId: invocationId,
        message: serialized,
        skill: await this.answerer.describeCitedSkill(answer.skills),
        recorded: answer.recorded,
      });
    } catch (error) {
      const errorCode = isProviderUnavailable(error) ? "assistant_unavailable" : "internal_error";
      await this.fail(invocationId, input, errorCode);
    }
  }

  private async publishChunk(channelId: string, invocationId: string, delta: string, recorded: boolean): Promise<void> {
    await this.chat.publish({ type: "assistant:chunk", channelId, invocationId, delta, recorded });
  }

  private async fail(invocationId: string, input: AssistantMentionInput, errorCode: string): Promise<void> {
    await failInvocation(this.db, invocationId, errorCode);
    await this.chat.publish({
      type: "assistant:failed",
      channelId: input.channelId,
      invocationId,
      errorCode,
      requestedBy: input.requestedBy,
      triggerMessageId: input.triggerMessageId,
    });
  }

  private async loadHistory(channelId: string): Promise<ContextBlock[]> {
    const history = await listChannelMessages(this.db, channelId, undefined, CONVERSATION_HISTORY_SIZE);
    const historyText = history.items
      .slice()
      .reverse()
      .filter((item) => !item.deletedAt)
      .map((item) => `- ${item.body}`)
      .join("\n");
    return [{ tag: "historique", content: historyText || "Aucun message précédent." }];
  }
}
