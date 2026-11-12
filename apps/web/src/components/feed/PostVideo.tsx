import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import type { Attachment } from "@kemet/shared";
import { postAttachmentUrl, postVideoPosterUrl } from "../../lib/chat/api.js";
import { frameRatio } from "../../lib/feed/frameRatio.js";
import { isSlowConnection } from "../../lib/network.js";
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
}

/**
 * Vidéo d'un post. Sur une connexion normale, elle joue en muet quand elle est
 * visible aux trois cinquièmes ; en 3G, en économie de données ou en
 * mouvement réduit, seule l'image d'aperçu est chargée, jusqu'au clic.
 */
export function PostVideo({ attachment, playable = true }: PostVideoProps) {
  const frame = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [mounted, setMounted] = useState(false);
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

  return (
    <div
      ref={frame}
      className="relative mt-2 max-h-[min(512px,70vh)] overflow-hidden rounded-card border border-border bg-black"
      style={{ aspectRatio: String(frameRatio(attachment, false)) }}
    >
      {mounted ? (
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
          aria-label={attachment.originalName}
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
              onClick={() => setMounted(true)}
              aria-label={fr.feed.playVideo(attachment.originalName)}
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
    </div>
  );
}
