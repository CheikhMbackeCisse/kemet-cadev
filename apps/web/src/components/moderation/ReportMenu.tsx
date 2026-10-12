import { Flag } from "lucide-react";
import { useState } from "react";
import type { ReportTarget } from "@kemet/shared";
import { ChatApiError, createReport } from "../../lib/chat/api.js";
import { Button } from "../ui/Button.js";
import { Dialog } from "../ui/Dialog.js";
import { IconButton } from "../ui/IconButton.js";
import { Textarea } from "../ui/Textarea.js";
import { useToast } from "../ui/Toast.js";
import { fr } from "../../i18n/fr.js";

export interface ReportMenuProps {
  contentType: "message" | "post";
  contentId: string;
  authorId: string;
  authorHandle: string;
}

export function ReportMenu({ contentType, contentId, authorId, authorHandle }: ReportMenuProps) {
  const toast = useToast();
  const [target, setTarget] = useState<ReportTarget | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function close() {
    setTarget(null);
    setReason("");
    setError(null);
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
      <IconButton aria-label={fr.moderation.reportAction} onClick={() => setTarget(contentType)}>
        <Flag className="size-4" aria-hidden="true" />
      </IconButton>
      <Dialog open={target !== null} onOpenChange={(open) => !open && close()} title={fr.moderation.reportTitle} description={fr.moderation.reportDescription(authorHandle)}>
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <Button
              variant={target === contentType ? "primary" : "secondary"}
              aria-pressed={target === contentType}
              onClick={() => setTarget(contentType)}
            >
              {contentType === "message" ? fr.moderation.reportThisMessage : fr.moderation.reportThisPost}
            </Button>
            <Button
              variant={target === "profile" ? "primary" : "secondary"}
              aria-pressed={target === "profile"}
              onClick={() => setTarget("profile")}
            >
              {fr.moderation.reportThisProfile(authorHandle)}
            </Button>
          </div>
          <Textarea
            placeholder={fr.moderation.reasonPlaceholder}
            aria-label={fr.moderation.reasonPlaceholder}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="min-h-20"
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
