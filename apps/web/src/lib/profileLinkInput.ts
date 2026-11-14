import type { ProfileLinkKind } from "@kemet/shared";

/** Préfixe fixe affiché devant le champ : on n'y tape que son identifiant. */
export const LINK_PREFIXES: Partial<Record<ProfileLinkKind, string>> = {
  github: "github.com/",
  gitlab: "gitlab.com/",
  linkedin: "linkedin.com/in/",
};

const PREFIX_PATTERNS: Partial<Record<ProfileLinkKind, RegExp>> = {
  github: /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^?#]+?)\/?$/i,
  gitlab: /^(?:https?:\/\/)?(?:www\.)?gitlab\.com\/([^?#]+?)\/?$/i,
  linkedin: /^(?:https?:\/\/)?(?:[a-z]{2,3}\.|www\.)?linkedin\.com\/in\/([^?#]+?)\/?$/i,
};

/**
 * Ce que montre le champ pour un lien enregistré : l'identifiant seul quand
 * l'adresse suit la forme du service, l'adresse entière sinon, pour ne rien
 * perdre d'un lien plus ancien.
 */
export function linkInputValue(kind: ProfileLinkKind, url: string): string {
  const pattern = PREFIX_PATTERNS[kind];
  if (!pattern || !url) return url;
  return pattern.exec(url.trim())?.[1] ?? url;
}

/**
 * Adresse à enregistrer à partir du champ : l'identifiant reçoit le préfixe du
 * service, une adresse collée en entier est gardée telle quelle.
 */
export function linkFromInput(kind: ProfileLinkKind, value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const prefix = LINK_PREFIXES[kind];
  if (!prefix) return trimmed;
  const pasted = PREFIX_PATTERNS[kind]!.exec(trimmed);
  if (pasted) return `https://${prefix}${pasted[1]}`;
  if (/^[a-z]+:\/\//i.test(trimmed) || trimmed.includes(".")) return trimmed;
  return `https://${prefix}${trimmed.replace(/^@+/, "").replace(/^\/+|\/+$/g, "")}`;
}
