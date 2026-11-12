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
    name: "Simple Icons 16.37.0 (34 logos de technologies), généré par scripts/build-tech-logos.ts",
    source: "https://simpleicons.org",
    license: "CC0-1.0",
    usedIn: "apps/web/src/components/ui/techLogos.ts",
  },
  {
    name: "Contour de l'Afrique, Natural Earth via world-atlas 2.0.2 (countries-50m), généré par scripts/build-africa-outline.ts",
    source: "https://www.naturalearthdata.com, https://github.com/topojson/world-atlas",
    license: "Domaine public (Natural Earth), ISC (world-atlas)",
    usedIn: "apps/web/src/components/arrival/africaOutline.ts",
  },
  {
    name: "Visuel promotionnel de la CADEV 2026 (« Coupe d'Afrique des Développeurs »), © Systalink, repris sans retouche ni recadrage",
    source: "https://www.instagram.com/systalink/p/DewrHGNjtTM/",
    license: "© Systalink, tous droits réservés. Visuel de l'organisateur de la compétition, crédité « Visuel : Systalink » avec un lien vers la source, affiché uniquement dans le post de démonstration « La CADEV 2026 en bref »",
    usedIn: "packages/db/seed-assets/cadev/cadev-couverture.jpg (packages/db/src/seed/cadev-post.ts)",
  },
];
