/**
 * Hauteur des lignes d'une longue liste au moment où on la quitte. Au retour,
 * la liste est reconstruite : `contain-intrinsic-size: auto` ne garde la
 * hauteur mesurée que pour le même élément, pas pour celui qui le remplace.
 * Les lignes hors de l'écran reprennent donc ces hauteurs plutôt qu'une
 * estimation, et la position de lecture rendue tombe sur le même contenu.
 */

const HEIGHT_KEY_ATTRIBUTE = "data-height-key";
const MAX_REMEMBERED = 600;

const heights = new Map<string, number>();

export function rememberHeights(root: ParentNode = document) {
  for (const element of root.querySelectorAll<HTMLElement>(`[${HEIGHT_KEY_ATTRIBUTE}]`)) {
    const key = element.getAttribute(HEIGHT_KEY_ATTRIBUTE);
    if (!key) continue;
    heights.delete(key);
    heights.set(key, element.getBoundingClientRect().height);
  }
  for (const key of heights.keys()) {
    if (heights.size <= MAX_REMEMBERED) break;
    heights.delete(key);
  }
}

export function rememberedHeight(key: string): number | undefined {
  return heights.get(key);
}

/** Attributs d'une ligne dont la hauteur doit survivre à un aller-retour. */
export function heightKeyProps(
  key: string | undefined,
  estimatedHeight: number,
): { "data-height-key"?: string; style?: { containIntrinsicSize: string } } {
  if (!key) return {};
  const height = rememberedHeight(key) ?? estimatedHeight;
  return {
    "data-height-key": key,
    style: { containIntrinsicSize: `auto ${height}px` },
  };
}
