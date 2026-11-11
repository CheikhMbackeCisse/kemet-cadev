import {
  BookOpen,
  FolderGit2,
  House,
  MessageSquare,
  Send,
  Settings,
  ShieldCheck,
  Trophy,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface RailNavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface NavSection extends RailNavItem {
  /**
   * Place sur mobile : un onglet de la barre du bas, une ligne de la feuille
   * ouverte par "Moi" (la barre n'a pas la place pour tout), ou un segment en
   * haut de l'onglet Salons (conversations privées).
   */
  mobile: "tab" | "moi" | "salons";
}

/**
 * Seule liste des grandes sections, pour le bureau comme pour le mobile.
 * La navigation vit dans le rail (bureau) et dans la barre d'onglets
 * (mobile), jamais dans la barre du haut d'une page. Ordre du bureau.
 */
export const NAV_SECTIONS: NavSection[] = [
  { id: "fil", label: "Fil", href: "/fil", icon: House, mobile: "tab" },
  { id: "travaux", label: "Travaux", href: "/travaux", icon: BookOpen, mobile: "tab" },
  { id: "salons", label: "Salons", href: "/salons", icon: MessageSquare, mobile: "tab" },
  { id: "messages", label: "Messages", href: "/messages", icon: Send, mobile: "salons" },
  { id: "skills", label: "Skills", href: "/skills", icon: Wrench, mobile: "tab" },
  { id: "projets", label: "Projets", href: "/projets", icon: FolderGit2, mobile: "moi" },
  { id: "competitions", label: "Compétitions", href: "/competitions", icon: Trophy, mobile: "moi" },
];

/** Ordre de la barre du bas sur mobile, qui diffère du bureau : Salons reste au pouce. */
export const MOBILE_TAB_ORDER = ["fil", "salons", "travaux", "skills"];

export const RAIL_NAV: RailNavItem[] = NAV_SECTIONS;

/** Au pied du rail, separe des sections : une page a lire, pas un espace de travail. */
export const RAIL_FOOTER_NAV: RailNavItem = {
  id: "confidentialite",
  label: "Confidentialité",
  href: "/confidentialite",
  icon: ShieldCheck,
};

/** Au pied de la barre d'activité sur bureau, dans la feuille "Moi" sur mobile. */
export const SETTINGS_NAV: RailNavItem = {
  id: "parametres",
  label: "Paramètres",
  href: "/parametres",
  icon: Settings,
};

export function sectionLabel(id: string): string {
  return NAV_SECTIONS.find((section) => section.id === id)?.label ?? "";
}

/** Section du rail correspondant a une URL, pour marquer l'icone active. */
export function activeRailSection(pathname: string): string {
  if (pathname === "/" || pathname.startsWith("/fil")) return "fil";
  if (pathname.startsWith("/skills")) return "skills";
  if (pathname.startsWith("/projets")) return "projets";
  if (pathname.startsWith("/travaux")) return "travaux";
  if (pathname.startsWith("/competitions")) return "competitions";
  if (pathname.startsWith("/salons")) return "salons";
  if (pathname.startsWith("/messages")) return "messages";
  if (pathname === "/confidentialite") return "confidentialite";
  return "";
}
