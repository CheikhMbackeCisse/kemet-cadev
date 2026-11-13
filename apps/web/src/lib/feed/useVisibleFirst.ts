import { startTransition, useEffect, useState } from "react";
import { savedScrollY } from "../navigation/navigate.js";
import { rememberedHeight } from "../navigation/rememberedHeights.js";
import { visibleWindow, type RowWindow } from "./visibleWindow.js";

const VIEWPORT_MARGIN_PX = 800;

/**
 * Au premier rendu, seules les lignes qui couvrent la position de lecture
 * sont construites ; les autres sont des cales de leur hauteur mémorisée,
 * remplacées juste après dans une transition. Au retour vers une longue
 * liste, l'écran revient sans attendre la construction de toute la liste.
 */
export function useVisibleFirst(
  keys: readonly string[],
  estimatedHeight: number,
): (index: number) => boolean {
  const [initialWindow] = useState<RowWindow | null>(() =>
    visibleWindow(
      keys.map((key) => rememberedHeight(key) ?? estimatedHeight),
      savedScrollY(),
      window.innerHeight,
      VIEWPORT_MARGIN_PX,
    ),
  );
  const [complete, setComplete] = useState(initialWindow === null);

  useEffect(() => {
    if (!complete) startTransition(() => setComplete(true));
  }, [complete]);

  return (index) =>
    complete ||
    initialWindow === null ||
    (index >= initialWindow.start && index <= initialWindow.end);
}
