export type ShareOutcome = "shared" | "copied" | "cancelled" | "failed";

/**
 * Feuille de partage du téléphone quand le navigateur en a une, sinon copie
 * du lien. Fermer la feuille sans choisir n'est pas une erreur.
 */
export async function shareLink(url: string, title: string): Promise<ShareOutcome> {
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ url, title });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    return "failed";
  }
}
