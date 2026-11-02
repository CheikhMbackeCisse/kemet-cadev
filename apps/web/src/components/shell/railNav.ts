import { FolderGit2, Hash, Rss, Settings, ShieldCheck, Trophy, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface RailNavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface NavSection extends RailNavItem {
  /**
   * Place sur mobile : un onglet de la barre du bas, ou une ligne de la
   * feuille ouverte par "Moi" (la barre n'a pas la place pour tout).
   */
  mobile: "tab" | "moi";
}

/**
 * Seule liste des grandes sections, pour le bureau comme pour le mobile.
 * La navigation vit dans le rail (bureau) et dans la barre d'onglets
 * (mobile), jamais dans la barre du haut d'une page.
 */
export const NAV_SECTIONS: NavSection[] = [
  { id: "fil", label: "Fil", href: "/fil", icon: Rss, mobile: "tab" },
  { id: "salons", label: "Salons", href: "/salons", icon: Hash, mobile: "tab" },
  { id: "skills", label: "Skills", href: "/skills", icon: Wrench, mobile: "tab" },
  { id: "projets", label: "Projets", href: "/projets", icon: FolderGit2, mobile: "tab" },
  { id: "competitions", label: "Compétitions", href: "/competitions", icon: Trophy, mobile: "moi" },
];

export const RAIL_NAV: RailNavItem[] = NAV_SECTIONS;

/** Au pied du rail, separe des sections : une page a lire, pas un espace de travail. */
export const RAIL_FOOTER_NAV: RailNavItem = {
  id: "confidentialite",
  label: "Confidentialité",
  href: "/confidentialite",
  icon: ShieldCheck,
};

/** Sur bureau, les paramètres passent par le menu du compte. */
export const SETTINGS_NAV: RailNavItem = {
  id: "parametres",
  label: "Paramètres",
  href: "/parametres",
  icon: Settings,
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
