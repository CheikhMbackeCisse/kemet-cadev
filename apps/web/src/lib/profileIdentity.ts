import type { Profile } from "@kemet/shared";
import { fr } from "../i18n/fr.js";

type IdentityFields = Pick<Profile, "role" | "workMode" | "organization">;

const VOWEL_START = /^[aeiouyhàâäéèêëîïôöùûü]/i;

/**
 * "à" devant un nom d'établissement saisi librement : "à l'EPT",
 * "à l'Université d'Ibadan", "au Cesti" pour "Le Cesti", "à Sup'Info".
 */
export function atPlace(name: string): string {
  const article = /^(l'|l’|la |le |les )(.*)$/i.exec(name);
  if (article) {
    const rest = article[2]!;
    switch (article[1]!.toLowerCase()) {
      case "le ":
        return `au ${rest}`;
      case "les ":
        return `aux ${rest}`;
      case "la ":
        return `à la ${rest}`;
      default:
        return `à l'${rest}`;
    }
  }
  return VOWEL_START.test(name) ? `à l'${name}` : `à ${name}`;
}

/**
 * La ligne "qui je suis" du profil, en verbes pour n'avoir aucun accord à
 * faire : "Étudie l'informatique à l'EPT", "Code en freelance", "Recrute
 * chez Kobo". Le rôle seul quand rien n'est précisé, rien pour "Autre" ou
 * sans rôle.
 */
export function describeIdentity({ role, workMode, organization }: IdentityFields): string | null {
  const labels = fr.profile.identity;
  switch (role) {
    case "student":
      return organization ? labels.studentAt(atPlace(organization)) : labels.student;
    case "developer":
      if (workMode === "freelance") return labels.developerFreelance;
      return organization ? labels.developerAt(organization) : labels.developer;
    case "hr":
      return organization ? labels.recruiterAt(organization) : labels.recruiter;
    case "entrepreneur":
      return organization ? labels.entrepreneurOf(organization) : labels.entrepreneur;
    case "designer":
      return labels.designer;
    case "project_manager":
      return labels.projectManager;
    default:
      return null;
  }
}

/** Ligne sous le nom : l'identité, puis la spécialité. */
export function profileSubtitle(profile: IdentityFields & Pick<Profile, "title">): string | null {
  return [describeIdentity(profile), profile.title].filter(Boolean).join(" · ") || null;
}
