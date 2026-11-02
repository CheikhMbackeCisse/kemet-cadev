import { useCallback, useRef, type MouseEvent, type PointerEvent, type TouchEvent } from "react";

export const LONG_PRESS_MS = 500;
const MOVE_TOLERANCE_PX = 10;

/**
 * Appui long au doigt seulement : la souris garde le survol et le clic droit
 * du navigateur. Un déplacement annule, pour ne pas gêner le défilement.
 */
export function useLongPress(onLongPress: (id: string) => void) {
  const timerRef = useRef<number | null>(null);
  const originRef = useRef<{ x: number; y: number } | null>(null);
  const firedRef = useRef(false);

  const cancel = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    originRef.current = null;
  }, []);

  const bind = useCallback(
    (id: string) => ({
      onPointerDown: (event: PointerEvent) => {
        if (event.pointerType !== "touch") return;
        firedRef.current = false;
        originRef.current = { x: event.clientX, y: event.clientY };
        timerRef.current = window.setTimeout(() => {
          firedRef.current = true;
          timerRef.current = null;
          onLongPress(id);
        }, LONG_PRESS_MS);
      },
      onPointerMove: (event: PointerEvent) => {
        const origin = originRef.current;
        if (!origin) return;
        if (
          Math.abs(event.clientX - origin.x) > MOVE_TOLERANCE_PX ||
          Math.abs(event.clientY - origin.y) > MOVE_TOLERANCE_PX
        )
          cancel();
      },
      onPointerUp: cancel,
      // Sans ça, le navigateur émule ensuite souris et clic : le focus passerait
      // à l'élément touché, hors de la feuille, qui se refermerait aussitôt.
      onTouchEnd: (event: TouchEvent) => {
        if (!firedRef.current) return;
        firedRef.current = false;
        event.preventDefault();
      },
      onPointerCancel: cancel,
      // Le menu natif (copier, sélectionner) passerait par-dessus la feuille.
      onContextMenu: (event: MouseEvent) => {
        if (firedRef.current || timerRef.current !== null) event.preventDefault();
      },
      // Le clic qui suit l'appui long ne doit atteindre ni le message ni un
      // bouton qu'il contient (une pastille de réaction, un lien).
      onClickCapture: (event: MouseEvent) => {
        if (!firedRef.current) return;
        firedRef.current = false;
        event.preventDefault();
        event.stopPropagation();
      },
    }),
    [onLongPress, cancel],
  );

  return { bind };
}
