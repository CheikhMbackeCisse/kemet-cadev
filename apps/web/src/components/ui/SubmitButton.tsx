import { useId, type ReactNode } from "react";
import { Button, type ButtonVariant } from "./Button.js";

export interface SubmitButtonProps {
  label: string;
  loading?: boolean;
  /** Bloque l'envoi sans raison à montrer (chargement en cours). */
  disabled?: boolean;
  /** Pourquoi l'envoi est bloqué : affiché à côté du bouton tant qu'il l'est. */
  disabledReason?: string | null;
  /** Action secondaire posée juste après le bouton, comme Annuler. */
  secondary?: ReactNode;
  /** "danger" pour une action irréversible, comme la suppression du compte. */
  variant?: ButtonVariant;
  /** Bouton sur toute la largeur, la raison n'étant alors lue que par un lecteur d'écran. */
  block?: boolean;
}

/**
 * Bouton principal d'un formulaire. Désactivé, il dit pourquoi : un bouton
 * grisé sans explication laisse chercher ce qui manque.
 */
export function SubmitButton({
  label,
  loading,
  disabled,
  disabledReason,
  secondary,
  variant,
  block = false,
}: SubmitButtonProps) {
  const reasonId = useId();
  const reason = disabledReason && !loading ? disabledReason : null;
  // En pleine largeur, la raison n'est pas affichée : le bouton reste
  // atteignable au clavier (aria-disabled) pour qu'un lecteur d'écran la lise.
  const softBlocked = block && Boolean(disabledReason);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="submit"
        variant={variant}
        loading={loading}
        disabled={Boolean(disabled || (disabledReason && !block))}
        aria-disabled={softBlocked || undefined}
        onClick={(event) => {
          if (softBlocked) event.preventDefault();
        }}
        aria-describedby={reason ? reasonId : undefined}
        className={block ? (softBlocked ? "w-full cursor-not-allowed opacity-50" : "w-full") : undefined}
      >
        {label}
      </Button>
      {secondary}
      {reason && (
        <p id={reasonId} className={block ? "sr-only" : variant === "inverse" ? "text-sm text-auth-text-muted" : "text-sm text-subtle"}>
          {reason}
        </p>
      )}
    </div>
  );
}
