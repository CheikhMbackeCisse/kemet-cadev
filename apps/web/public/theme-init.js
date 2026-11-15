/* global document, window, URL, URLSearchParams */
// Lu avant le premier affichage, de façon bloquante, depuis index.html : le
// thème choisi à la main et le fond du parcours d'arrivée sont posés avant
// que la page ne se peigne, sans flash blanc. Fichier séparé plutôt qu'un
// script en ligne, que la Content-Security-Policy refuse.
(function () {
  var root = document.documentElement;
  try {
    var theme = window.localStorage.getItem("kemet:theme");
    if (theme === "light" || theme === "dark") root.setAttribute("data-theme", theme);
  } catch {
    // Stockage refusé (navigation privée) : le thème du système s'applique.
  }
  // Français par défaut ; anglais seulement si choisi (src/i18n/language.ts).
  // ?lang=en ou ?lang=fr : le lien EN de l'accueil statique, qui marche
  // avant que le JavaScript de l'application ne soit chargé.
  var asked = new URLSearchParams(window.location.search).get("lang");
  var english = false;
  try {
    if (asked === "en" || asked === "fr") window.localStorage.setItem("kemet:language", asked);
    english = window.localStorage.getItem("kemet:language") === "en";
  } catch {
    english = asked === "en";
  }
  if (asked) {
    var url = new URL(window.location.href);
    url.searchParams.delete("lang");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }
  if (english) root.setAttribute("lang", "en");
  var path = window.location.pathname;
  // Même liste que ARRIVAL_PATH_PATTERN (src/lib/navigation/arrival.ts).
  var arrival = /^\/(decouvrir|connexion|inscription|mot-de-passe-oublie|reinitialiser-mot-de-passe|completer-profil|bienvenue)(\/|$)/.test(path);
  // La racine d'une première visite mène à l'accueil : son fond dès le début.
  if (path === "/") {
    try {
      var intro = JSON.parse(window.localStorage.getItem("kemet.intro") || "null");
      arrival = !(intro && intro.seen === true);
    } catch {
      arrival = true;
    }
  }
  if (arrival) root.setAttribute("data-arrival", "");
  // Accueil écrit dans index.html, affiché avant le JavaScript (voir
  // src/lib/staticWelcome.ts, qui le retire).
  // Accueil statique écrit en français : jamais pour qui a choisi l'anglais.
  if (!english && arrival && (path === "/" || /^\/decouvrir\/?$/.test(path)))
    root.setAttribute("data-static-welcome", "");
})();
