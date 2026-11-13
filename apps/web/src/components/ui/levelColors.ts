import type { Level } from "@kemet/shared";

// Classes écrites en entier : Tailwind ne voit pas une classe composée.
export const LEVEL_TEXT_CLASSES: Record<Level, string> = {
  apprenti: "text-level-apprenti",
  artisan: "text-level-artisan",
  scribe: "text-level-scribe",
  architecte: "text-level-architecte",
  legende: "text-level-legende",
};

export const LEVEL_FILL_CLASSES: Record<Level, string> = {
  apprenti: "bg-level-apprenti",
  artisan: "bg-level-artisan",
  scribe: "bg-level-scribe",
  architecte: "bg-level-architecte",
  legende: "bg-level-legende",
};
