import { FolderGit2, Hash, Rss, Trophy, User } from "lucide-react";
import type { MobileTabItem } from "./types.js";

export const MOBILE_TABS: MobileTabItem[] = [
  { id: "fil", label: "Fil", icon: Rss },
  { id: "salons", label: "Salons", icon: Hash },
  { id: "projets", label: "Projets", icon: FolderGit2 },
  { id: "competitions", label: "Compétitions", icon: Trophy },
  { id: "moi", label: "Moi", icon: User },
];

const ROUTES: Partial<Record<string, string>> = {
  fil: "/fil",
  salons: "/salons",
  projets: "/projets",
  competitions: "/competitions",
};

/** Destination d'un onglet mobile. "Moi" dépend de la session : profil public si connecté, connexion sinon. */
export function mobileTabHref(id: string, ownHandle: string | null): string {
  if (id === "moi") return ownHandle ? `/u/${ownHandle}` : "/connexion";
  return ROUTES[id] ?? "/fil";
}
