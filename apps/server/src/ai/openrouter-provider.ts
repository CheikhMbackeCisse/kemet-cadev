import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import {
  LlmProviderError,
  extractHttpStatusCode,
  type LlmMessage,
  type LlmProvider,
} from "./llm-provider.js";

// OpenRouter expose une API compatible OpenAI : pas de dépendance
// supplémentaire à auditer pour les licences, @ai-sdk/openai suffit avec une
// base URL différente.
const BASE_URL = "https://openrouter.ai/api/v1";

export function createOpenRouterProvider(apiKey: string, model: string): LlmProvider {
  const openrouter = createOpenAI({ apiKey, baseURL: BASE_URL });

  return {
    name: "openrouter",
    async *streamResponse(messages: LlmMessage[]) {
      let result: ReturnType<typeof streamText>;
      try {
        result = streamText({ model: openrouter(model), messages });
      } catch (error) {
        throw toProviderError(error);
      }
      try {
        for await (const delta of result.textStream) {
          yield delta;
        }
      } catch (error) {
        throw toProviderError(error);
      }
    },
  };
}

function toProviderError(error: unknown): LlmProviderError {
  const statusCode = extractHttpStatusCode(error);
  const message = error instanceof Error ? error.message : "Erreur OpenRouter inconnue.";
  return new LlmProviderError("openrouter", statusCode === 429, message);
}
