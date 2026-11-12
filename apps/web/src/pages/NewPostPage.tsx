import { navigate } from "../lib/navigation/navigate.js";
import { Clapperboard, Image as ImageIcon, X } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { MAX_POST_ATTACHMENTS, type Attachment, type PostFormat } from "@kemet/shared";
import { Button } from "../components/ui/Button.js";
import { IconButton } from "../components/ui/IconButton.js";
import { Input } from "../components/ui/Input.js";
import { Select } from "../components/ui/Select.js";
import { useToast } from "../components/ui/Toast.js";
import { FormPage } from "../components/layout/FormPage.js";
import {
  ChatApiError,
  createPost,
  postAttachmentUrl,
  uploadPostAttachment,
  uploadPostVideo,
} from "../lib/chat/api.js";
import { prepareVideo, VideoCheckError } from "../lib/feed/videoPoster.js";
import {
  videoUploadAnnouncement,
  videoUploadLabel,
  type VideoUploadState,
} from "../lib/feed/videoUploadAnnouncement.js";
import { useSession } from "../session/SessionProvider.js";
import { fr } from "../i18n/fr.js";
import { hasFieldErrors, requiredFieldErrors, type FieldErrors } from "../lib/forms.js";
import { FormField } from "../components/ui/FormField.js";
import { BeginnerCheckbox } from "../components/beginners/BeginnerCheckbox.js";
import { CodeTextarea } from "../components/content/CodeTextarea.js";

export function NewPostPage() {
  const toast = useToast();
  const { status, isSuspended } = useSession();
  const [body, setBody] = useState("");
  const [format, setFormat] = useState<"none" | PostFormat>("none");
  const [testUrl, setTestUrl] = useState("");
  const [testAsk, setTestAsk] = useState("");
  const [isBeginner, setIsBeginner] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<"body" | "testUrl">>({});
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [video, setVideo] = useState<{ attachment: Attachment; posterUrl: string } | null>(null);
  const [videoUpload, setVideoUpload] = useState<VideoUploadState>({ phase: "idle" });
  const videoLabel = videoUploadLabel(videoUpload);

  useEffect(() => () => {
    if (video) URL.revokeObjectURL(video.posterUrl);
  }, [video]);

  useEffect(() => {
    if (status === "visitor") navigate("/connexion");
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

  async function handleVideoSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    setVideoUpload({ phase: "preparing" });
    try {
      const prepared = await prepareVideo(file);
      setVideoUpload({ phase: "uploading", percent: 0 });
      const attachment = await uploadPostVideo(file, prepared.poster, (fraction) =>
        setVideoUpload({ phase: "uploading", percent: Math.round(fraction * 100) }),
      );
      setVideo({ attachment, posterUrl: URL.createObjectURL(prepared.poster) });
      setVideoUpload({ phase: "done" });
    } catch (err) {
      const message =
        err instanceof VideoCheckError || err instanceof ChatApiError ? err.message : fr.feed.videoUploadError;
      toast.show(message, "danger");
      setVideoUpload({ phase: "idle" });
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const errors: FieldErrors<"body" | "testUrl"> = {
      ...(format === "a_tester" ? requiredFieldErrors({ testUrl }) : {}),
      ...(!body.trim() && attachments.length === 0 && !video ? { body: fr.feed.bodyOrImageRequired } : {}),
    };
    setFieldErrors(errors);
    if (hasFieldErrors(errors)) return;
    setSubmitting(true);
    try {
      await createPost({
        body: body.trim(),
        format: format === "none" ? null : format,
        testUrl: format === "a_tester" ? testUrl.trim() : null,
        testAsk: format === "a_tester" ? testAsk.trim() : null,
        attachmentIds: video ? [video.attachment.id] : attachments.map((attachment) => attachment.id),
        isBeginner,
      });
      navigate("/fil");
    } catch (err) {
      setError(err instanceof ChatApiError ? err.message : fr.feed.createError);
      setSubmitting(false);
    }
  }

  return (
    <FormPage
      title={fr.feed.newPostTitle}
      activeSection="fil"
      backHref="/fil"
      submitLabel={fr.feed.publish}
      submitting={submitting}
      submitDisabled={isSuspended}
      error={error}
      onSubmit={handleSubmit}
    >
      <CodeTextarea
        label={fr.feed.newPostBodyLabel}
        placeholder={fr.feed.composerPlaceholder}
        value={body}
        onValueChange={setBody}
        disabled={isSuspended}
        error={fieldErrors.body}
      />

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
        {video && (
          <div className="relative w-40">
            <img
              src={video.posterUrl}
              alt={video.attachment.originalName}
              className="aspect-[9/16] w-full rounded-card border border-border bg-black object-contain"
            />
            <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-xs tabular-nums text-white">
              {fr.feed.videoDuration(Math.round((video.attachment.durationMs ?? 0) / 1000))}
            </span>
            <IconButton
              aria-label={fr.feed.removeVideo}
              onClick={() => {
                setVideo(null);
                setVideoUpload({ phase: "idle" });
              }}
              className="absolute -right-2 -top-2 size-control-compact max-md:size-control-mobile bg-surface"
            >
              <X className="size-4" aria-hidden="true" />
            </IconButton>
          </div>
        )}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageSelected}
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/mp4,video/webm"
          className="hidden"
          onChange={handleVideoSelected}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => imageInputRef.current?.click()}
            loading={uploading && videoLabel === null}
            disabled={isSuspended || uploading || video !== null || attachments.length >= MAX_POST_ATTACHMENTS}
          >
            <ImageIcon className="size-4" aria-hidden="true" />
            {fr.feed.attachImage}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => videoInputRef.current?.click()}
            loading={videoLabel !== null}
            disabled={isSuspended || uploading || video !== null || attachments.length > 0}
          >
            <Clapperboard className="size-4" aria-hidden="true" />
            {fr.feed.attachVideo}
          </Button>
        </div>
        {videoLabel && (
          <p aria-hidden="true" className="text-sm text-text-2">
            {videoLabel}
          </p>
        )}
        {/* Toujours présente : une zone live ajoutée au moment du message n'est pas toujours lue. */}
        <p role="status" className="sr-only">
          {videoUploadAnnouncement(videoUpload)}
        </p>

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
          <FormField label={fr.feed.testUrlLabel} error={fieldErrors.testUrl}>
            <Input
              value={testUrl}
              onChange={(event) => setTestUrl(event.target.value)}
              disabled={isSuspended}
            />
          </FormField>
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

      <BeginnerCheckbox
        checked={isBeginner}
        onCheckedChange={setIsBeginner}
        label={fr.beginners.postCheckbox}
      />
    </FormPage>
  );
}
