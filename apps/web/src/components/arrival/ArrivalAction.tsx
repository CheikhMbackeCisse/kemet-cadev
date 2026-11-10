import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Bouton principal d'une carte du parcours d'arrivée, et l'erreur d'envoi
 * au-dessus de lui pour qu'on la voie là où l'on a cliqué, dernier enfant
 * d'un formulaire posé en `relative`. Quand la carte dépasse de l'écran (petit
 * téléphone, Safari et ses barres), il reste collé au bas de l'écran pendant
 * que le reste défile, sur un fond de verre qui le sépare de ce qui passe
 * dessous. Le repère, posé au bas du formulaire, marque sa place normale :
 * tant qu'elle est sous le bord de l'écran, le bouton est décollé de sa place.
 */
export function ArrivalAction({ children }: { children: ReactNode }) {
  const marker = useRef<HTMLSpanElement>(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const element = marker.current;
    // Sans IntersectionObserver (vieux navigateur, tests), le bouton reste
    // collé sans son fond : il garde sa place et reste cliquable.
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry) return;
      const bottom = entry.rootBounds?.bottom ?? window.innerHeight;
      setStuck(!entry.isIntersecting && entry.boundingClientRect.top >= bottom);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div className="arrival-action" data-stuck={stuck ? "" : undefined}>
        {children}
      </div>
      <span
        ref={marker}
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-0 h-px w-px"
      />
    </>
  );
}
