/**
 * Dernière façon dont la personne a agi sur la page, posée sur <html> en
 * `data-input` : "keyboard" après une touche, "pointer" après un clic ou un
 * toucher. index.css cache le contour de focus tant qu'elle est "pointer".
 *
 * :focus-visible seul ne suffit pas : un focus donné par le code (titre
 * d'une nouvelle page, champ après une erreur) est encadré si la dernière
 * action était une touche, même Entrée sur un bouton, et Safari l'encadre
 * aussi après un toucher. Le focus continue de bouger pour les lecteurs
 * d'écran : seul son dessin dépend de la dernière action.
 */
export function trackInputModality(root: HTMLElement = document.documentElement): () => void {
  // Avant toute action, rien n'est encadré : le premier Tab suffit à le montrer.
  root.dataset.input = "pointer";

  function onKeyDown(event: KeyboardEvent) {
    // Un raccourci (Ctrl+B, Cmd+K) ne fait pas naviguer au clavier.
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    root.dataset.input = "keyboard";
  }
  function onPointerDown() {
    root.dataset.input = "pointer";
  }

  document.addEventListener("keydown", onKeyDown, true);
  document.addEventListener("pointerdown", onPointerDown, true);
  return () => {
    document.removeEventListener("keydown", onKeyDown, true);
    document.removeEventListener("pointerdown", onPointerDown, true);
  };
}
