import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { APICallError, Output, streamText } from "ai";
import {
  LlmProviderError,
  type LlmCallContext,
  type LlmMessage,
  type LlmProvider,
} from "./llm-provider.js";
import { toProviderError } from "./provider-failure.js";

/** `baseURL` ne sert qu'aux tests, qui font répondre un faux serveur local. */
export function createGeminiProvider(apiKey: string, model: string, baseURL?: string): LlmProvider {
  const google = createGoogleGenerativeAI({ apiKey, ...(baseURL ? { baseURL } : {}) });

  return {
    name: "gemini",
    model,
    async *streamResponse(messages: LlmMessage[], { signal, json }: LlmCallContext) {
      // Le SDK `ai` v7 refuse un message `system` dans `messages`
      // (AI_InvalidPromptError, avant tout appel) : la consigne passe par
      // `instructions`, qui devient le `systemInstruction` de Gemini.
      const instructions = messages
        .filter((message) => message.role === "system")
        .map((message) => message.content)
        .join("\n\n");
      const result = streamText({
        model: google(model),
        ...(instructions ? { instructions } : {}),
        messages: messages
          .filter((message) => message.role !== "system")
          .map((message) => ({
            role: message.role as "user" | "assistant",
            content: message.content,
          })),
        abortSignal: signal,
        // Pas de nouvelle tentative dans le SDK : sur un 429, c'est le
        // maillon suivant de la chaîne qui doit répondre, tout de suite.
        maxRetries: 0,
        // Sans `onError`, le SDK écrit l'erreur complète dans la console, y
        // compris le corps de la requête, donc le prompt.
        onError: () => {},
        // Sortie structurée : Gemini contraint sa réponse au schéma. La chaîne
        // la valide quand même avec Zod, qui reste la seule garantie.
        ...(json ? { output: Output.object({ schema: json.schema, name: json.name }) } : {}),
      });
      // `textStream` se termine sans rien lever quand l'appel échoue : seul
      // `fullStream` transmet l'erreur, dont la chaîne a besoin pour basculer.
      for await (const part of result.fullStream) {
        if (part.type === "text-delta") yield part.text;
        else if (part.type === "error") throw toGeminiError(part.error);
      }
    },
  };
}

function toGeminiError(error: unknown): LlmProviderError {
  if (APICallError.isInstance(error)) {
    if (error.statusCode === undefined)
      return new LlmProviderError("gemini", "network", "appel Gemini interrompu");
    return toProviderError("gemini", {
      status: error.statusCode,
      headers: new Headers(error.responseHeaders ?? {}),
      body: error.responseBody ?? "",
    });
  }
  // Erreur levée par le SDK avant l'appel (prompt refusé, par exemple) : le
  // maillon suivant peut encore répondre, et la cause reste visible au journal.
  return new LlmProviderError("gemini", "rejected", "requête Gemini refusée par le SDK");
}
