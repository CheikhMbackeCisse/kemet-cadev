/**
 * Mesure le débit réel de l'offre gratuite Mistral "Experiment" : envoie des
 * requêtes à intervalle croissant jusqu'à obtenir une erreur de quota (429),
 * et note le dernier intervalle stable. Lancé à la main, jamais en CI.
 *
 * Usage : MISTRAL_API_KEY=... pnpm tsx evals/mistral-throughput.ts
 */

const apiKey = process.env.MISTRAL_API_KEY;
if (!apiKey) {
  console.error("MISTRAL_API_KEY manquant.");
  process.exit(1);
}

const INTERVALS_MS = [2000, 1000, 500, 250, 100];

async function ping(intervalMs: number): Promise<boolean> {
  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "mistral-small-latest",
      messages: [{ role: "user", content: "ping" }],
      max_tokens: 1,
    }),
  });

  if (response.status === 429) {
    console.log(`Quota atteint à l'intervalle ${intervalMs} ms.`);
    return false;
  }
  if (!response.ok) {
    console.error(`Erreur inattendue (${response.status}) à l'intervalle ${intervalMs} ms.`);
    return false;
  }
  return true;
}

async function main() {
  for (const intervalMs of INTERVALS_MS) {
    console.log(`Test à l'intervalle ${intervalMs} ms (10 requêtes)...`);
    let stable = true;
    for (let i = 0; i < 10 && stable; i++) {
      stable = await ping(intervalMs);
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    if (stable) {
      console.log(`Intervalle ${intervalMs} ms : stable sur 10 requêtes.`);
    } else {
      console.log(`Intervalle ${intervalMs} ms : instable, arrêt des tests.`);
      break;
    }
  }
}

main();
