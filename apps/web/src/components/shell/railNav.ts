import {
  BookOpen,
  Flag,
  FolderGit2,
  House,
  LockKeyhole,
  MessageSquare,
  Send,
  Settings,
  ShieldCheck,
  Trophy,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { fr } from "../../i18n/fr.js";

export interface RailNavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /**
   * Vrai si l'icône reste lisible remplie. Les autres (dossier, trophée,
   * bouclier, cadenas, roue) perdent leurs détails une fois pleines et
   * marquent la section ouverte par un trait plus épais.
   */
  fillWhenActive?: boolean;
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
  { id: "fil", label: fr.feed.title, href: "/fil", icon: House, fillWhenActive: true, mobile: "tab" },
  {
    id: "travaux",
    label: fr.works.title,
    href: "/travaux",
    icon: BookOpen,
    fillWhenActive: true,
    mobile: "tab",
  },
  {
    id: "salons",
    label: fr.messages.segmentSalons,
    href: "/salons",
    icon: MessageSquare,
    fillWhenActive: true,
    mobile: "tab",
  },
  {
    id: "messages",
    label: fr.messages.title,
    href: "/messages",
    icon: Send,
    fillWhenActive: true,
    mobile: "salons",
  },
  {
    id: "skills",
    label: fr.skills.title,
    href: "/skills",
    icon: Wrench,
    fillWhenActive: true,
    mobile: "tab",
  },
  { id: "projets", label: fr.projects.title, href: "/projets", icon: FolderGit2, mobile: "moi" },
  { id: "competitions", label: fr.competitions.title, href: "/competitions", icon: Trophy, mobile: "moi" },
];

/** Ordre de la barre du bas sur mobile, qui diffère du bureau : Salons reste au pouce. */
export const MOBILE_TAB_ORDER = ["fil", "salons", "travaux", "skills"];

export const RAIL_NAV: RailNavItem[] = NAV_SECTIONS;

/** Au pied du rail, séparé des sections : une page à lire, pas un espace de travail. */
export const RAIL_FOOTER_NAV: RailNavItem = {
  id: "confidentialite",
  label: fr.privacy.navLink,
  href: "/confidentialite",
  icon: ShieldCheck,
};

/** Au pied du rail, sous Confidentialité. */
export const SECURITY_NAV: RailNavItem = {
  id: "securite",
  label: fr.security.navLink,
  href: "/securite",
  icon: LockKeyhole,
};

/** Au pied de la barre d'activité sur bureau, dans la feuille "Moi" sur mobile. */
export const SETTINGS_NAV: RailNavItem = {
  id: "parametres",
  label: fr.settings.navLink,
  href: "/parametres",
  icon: Settings,
};

/** Au pied de la barre sur bureau, pour un administrateur seulement. */
export const MODERATION_NAV: RailNavItem = {
  id: "moderation",
  label: fr.moderation.navLink,
  href: "/moderation",
  icon: Flag,
  fillWhenActive: true,
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
  if (pathname === "/securite") return "securite";
  if (pathname === "/moderation") return "moderation";
  return "";
}
