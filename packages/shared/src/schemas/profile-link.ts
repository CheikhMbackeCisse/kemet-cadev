import { z } from "zod";

export const PROFILE_LINK_KINDS = ["github", "gitlab", "linkedin", "portfolio", "website"] as const;

export type ProfileLinkKind = (typeof PROFILE_LINK_KINDS)[number];

export const MAX_PROFILE_LINK_LENGTH = 200;

// Un lien de forge ou de réseau doit mener chez ce service : l'icône affichée
// à côté le promet. Portfolio et site restent libres.
const LINK_HOSTS: Partial<Record<ProfileLinkKind, (host: string) => boolean>> = {
  github: (host) => host === "github.com" || host === "www.github.com",
  gitlab: (host) => host === "gitlab.com" || host === "www.gitlab.com",
  linkedin: (host) => host === "linkedin.com" || host.endsWith(".linkedin.com"),
};

/** Vrai pour un lien https valable pour ce type, avec un chemin au-delà de la racine pour une forge ou un réseau. */
export function isValidProfileLink(kind: ProfileLinkKind, value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username !== "" || url.password !== "") return false;
  const hostCheck = LINK_HOSTS[kind];
  if (!hostCheck) return true;
  return hostCheck(url.hostname.toLowerCase()) && url.pathname.length > 1;
}

export function profileLinkSchema(kind: ProfileLinkKind) {
  return z
    .string()
    .trim()
    .max(MAX_PROFILE_LINK_LENGTH)
    .refine((value) => isValidProfileLink(kind, value), {
      message:
        kind === "portfolio" || kind === "website"
          ? "Lien https uniquement."
          : "Ce lien ne mène pas au bon service.",
    });
}
