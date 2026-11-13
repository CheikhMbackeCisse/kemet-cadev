/* global document, window */
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
})();
