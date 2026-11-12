import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Attachment } from "@kemet/shared";
import { postAttachmentUrl } from "../../lib/chat/api.js";
import { cn } from "../../lib/cn.js";
import { fr } from "../../i18n/fr.js";
import { frameRatio } from "../../lib/feed/frameRatio.js";
import { PostVideo } from "./PostVideo.js";

export interface PostImagesProps {
  attachments: Attachment[];
  className?: string;
  /** Faux quand le bloc est déjà dans un lien (aperçu d'un post partagé). */
  linked?: boolean;
  /** Crédit d'un visuel repris d'un tiers, affiché sous les images. */
  credit?: { label: string; url: string | null } | null;
}

// Le cadre a ses proportions avant l'arrivée de l'image (dimensions lues à
// l'envoi) : le fil ne saute pas pendant le téléchargement, plusieurs
// secondes en 3G. L'image y tient entière, jamais recadrée.
function Picture({ attachment, eager = false }: { attachment: Attachment; eager?: boolean }) {
  return (
    <img
      src={postAttachmentUrl(attachment.id)}
      alt={attachment.originalName}
      width={attachment.width ?? undefined}
      height={attachment.height ?? undefined}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
      className="block size-full bg-surface-2 object-contain"
    />
  );
}

function Slide({ attachment, linked }: { attachment: Attachment; linked: boolean }) {
  if (!linked) return <Picture attachment={attachment} />;
  return (
    <a
      href={postAttachmentUrl(attachment.id)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={fr.feed.openImage(attachment.originalName)}
      className="block size-full"
    >
      <Picture attachment={attachment} />
    </a>
  );
}

function Carousel({ attachments, ratio }: { attachments: Attachment[]; ratio: number }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const count = attachments.length;

  function onScroll() {
    const element = scroller.current;
    if (!element || element.clientWidth === 0) return;
    setIndex(Math.min(count - 1, Math.max(0, Math.round(element.scrollLeft / element.clientWidth))));
  }

  function go(target: number) {
    const element = scroller.current;
    if (!element) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    element.scrollTo({ left: target * element.clientWidth, behavior: reduced ? "auto" : "smooth" });
  }

  return (
    <div
      role="group"
      aria-roledescription={fr.feed.carousel}
      aria-label={fr.feed.carouselLabel(count)}
      className="group/carousel relative"
    >
      <div
        ref={scroller}
        onScroll={onScroll}
        // Le glissement entre onglets ne part jamais d'un carrousel.
        data-no-tab-swipe
        tabIndex={0}
        aria-label={fr.feed.carouselScroller}
        className="scrollbar-none flex max-h-[min(512px,70vh)] snap-x snap-mandatory overflow-x-auto overscroll-x-contain focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
        style={{ aspectRatio: String(ratio) }}
      >
        {attachments.map((attachment, position) => (
          <div
            key={attachment.id}
            role="group"
            aria-roledescription={fr.feed.slide}
            aria-label={fr.feed.slideLabel(position + 1, count)}
            className="h-full w-full shrink-0 snap-center snap-always"
          >
            <Slide attachment={attachment} linked />
          </div>
        ))}
      </div>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium tabular-nums text-white"
      >
        {index + 1}/{count}
      </span>
      {index > 0 && (
        <button
          type="button"
          onClick={() => go(index - 1)}
          aria-label={fr.feed.previousImage}
          className="absolute left-2 top-1/2 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity focus-visible:opacity-100 group-hover/carousel:opacity-100 [@media(hover:hover)]:flex"
        >
          <ChevronLeft className="size-5" aria-hidden="true" />
        </button>
      )}
      {index < count - 1 && (
        <button
          type="button"
          onClick={() => go(index + 1)}
          aria-label={fr.feed.nextImage}
          className="absolute right-2 top-1/2 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity focus-visible:opacity-100 group-hover/carousel:opacity-100 [@media(hover:hover)]:flex"
        >
          <ChevronRight className="size-5" aria-hidden="true" />
        </button>
      )}
      <div aria-hidden="true" className="flex justify-center gap-1.5 bg-surface py-2">
        {attachments.map((attachment, position) => (
          <span
            key={attachment.id}
            className={cn(
              "size-1.5 rounded-full transition-colors",
              position === index ? "bg-primary" : "bg-border-strong",
            )}
          />
        ))}
      </div>
    </div>
  );
}

function Credit({ credit }: { credit: NonNullable<PostImagesProps["credit"]> }) {
  return (
    <p className="flex flex-wrap gap-x-2 border-t border-border bg-surface px-3 py-2 text-xs text-text-2">
      <span>{credit.label}</span>
      {credit.url && (
        <a href={credit.url} target="_blank" rel="noopener noreferrer" className="text-link hover:underline">
          {fr.feed.creditLink}
        </a>
      )}
    </p>
  );
}

export function PostImages({ attachments: all, className, linked = true, credit }: PostImagesProps) {
  // Images effacées avec le compte de leur auteur : on le dit, sans cadre vide.
  const attachments = all.filter((attachment) => !attachment.removed);
  if (attachments.length === 0) {
    return all.length > 0 ? (
      <p className={cn("mt-2 text-sm text-subtle", className)}>{fr.chat.imagesRemoved(all.length)}</p>
    ) : null;
  }

  // Une vidéo se publie seule (règle du serveur).
  const first = attachments[0]!;
  if (first.kind === "video") {
    return (
      <div className={className}>
        <PostVideo attachment={first} playable={linked} />
        {credit && <Credit credit={credit} />}
      </div>
    );
  }

  const ratio = frameRatio(first, attachments.length > 1);
  // Dans un lien (aperçu d'un post partagé), pas de bouton : la première
  // image et le nombre d'images.
  const single = attachments.length === 1 || !linked;

  return (
    <div className={cn("mt-2 overflow-hidden rounded-card border border-border", className)}>
      {single ? (
        <div className="relative max-h-[min(512px,70vh)]" style={{ aspectRatio: String(ratio) }}>
          <Slide attachment={attachments[0]!} linked={linked} />
          {attachments.length > 1 && (
            <span className="pointer-events-none absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium tabular-nums text-white">
              1/{attachments.length}
            </span>
          )}
        </div>
      ) : (
        <Carousel attachments={attachments} ratio={ratio} />
      )}
      {credit && <Credit credit={credit} />}
    </div>
  );
}
