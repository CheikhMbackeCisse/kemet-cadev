import { useRef, type TouchEvent } from "react";

// Le geste ne part que du bord gauche, pour ne jamais gêner un défilement
// horizontal (bloc de code, image) au milieu de l'écran.
const EDGE_WIDTH = 24;
const MIN_DISTANCE = 64;

/** Glissement vers la droite depuis le bord gauche de l'écran. */
export function useEdgeSwipe(onSwipe: () => void) {
  const start = useRef<{ x: number; y: number } | null>(null);

  return {
    onTouchStart(event: TouchEvent) {
      const touch = event.touches[0];
      start.current =
        touch && touch.clientX <= EDGE_WIDTH ? { x: touch.clientX, y: touch.clientY } : null;
    },
    onTouchCancel() {
      start.current = null;
    },
    onTouchEnd(event: TouchEvent) {
      const origin = start.current;
      start.current = null;
      const touch = event.changedTouches[0];
      if (!origin || !touch) return;
      const dx = touch.clientX - origin.x;
      const dy = Math.abs(touch.clientY - origin.y);
      if (dx >= MIN_DISTANCE && dx > dy * 2) onSwipe();
    },
  };
}
