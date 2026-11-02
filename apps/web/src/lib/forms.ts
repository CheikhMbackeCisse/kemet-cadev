import { fr } from "../i18n/fr.js";

export type RequiredField = readonly [value: string | null | undefined, label: string];

/** Libellé court d'un champ : la précision entre parenthèses n'aide pas dans une liste. */
function shortLabel(label: string): string {
  return label.replace(/\s*\(.*\)\s*$/, "");
}

/**
 * Raison affichée à côté d'un bouton d'envoi désactivé : la liste des champs
 * obligatoires encore vides, ou null quand tout est rempli.
 */
export function missingFieldsReason(fields: readonly RequiredField[]): string | null {
  const missing = fields.filter(([value]) => !value?.trim()).map(([, label]) => shortLabel(label));
  return missing.length > 0 ? fr.common.missingFields(missing) : null;
}
