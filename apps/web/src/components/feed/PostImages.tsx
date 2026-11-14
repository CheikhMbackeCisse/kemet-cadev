import { useRef, useState, type KeyboardEvent } from "react";
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
  /** Post des pièces jointes : une vidéo s'ouvre alors en plein écran. */
  postId?: string;
  /** Auteur du post, pour nommer une vidéo sans lire son nom de fichier. */
  authorName?: string;
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

function Slide({
  attachment,
  linked,
  eager = false,
}: {
  attachment: Attachment;
  linked: boolean;
  eager?: boolean;
}) {
  if (!linked) return <Picture attachment={attachment} eager={eager} />;
  return (
    <a
      href={postAttachmentUrl(attachment.id)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={fr.feed.openImage(attachment.originalName)}
      className="block size-full"
    >
      <Picture attachment={attachment} eager={eager} />
    </a>
  );
}

const FRAME_MAX_HEIGHT = "min(512px, 70vh)";

const ARROW_CLASS =
  "absolute top-1/2 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black [@media(hover:hover)]:flex";

function ArrowButton({
  side,
  disabled,
  onClick,
}: {
  side: "previous" | "next";
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = side === "previous" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      aria-disabled={disabled}
      aria-label={side === "previous" ? fr.feed.previousImage : fr.feed.nextImage}
      className={cn(
        ARROW_CLASS,
        side === "previous" ? "left-2" : "right-2",
        disabled
          ? "cursor-default opacity-0 focus-visible:opacity-40"
          : "opacity-0 focus-visible:opacity-100 group-hover/carousel:opacity-100",
      )}
    >
      <Icon className="size-5" aria-hidden="true" />
    </button>
  );
}

function Carousel({ attachments, ratio }: { attachments: Attachment[]; ratio: number }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const count = attachments.length;

  function onScroll() {
    const element = scroller.current;
    if (!element || element.clientWidth === 0) return;
    setIndex(
      Math.min(count - 1, Math.max(0, Math.round(element.scrollLeft / element.clientWidth))),
    );
  }

  function go(target: number) {
    const element = scroller.current;
    if (!element) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    element.scrollTo({ left: target * element.clientWidth, behavior: reduced ? "auto" : "smooth" });
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const target = index + (event.key === "ArrowLeft" ? -1 : 1);
    if (target >= 0 && target < count) go(target);
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
        onKeyDown={onKeyDown}
        // Le glissement entre onglets ne part jamais d'un carrousel.
        data-no-tab-swipe
        tabIndex={0}
        role="region"
        aria-label={fr.feed.carouselScroller}
        className="scrollbar-none flex max-h-[min(512px,70vh)] w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
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
            {/* Le premier visuel arrive tout de suite, les suivants au défilement. */}
            <Slide attachment={attachment} linked eager={position === 0} />
          </div>
        ))}
      </div>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium tabular-nums text-white"
      >
        {index + 1}/{count}
      </span>
      {/* Toujours rendues : une flèche qui disparaîtrait sous le focus le
          laisserait tomber sur la page. Aux extrémités, elle reste joignable
          au clavier mais ne fait rien. */}
      <ArrowButton side="previous" disabled={index === 0} onClick={() => go(index - 1)} />
      <ArrowButton side="next" disabled={index === count - 1} onClick={() => go(index + 1)} />
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

function Credit({
  credit,
  detached = false,
}: {
  credit: NonNullable<PostImagesProps["credit"]>;
  /** Sous une vidéo, qui a son propre cadre : pas de filet ni de fond. */
  detached?: boolean;
}) {
  return (
    <p
      className={cn(
        "flex flex-wrap gap-x-2 text-xs text-text-2",
        detached ? "mt-1" : "border-t border-border bg-surface px-3 py-2",
      )}
    >
      <span>{credit.label}</span>
      {credit.url && (
        <a
          href={credit.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-link hover:underline"
        >
          {fr.feed.creditLink}
          <span className="sr-only"> {fr.feed.newTab}</span>
        </a>
      )}
    </p>
  );
}

export function PostImages({
  attachments: all,
  className,
  linked = true,
  credit,
  postId,
  authorName,
}: PostImagesProps) {
  // Images effacées avec le compte de leur auteur : on le dit, sans cadre vide.
  const attachments = all.filter((attachment) => !attachment.removed);
  if (attachments.length === 0) {
    return all.length > 0 ? (
      <p className={cn("mt-2 text-sm text-subtle", className)}>
        {fr.chat.imagesRemoved(all.length)}
      </p>
    ) : null;
  }

  // Une vidéo se publie seule (règle du serveur).
  const first = attachments[0]!;
  if (first.kind === "video") {
    return (
      <div className={className}>
        <PostVideo attachment={first} playable={linked} postId={postId} authorName={authorName} />
        {credit && <Credit credit={credit} detached />}
      </div>
    );
  }

  const ratio = frameRatio(first, attachments.length > 1);
  // Dans un lien (aperçu d'un post partagé), pas de bouton : la première
  // image et le nombre d'images.
  const single = attachments.length === 1 || !linked;

  // Sans largeur bornée, la hauteur maximale rétrécit le cadre mais pas sa
  // bordure : une bande vide restait à droite d'une image carrée sur bureau.
  return (
    <div
      className={cn("mt-2 overflow-hidden rounded-card border border-border", className)}
      style={{ maxWidth: `calc(${FRAME_MAX_HEIGHT} * ${ratio})` }}
    >
      {single ? (
        <div className="relative w-full" style={{ aspectRatio: String(ratio) }}>
          <Slide attachment={attachments[0]!} linked={linked} />
          {attachments.length > 1 && (
            <>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium tabular-nums text-white"
              >
                1/{attachments.length}
              </span>
              <span className="sr-only">{fr.feed.carouselLabel(attachments.length)}</span>
            </>
          )}
        </div>
      ) : (
        <Carousel attachments={attachments} ratio={ratio} />
      )}
      {credit && <Credit credit={credit} />}
    </div>
  );
}
