export type Language = "fr" | "en";

/** Même clé que public/theme-init.js, qui pose la langue de la page avant le premier affichage. */
export const LANGUAGE_STORAGE_KEY = "kemet:language";

/** Le français pour tout le monde ; l'anglais seulement s'il a été choisi. */
export function pickLanguage(stored: string | null): Language {
  return stored === "en" ? "en" : "fr";
}

function readStoredLanguage(): string | null {
  try {
    return window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Langue de l'interface pour ce chargement de page. */
export function currentLanguage(): Language {
  if (typeof window === "undefined") return "fr";
  return pickLanguage(readStoredLanguage());
}

/** Enregistre le choix et recharge : tous les textes changent d'un coup. */
export function switchLanguage(language: Language): void {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Stockage refusé : la page rechargée reste en français.
  }
  window.location.reload();
}

/** Locale des dates et des nombres. */
export function localeOf(language: Language): string {
  return language === "en" ? "en-GB" : "fr-FR";
}

/** Locale des dates et des nombres pour ce chargement de page. */
export const LOCALE = localeOf(currentLanguage());
