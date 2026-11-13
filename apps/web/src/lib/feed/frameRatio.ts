import type { Attachment } from "@kemet/shared";

const MIN_RATIO = 4 / 5;
const MAX_RATIO = 16 / 9;

/**
 * Proportions du cadre d'une image de post (largeur sur hauteur) : celles de
 * l'image, ramenées entre 4:5 et 16:9 ; un carrousel prend celles de sa
 * première image. Sans dimensions connues (images d'avant G13), 16:9 pour
 * une image seule et un carré pour un carrousel.
 */
export function frameRatio(first: Pick<Attachment, "width" | "height">, carousel: boolean): number {
  if (first.width && first.height) {
    return Math.min(MAX_RATIO, Math.max(MIN_RATIO, first.width / first.height));
  }
  return carousel ? 1 : MAX_RATIO;
}
