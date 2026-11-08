import { Film, ImagePlus, PlaySquare, Plus, Video, X } from "lucide-react";
import { useId, useRef, useState, type RefObject } from "react";
import {
  DEFAULT_MAX_WORK_VIDEO_BYTES,
  MAX_WORK_GALLERY_IMAGES,
  MAX_WORK_VIDEOS,
  parseYoutubeId,
  workMediaContentPath,
  type WorkDetail,
  type WorkMediaFields as WorkMediaFieldsInput,
} from "@kemet/shared";
import { uploadWorkMedia } from "../../lib/chat/api.js";
import { Button } from "../ui/Button.js";
import { IconButton } from "../ui/IconButton.js";
import { Input } from "../ui/Input.js";
import { useToast } from "../ui/Toast.js";
import { fr } from "../../i18n/fr.js";

const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";
const VIDEO_ACCEPT = "video/mp4,video/webm";
const MAX_VIDEO_MEGABYTES = Math.round(DEFAULT_MAX_WORK_VIDEO_BYTES / (1024 * 1024));

interface ImageDraft {
  id: string;
  name: string;
  /** Un fichier qui vient d'être envoyé n'est pas encore public : aperçu local. */
  previewUrl: string;
}

type VideoDraft =
  { kind: "file"; id: string; name: string } | { kind: "youtube"; key: string; youtubeId: string };

export interface WorkMediaDraft {
  cover: ImageDraft | null;
  gallery: ImageDraft[];
  videos: VideoDraft[];
}

export function initialMediaDraft(work: WorkDetail | null): WorkMediaDraft {
  if (!work) return { cover: null, gallery: [], videos: [] };
  return {
    cover: work.coverMediaId
      ? {
          id: work.coverMediaId,
          name: fr.works.coverLabel,
          previewUrl: workMediaContentPath(work.coverMediaId),
        }
      : null,
    gallery: work.gallery.map((image) => ({
      id: image.id,
      name: image.originalName,
      previewUrl: workMediaContentPath(image.id),
    })),
    videos: work.videos.map((video) =>
      video.kind === "file"
        ? { kind: "file", id: video.id, name: video.originalName }
        : { kind: "youtube", key: video.id, youtubeId: video.youtubeId },
    ),
  };
}

/** Ce que le formulaire envoie : les fichiers dans l'ordre d'affichage, puis les liens. */
export function mediaDraftToInput(draft: WorkMediaDraft): WorkMediaFieldsInput {
  return {
    media: [
      ...(draft.cover ? [{ id: draft.cover.id, role: "cover" as const }] : []),
      ...draft.gallery.map((image) => ({ id: image.id, role: "gallery" as const })),
      ...draft.videos.flatMap((video) =>
        video.kind === "file" ? [{ id: video.id, role: "video" as const }] : [],
      ),
    ],
    youtubeUrls: draft.videos.flatMap((video) =>
      video.kind === "youtube" ? [`https://www.youtube.com/watch?v=${video.youtubeId}`] : [],
    ),
  };
}

export interface WorkMediaFieldsProps {
  value: WorkMediaDraft;
  onChange: (update: (current: WorkMediaDraft) => WorkMediaDraft) => void;
  onUploadingChange: (uploading: boolean) => void;
}

