import { TriangleAlert, X } from "lucide-react";
import { fr } from "../../i18n/fr.js";
import { Button } from "../ui/Button.js";
import { IconButton } from "../ui/IconButton.js";

export function assistantFailureText(errorCode: string): string {
  switch (errorCode) {
    case "quota_exceeded":
      return fr.chat.assistantQuotaReached;
    case "assistant_unavailable":
      return fr.chat.assistantUnavailable;
    default:
      return fr.chat.assistantFailed;
  }
}

export interface AssistantFailureNoticeProps {
  errorCode: string;
  onRetry: (() => void) | null;
  onDismiss: () => void;
}

/**
 * Posée au-dessus du composeur plutôt que dans le fil : un échec n'est pas une
 * réponse de @kemet, et il ne regarde que la personne qui a posé la question.
 */
export function AssistantFailureNotice({
  errorCode,
  onRetry,
  onDismiss,
}: AssistantFailureNoticeProps) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-control bg-danger-soft py-2 pl-3 pr-1"
    >
      <TriangleAlert className="size-5 shrink-0 text-danger" aria-hidden="true" />
      {/* Base de 15 rem : sur mobile, les boutons passent à la ligne au lieu
          de réduire le texte à une colonne de quelques mots. */}
      <p className="min-w-0 flex-1 basis-60 text-base text-text">
        {assistantFailureText(errorCode)}
      </p>
      <div className="ml-auto flex items-center gap-1">
        {onRetry && (
          <Button variant="secondary" onClick={onRetry} className="bg-surface hover:bg-surface-2">
            {fr.chat.retryAssistantQuestion}
          </Button>
        )}
        <IconButton
          aria-label={fr.chat.dismissAssistantFailure}
          onClick={onDismiss}
          className="size-control-compact max-md:size-control-mobile"
        >
          <X className="size-4" aria-hidden="true" />
        </IconButton>
      </div>
    </div>
  );
}
