// Workbox 7 télécharge sa précache un fichier après l'autre
// (PrecacheController.install, voir GoogleChrome/workbox#2528). Avec tous les
// morceaux de l'application, soit 126 fichiers, l'installation demandait un
// aller-retour réseau par fichier : 50 s depuis Dakar, bien plus en 3G, et le
// service worker ne s'activait parfois jamais. La précache se limite donc à la
// coquille : la page, ce qu'elle charge d'emblée et les fichiers de la racine.
// Les morceaux chargés à la demande sont mis en cache à leur premier usage.

interface PrecacheEntry {
  url: string;
}

const ASSET_REFERENCE = /(?:src|href)="\/(assets\/[^"]+)"/g;

/** Chemins des fichiers de assets/ que index.html charge directement. */
export function shellAssetsOf(indexHtml: string): Set<string> {
  return new Set(Array.from(indexHtml.matchAll(ASSET_REFERENCE), (match) => match[1] ?? ""));
}

/** Garde les fichiers hors de assets/ et ceux de assets/ chargés par index.html. */
export function keepShellEntries<T extends PrecacheEntry>(entries: T[], indexHtml: string): T[] {
  const shellAssets = shellAssetsOf(indexHtml);
  return entries.filter((entry) => !entry.url.startsWith("assets/") || shellAssets.has(entry.url));
}
