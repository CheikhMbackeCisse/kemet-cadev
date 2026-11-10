import { LEVEL_THRESHOLDS, levelForPoints, type Level } from "@kemet/shared";

export interface LevelProgress {
  level: Level;
  /** Absent au plus haut niveau. */
  next: {
    level: Level;
    /** Seuil du niveau atteint, puis du suivant. */
    fromPoints: number;
    minPoints: number;
    remaining: number;
    ratio: number;
  } | null;
}

/** Position dans le niveau atteint, d'après les seuils partagés avec le serveur. */
export function levelProgress(points: number): LevelProgress {
  const level = levelForPoints(points);
  const index = LEVEL_THRESHOLDS.findIndex((threshold) => threshold.level === level);
  const current = LEVEL_THRESHOLDS[index]!;
  const next = LEVEL_THRESHOLDS[index + 1];
  if (!next) return { level, next: null };
  return {
    level,
    next: {
      level: next.level,
      fromPoints: current.minPoints,
      minPoints: next.minPoints,
      remaining: next.minPoints - points,
      ratio: (points - current.minPoints) / (next.minPoints - current.minPoints),
    },
  };
}
