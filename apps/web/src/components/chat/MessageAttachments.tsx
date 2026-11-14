import { Download } from "lucide-react";
import type { Attachment } from "@kemet/shared";
import { attachmentUrl } from "../../lib/chat/api.js";
import { fr } from "../../i18n/fr.js";
import { VoicePlayer } from "./VoicePlayer.js";
import { useImageViewer } from "../media/ImageViewer.js";

export function MessageAttachments({ attachments }: { attachments: Attachment[] }) {
  const images = attachments.filter(
    (attachment) => attachment.kind === "image" && !attachment.removed,
  );
  const { openAt, viewer } = useImageViewer(
    images.map((image) => ({ src: attachmentUrl(image.id), alt: image.originalName })),
  );
  if (attachments.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-2">
      {attachments.map((attachment) =>
        attachment.removed ? (
          <span key={attachment.id} className="text-sm text-subtle">
            {fr.chat.fileRemoved(attachment.originalName)}
          </span>
        ) : attachment.kind === "voice" ? (
          <VoicePlayer key={attachment.id} attachment={attachment} />
        ) : attachment.kind === "image" ? (
          <button
            key={attachment.id}
            type="button"
            onClick={(event) => openAt(images.indexOf(attachment), event.currentTarget)}
            aria-label={fr.chat.openImage(attachment.originalName)}
            className="block max-w-full cursor-zoom-in rounded-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:max-w-xs"
          >
            <img
              src={attachmentUrl(attachment.id)}
              alt={attachment.originalName}
              loading="lazy"
              decoding="async"
              className="max-h-64 max-w-full rounded-card border border-border object-contain"
            />
          </button>
        ) : (
          <a
            key={attachment.id}
            href={attachmentUrl(attachment.id)}
            aria-label={fr.chat.downloadFile(attachment.originalName)}
            className="inline-flex h-control-mobile items-center gap-2 rounded-card border border-border px-3 text-sm text-text hover:bg-surface-2 md:h-control"
          >
            <Download className="size-4" aria-hidden="true" />
            {attachment.originalName}
          </a>
        ),
      )}
      {viewer}
    </div>
  );
}
