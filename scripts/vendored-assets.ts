/**
 * Ressources copiées dans le dépôt plutôt qu'installées : aucun paquet ne les
 * apporte, leur licence est donc notée ici et recopiée dans
 * THIRD_PARTY_LICENSES.md.
 */
export interface VendoredAsset {
  name: string;
  source: string;
  license: string;
  usedIn: string;
}

export const VENDORED_ASSETS: readonly VendoredAsset[] = [
  {
    name: "Simple Icons 16.37.0 (Python, JavaScript, TypeScript, React, Flutter, Node.js, Go, Docker, Linux, HTML5, CSS, Kotlin, Swift)",
    source: "https://simpleicons.org",
    license: "CC0-1.0",
    usedIn: "apps/web/src/components/arrival/techLogos.ts",
  },
  {
    name: "Contour de l'Afrique, Natural Earth via world-atlas 2.0.2 (countries-110m)",
    source: "https://www.naturalearthdata.com, https://github.com/topojson/world-atlas",
    license: "Domaine public (Natural Earth), ISC (world-atlas)",
    usedIn: "apps/web/src/components/arrival/africaOutline.ts",
  },
];
