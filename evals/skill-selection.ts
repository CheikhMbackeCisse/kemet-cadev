/**
 * Vérifie que l'assistant choisit le bon skill, ou aucun, pour une série de
 * questions types, à partir du nom et de la description des candidats
 * présélectionnés. Lancé à la main, jamais en CI : dépend d'un vrai appel
 * au modèle.
 *
 * Usage (au moins une clé d'API dans l'environnement) :
 *   pnpm tsx --env-file=.env evals/skill-selection.ts [--provider=gemini|groq|openrouter]
 * Voir evals/eval-chain.ts pour les options.
 */
import type { LlmMessage } from "../apps/server/src/ai/llm-provider.js";
import { createEvalRunner } from "./eval-chain.js";

const runner = createEvalRunner("skill-selection");

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
  const answer = await runner.ask(buildClassifyMessages(testCase.question));
  const output = answer.text;
  const slug = output.trim().toLowerCase().split("\n")[0]?.trim();
  const matched = CANDIDATES.find((candidate) => candidate.slug === slug)?.slug ?? null;

  const passed = !answer.unavailable && matched === testCase.expectedSlug;
  console.log(`\nQuestion : ${testCase.question}`);
  console.log(`Attendu : ${testCase.expectedSlug ?? "aucun"} — Obtenu : ${matched ?? "aucun"} (réponse brute : "${output.trim()}")`);
  console.log(answer.unavailable ? "NON JUGÉ" : passed ? "PASS" : "FAIL");
  return passed;
}

async function main() {
  let passedCount = 0;
  for (const testCase of CASES) {
    if (await runCase(testCase)) passedCount += 1;
  }
  runner.summarize(passedCount, CASES.length);
  const allPassed = passedCount === CASES.length;
  console.log(allPassed ? "\nTous les cas sont corrects." : "\nAu moins un cas est incorrect.");
  process.exit(allPassed ? 0 : 1);
}

main();
