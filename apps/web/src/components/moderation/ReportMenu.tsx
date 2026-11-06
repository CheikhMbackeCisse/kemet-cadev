import { Flag } from "lucide-react";
import { useEffect, useState } from "react";
import { isDeletedAccountHandle, type ReportTarget } from "@kemet/shared";
import { ChatApiError, createReport } from "../../lib/chat/api.js";
import { Button } from "../ui/Button.js";
import { Dialog } from "../ui/Dialog.js";
import { IconButton } from "../ui/IconButton.js";
import { Textarea } from "../ui/Textarea.js";
import { useToast } from "../ui/Toast.js";
import { fr } from "../../i18n/fr.js";

const CONTENT_LABELS = {
  message: fr.moderation.reportThisMessage,
  post: fr.moderation.reportThisPost,
  work: fr.moderation.reportThisWork,
};

export interface ReportMenuProps {
  contentType: "message" | "post" | "work";
  contentId: string;
  authorId: string;
  authorHandle: string;
}

export function ReportMenu(props: ReportMenuProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconButton aria-label={fr.moderation.reportAction} onClick={() => setOpen(true)}>
        <Flag className="size-4" aria-hidden="true" />
      </IconButton>
      <ReportDialog {...props} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export interface ReportDialogProps extends ReportMenuProps {
  open: boolean;
  onClose: () => void;
}

/** Fenêtre de signalement seule, pour l'ouvrir depuis un autre déclencheur. */
export function ReportDialog({
  contentType,
  contentId,
  authorId,
  authorHandle,
  open,
  onClose,
}: ReportDialogProps) {
  const toast = useToast();
  const [target, setTarget] = useState<ReportTarget | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Un compte supprimé n'a plus de profil à signaler, seulement ses contenus.
  const deleted = isDeletedAccountHandle(authorHandle);

  useEffect(() => {
    if (open) setTarget(contentType);
  }, [open, contentType]);

  function close() {
    setTarget(null);
    setReason("");
    setError(null);
    onClose();
  }

  async function submit() {
    if (!target) return;
    setSubmitting(true);
    setError(null);
    try {
      await createReport({
        targetType: target,
        targetId: target === "profile" ? authorId : contentId,
        reason: reason.trim(),
      });
      toast.show(fr.moderation.reportSent, "success");
      close();
    } catch (err) {
      setError(err instanceof ChatApiError && err.statusCode === 409 ? fr.moderation.reportAlreadySent : fr.moderation.reportError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Dialog open={open && target !== null} onOpenChange={(open) => !open && close()} title={fr.moderation.reportTitle} description={fr.moderation.reportDescription(deleted ? fr.moderation.deletedAccount : authorHandle)}>
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <Button
              variant={target === contentType ? "primary" : "secondary"}
              aria-pressed={target === contentType}
              onClick={() => setTarget(contentType)}
            >
              {CONTENT_LABELS[contentType]}
            </Button>
            {!deleted && (
              <Button
                variant={target === "profile" ? "primary" : "secondary"}
                aria-pressed={target === "profile"}
                onClick={() => setTarget("profile")}
              >
                {fr.moderation.reportThisProfile(authorHandle)}
              </Button>
            )}
          </div>
          <Textarea
            placeholder={fr.moderation.reasonPlaceholder}
            aria-label={fr.moderation.reasonPlaceholder}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            autoFocus
          />
          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}
          <Button onClick={submit} disabled={!reason.trim() || submitting} loading={submitting}>
            {fr.moderation.reportSubmit}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
