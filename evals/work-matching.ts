/**
 * Vérifie que "Qui a travaillé sur ce sujet ?" retient les bons auteurs pour
 * une série de sujets types, et personne quand rien ne correspond, à partir
 * d'une présélection fixe. Lancé à la main, jamais en CI : dépend d'un vrai
 * appel au modèle.
 *
 * Usage :
 *   GOOGLE_GENERATIVE_AI_API_KEY=... OPENROUTER_API_KEY=... pnpm tsx evals/work-matching.ts
 */
import { createLlmProviderFromEnv } from "../apps/server/src/ai/create-llm-provider.js";
import { buildMatchMessages, parseModelSuggestions } from "../apps/server/src/ai/work-matcher.js";
import { toCandidates } from "./work-match-fixtures.js";

const CANDIDATES = toCandidates([
  {
    title: "Gestion de stock hors ligne pour boutiques de quartier",
    type: "class_project",
    summary:
      "Les ventes sont enregistrées dans le navigateur sans réseau et synchronisées à la reconnexion.",
    tags: ["hors-ligne", "synchronisation", "mobile"],
    stack: ["Vue", "Node.js"],
    handle: "yassine-trabelsi",
  },
  {
    title: "Capteurs d'humidité du sol en LoRa",
    type: "application",
    summary: "Firmware basse consommation, un an sur une pile, pour des champs sans électricité.",
    tags: ["iot", "agriculture", "lora"],
    stack: ["Rust", "C"],
    handle: "jean-marc-mukendi",
  },
  {
    title: "Idempotence des paiements mobile money",
    type: "article",
    summary: "Rejouer une requête de paiement après une coupure sans débiter deux fois le client.",
    tags: ["paiements", "mobile-money", "idempotence"],
    stack: ["Java", "Kafka"],
    handle: "samuel-mwangi",
  },
]);

interface Case {
  subject: string;
  expected: string[];
}

const CASES: Case[] = [
  {
    subject:
      "Comment synchroniser une application Flutter qui fonctionne plusieurs jours sans réseau ?",
    expected: ["yassine-trabelsi"],
  },
  {
    subject: "Je dois choisir la fréquence de mesure de capteurs agricoles alimentés par pile.",
    expected: ["jean-marc-mukendi"],
  },
  { subject: "Quelle est la meilleure recette de thiéboudiène ?", expected: [] },
];

async function runCase(testCase: Case): Promise<boolean> {
  const provider = createLlmProviderFromEnv(process.env);
  let output = "";
  for await (const chunk of provider.streamResponse(
    buildMatchMessages(testCase.subject, CANDIDATES),
  )) {
    output += chunk.delta;
  }
  const accepted = parseModelSuggestions(output, CANDIDATES);
  const handles = accepted?.map((entry) => entry.person.handle) ?? null;

  // Chaque personne attendue doit être retenue ; une suggestion de plus est
  // tolérée si elle reste justifiable, sauf quand aucune n'est attendue.
  const passed =
    handles !== null &&
    testCase.expected.every((handle) => handles.includes(handle)) &&
    (testCase.expected.length > 0 || handles.length === 0);
  console.log(`\nSujet : ${testCase.subject}`);
  console.log(
    `Attendu : ${testCase.expected.join(", ") || "personne"} — Obtenu : ${handles?.join(", ") ?? "réponse illisible"}`,
  );
  for (const entry of accepted ?? [])
    console.log(`  @${entry.person.handle} : ${entry.justification}`);
  console.log(passed ? "PASS" : "FAIL");
  return passed;
}

async function main() {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY || !process.env.OPENROUTER_API_KEY) {
    console.error(
      "GOOGLE_GENERATIVE_AI_API_KEY et OPENROUTER_API_KEY sont requises pour cette suite.",
    );
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
