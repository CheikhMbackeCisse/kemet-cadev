import "@testing-library/jest-dom/vitest";

// jsdom n'implémente pas matchMedia, dont dépend tout le cadre des pages
// (barre d'activité, panneau latéral). Par défaut, aucune requête ne
// correspond, comme sur un petit écran ; un test qui a besoin d'une
// largeur précise remplace cette fonction par vi.stubGlobal.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) satisfies MediaQueryList;
}

// jsdom n'implémente pas non plus le défilement, que le routeur remet en
// haut à chaque navigation, ni scrollIntoView, qui amène un champ en erreur
// à l'écran.
if (typeof window !== "undefined") {
  window.scrollTo = () => {};
  Element.prototype.scrollIntoView = () => {};
}