/** Couverture, galerie et vidéos d'un travail. Chaque fichier part au serveur dès qu'il est choisi. */
export function WorkMediaFields({ value, onChange, onUploadingChange }: WorkMediaFieldsProps) {
  const toast = useToast();
  const youtubeId = useId();
  const coverInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<"cover" | "gallery" | "video" | null>(null);
  const [youtubeDraft, setYoutubeDraft] = useState("");
  const [youtubeError, setYoutubeError] = useState<string | null>(null);

  const galleryFull = value.gallery.length >= MAX_WORK_GALLERY_IMAGES;
  const videosFull = value.videos.length >= MAX_WORK_VIDEOS;

  async function upload(target: "cover" | "gallery" | "video", files: File[]) {
    if (files.length === 0) return;
    setPending(target);
    onUploadingChange(true);
    try {
      for (const file of files) {
        if (target === "video" && file.size > DEFAULT_MAX_WORK_VIDEO_BYTES) {
          toast.show(fr.works.videoTooLarge(MAX_VIDEO_MEGABYTES), "danger");
          continue;
        }
        const media = await uploadWorkMedia(file);
        const expected = target === "video" ? "video" : "image";
        if (media.kind !== expected) {
          toast.show(
            expected === "video" ? fr.works.expectedVideo : fr.works.expectedImage,
            "danger",
          );
          continue;
        }
        if (target === "video") {
          onChange((current) =>
            current.videos.length >= MAX_WORK_VIDEOS
              ? current
              : {
                  ...current,
                  videos: [
                    ...current.videos,
                    { kind: "file", id: media.id, name: media.originalName },
                  ],
                },
          );
          continue;
        }
        const image = {
          id: media.id,
          name: media.originalName,
          previewUrl: URL.createObjectURL(file),
        };
        onChange((current) =>
          target === "cover"
            ? { ...current, cover: image }
            : current.gallery.length >= MAX_WORK_GALLERY_IMAGES
              ? current
              : { ...current, gallery: [...current.gallery, image] },
        );
      }
    } catch (error) {
      toast.show(
        error instanceof Error && error.message ? error.message : fr.works.mediaUploadError,
        "danger",
      );
    } finally {
      setPending(null);
      onUploadingChange(false);
      for (const input of [coverInput, galleryInput, videoInput])
        if (input.current) input.current.value = "";
    }
  }

  function addYoutube() {
    const id = parseYoutubeId(youtubeDraft);
    if (!id) {
      setYoutubeError(fr.works.youtubeInvalid);
      return;
    }
    setYoutubeError(null);
    setYoutubeDraft("");
    onChange((current) => ({
      ...current,
      videos: [...current.videos, { kind: "youtube", key: `${id}-${Date.now()}`, youtubeId: id }],
    }));
  }

  function fileInput(
    ref: RefObject<HTMLInputElement>,
    accept: string,
    target: "cover" | "gallery" | "video",
    multiple = false,
  ) {
    return (
      <input
        ref={ref}
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          const room =
            target === "gallery" ? MAX_WORK_GALLERY_IMAGES - value.gallery.length : files.length;
          void upload(target, files.slice(0, Math.max(room, 0)));
        }}
      />
    );
  }

  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="text-md font-semibold text-text">{fr.works.mediaTitle}</legend>
      <p className="-mt-2 text-xs text-subtle">{fr.works.mediaHint}</p>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-text-2">{fr.works.coverLabel}</span>
        {value.cover && (
          <div className="relative w-full max-w-sm overflow-hidden rounded-card border border-border">
            <img
              src={value.cover.previewUrl}
              alt=""
              className="aspect-[16/9] w-full bg-surface-2 object-cover"
            />
            <IconButton
              type="button"
              aria-label={fr.works.coverRemove}
              onClick={() => onChange((current) => ({ ...current, cover: null }))}
              className="absolute right-2 top-2 bg-bg"
            >
              <X className="size-4" aria-hidden="true" />
            </IconButton>
          </div>
        )}
        {fileInput(coverInput, IMAGE_ACCEPT, "cover")}
        <Button
          type="button"
          variant="secondary"
          className="self-start"
          loading={pending === "cover"}
          disabled={pending !== null && pending !== "cover"}
          onClick={() => coverInput.current?.click()}
        >
          <ImagePlus className="size-4" aria-hidden="true" />
          {value.cover ? fr.works.coverReplace : fr.works.coverChoose}
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-text-2">{fr.works.galleryLabel}</span>
        {value.gallery.length > 0 && (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {value.gallery.map((image) => (
              <li
                key={image.id}
                className="relative overflow-hidden rounded-control border border-border"
              >
                <img
                  src={image.previewUrl}
                  alt=""
                  className="aspect-square w-full bg-surface-2 object-cover"
                />
                <IconButton
                  type="button"
                  aria-label={fr.works.removeMedia(image.name)}
                  onClick={() =>
                    onChange((current) => ({
                      ...current,
                      gallery: current.gallery.filter((item) => item.id !== image.id),
                    }))
                  }
                  className="absolute right-1 top-1 bg-bg"
                >
                  <X className="size-4" aria-hidden="true" />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
        {fileInput(galleryInput, IMAGE_ACCEPT, "gallery", true)}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            loading={pending === "gallery"}
            disabled={galleryFull || (pending !== null && pending !== "gallery")}
            onClick={() => galleryInput.current?.click()}
          >
            <Plus className="size-4" aria-hidden="true" />
            {fr.works.galleryAdd}
          </Button>
          {galleryFull && <span className="text-xs text-subtle">{fr.works.galleryFull}</span>}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-text-2">{fr.works.videosLabel}</span>
        {value.videos.length > 0 && (
          <ul className="flex flex-col gap-1">
            {value.videos.map((video) => (
              <li
                key={video.kind === "file" ? video.id : video.key}
                className="flex items-center gap-2 text-sm text-text"
              >
                {video.kind === "file" ? (
                  <Film className="size-4 shrink-0 text-muted" aria-hidden="true" />
                ) : (
                  <PlaySquare className="size-4 shrink-0 text-muted" aria-hidden="true" />
                )}
                <span className="min-w-0 flex-1 truncate">
                  {video.kind === "file"
                    ? video.name
                    : `${fr.works.youtubeVideo} (${video.youtubeId})`}
                </span>
                <IconButton
                  type="button"
                  aria-label={fr.works.removeMedia(
                    video.kind === "file" ? video.name : fr.works.youtubeVideo,
                  )}
                  onClick={() =>
                    onChange((current) => ({
                      ...current,
                      videos: current.videos.filter((item) => item !== video),
                    }))
                  }
                >
                  <X className="size-4" aria-hidden="true" />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
        {fileInput(videoInput, VIDEO_ACCEPT, "video")}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            loading={pending === "video"}
            disabled={videosFull || (pending !== null && pending !== "video")}
            onClick={() => videoInput.current?.click()}
          >
            <Video className="size-4" aria-hidden="true" />
            {fr.works.videoAdd}
          </Button>
          {videosFull && <span className="text-xs text-subtle">{fr.works.videosFull}</span>}
        </div>
        <label htmlFor={youtubeId} className="mt-1 text-sm text-text-2">
          {fr.works.youtubeLabel}
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id={youtubeId}
            type="url"
            inputMode="url"
            value={youtubeDraft}
            placeholder={fr.works.youtubePlaceholder}
            disabled={videosFull}
            aria-invalid={youtubeError ? true : undefined}
            aria-describedby={youtubeError ? `${youtubeId}-error` : undefined}
            onChange={(event) => setYoutubeDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addYoutube();
              }
            }}
            className="min-w-0 flex-1"
          />
          <Button
            type="button"
            variant="secondary"
            disabled={videosFull || !youtubeDraft.trim()}
            onClick={addYoutube}
          >
            {fr.works.youtubeAdd}
          </Button>
        </div>
        {youtubeError && (
          <p id={`${youtubeId}-error`} className="text-xs text-danger">
            {youtubeError}
          </p>
        )}
      </div>
    </fieldset>
  );
}
