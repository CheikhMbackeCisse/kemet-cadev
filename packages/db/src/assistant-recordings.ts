/**
 * Réponses de l'assistant écrites à l'avance pour des questions de démonstration.
 * Le seed s'en sert pour les échanges du salon CADEV 2026, le serveur pour la démo
 * de secours quand les deux fournisseurs d'IA sont saturés (ASSISTANT_RECORDED_ANSWERS).
 */
export interface AssistantRecording {
  skillSlug: string;
  /** Écrit "@kemet avec <skill>, <question>" plutôt que de laisser l'assistant choisir. */
  explicitSkill: boolean;
  question: string;
  answer: string;
}

export const FLUTTER_SYNC_RECORDING: AssistantRecording = {
  skillSlug: "flutter-sync-hors-ligne",
  explicitSkill: true,
  question: "comment je stocke la file d'opérations en attente côté client ?",
  answer: [
    "Je m'appuie sur le skill flutter-sync-hors-ligne.",
    "",
    "Garde une table locale d'opérations plutôt qu'un état final, une ligne par écriture faite hors ligne :",
    "",
    "```dart",
    "class PendingOperation {",
    "  final String id; // UUID généré sur le téléphone",
    "  final String entity;",
    "  final String entityId;",
    "  final Map<String, dynamic> payload;",
    "  final DateTime createdAt;",
    "  SyncStatus status; // pending, synced ou conflict",
    "}",
    "```",
    "",
    "- À la reconnexion, rejoue la file dans l'ordre de `createdAt` et envoie l'`id` avec chaque opération : le serveur ignore une opération déjà reçue.",
    "- Le serveur tranche les conflits avec son propre horodatage, jamais celui du téléphone, dont l'horloge dérive après une longue période hors ligne.",
    "- Une opération refusée passe en `conflict` et reste visible à l'écran, au lieu de disparaître en silence.",
  ].join("\n"),
};

export const DESIGN_SYSTEM_RECORDING: AssistantRecording = {
  skillSlug: "design-system-theme-sombre",
  explicitSkill: false,
  question: "comment ajouter un thème sombre à un design system React existant sans tout réécrire ?",
  answer: [
    "Je m'appuie sur le skill design-system-theme-sombre.",
    "",
    "Remplace chaque couleur écrite en dur par une variable CSS, définie une fois sur `:root` puis redéfinie pour le thème sombre :",
    "",
    "```css",
    ":root { --surface: #ffffff; --text: #14171f; }",
    "[data-theme=\"dark\"] { --surface: #12141a; --text: #e8eaf0; }",
    "```",
    "",
    "- Détecte la préférence du système à un seul endroit, dans un contexte React qui expose le thème choisi. Un composant qui lit `window.matchMedia` lui-même ignore le choix manuel de l'utilisateur.",
    "- Vérifie le contraste des deux thèmes séparément : une couleur lisible en clair ne l'est pas forcément en sombre, c'est souvent le cas des liens et des états désactivés.",
  ].join("\n"),
};

export const CI_DOCKER_RECORDING: AssistantRecording = {
  skillSlug: "ci-docker-fiable",
  explicitSkill: true,
  question: "mes tests e2e échouent au hasard sur GitHub Actions juste après le démarrage des conteneurs, une idée ?",
  answer: [
    "Je m'appuie sur le skill ci-docker-fiable.",
    "",
    "Le plus probable : les tests démarrent avant que les services soient prêts. Remplace tout `sleep` par une attente sur les healthchecks :",
    "",
    "```yaml",
    "- run: docker compose up -d --wait --wait-timeout 180",
    "```",
    "",
    "- Chaque service doit déclarer un `healthcheck` qui teste vraiment sa disponibilité (une requête HTTP, `pg_isready`), pas seulement que le processus tourne.",
    "- Si l'échec persiste, regarde la mémoire de chaque conteneur avec `docker stats` : un service tué faute de mémoire échoue sans message clair dans les journaux de l'application.",
    "- Le cache de couches de buildx (`cache-from: type=gha`) réduit aussi le temps de construction de plusieurs minutes.",
  ].join("\n"),
};

export const WAVE_WEBHOOK_RECORDING: AssistantRecording = {
  skillSlug: "wave-paiements",
  explicitSkill: true,
  question: "comment vérifier la signature d'un webhook Wave en Node.js ?",
  answer: [
    "Je m'appuie sur le skill wave-paiements.",
    "",
    "Calcule le HMAC SHA-256 du corps brut de la requête avec ton secret de webhook, puis compare-le à l'en-tête de signature en temps constant :",
    "",
    "```ts",
    "import { createHmac, timingSafeEqual } from \"node:crypto\";",
    "",
    "export function isValidWaveSignature(rawBody: Buffer, signature: string, secret: string): boolean {",
    "  const expected = Buffer.from(createHmac(\"sha256\", secret).update(rawBody).digest(\"hex\"));",
    "  const received = Buffer.from(signature);",
    "  return expected.length === received.length && timingSafeEqual(expected, received);",
    "}",
    "```",
    "",
    "- Utilise le corps brut, avant tout parsing JSON : un JSON reformaté ne donne plus la même signature.",
    "- Même avec une signature valide, revérifie le statut de la transaction par l'API Wave avant de confirmer le paiement : les webhooks arrivent sans garantie d'ordre.",
  ].join("\n"),
};

export const ASSISTANT_RECORDINGS: readonly AssistantRecording[] = [
  FLUTTER_SYNC_RECORDING,
  DESIGN_SYSTEM_RECORDING,
  CI_DOCKER_RECORDING,
  WAVE_WEBHOOK_RECORDING,
];

/** Corps du message qui appelle l'assistant pour cet enregistrement. */
export function assistantRecordingTrigger(recording: AssistantRecording): string {
  return recording.explicitSkill
    ? `@kemet avec ${recording.skillSlug}, ${recording.question}`
    : `@kemet ${recording.question}`;
}
