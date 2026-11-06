/**
 * Mesure le débit réel des offres gratuites Gemini et OpenRouter : envoie des
 * requêtes à intervalle croissant jusqu'à obtenir une erreur de quota (429),
 * et note le dernier intervalle stable pour chaque fournisseur. Lancé à la
 * main, jamais en CI.
 *
 * Usage :
 *   GOOGLE_GENERATIVE_AI_API_KEY=... OPENROUTER_API_KEY=... pnpm tsx evals/llm-throughput.ts
 *
 * Teste le premier modèle Gemini et le premier modèle OpenRouter de la
 * configuration du serveur (GEMINI_MODEL, OPENROUTER_MODELS).
 */

import { resolveLlmModels } from "../apps/server/src/ai/create-llm-provider.js";

const models = resolveLlmModels(process.env);

const INTERVALS_MS = [2000, 1000, 500, 250, 100];

interface Provider {
  name: string;
  apiKeyEnvVar: string;
  ping: (apiKey: string) => Promise<Response>;
}

const providers: Provider[] = [
  {
    name: "Gemini",
    apiKeyEnvVar: "GOOGLE_GENERATIVE_AI_API_KEY",
    ping: (apiKey) =>
      fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(models.gemini[0]!)}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({ contents: [{ parts: [{ text: "ping" }] }] }),
        },
      ),
  },
  {
    name: "OpenRouter",
    apiKeyEnvVar: "OPENROUTER_API_KEY",
    ping: (apiKey) =>
      fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: models.openrouter[0],
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 1,
        }),
      }),
  },
];

async function ping(provider: Provider, apiKey: string, intervalMs: number): Promise<boolean> {
  const response = await provider.ping(apiKey);

  if (response.status === 429) {
    console.log(`${provider.name} : quota atteint à l'intervalle ${intervalMs} ms.`);
    return false;
  }
  if (!response.ok) {
    console.error(
      `${provider.name} : erreur inattendue (${response.status}) à l'intervalle ${intervalMs} ms.`,
    );
    return false;
  }
  return true;
}

async function measure(provider: Provider, apiKey: string): Promise<void> {
  console.log(`--- ${provider.name} ---`);
  for (const intervalMs of INTERVALS_MS) {
    console.log(`${provider.name} : test à l'intervalle ${intervalMs} ms (10 requêtes)...`);
    let stable = true;
    for (let i = 0; i < 10 && stable; i++) {
      stable = await ping(provider, apiKey, intervalMs);
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    if (stable) {
      console.log(`${provider.name} : intervalle ${intervalMs} ms stable sur 10 requêtes.`);
    } else {
      console.log(`${provider.name} : intervalle ${intervalMs} ms instable, arrêt des tests.`);
      break;
    }
  }
}

async function main() {
  for (const provider of providers) {
    const apiKey = process.env[provider.apiKeyEnvVar];
    if (!apiKey) {
      console.error(`${provider.apiKeyEnvVar} manquant, ${provider.name} ignoré.`);
      continue;
    }
    await measure(provider, apiKey);
  }
}

main();
