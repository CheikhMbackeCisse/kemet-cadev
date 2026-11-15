import { Award, User } from "lucide-react";
import {
  MOBILE_TAB_ORDER,
  MODERATION_NAV,
  NAV_SECTIONS,
  RAIL_FOOTER_NAV,
  SECURITY_NAV,
  SETTINGS_NAV,
  type RailNavItem,
} from "./railNav.js";
import type { MobileTabItem } from "./types.js";
import { fr } from "../../i18n/fr.js";

export const MOI_TAB_ID = "moi";

export const MOBILE_TABS: MobileTabItem[] = [
  ...MOBILE_TAB_ORDER.map((id) => NAV_SECTIONS.find((section) => section.id === id)!),
  { id: MOI_TAB_ID, label: fr.moi.title, icon: User },
];

/** Sections sans onglet, atteintes depuis la page "Moi". */
export const MOI_ITEMS: RailNavItem[] = [
  ...NAV_SECTIONS.filter((section) => section.mobile === "moi"),
  { id: "niveaux", label: fr.levels.pageTitle, href: "/niveaux", icon: Award },
  SETTINGS_NAV,
  RAIL_FOOTER_NAV,
  SECURITY_NAV,
];

/**
 * Onglet actif d'une section. Projets et Compétitions, rangés dans "Moi",
 * n'allument aucun onglet : ce ne sont pas des pages de la personne.
 */
export function mobileTabFor(sectionId: string): string {
  const section = NAV_SECTIONS.find((candidate) => candidate.id === sectionId);
  if (section?.mobile === "moi") return "";
  if (section?.mobile === "salons") return "salons";
  if ([SETTINGS_NAV.id, RAIL_FOOTER_NAV.id, SECURITY_NAV.id, MODERATION_NAV.id].includes(sectionId))
    return MOI_TAB_ID;
  return sectionId;
}

export const MOI_PATH = "/moi";

/** Destination d'un onglet mobile. */
export function mobileTabHref(id: string): string {
  if (id === MOI_TAB_ID) return MOI_PATH;
  return NAV_SECTIONS.find((section) => section.id === id)?.href ?? "/fil";
}
