/**
 * Chaîne de fournisseurs pour les evals, avec ce qu'il faut pour comparer
 * les fournisseurs entre eux :
 * - `--provider=gemini|groq|openrouter` n'appelle que ce fournisseur (tous
 *   ses modèles, dans l'ordre) ; sans option, toute la chaîne, comme en
 *   production ;
 * - `EVAL_PACE_MS` espace les appels, pour rester sous un quota par minute
 *   (5 requêtes par minute pour gemini-3.5-flash sur l'offre gratuite) ;
 * - `EVAL_OPENROUTER_BUDGET` plafonne les appels OpenRouter de la suite.
 * Chaque appel note le fournisseur et le modèle qui ont répondu, et le délai.
 * Rien n'est journalisé du prompt ni des clés.
 */
import { createLlmChainFromEnv } from "../apps/server/src/ai/create-llm-provider.js";
import { MemoryDailyBudget, type DailyBudget } from "../apps/server/src/ai/daily-budget.js";
import type { FallbackLogEntry } from "../apps/server/src/ai/llm-chain.js";
import {
  AllProvidersUnavailableError,
  type LlmMessage,
  type LlmProviderName,
  type LlmRequestOptions,
} from "../apps/server/src/ai/llm-provider.js";

export interface EvalAnswer {
  text: string;
  provider: LlmProviderName | null;
  model: string | null;
  ms: number;
  /** Toute la chaîne a échoué : le cas ne peut pas être jugé. */
  unavailable: boolean;
}

const PROVIDERS: LlmProviderName[] = ["gemini", "groq", "openrouter"];

function readProvider(): LlmProviderName | undefined {
  const value = process.argv.find((arg) => arg.startsWith("--provider="))?.split("=")[1];
  if (value === undefined) return undefined;
  if (!PROVIDERS.includes(value as LlmProviderName)) {
    console.error(`--provider doit valoir ${PROVIDERS.join(", ")}.`);
    process.exit(1);
  }
  return value as LlmProviderName;
}

export function createEvalRunner(suite: string) {
  const only = readProvider();
  const paceMs = Number(process.env.EVAL_PACE_MS ?? 0);
  const fallbacks: FallbackLogEntry[] = [];
  let openRouterCalls = 0;
  const inner = new MemoryDailyBudget(Number(process.env.EVAL_OPENROUTER_BUDGET ?? 35));
  const openRouterBudget: DailyBudget = {
    async tryConsume() {
      const allowed = await inner.tryConsume();
      if (allowed) openRouterCalls += 1;
      return allowed;
    },
  };
  const chain = createLlmChainFromEnv(process.env, {
    only,
    openRouterBudget,
    logger: (entry) => fallbacks.push(entry),
  });
  if (!chain) {
    console.error(
      `Aucune clé d'API pour ${only ?? "aucun fournisseur"} : suite ${suite} non lancée.`,
    );
    process.exit(1);
  }
  const answers: EvalAnswer[] = [];
  let calls = 0;

  console.log(
    `Suite ${suite}, chaîne : ${chain
      .describe()
      .map((link) => `${link.provider}/${link.model}`)
      .join(" > ")}`,
  );

  return {
    async ask(messages: LlmMessage[], options?: LlmRequestOptions): Promise<EvalAnswer> {
      if (calls > 0 && paceMs > 0) await new Promise((resolve) => setTimeout(resolve, paceMs));
      calls += 1;
      const startedAt = Date.now();
      const answer: EvalAnswer = {
        text: "",
        provider: null,
        model: null,
        ms: 0,
        unavailable: false,
      };
      try {
        for await (const chunk of chain.streamResponse(messages, options)) {
          answer.text += chunk.delta;
          answer.provider = chunk.provider;
          answer.model = chunk.model;
        }
      } catch (error) {
        if (!(error instanceof AllProvidersUnavailableError)) throw error;
        answer.unavailable = true;
      }
      answer.ms = Date.now() - startedAt;
      answers.push(answer);
      console.log(
        answer.unavailable
          ? `[aucun fournisseur n'a répondu, ${answer.ms} ms]`
          : `[${answer.provider}/${answer.model}, ${answer.ms} ms]`,
      );
      return answer;
    },

    /** Une ligne JSON à recopier dans le rapport. */
    summarize(passed: number, total: number): void {
      const causes: Record<string, number> = {};
      for (const entry of fallbacks) {
        const key = `${entry.event}:${entry.provider ?? "-"}/${entry.model ?? "-"}:${entry.cause ?? "-"}`;
        causes[key] = (causes[key] ?? 0) + 1;
      }
      const models: Record<string, number> = {};
      for (const answer of answers) {
        const key = answer.unavailable ? "aucun" : `${answer.provider}/${answer.model}`;
        models[key] = (models[key] ?? 0) + 1;
      }
      const delays = answers.map((answer) => answer.ms);
      console.log(
        `RÉSUMÉ ${JSON.stringify({
          suite,
          provider: only ?? "chaîne",
          passed,
          total,
          answeredBy: models,
          delayMs: {
            min: Math.min(...delays),
            max: Math.max(...delays),
            mean: Math.round(delays.reduce((a, b) => a + b, 0) / delays.length),
          },
          fallbacks: causes,
          openRouterCalls,
        })}`,
      );
    },
  };
}
