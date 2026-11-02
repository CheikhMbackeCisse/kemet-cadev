import { FolderGit2, Hash, Rss, ShieldCheck, Trophy, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface RailNavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
}

/**
 * Navigation entre les grandes sections, dans le rail seulement : jamais dans
 * la barre du haut d'une page, au niveau de son contenu.
 */
export const RAIL_NAV: RailNavItem[] = [
  { id: "fil", label: "Fil", href: "/fil", icon: Rss },
  { id: "salons", label: "Salons", href: "/salons", icon: Hash },
  { id: "skills", label: "Skills", href: "/skills", icon: Wrench },
  { id: "projets", label: "Projets", href: "/projets", icon: FolderGit2 },
  { id: "competitions", label: "Compétitions", href: "/competitions", icon: Trophy },
];

/** Au pied du rail, separe des sections : une page a lire, pas un espace de travail. */
export const RAIL_FOOTER_NAV: RailNavItem = {
  id: "confidentialite",
  label: "Confidentialité",
  href: "/confidentialite",
  icon: ShieldCheck,
};

/** Section du rail correspondant a une URL, pour marquer l'icone active. */
export function activeRailSection(pathname: string): string {
  if (pathname === "/" || pathname.startsWith("/fil")) return "fil";
  if (pathname.startsWith("/skills")) return "skills";
  if (pathname.startsWith("/projets")) return "projets";
  if (pathname.startsWith("/competitions")) return "competitions";
  if (pathname.startsWith("/salons")) return "salons";
  if (pathname === "/confidentialite") return "confidentialite";
  return "";
}
