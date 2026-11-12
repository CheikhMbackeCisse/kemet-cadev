import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, Heart, MessageCircle, Play, Share2, Volume2, VolumeX, X } from "lucide-react";
import type { PostSummary } from "@kemet/shared";
import {
  getPost,
  postAttachmentUrl,
  postVideoPosterUrl,
  setPostBookmark,
  togglePostReaction,
} from "../lib/chat/api.js";
import { postQueryKey } from "../lib/feed/feedQuery.js";
import { postVideo, updatePostInCaches, videoPostsFromCache } from "../lib/feed/videoPosts.js";
import { navigate } from "../lib/navigation/navigate.js";
import { shareLink } from "../lib/shareLink.js";
import { formatCount } from "../lib/formatCount.js";
import { cn } from "../lib/cn.js";
import { useSession } from "../session/SessionProvider.js";
import { useToast } from "../components/ui/Toast.js";
import { Avatar } from "../components/ui/Avatar.js";
import { fr } from "../i18n/fr.js";

function readPostId(pathname: string): string {
  return decodeURIComponent(pathname.split("/")[2] ?? "");
}

function close() {
  if (window.history.length > 1) window.history.back();
  else navigate("/fil");
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const ROUND_BUTTON =
  "flex size-11 items-center justify-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white";
const ACTION_BUTTON =
  "flex flex-col items-center gap-1 text-xs font-medium tabular-nums text-white";

interface SlideProps {
  post: PostSummary;
  index: number;
  total: number;
  active: boolean;
  soundOn: boolean;
  canInteract: boolean;
  onSoundBlocked: () => void;
  onReact: () => void;
  onSave: () => void;
  onShare: () => void;
}

function VideoSlide({
  post,
  index,
  total,
  active,
  soundOn,
  canInteract,
  onSoundBlocked,
  onReact,
  onSave,
  onShare,
}: SlideProps) {
  const video = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(true);
  const attachment = postVideo(post)!;

  // Lu par l'effet de lecture sans le relancer : couper le son ne doit pas
  // relancer une vidéo mise en pause.
  const sound = useRef(soundOn);
  sound.current = soundOn;

  useEffect(() => {
    const element = video.current;
    if (!element) return;
    if (!active) {
      element.pause();
      return;
    }
    element.muted = !sound.current;
    // Sans geste récent (lien ouvert directement), le navigateur refuse le
    // son : la vidéo repart en muet, le bouton du son le dit.
    element.play().catch(() => {
      if (element.muted) return;
      element.muted = true;
      onSoundBlocked();
      void element.play().catch(() => undefined);
    });
  }, [active, onSoundBlocked]);

  useEffect(() => {
    if (video.current) video.current.muted = !soundOn;
  }, [soundOn]);

  function togglePlayback() {
    const element = video.current;
    if (!element) return;
    if (element.paused) void element.play().catch(() => undefined);
    else element.pause();
  }

  return (
    <section
      data-index={index}
      aria-roledescription={fr.feed.viewerSlide}
      aria-label={fr.feed.viewerSlideLabel(index + 1, total, post.authorDisplayName)}
      className="h-dvh w-full shrink-0 snap-start snap-always bg-black"
    >
      {/* Une colonne aux proportions d'une vidéo verticale : sur un grand écran,
          les actions restent au bord de la vidéo et non de la fenêtre. */}
      <div className="relative mx-auto h-full w-full max-w-[calc(100dvh*9/16)]">
        <video
          ref={video}
          src={postAttachmentUrl(attachment.id)}
          poster={postVideoPosterUrl(attachment.id)}
          preload={active ? "auto" : "none"}
          loop
          playsInline
          onClick={togglePlayback}
          onPlay={() => setPaused(false)}
          onPause={() => setPaused(true)}
          aria-label={attachment.originalName}
          className="block size-full object-contain"
        >
          {fr.feed.videoUnsupported}
        </video>
        {active && paused && (
          <button
            type="button"
            onClick={togglePlayback}
            aria-label={fr.feed.viewerPlay}
            className="absolute left-1/2 top-1/2 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <Play className="ml-1 size-8" aria-hidden="true" />
          </button>
        )}

        <div className="absolute bottom-6 right-3 flex flex-col items-center gap-5 pb-[env(safe-area-inset-bottom)]">
          {canInteract ? (
            <button
              type="button"
              onClick={onReact}
              aria-pressed={post.reactedByMe}
              aria-label={fr.feed.utileAriaLabel(post.utileCount)}
              className={ACTION_BUTTON}
            >
              <span className={ROUND_BUTTON}>
                <Heart
                  className={cn("size-6", post.reactedByMe && "fill-current text-danger")}
                  aria-hidden="true"
                />
              </span>
              <span aria-hidden="true">{formatCount(post.utileCount)}</span>
            </button>
          ) : (
            <span className={ACTION_BUTTON}>
              <span className={ROUND_BUTTON}>
                <Heart className="size-6" aria-hidden="true" />
              </span>
              <span className="sr-only">{fr.feed.utileCount(post.utileCount)}</span>
              <span aria-hidden="true">{formatCount(post.utileCount)}</span>
            </span>
          )}
          <a
            href={`/fil/${post.id}`}
            aria-label={fr.feed.replyAriaLabel(post.replyCount)}
            className={ACTION_BUTTON}
          >
            <span className={ROUND_BUTTON}>
              <MessageCircle className="size-6" aria-hidden="true" />
            </span>
            <span aria-hidden="true">{formatCount(post.replyCount)}</span>
          </a>
          {canInteract && (
            <button
              type="button"
              onClick={onSave}
              aria-pressed={post.savedByMe}
              aria-label={fr.feed.save}
              className={ACTION_BUTTON}
            >
              <span className={ROUND_BUTTON}>
                <Bookmark
                  className={cn("size-6", post.savedByMe && "fill-current")}
                  aria-hidden="true"
                />
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={onShare}
            aria-label={fr.feed.share}
            className={ACTION_BUTTON}
          >
            <span className={ROUND_BUTTON}>
              <Share2 className="size-6" aria-hidden="true" />
            </span>
          </button>
        </div>

        <div className="absolute bottom-6 left-3 right-20 rounded-card bg-black/80 p-3 text-white pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <a
            href={`/u/${post.authorHandle}`}
            className="flex items-center gap-2 text-sm font-semibold hover:underline"
          >
            <Avatar
              name={post.authorDisplayName}
              src={post.authorAvatarUrl ?? undefined}
              size={32}
              countryCode={post.authorCountry}
            />
            {post.authorDisplayName}
          </a>
          {post.body && <p className="mt-2 line-clamp-2 text-sm">{post.body}</p>}
        </div>
      </div>
    </section>
  );
}

/**
 * Vidéos du fil en plein écran, une par hauteur d'écran, au défilement
 * vertical. Ouverte depuis une vidéo du fil, elle fait défiler les vidéos de
 * ce fil dans son ordre ; ouverte par un lien, la seule vidéo du lien.
 */
export function VideoViewerPage() {
  const [postId] = useState(() => readPostId(window.location.pathname));
  const queryClient = useQueryClient();
  const toast = useToast();
  const { status, isSuspended } = useSession();
  const canInteract = status === "ready" && !isSuspended;

  const [fromFeed] = useState(() => videoPostsFromCache(queryClient, postId));
  const single = useQuery({
    queryKey: postQueryKey(postId),
    queryFn: () => getPost(postId).then((result) => result.post),
    enabled: fromFeed.length === 0,
  });
  const [changes, setChanges] = useState<Record<string, Partial<PostSummary>>>({});
  const base =
    fromFeed.length > 0 ? fromFeed : single.data && postVideo(single.data) ? [single.data] : [];
  const posts = base.map((post) => ({ ...post, ...changes[post.id] }));

  const scroller = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(() =>
    Math.max(
      0,
      fromFeed.findIndex((post) => post.id === postId),
    ),
  );
  // Le toucher qui a ouvert la vue permet le son ; un lien ouvert directement, non.
  const [soundOn, setSoundOn] = useState(true);
  const soundBlocked = useCallback(() => setSoundOn(false), []);

  const count = posts.length;
  // Placée une fois, à l'arrivée des vidéos : ensuite, le défilement décide.
  const positioned = useRef(false);
  useLayoutEffect(() => {
    const element = scroller.current;
    if (positioned.current || !element || count === 0) return;
    positioned.current = true;
    element.scrollTop = active * element.clientHeight;
  }, [count, active]);

  useEffect(() => {
    const root = scroller.current;
    if (!root || count === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.intersectionRatio >= 0.6)
            setActive(Number((entry.target as HTMLElement).dataset.index));
        }
      },
      { root, threshold: 0.6 },
    );
    for (const slide of root.querySelectorAll("[data-index]")) observer.observe(slide);
    return () => observer.disconnect();
  }, [count]);

  useEffect(() => {
    function go(target: number) {
      const element = scroller.current;
      if (!element || target < 0 || target >= count) return;
      element.scrollTo({
        top: target * element.clientHeight,
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea")) return;
      if (event.key === "Escape") close();
      else if (event.key === "ArrowDown" || event.key === "PageDown") {
        event.preventDefault();
        go(active + 1);
      } else if (event.key === "ArrowUp" || event.key === "PageUp") {
        event.preventDefault();
        go(active - 1);
      } else if (event.key === "m") setSoundOn((current) => !current);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active, count]);

  function apply(id: string, change: Partial<PostSummary>) {
    setChanges((current) => ({ ...current, [id]: { ...current[id], ...change } }));
    updatePostInCaches(queryClient, id, change);
  }

  async function react(post: PostSummary) {
    try {
      const result = await togglePostReaction(post.id);
      apply(post.id, { utileCount: result.utileCount, reactedByMe: result.reactedByMe });
    } catch {
      toast.show(fr.feed.reactError, "danger");
    }
  }

  async function save(post: PostSummary) {
    try {
      const result = await setPostBookmark(post.id, !post.savedByMe);
      apply(post.id, { savedByMe: result.savedByMe });
      toast.show(result.savedByMe ? fr.feed.savedToast : fr.feed.unsavedToast, "success");
    } catch {
      toast.show(fr.feed.saveError, "danger");
    }
  }

  async function share(post: PostSummary) {
    const outcome = await shareLink(
      `${window.location.origin}/fil/${post.id}`,
      fr.feed.shareTitle(post.authorDisplayName),
    );
    if (outcome === "copied") toast.show(fr.feed.linkCopied, "success");
    if (outcome === "failed") toast.show(fr.feed.shareFailed, "danger");
  }

  const waiting = count === 0 && single.isPending && fromFeed.length === 0;

  return (
    <main className="fixed inset-0 z-40 bg-black text-white">
      <h1 className="sr-only">{fr.feed.viewerTitle}</h1>
      {count > 0 ? (
        <div
          ref={scroller}
          data-no-tab-swipe
          className="scrollbar-none h-dvh snap-y snap-mandatory overflow-y-auto overscroll-contain"
        >
          {posts.map((post, index) => (
            <VideoSlide
              key={post.id}
              post={post}
              index={index}
              total={count}
              active={index === active}
              soundOn={soundOn}
              canInteract={canInteract}
              onSoundBlocked={soundBlocked}
              onReact={() => void react(post)}
              onSave={() => void save(post)}
              onShare={() => void share(post)}
            />
          ))}
        </div>
      ) : (
        <div className="flex h-dvh items-center justify-center px-6 text-center text-sm text-white/80">
          {waiting ? (
            <span role="status">{fr.feed.viewerLoading}</span>
          ) : (
            <p role="alert">{fr.feed.viewerUnavailable}</p>
          )}
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-between p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={close}
          aria-label={fr.feed.viewerClose}
          className={cn(ROUND_BUTTON, "pointer-events-auto")}
        >
          <X className="size-6" aria-hidden="true" />
        </button>
        {count > 0 && (
          <button
            type="button"
            onClick={() => setSoundOn((current) => !current)}
            aria-pressed={soundOn}
            aria-label={fr.feed.viewerSound}
            className={cn(ROUND_BUTTON, "pointer-events-auto")}
          >
            {soundOn ? (
              <Volume2 className="size-6" aria-hidden="true" />
            ) : (
              <VolumeX className="size-6" aria-hidden="true" />
            )}
          </button>
        )}
      </div>
    </main>
  );
}
