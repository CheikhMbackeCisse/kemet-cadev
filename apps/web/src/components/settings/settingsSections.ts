import { CircleHelp, Palette, ShieldCheck, User, UserCog, type LucideIcon } from "lucide-react";
import { fr } from "../../i18n/fr.js";

export interface SettingsSection {
  id: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  href: string;
  /** Mots cherchés en plus du titre et de la description. */
  keywords: string[];
  /** Section réservée à un compte : un visiteur ne la voit pas. */
  requiresAccount: boolean;
  group: "account" | "app";
}

// Seulement des réglages qui fonctionnent : pas de section Notifications,
// le code n'en envoie aucune.
export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    id: "compte",
    label: fr.settings.accountSection,
    hint: fr.settings.accountHint,
    icon: UserCog,
    href: "/parametres/compte",
    keywords: ["email", "mot de passe", "github", "google", "linkedin", "connexion"],
    requiresAccount: true,
    group: "account",
  },
  {
    id: "profil",
    label: fr.settings.profileSection,
    hint: fr.settings.profileHint,
    icon: User,
    href: "/parametres/profil",
    keywords: ["nom", "identifiant", "pays", "nationalité", "rôle", "spécialité", "bio", "lien"],
    requiresAccount: true,
    group: "account",
  },
  {
    id: "donnees",
    label: fr.settings.dataSection,
    hint: fr.settings.dataHint,
    icon: ShieldCheck,
    href: "/parametres/donnees",
    keywords: ["bloquer", "bloqué", "export", "télécharger", "supprimer", "confidentialité"],
    requiresAccount: true,
    group: "account",
  },
  {
    id: "apparence",
    label: fr.settings.appearanceSection,
    hint: fr.settings.appearanceHint,
    icon: Palette,
    href: "/parametres/apparence",
    keywords: ["thème", "sombre", "clair", "système"],
    requiresAccount: false,
    group: "app",
  },
  {
    id: "aide",
    label: fr.settings.helpSection,
    hint: fr.settings.helpHint,
    icon: CircleHelp,
    href: "/parametres/aide",
    keywords: ["version", "contact", "à propos", "confidentialité"],
    requiresAccount: false,
    group: "app",
  },
];

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

export function filterSettingsSections(sections: SettingsSection[], query: string): SettingsSection[] {
  const needle = normalize(query);
  if (!needle) return sections;
  return sections.filter((section) =>
    [section.label, section.hint, ...section.keywords].some((text) => normalize(text).includes(needle)),
  );
}
