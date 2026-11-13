export interface RowWindow {
  start: number;
  end: number;
}

/**
 * Lignes d'une liste qui couvrent la position de lecture, marge comprise.
 * La liste ne commence pas en haut du document : la marge absorbe l'en-tête
 * posé au-dessus d'elle.
 */
export function visibleWindow(
  heights: readonly number[],
  scrollY: number,
  viewportHeight: number,
  marginPx: number,
): RowWindow | null {
  if (heights.length === 0) return null;
  const from = Math.max(0, scrollY - marginPx);
  const to = scrollY + viewportHeight + marginPx;
  let top = 0;
  let start = -1;
  let end = heights.length - 1;
  for (let index = 0; index < heights.length; index++) {
    const bottom = top + (heights[index] ?? 0);
    if (start === -1 && bottom >= from) start = index;
    if (top > to) {
      end = index - 1;
      break;
    }
    top = bottom;
  }
  if (start === -1) start = heights.length - 1;
  return { start, end: Math.max(start, end) };
}
