import { useId, type ReactNode } from "react";
import { Button } from "./Button.js";

export interface SubmitButtonProps {
  label: string;
  loading?: boolean;
  /** Bloque l'envoi sans raison à montrer (chargement en cours). */
  disabled?: boolean;
  /** Pourquoi l'envoi est bloqué : affiché à côté du bouton tant qu'il l'est. */
  disabledReason?: string | null;
  /** Action secondaire posée juste après le bouton, comme Annuler. */
  secondary?: ReactNode;
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
}: SubmitButtonProps) {
  const reasonId = useId();
  const reason = disabledReason && !loading ? disabledReason : null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="submit"
        loading={loading}
        disabled={Boolean(disabled || disabledReason)}
        aria-describedby={reason ? reasonId : undefined}
      >
        {label}
      </Button>
      {secondary}
      {reason && (
        <p id={reasonId} className="text-sm text-subtle">
          {reason}
        </p>
      )}
    </div>
  );
}
