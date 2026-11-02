import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Les rayons du thème (tailwind.config.js) portent des noms que
// tailwind-merge ne connaît pas : sans cette déclaration, `rounded-card`
// passé en surcharge resterait à côté de `rounded-control` au lieu de le
// remplacer.
const twMerge = extendTailwindMerge({
  extend: { theme: { radius: ["control", "card", "panel"] } },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
