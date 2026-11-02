/**
 * À l'ouverture d'un dialogue ou d'une feuille, Radix place le focus sur le
 * premier élément focusable, souvent le bouton de fermeture, encadré dès
 * l'ouverture. Le focus va plutôt sur le contenu lui-même (tabIndex -1) :
 * Tab mène ensuite au premier élément, et un lecteur d'écran annonce le
 * titre.
 */
export function focusContent(event: Event) {
  event.preventDefault();
  (event.currentTarget as HTMLElement | null)?.focus();
}
