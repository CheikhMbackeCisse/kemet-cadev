/** Espace d'entraide créé par la migration 0031, proposé aux débutants. */
export const BEGINNERS_SPACE_ID = "00000000-0000-0000-0000-000000000003";
export const BEGINNERS_SPACE_SLUG = "debuter-en-informatique";

/**
 * Débutant : rôle Étudiant, ou un rôle choisi sans aucun domaine (hors RH et
 * entrepreneurs, qui répondent à une autre question), ou un ancien compte venu
 * pour apprendre sans domaine. Un compte qui n'a répondu à rien n'est pas débutant.
 */
export function isBeginnerAudience(profile: {
  role: string | null;
  interests: readonly string[];
  intents: readonly string[];
}): boolean {
  return (
    profile.role === "student" ||
    (profile.interests.length === 0 &&
      ((profile.role !== null && !prefersTalentFeed(profile.role)) ||
        profile.intents.includes("learn")))
  );
}

/** RH et entrepreneurs : un fil "Pour toi" tourné vers les travaux, les profils et les projets plutôt que le code. */
export function prefersTalentFeed(role: string | null): boolean {
  return role === "hr" || role === "entrepreneur";
}
