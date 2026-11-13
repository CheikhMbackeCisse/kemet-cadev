import type { Db } from "@kemet/db";
import { KEMET_ASSISTANT_PROFILE_ID, parseAssistantRequest } from "../chat/kemet-assistant.js";
import {
  completeInvocation,
  failInvocation,
  insertPostInvocation,
  markInvocationStreaming,
} from "../api/repositories/assistant.js";
import { findPostById, findPostReplyById, insertPostReply, listRepliesBefore } from "../api/repositories/posts.js";
import { findWorkById } from "../api/repositories/works.js";
import { AssistantAnswerer, isProviderUnavailable, type ContextBlock, type RecordedAnswersOptions } from "./assistant-answerer.js";
import type { StreamingLlmProvider } from "./llm-provider.js";
import { localAssistantRuntime, type AssistantRuntime } from "./assistant-runtime.js";
import { checkDailyQuota } from "./quota.js";
import type { ResponseCache } from "./response-cache.js";
import type { SkillRetriever } from "./skill-retriever.js";

export interface PostAssistantInput {
  postId: string;
  triggerReplyId: string;
  triggerCreatedAt: Date;
  requestedBy: string;
  body: string;
}

export type PostAssistantStart = { invocationId: string; errorCode: null } | { invocationId: null; errorCode: "quota_exceeded" };

export interface PostAssistant {
  /**
   * Vérifie le quota et crée l'invocation, puis rédige la réponse en
   * arrière-plan. `null` quand l'assistant est inerte (aucun fournisseur).
   */
  start(input: PostAssistantInput): Promise<PostAssistantStart | null>;
  /** Attend les réponses en cours : arrêt propre et tests. */
  idle(): Promise<void>;
}

export class NoopPostAssistant implements PostAssistant {
  async start(): Promise<null> {
    return null;
  }
  async idle(): Promise<void> {}
}

const REPLY_HISTORY_SIZE = 10;
const EMPTY_ANSWER = "Je n'ai pas de réponse utile pour cette question.";

export class KemetPostAssistant implements PostAssistant {
  private readonly answerer: AssistantAnswerer;
  private readonly running = new Set<Promise<void>>();

  constructor(
    private readonly db: Db,
    provider: StreamingLlmProvider,
    retriever: SkillRetriever,
    cache: ResponseCache,
    private readonly dailyQuotaOverride?: number,
    recordedAnswersEnabled = false,
    private readonly onError: (error: unknown) => void = () => {},
    private readonly runtime: AssistantRuntime = localAssistantRuntime(),
  ) {
    // Aucun streaming vers le navigateur sous un post : rejouer une réponse
    // enregistrée morceau par morceau ne ferait que la retarder.
    const recordedAnswers: RecordedAnswersOptions = { enabled: recordedAnswersEnabled, replayDelayMs: 0 };
    this.answerer = new AssistantAnswerer(db, provider, retriever, cache, recordedAnswers);
  }

  async start(input: PostAssistantInput): Promise<PostAssistantStart> {
    // Avant l'invocation, comme dans un salon : sinon elle compterait dans son propre total.
    const quota = await checkDailyQuota(
      this.db,
      input.requestedBy,
      this.dailyQuotaOverride,
      this.runtime.quotaCounter,
    );
    if (!quota.allowed) return { invocationId: null, errorCode: "quota_exceeded" };

    const invocation = await insertPostInvocation(this.db, {
      postId: input.postId,
      triggerReplyId: input.triggerReplyId,
      requestedBy: input.requestedBy,
    });
    // L'invocation reste "pending" tant qu'elle attend une place dans la file.
    const task = this.runtime.limiter
      .run(() => this.run(invocation.id, input))
      .catch(this.onError)
      .finally(() => this.running.delete(task));
    this.running.add(task);
    return { invocationId: invocation.id, errorCode: null };
  }

  async idle(): Promise<void> {
    await Promise.all([...this.running]);
  }

  private async run(invocationId: string, input: PostAssistantInput): Promise<void> {
    const { question, requestedSlugs } = parseAssistantRequest(input.body);
    try {
      await markInvocationStreaming(this.db, invocationId);
      const answer = await this.answerer.answer({
        question,
        requestedSlugs,
        requestedBy: input.requestedBy,
        cacheScope: `post:${input.postId}`,
        publicSkillsOnly: true,
        loadContext: () => this.loadContext(input),
        onDelta: async () => {},
      });
      // Post ou question retirés pendant la rédaction : la réponse n'a plus où aller.
      const [post, trigger] = await Promise.all([
        findPostById(this.db, input.postId),
        findPostReplyById(this.db, input.triggerReplyId),
      ]);
      if (!post || post.deletedAt || !trigger || trigger.deletedAt) {
        await failInvocation(this.db, invocationId, "context_removed");
        return;
      }
      const reply = await insertPostReply(this.db, {
        postId: input.postId,
        authorId: KEMET_ASSISTANT_PROFILE_ID,
        body: answer.text.trim() || EMPTY_ANSWER,
      });
      await completeInvocation(this.db, invocationId, {
        responseReplyId: reply.id,
        provider: answer.provider,
        skillIds: answer.skills.map((skill) => skill.id),
        recorded: answer.recorded,
      });
    } catch (error) {
      await failInvocation(this.db, invocationId, isProviderUnavailable(error) ? "assistant_unavailable" : "internal_error");
      if (!isProviderUnavailable(error)) throw error;
    }
  }

  private async loadContext(input: PostAssistantInput): Promise<ContextBlock[]> {
    const post = await findPostById(this.db, input.postId);
    const parts: string[] = [];
    if (post?.body) parts.push(post.body);
    if (post?.sharedPostId) {
      const shared = await findPostById(this.db, post.sharedPostId);
      if (shared && !shared.deletedAt && shared.body) parts.push(`Post partagé :\n${shared.body}`);
    }
    if (post?.workId) {
      const work = await findWorkById(this.db, post.workId);
      if (work && !work.deletedAt) parts.push(`Travail annoncé : ${work.title}`);
    }
    const replies = await listRepliesBefore(this.db, input.postId, input.triggerCreatedAt, REPLY_HISTORY_SIZE);
    const history = replies.map((reply) => `- ${reply.body}`).join("\n");
    return [
      { tag: "post", content: parts.join("\n\n") || "Post sans texte." },
      { tag: "historique", content: history || "Aucune réponse précédente." },
    ];
  }
}
