import { type ReactNode } from "react";
import { Button, type ButtonVariant } from "./Button.js";

export interface SubmitButtonProps {
  label: string;
  loading?: boolean;
  /** Bloque l'envoi pendant un chargement ; un champ manquant ne le bloque jamais. */
  disabled?: boolean;
  /** Action secondaire posée juste après le bouton, comme Annuler. */
  secondary?: ReactNode;
  /** "danger" pour une action irréversible, comme la suppression du compte. */
  variant?: ButtonVariant;
  /** Bouton sur toute la largeur. */
  block?: boolean;
}

/**
 * Bouton principal d'un formulaire. Il reste actif : à l'envoi, chaque champ
 * manquant affiche son erreur sous lui (FormField).
 */
export function SubmitButton({
  label,
  loading,
  disabled,
  secondary,
  variant,
  block = false,
}: SubmitButtonProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="submit"
        variant={variant}
        loading={loading}
        disabled={disabled}
        className={block ? "w-full" : undefined}
      >
        {label}
      </Button>
      {secondary}
    </div>
  );
}
