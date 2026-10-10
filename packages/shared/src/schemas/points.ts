import { z } from "zod";

export const LEVELS = ["apprenti", "artisan", "scribe", "architecte", "legende"] as const;

export const levelSchema = z.enum(LEVELS);

export type Level = z.infer<typeof levelSchema>;

// Seuils cumulés en points (docs/CONTEXTE.md, section "Points et niveaux").
// Le parcours seul (plafonné à 1 500) permet d'atteindre Scribe ; seule
// l'entraide, non plafonnée, fait franchir Architecte puis Légende.
export const LEVEL_THRESHOLDS: ReadonlyArray<{ level: Level; minPoints: number }> = [
  { level: "apprenti", minPoints: 0 },
  { level: "artisan", minPoints: 300 },
  { level: "scribe", minPoints: 1000 },
  { level: "architecte", minPoints: 2500 },
  { level: "legende", minPoints: 5000 },
];

export function levelForPoints(totalPoints: number): Level {
  let current: Level = "apprenti";
  for (const threshold of LEVEL_THRESHOLDS) {
    if (totalPoints >= threshold.minPoints) current = threshold.level;
  }
  return current;
}
