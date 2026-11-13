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
    name: "Devicon 2.17.0 (16 logos de technologies en couleurs, variantes original), copiés par scripts/build-devicon.ts. Les logos appartiennent à leurs propriétaires et servent seulement à désigner les technologies",
    source: "https://devicon.dev, https://github.com/devicons/devicon",
    license: "MIT",
    usedIn: "apps/web/src/components/arrival/devicon/",
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
    license: "© Systalink, tous droits réservés. Utilisé avec l'accord écrit de Systalink, donné le 12/11/2026, pour ce visuel, son logo et le post « La CADEV 2026 en bref » publié à son nom dans l'espace CADEV 2026, crédité « Visuel : Systalink » avec un lien vers la publication d'origine",
    usedIn: "packages/db/seed-assets/cadev/cadev-couverture.jpg (packages/db/src/seed/cadev-post.ts)",
  },
  {
    name: "Symbole du logo de Systalink (deux tracés de icon0.svg, couleur #1264DA), repris à l'identique",
    source: "https://systalink.com/icon0.svg",
    license: "© Systalink, tous droits réservés. Utilisé avec l'accord écrit de Systalink, donné le 12/11/2026, comme photo de profil du compte Systalink du seed, sans badge ni mention de vérification",
    usedIn: "packages/db/src/seed/systalink.ts",
  },
  {
    name: "Logo « <cadev/> 2026 » de la CADEV 2026, © Systalink, redessiné en tracés vectoriels d'après le visuel promotionnel (lettres de Plus Jakarta Sans 700, « dev » en vert, « 2026 » en dessous, fond bleu nuit)",
    source: "https://www.instagram.com/systalink/p/DewrHGNjtTM/",
    license: "© Systalink, tous droits réservés. Utilisé avec l'accord écrit de Systalink, donné le 12/11/2026, comme icône de l'espace CADEV 2026 seulement",
    usedIn: "apps/web/src/components/ui/CadevLogo.tsx (apps/web/src/components/ui/SpaceIcon.tsx)",
  },
];
