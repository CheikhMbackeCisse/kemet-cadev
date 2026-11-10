import { useCallback, useRef, useState } from "react";
import { focusFirstInvalidField, hasFieldErrors, type FieldErrors } from "./forms.js";

/**
 * Erreurs de champ d'un formulaire hors FormPage : `report` les affiche, met
 * le focus sur la première et dit si l'envoi peut continuer.
 */
export function useFieldErrors<Name extends string>() {
  const formRef = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<FieldErrors<Name>>({});
  const report = useCallback((next: FieldErrors<Name>): boolean => {
    setErrors(next);
    if (!hasFieldErrors(next)) return true;
    focusFirstInvalidField(formRef.current);
    return false;
  }, []);
  return { formRef, errors, report };
}
