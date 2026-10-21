import { FolderGit2, Hash, Rss, Trophy, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface RailNavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
}

/**
 * Navigation entre les grandes sections du produit. Elle vit dans le rail de
 * gauche et nulle part ailleurs : chaque page la posait avant dans sa propre
 * barre du haut, ce qui mettait des liens vers d'autres pages au meme niveau
 * que le contenu de la page ouverte.
 */
export const RAIL_NAV: RailNavItem[] = [
  { id: "fil", label: "Fil", href: "/fil", icon: Rss },
  { id: "salons", label: "Salons", href: "/salons", icon: Hash },
  { id: "skills", label: "Skills", href: "/skills", icon: Wrench },
  { id: "projets", label: "Projets", href: "/projets", icon: FolderGit2 },
  { id: "competitions", label: "Compétitions", href: "/competitions", icon: Trophy },
];

/** Section du rail correspondant a une URL, pour marquer l'icone active. */
export function activeRailSection(pathname: string): string {
  if (pathname === "/" || pathname.startsWith("/fil")) return "fil";
  if (pathname.startsWith("/skills")) return "skills";
  if (pathname.startsWith("/projets")) return "projets";
  if (pathname.startsWith("/competitions")) return "competitions";
  if (pathname.startsWith("/salons")) return "salons";
  return "";
}
