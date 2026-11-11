import { assistantRecordingTrigger, WAVE_WEBHOOK_RECORDING } from "../assistant-recordings.js";

/**
 * Question Wave en tête du fil "Pour toi" d'un visiteur, avec la réponse
 * enregistrée de @kemet dépliée dessous. Comme dans l'application, @kemet est
 * appelé par une réponse au post, jamais par le post seul (ADR 0033).
 */
export const WAVE_SHOWCASE = {
  key: "wave-webhook-question",
  recording: WAVE_WEBHOOK_RECORDING,
  authorHandle: "heritier-kabeya",
  hoursAgo: 5,
  body:
    "Je branche les paiements Wave sur une API Node.js. Les notifications arrivent bien sur mon " +
    "endpoint, mais comment vérifier qu'elles viennent vraiment de Wave ?",
  trigger: assistantRecordingTrigger(WAVE_WEBHOOK_RECORDING),
  hearts: 34,
  replies: [
    {
      key: "coumba-raw-body",
      authorHandle: "coumba-thiam",
      minutesAfter: 18,
      body:
        "Avec Fastify, ajoute un parser de contenu qui garde le Buffer pour cette route : sinon le " +
        "corps est déjà reformaté et la signature ne correspond jamais.",
    },
    {
      key: "kiprono-idempotence",
      authorHandle: "kiprono-langat",
      minutesAfter: 41,
      body:
        "Garde aussi l'identifiant de chaque notification reçue : Wave peut renvoyer la même " +
        "plusieurs fois, ton traitement doit pouvoir la recevoir deux fois sans rien doubler.",
    },
    {
      key: "heritier-thanks",
      authorHandle: "heritier-kabeya",
      minutesAfter: 75,
      body: "C'était bien le corps reformaté par le parser JSON. Ça passe maintenant, merci.",
    },
  ],
} as const;
