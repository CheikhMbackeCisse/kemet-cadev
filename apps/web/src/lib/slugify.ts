import { ChatApiError } from "./chat/api.js";

const DIACRITICS_PATTERN = new RegExp(
  `[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`,
  "g",
);

const MAX_SLUG_LENGTH = 50;
const MAX_ATTEMPTS = 5;

/** Identifiant lisible dans une URL, derive d'un nom saisi en francais. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITICS_PATTERN, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Identifiant tiré du titre, assez long pour le schéma (3 caractères au moins). */
export function slugFromTitle(title: string, fallback: string): string {
  const base = slugify(title).slice(0, MAX_SLUG_LENGTH).replace(/-+$/, "");
  return base.length >= 3 ? base : `${fallback}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Crée avec un identifiant tiré du titre, qu'on ne demande plus : s'il est
 * déjà pris (409), on essaie "titre-2", "titre-3"...
 */
export async function createWithSlugFromTitle<T>(
  title: string,
  fallback: string,
  create: (slug: string) => Promise<T>,
): Promise<T> {
  const base = slugFromTitle(title, fallback);
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await create(attempt === 1 ? base : `${base}-${attempt}`);
    } catch (error) {
      const taken = error instanceof ChatApiError && error.statusCode === 409;
      if (!taken || attempt >= MAX_ATTEMPTS) throw error;
    }
  }
}
