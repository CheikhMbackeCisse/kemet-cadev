/**
 * Vérifie que "Qui a travaillé sur ce sujet ?" retient les bons auteurs pour
 * une série de sujets types, et personne quand rien ne correspond, à partir
 * d'une présélection fixe. Lancé à la main, jamais en CI : dépend d'un vrai
 * appel au modèle.
 *
 * Usage (au moins une clé d'API dans l'environnement) :
 *   pnpm tsx --env-file=.env evals/work-matching.ts [--provider=gemini|groq|openrouter]
 * Voir evals/eval-chain.ts pour les options.
 */
import { buildMatchMessages, parseModelSuggestions } from "../apps/server/src/ai/work-matcher.js";
import { workMatchModelOutputSchema } from "../packages/shared/src/index.js";
import { createEvalRunner } from "./eval-chain.js";
import { toCandidates } from "./work-match-fixtures.js";

const runner = createEvalRunner("work-matching");

const CANDIDATES = toCandidates([
  {
    title: "Gestion de stock hors ligne pour boutiques de quartier",
    type: "class_project",
    summary:
      "Les ventes sont enregistrées dans le navigateur sans réseau et synchronisées à la reconnexion.",
    tags: ["hors-ligne", "synchronisation", "mobile"],
    stack: ["Vue", "Node.js"],
    handle: "skander-jaziri",
  },
  {
    title: "Capteurs d'humidité du sol en LoRa",
    type: "application",
    summary: "Firmware basse consommation, un an sur une pile, pour des champs sans électricité.",
    tags: ["iot", "agriculture", "lora"],
    stack: ["Rust", "C"],
    handle: "heritier-kabeya",
  },
  {
    title: "Idempotence des paiements mobile money",
    type: "article",
    summary: "Rejouer une requête de paiement après une coupure sans débiter deux fois le client.",
    tags: ["paiements", "mobile-money", "idempotence"],
    stack: ["Java", "Kafka"],
    handle: "kiprono-langat",
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
    expected: ["skander-jaziri"],
  },
  {
    subject: "Je dois choisir la fréquence de mesure de capteurs agricoles alimentés par pile.",
    expected: ["heritier-kabeya"],
  },
  { subject: "Quelle est la meilleure recette de thiéboudiène ?", expected: [] },
];

async function runCase(testCase: Case): Promise<boolean> {
  const prompt = buildMatchMessages(testCase.subject, CANDIDATES);
  // Même demande qu'en production : la chaîne valide le JSON avec Zod.
  const answer = await runner.ask(prompt.messages, {
    json: { name: "work_match", schema: workMatchModelOutputSchema },
  });
  const accepted = parseModelSuggestions(answer.text, prompt.candidates);
  const handles = accepted?.map((entry) => entry.person.handle) ?? null;

  // Chaque personne attendue doit être retenue ; une suggestion de plus est
  // tolérée si elle reste justifiable, sauf quand aucune n'est attendue.
  const passed =
    !answer.unavailable &&
    handles !== null &&
    testCase.expected.every((handle) => handles.includes(handle)) &&
    (testCase.expected.length > 0 || handles.length === 0);
  console.log(`\nSujet : ${testCase.subject}`);
  console.log(
    `Attendu : ${testCase.expected.join(", ") || "personne"} — Obtenu : ${handles?.join(", ") ?? "réponse illisible"}`,
  );
  for (const entry of accepted ?? []) console.log(`  @${entry.person.handle} : ${entry.justification}`);
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
