import type { MeResponse } from "@kemet/shared";

/**
 * Tout compte peut publier une offre ; le raccourci du menu de Moi n'apparaît
 * qu'aux recruteurs, aux entrepreneurs et aux organisations, qui en publient.
 */
export function publishesOffers(profile: MeResponse["profile"]): boolean {
  if (!profile) return false;
  return (
    profile.kind === "organization" || profile.role === "hr" || profile.role === "entrepreneur"
  );
}
