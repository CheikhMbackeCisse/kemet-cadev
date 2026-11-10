import { fr } from "../i18n/fr.js";

/** Erreur de chaque champ, par nom ; un champ sans entrée est valide. */
export type FieldErrors<Name extends string = string> = Partial<Record<Name, string>>;

/**
 * Champs obligatoires encore vides, vérifiés à l'envoi : le bouton reste
 * actif et chaque champ manquant dit lui-même ce qui ne va pas.
 */
export function requiredFieldErrors<Name extends string>(
  fields: Record<Name, string | null | undefined>,
): FieldErrors<Name> {
  const errors: FieldErrors<Name> = {};
  for (const name of Object.keys(fields) as Name[]) {
    if (!fields[name]?.trim()) errors[name] = fr.common.requiredField;
  }
  return errors;
}

/** Champ obligatoire avec une longueur minimale, comme le schéma du serveur. */
export function validateFields<Name extends string>(
  fields: Record<Name, { value: string | null | undefined; min?: number }>,
): FieldErrors<Name> {
  const errors: FieldErrors<Name> = {};
  for (const name of Object.keys(fields) as Name[]) {
    const { value, min } = fields[name];
    const length = value?.trim().length ?? 0;
    if (length === 0) errors[name] = fr.common.requiredField;
    else if (min && length < min) errors[name] = fr.common.tooShort(min);
  }
  return errors;
}

const HANDLE_PATTERN = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;

/** Mêmes règles que `handleSchema`, dites sous le champ plutôt qu'en aide permanente. */
export function handleError(handle: string): string | undefined {
  const value = handle.trim();
  if (!value) return fr.common.requiredField;
  if (value.length < 3) return fr.common.tooShort(3);
  if (value.length > 30) return fr.common.tooLong(30);
  if (!HANDLE_PATTERN.test(value)) return fr.auth.handleInvalid;
  return undefined;
}

export function hasFieldErrors(errors: FieldErrors): boolean {
  return Object.values(errors).some(Boolean);
}

/** Focus sur le premier champ en erreur du formulaire, une fois les erreurs affichées. */
export function focusFirstInvalidField(form: HTMLFormElement | null): void {
  requestAnimationFrame(() => {
    const field = form?.querySelector<HTMLElement>('[aria-invalid="true"]');
    field?.focus();
    field?.scrollIntoView({ block: "center" });
  });
}
