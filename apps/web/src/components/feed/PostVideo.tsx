import { useEffect, useRef, useState } from "react";
import { Maximize2, Play } from "lucide-react";
import type { Attachment } from "@kemet/shared";
import { postAttachmentUrl, postVideoPosterUrl } from "../../lib/chat/api.js";
import { frameRatio } from "../../lib/feed/frameRatio.js";
import { isSlowConnection } from "../../lib/network.js";
import { navigate } from "../../lib/navigation/navigate.js";
import { fr } from "../../i18n/fr.js";

// Une seule vidéo joue à la fois dans le fil : la suivante met en pause la précédente.
let playing: HTMLVideoElement | null = null;

function claim(video: HTMLVideoElement) {
  if (playing && playing !== video) playing.pause();
  playing = video;
}

function autoplayAllowed(): boolean {
  return !isSlowConnection() && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export interface PostVideoProps {
  attachment: Attachment;
  /** Faux dans l'aperçu d'un post partagé, déjà dans un lien : aperçu seul. */
  playable?: boolean;
  /** Post de la vidéo : ouvre la vue plein écran. Absent, pas de bouton. */
  postId?: string;
  /** Nomme la vidéo pour les lecteurs d'écran, plutôt que le nom du fichier. */
  authorName?: string;
}

/**
 * Vidéo d'un post. Sur une connexion normale, elle joue en muet quand elle est
 * visible aux trois cinquièmes ; en 3G, en économie de données ou en
 * mouvement réduit, seule l'image d'aperçu est chargée, jusqu'au clic.
 */
export function PostVideo({ attachment, playable = true, postId, authorName }: PostVideoProps) {
  const frame = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [mounted, setMounted] = useState(false);
  const [failed, setFailed] = useState(false);
  // Le bouton Lire disparaît sous le focus : la vidéo le reprend.
  const focusOnMount = useRef(false);
  const label = authorName ? fr.feed.videoOf(authorName) : attachment.originalName;
  const [autoplay] = useState(() => playable && autoplayAllowed());
  const seconds = Math.round((attachment.durationMs ?? 0) / 1000);

  useEffect(() => {
    const element = frame.current;
    if (!autoplay || !element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.intersectionRatio >= 0.6) {
          setMounted(true);
          const current = video.current;
          if (current) {
            claim(current);
            void current.play().catch(() => undefined);
          }
        } else {
          video.current?.pause();
        }
      },
      { threshold: [0, 0.6] },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [autoplay]);

  useEffect(() => {
    if (mounted && focusOnMount.current) video.current?.focus();
  }, [mounted]);

  return (
    <div
      ref={frame}
      className="relative mt-2 max-h-[min(512px,70vh)] overflow-hidden rounded-card border border-border bg-black"
      style={{ aspectRatio: String(frameRatio(attachment, false)) }}
    >
      {failed ? (
        <p className="flex size-full flex-col items-center justify-center gap-2 px-4 text-center text-sm text-white/80">
          {fr.feed.videoLoadError}
          <a
            href={postAttachmentUrl(attachment.id)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white underline"
          >
            {fr.feed.videoOpenFile}
          </a>
        </p>
      ) : mounted ? (
        <video
          ref={video}
          src={postAttachmentUrl(attachment.id)}
          poster={postVideoPosterUrl(attachment.id)}
          muted={autoplay}
          autoPlay
          loop={autoplay}
          playsInline
          controls
          preload="metadata"
          onPlay={(event) => claim(event.currentTarget)}
          onError={() => setFailed(true)}
          aria-label={label}
          className="block size-full object-contain"
        >
          {fr.feed.videoUnsupported}
        </video>
      ) : (
        <>
          <img
            src={postVideoPosterUrl(attachment.id)}
            alt=""
            width={attachment.width ?? undefined}
            height={attachment.height ?? undefined}
            loading="lazy"
            decoding="async"
            className="block size-full object-contain"
          />
          {playable && (
            <button
              type="button"
              onClick={() => {
                focusOnMount.current = true;
                setMounted(true);
              }}
              aria-label={fr.feed.playVideo(label)}
              className="absolute inset-0 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
            >
              <span className="flex size-14 items-center justify-center rounded-full bg-black/60 text-white">
                <Play className="ml-0.5 size-7" aria-hidden="true" />
              </span>
            </button>
          )}
          {seconds > 0 && (
            <span className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium tabular-nums text-white">
              {fr.feed.videoDuration(seconds)}
            </span>
          )}
        </>
      )}
      {playable && postId && (
        <button
          type="button"
          onClick={() => {
            video.current?.pause();
            navigate(`/videos/${postId}`);
          }}
          aria-label={fr.feed.openVideoViewer}
          title={fr.feed.openVideoViewer}
          className="absolute right-2 top-2 flex size-9 items-center justify-center rounded-full bg-black/60 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black max-md:size-11"
        >
          <Maximize2 className="size-5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
