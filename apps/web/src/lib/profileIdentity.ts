import type { Profile } from "@kemet/shared";
import { fr } from "../i18n/fr.js";

type IdentityFields = Pick<Profile, "role" | "workMode" | "organization">;

/**
 * La ligne "qui je suis" du profil : "Étudiant en informatique · EPT",
 * "Développeur freelance", "Recruteur chez Kobo". Le rôle seul quand rien
 * n'est précisé, rien pour "Autre" ou sans rôle.
 */
export function describeIdentity({ role, workMode, organization }: IdentityFields): string | null {
  const labels = fr.profile.identity;
  switch (role) {
    case "student":
      return organization ? `${labels.student} · ${organization}` : labels.student;
    case "developer":
      if (workMode === "freelance") return labels.developerFreelance;
      return organization ? labels.developerAt(organization) : labels.developer;
    case "hr":
      return organization ? labels.recruiterAt(organization) : labels.recruiter;
    case "entrepreneur":
      return organization ? `${labels.entrepreneur} · ${organization}` : labels.entrepreneur;
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
