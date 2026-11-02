import { Image as ImageIcon, X } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { MAX_POST_ATTACHMENTS, type Attachment, type PostFormat } from "@kemet/shared";
import { Button } from "../components/ui/Button.js";
import { IconButton } from "../components/ui/IconButton.js";
import { Input } from "../components/ui/Input.js";
import { Select } from "../components/ui/Select.js";
import { Textarea } from "../components/ui/Textarea.js";
import { useToast } from "../components/ui/Toast.js";
import { FormPage } from "../components/layout/FormPage.js";
import {
  ChatApiError,
  createPost,
  postAttachmentUrl,
  uploadPostAttachment,
} from "../lib/chat/api.js";
import { useSession } from "../session/SessionProvider.js";
import { fr } from "../i18n/fr.js";
import { missingFieldsReason } from "../lib/forms.js";

export function NewPostPage() {
  const toast = useToast();
  const { status, isSuspended } = useSession();
  const [body, setBody] = useState("");
  const [format, setFormat] = useState<"none" | PostFormat>("none");
  const [testUrl, setTestUrl] = useState("");
  const [testAsk, setTestAsk] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (status === "visitor") window.location.href = "/connexion";
  }, [status]);

  async function handleImageSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (attachments.length >= MAX_POST_ATTACHMENTS) {
      toast.show(fr.feed.tooManyImages(MAX_POST_ATTACHMENTS), "danger");
      return;
    }
    setUploading(true);
    try {
      const attachment = await uploadPostAttachment(file);
      setAttachments((current) => [...current, attachment]);
    } catch (err) {
      toast.show(err instanceof ChatApiError ? err.message : fr.feed.imageUploadError, "danger");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await createPost({
        body: body.trim(),
        format: format === "none" ? null : format,
        testUrl: format === "a_tester" ? testUrl.trim() : null,
        testAsk: format === "a_tester" ? testAsk.trim() : null,
        attachmentIds: attachments.map((attachment) => attachment.id),
      });
      window.location.href = "/fil";
    } catch (err) {
      setError(err instanceof ChatApiError ? err.message : fr.feed.createError);
      setSubmitting(false);
    }
  }

  const blockedReason = isSuspended
    ? fr.common.suspendedCannotSubmit
    : !body.trim() && attachments.length === 0
      ? fr.feed.bodyOrImageRequired
      : format === "a_tester"
        ? missingFieldsReason([[testUrl, fr.feed.testUrlLabel]])
        : null;

  return (
    <FormPage
      title={fr.feed.newPostTitle}
      subtitle={fr.feed.newPostSubtitle}
      activeSection="fil"
      backHref="/fil"
      submitLabel={fr.feed.publish}
      submitting={submitting}
      submitDisabledReason={blockedReason}
      error={error}
      onSubmit={handleSubmit}
    >
      <label className="flex flex-col gap-1 text-sm text-text-2">
        {fr.feed.newPostBodyLabel}
        <Textarea
          placeholder={fr.feed.composerPlaceholder}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          disabled={isSuspended}
        />
      </label>

      <div className="flex flex-col gap-2">
        <span className="text-sm text-text-2">{fr.feed.newPostImagesLabel}</span>
        {attachments.length > 0 && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {attachments.map((attachment) => (
              <div key={attachment.id} className="relative">
                <img
                  src={postAttachmentUrl(attachment.id)}
                  alt={attachment.originalName}
                  className="aspect-square w-full rounded-card border border-border object-cover"
                />
                <IconButton
                  aria-label={fr.feed.removeImage(attachment.originalName)}
                  onClick={() =>
                    setAttachments((current) => current.filter((item) => item.id !== attachment.id))
                  }
                  className="absolute -right-2 -top-2 size-control-compact max-md:size-control-mobile bg-surface"
                >
                  <X className="size-4" aria-hidden="true" />
                </IconButton>
              </div>
            ))}
          </div>
        )}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageSelected}
        />
        <Button
          type="button"
          variant="secondary"
          className="self-start"
          onClick={() => imageInputRef.current?.click()}
          loading={uploading}
          disabled={isSuspended || attachments.length >= MAX_POST_ATTACHMENTS}
        >
          <ImageIcon className="size-4" aria-hidden="true" />
          {fr.feed.attachImage}
        </Button>
        <span className="text-xs text-subtle">
          {fr.feed.newPostImagesHint(MAX_POST_ATTACHMENTS)}
        </span>
      </div>

      <label className="flex flex-col gap-1 text-sm text-text-2">
        {fr.feed.formatLabel}
        <Select
          aria-label={fr.feed.formatLabel}
          value={format}
          onValueChange={(value) => setFormat(value as "none" | PostFormat)}
          options={[
            { value: "none", label: fr.feed.formatNone },
            { value: "astuce", label: fr.feed.formatAstuce },
            { value: "a_tester", label: fr.feed.formatATester },
            { value: "question", label: fr.feed.formatQuestion },
          ]}
          disabled={isSuspended}
        />
      </label>

      {format === "a_tester" && (
        <>
          <label className="flex flex-col gap-1 text-sm text-text-2">
            {fr.feed.testUrlLabel}
            <Input
              value={testUrl}
              onChange={(event) => setTestUrl(event.target.value)}
              disabled={isSuspended}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-text-2">
            {fr.feed.testAskLabel}
            <Input
              value={testAsk}
              onChange={(event) => setTestAsk(event.target.value)}
              disabled={isSuspended}
            />
          </label>
        </>
      )}
    </FormPage>
  );
}
