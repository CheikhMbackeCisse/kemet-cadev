/**
 * Mesure le temps d'encodage de multilingual-e5-small sur CPU pour un lot de
 * textes de la taille d'un chunk de notes de skill (environ 500 mots).
 * Lancé à la main, jamais en CI : transformers.js télécharge le modèle au
 * premier appel.
 *
 * transformers.js dépend en dur de sharp (libvips, LGPL), interdit par
 * nos règles de licence. Ce paquet n'est donc pas dans les dépendances du workspace :
 * installer temporairement avec `pnpm add -D --workspace-root=false
 * @xenova/transformers` dans un dossier à part avant de lancer ce script, et
 * trancher le remplacement de la librairie d'embeddings avant le lot 6.
 *
 * Usage : pnpm tsx evals/embeddings-benchmark.ts
 */
import { pipeline } from "@xenova/transformers";

const SAMPLE_TEXT = "Ceci est un exemple de texte représentatif d'un chunk de notes de skill. ".repeat(20);
const RUNS = 10;

async function main() {
  console.log("Chargement du modèle multilingual-e5-small...");
  const extractor = await pipeline("feature-extraction", "Xenova/multilingual-e5-small");

  const durations: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const start = performance.now();
    await extractor(SAMPLE_TEXT, { pooling: "mean", normalize: true });
    durations.push(performance.now() - start);
  }

  const average = durations.reduce((sum, d) => sum + d, 0) / durations.length;
  console.log(`Temps moyen sur ${RUNS} appels : ${average.toFixed(1)} ms.`);
  console.log(`Min : ${Math.min(...durations).toFixed(1)} ms. Max : ${Math.max(...durations).toFixed(1)} ms.`);
}

main();
