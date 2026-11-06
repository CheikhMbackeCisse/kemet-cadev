import { User } from "lucide-react";
import {
  MOBILE_TAB_ORDER,
  NAV_SECTIONS,
  RAIL_FOOTER_NAV,
  SETTINGS_NAV,
  type RailNavItem,
} from "./railNav.js";
import type { MobileTabItem } from "./types.js";

export const MOI_TAB_ID = "moi";

export const MOBILE_TABS: MobileTabItem[] = [
  ...MOBILE_TAB_ORDER.map((id) => NAV_SECTIONS.find((section) => section.id === id)!),
  { id: MOI_TAB_ID, label: "Moi", icon: User },
];

/** Lignes de la feuille ouverte par "Moi", après le profil. */
export const MOI_SHEET_ITEMS: RailNavItem[] = [
  ...NAV_SECTIONS.filter((section) => section.mobile === "moi"),
  SETTINGS_NAV,
  RAIL_FOOTER_NAV,
];

/** Onglet actif d'une section : celles rangées dans "Moi" allument "Moi". */
export function mobileTabFor(sectionId: string): string {
  const section = NAV_SECTIONS.find((candidate) => candidate.id === sectionId);
  if (section?.mobile === "moi") return MOI_TAB_ID;
  if (section?.mobile === "salons") return "salons";
  if (sectionId === SETTINGS_NAV.id || sectionId === RAIL_FOOTER_NAV.id) return MOI_TAB_ID;
  return sectionId;
}

/** Destination d'un onglet mobile ("Moi" ouvre une feuille, pas une page). */
export function mobileTabHref(id: string): string {
  return NAV_SECTIONS.find((section) => section.id === id)?.href ?? "/fil";
}
