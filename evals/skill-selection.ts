/**
 * Vérifie que l'assistant choisit le bon skill, ou aucun, pour une série de
 * questions types, à partir du nom et de la description des candidats
 * présélectionnés. Lancé à la main, jamais en CI : dépend d'un vrai appel
 * au modèle.
 *
 * Usage :
 *   GOOGLE_GENERATIVE_AI_API_KEY=... OPENROUTER_API_KEY=... pnpm tsx evals/skill-selection.ts
 */
import { createLlmProviderFromEnv } from "../apps/server/src/ai/create-llm-provider.js";
import type { LlmMessage } from "../apps/server/src/ai/llm-provider.js";

interface Candidate {
  slug: string;
  description: string;
}

const CANDIDATES: Candidate[] = [
  { slug: "wave-paiements", description: "Intégrer les paiements Wave dans une API Node.js : webhooks, statuts, remboursements." },
  { slug: "ci-docker-fiable", description: "Rendre une CI GitHub Actions stable quand elle construit et démarre des images Docker." },
  { slug: "migrations-drizzle", description: "Écrire et relire des migrations Drizzle sans casser une base de production." },
];

interface Case {
  question: string;
  expectedSlug: string | null;
}

const CASES: Case[] = [
  { question: "Comment je vérifie la signature d'un webhook Wave ?", expectedSlug: "wave-paiements" },
  { question: "Ma CI met douze minutes à construire les images Docker, comment accélérer ça ?", expectedSlug: "ci-docker-fiable" },
  { question: "Quelle est la meilleure recette de thiéboudiène ?", expectedSlug: null },
];

function buildClassifyMessages(question: string): LlmMessage[] {
  const list = CANDIDATES.map((candidate) => `${candidate.slug} — ${candidate.description}`).join("\n");
  return [
    {
      role: "system",
      content:
        "Tu choisis un identifiant de skill dans une liste, tu ne réponds jamais à la question. " +
        "Réponds uniquement par le slug du skill le plus utile pour répondre à la question, ou par " +
        "le mot aucun si rien ne correspond vraiment. Une seule ligne, rien d'autre.",
    },
    { role: "user", content: `Question : ${question}\n\nSkills disponibles :\n${list}` },
  ];
}

async function runCase(testCase: Case): Promise<boolean> {
  const provider = createLlmProviderFromEnv(process.env);
  let output = "";
  for await (const chunk of provider.streamResponse(buildClassifyMessages(testCase.question))) output += chunk.delta;
  const slug = output.trim().toLowerCase().split("\n")[0]?.trim();
  const matched = CANDIDATES.find((candidate) => candidate.slug === slug)?.slug ?? null;

  const passed = matched === testCase.expectedSlug;
  console.log(`\nQuestion : ${testCase.question}`);
  console.log(`Attendu : ${testCase.expectedSlug ?? "aucun"} — Obtenu : ${matched ?? "aucun"} (réponse brute : "${output.trim()}")`);
  console.log(passed ? "PASS" : "FAIL");
  return passed;
}

async function main() {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY || !process.env.OPENROUTER_API_KEY) {
    console.error("GOOGLE_GENERATIVE_AI_API_KEY et OPENROUTER_API_KEY sont requises pour cette suite.");
    process.exit(1);
  }
  let allPassed = true;
  for (const testCase of CASES) {
    allPassed = (await runCase(testCase)) && allPassed;
  }
  console.log(allPassed ? "\nTous les cas sont corrects." : "\nAu moins un cas est incorrect.");
  process.exit(allPassed ? 0 : 1);
}

main();
