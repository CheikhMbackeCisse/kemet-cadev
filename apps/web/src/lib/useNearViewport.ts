import { useEffect, useState, type RefObject } from "react";

const DEFAULT_MARGIN = "200px";

/**
 * Passe à true quand l'élément approche de l'écran, puis le reste. Sans
 * IntersectionObserver (vieux navigateur, tests), l'élément compte comme visible.
 */
export function useNearViewport(
  ref: RefObject<Element | null>,
  rootMargin = DEFAULT_MARGIN,
): boolean {
  const [near, setNear] = useState(() => typeof IntersectionObserver === "undefined");

  useEffect(() => {
    const element = ref.current;
    if (near || !element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, rootMargin, near]);

  return near;
}
