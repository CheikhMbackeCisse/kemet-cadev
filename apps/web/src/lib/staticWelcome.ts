/**
 * L'accueil écrit en HTML dans index.html, affiché avant le JavaScript
 * (public/theme-init.js le montre). React le retire dès que sa propre carte
 * est à la même place, ou dès qu'une autre page s'affiche.
 */
export function releaseStaticWelcome(): void {
  document.documentElement.removeAttribute("data-static-welcome");
  document.getElementById("static-welcome")?.remove();
}
