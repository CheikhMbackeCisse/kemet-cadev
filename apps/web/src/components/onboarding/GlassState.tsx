import { Button } from "../ui/Button.js";
import { fr } from "../../i18n/fr.js";

/** État vide ou d'erreur d'une liste posée sur la carte en verre. */
export function GlassState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role={onRetry ? "alert" : undefined}
      className="flex flex-col items-center gap-3 py-6 text-center text-base text-auth-text"
    >
      <p>{message}</p>
      {onRetry && (
        <Button type="button" variant="inverse-ghost" onClick={onRetry}>
          {fr.onboarding.retry}
        </Button>
      )}
    </div>
  );
}
