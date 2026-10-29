import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText } from "ai";
import {
  LlmProviderError,
  extractHttpStatusCode,
  type LlmMessage,
  type LlmProvider,
} from "./llm-provider.js";

export function createGeminiProvider(apiKey: string, model: string): LlmProvider {
  const google = createGoogleGenerativeAI({ apiKey });

  return {
    name: "gemini",
    async *streamResponse(messages: LlmMessage[]) {
      let result: ReturnType<typeof streamText>;
      try {
        result = streamText({ model: google(model), messages });
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
  const message = error instanceof Error ? error.message : "Erreur Gemini inconnue.";
  return new LlmProviderError("gemini", statusCode === 429, message);
}
