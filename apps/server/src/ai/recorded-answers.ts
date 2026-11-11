import { ASSISTANT_RECORDINGS, assistantRecordingTrigger, type AssistantRecording } from "@kemet/db";
import type { SkillExampleAnswer } from "@kemet/shared";

const REPLAY_CHUNK_WORDS = 4;

// Insensible à la casse, aux accents, à la ponctuation et aux espaces : une
// question de démo retapée à la main doit retrouver son enregistrement, une
// autre question jamais.
function normalizeQuestion(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/**
 * Enregistrement qui correspond exactement à la question posée, ou `null`. Un
 * skill demandé explicitement doit être celui de l'enregistrement.
 */
export function findRecordedAnswer(question: string, requestedSlugs: string[]): AssistantRecording | null {
  const normalized = normalizeQuestion(question);
  if (!normalized) return null;
  return (
    ASSISTANT_RECORDINGS.find(
      (recording) =>
        normalizeQuestion(recording.question) === normalized &&
        requestedSlugs.every((slug) => slug === recording.skillSlug),
    ) ?? null
  );
}

/** Découpe une réponse enregistrée en morceaux de quelques mots, pour la rejouer en streaming. */
export function splitForReplay(answer: string): string[] {
  const tokens = answer.match(/\S+\s*|\s+/g) ?? [];
  const chunks: string[] = [];
  for (let index = 0; index < tokens.length; index += REPLAY_CHUNK_WORDS) {
    chunks.push(tokens.slice(index, index + REPLAY_CHUNK_WORDS).join(""));
  }
  return chunks;
}

/**
 * Exemple affiché sur la page d'un skill : seulement pour un skill posé par le
 * seed (`isDemo`, jamais accepté du client), dont le slug a une réponse
 * enregistrée. Un skill recréé sous le même slug, même depuis un compte de
 * démonstration, n'obtient jamais une réponse écrite pour un autre contenu.
 */
export function findSkillExampleAnswer(slug: string, skillIsDemo: boolean): SkillExampleAnswer | null {
  if (!skillIsDemo) return null;
  const recording = ASSISTANT_RECORDINGS.find((candidate) => candidate.skillSlug === slug);
  return recording ? { question: assistantRecordingTrigger(recording), answer: recording.answer } : null;
}
