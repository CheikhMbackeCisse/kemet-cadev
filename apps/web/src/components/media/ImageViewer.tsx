import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { fr } from "../../i18n/fr.js";

export interface ViewerImage {
  src: string;
  alt: string;
}

// Posé sur l'entrée d'historique ajoutée à l'ouverture : le retour du
// système (bouton Android, geste de Safari) ferme la visionneuse au lieu de
// quitter la page.
const HISTORY_KEY = "imageViewer";
const SWIPE_CLOSE_DISTANCE = 96;

function viewerEntryOnTop(): boolean {
  const state = window.history.state as Record<string, unknown> | null;
  return state?.[HISTORY_KEY] === true;
}

function zoomed(): boolean {
  return (window.visualViewport?.scale ?? 1) > 1.01;
}

interface ImageViewerProps {
  images: ViewerImage[];
  initialIndex: number;
  /** Reçoit le focus à la fermeture : l'image touchée. */
  returnFocusTo: HTMLElement | null;
  onClose: () => void;
}

function ImageViewer({ images, initialIndex, returnFocusTo, onClose }: ImageViewerProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const [index, setIndex] = useState(initialIndex);
  const [dragY, setDragY] = useState(0);
  const drag = useRef<{ x: number; y: number; vertical: boolean | null } | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const count = images.length;

  useEffect(() => {
    // Sous StrictMode, l'effet passe deux fois : une seule entrée ajoutée.
    if (!viewerEntryOnTop()) {
      const state = window.history.state as Record<string, unknown> | null;
      window.history.pushState({ ...state, [HISTORY_KEY]: true }, "", window.location.href);
    }
    const onPopState = () => {
      if (!viewerEntryOnTop()) onCloseRef.current();
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const close = useCallback(() => {
    if (viewerEntryOnTop()) window.history.back();
    else onCloseRef.current();
  }, []);

  useLayoutEffect(() => {
    const element = scroller.current;
    if (element) element.scrollLeft = initialIndex * element.clientWidth;
  }, [initialIndex]);

  function onScroll() {
    const element = scroller.current;
    if (!element || element.clientWidth === 0) return;
    setIndex(
      Math.min(count - 1, Math.max(0, Math.round(element.scrollLeft / element.clientWidth))),
    );
  }

  function go(target: number) {
    const element = scroller.current;
    if (!element || target < 0 || target >= count) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    element.scrollTo({ left: target * element.clientWidth, behavior: reduced ? "auto" : "smooth" });
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      event.stopPropagation();
      go(index + (event.key === "ArrowLeft" ? -1 : 1));
    }
  }

  // Glisser vers le bas ferme. Jamais pendant un zoom à deux doigts : le
  // geste sert alors à se déplacer dans l'image.
  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || event.pointerType === "mouse" || zoomed()) return;
    drag.current = { x: event.clientX, y: event.clientY, vertical: null };
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const start = drag.current;
    if (!start || !event.isPrimary) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (start.vertical === null && Math.hypot(dx, dy) > 8) {
      start.vertical = Math.abs(dy) > Math.abs(dx) && dy > 0;
    }
    if (start.vertical) setDragY(Math.max(0, dy));
  }

  function endDrag() {
    const wasVertical = drag.current?.vertical === true;
    drag.current = null;
    if (wasVertical && dragY > SWIPE_CLOSE_DISTANCE) close();
    else setDragY(0);
  }

  const current = images[index] ?? images[0]!;

  return (
    <RadixDialog.Root open onOpenChange={(open) => !open && close()}>
      <RadixDialog.Portal>
        <RadixDialog.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            closeButton.current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocusTo?.focus({ preventScroll: true });
          }}
          onKeyDown={onKeyDown}
          // Rendue dans un portail, la visionneuse reste dans l'arbre React de
          // la carte du post : un toucher ne doit pas remonter jusqu'à son
          // ouverture au clic.
          onClick={(event) => event.stopPropagation()}
          // Ni le glissement entre onglets ni celui du bord ne partent d'ici.
          data-no-tab-swipe
          className="image-viewer fixed inset-0 z-50 outline-none"
          style={{ backgroundColor: `rgb(0 0 0 / ${0.92 * (1 - Math.min(dragY / 400, 0.6))})` }}
        >
          <RadixDialog.Title className="sr-only">
            {count > 1 ? fr.imageViewer.titleMany(index + 1, count, current.alt) : current.alt}
          </RadixDialog.Title>
          <div
            ref={scroller}
            onScroll={onScroll}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            className="scrollbar-none flex size-full snap-x snap-mandatory overflow-x-auto overscroll-contain"
            style={{
              touchAction: "pan-x pinch-zoom",
              transform: dragY ? `translateY(${dragY}px)` : undefined,
              transition: dragY ? undefined : "transform 150ms ease-out",
            }}
          >
            {images.map((image, position) => (
              <div
                key={image.src}
                // Toucher le fond, à côté de l'image, ferme.
                onClick={(event) => {
                  if (event.target === event.currentTarget) close();
                }}
                aria-hidden={position === index ? undefined : true}
                className="flex size-full shrink-0 snap-center snap-always items-center justify-center"
              >
                <img
                  src={image.src}
                  alt={image.alt}
                  decoding="async"
                  loading={Math.abs(position - initialIndex) <= 1 ? "eager" : "lazy"}
                  draggable={false}
                  className="max-h-full max-w-full select-none object-contain"
                />
              </div>
            ))}
          </div>
          {count > 1 && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-[max(12px,env(safe-area-inset-top))] -translate-x-1/2 rounded-full bg-black/50 px-2.5 py-1 text-xs font-medium tabular-nums text-white/85"
            >
              {index + 1} / {count}
            </span>
          )}
          <RadixDialog.Close
            ref={closeButton}
            aria-label={fr.imageViewer.close}
            className="absolute right-[max(4px,env(safe-area-inset-right))] top-[max(4px,env(safe-area-inset-top))] inline-flex size-11 items-center justify-center rounded-full text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            onClick={(event) => {
              event.preventDefault();
              close();
            }}
          >
            <X className="size-6" aria-hidden="true" />
          </RadixDialog.Close>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

/**
 * Visionneuse d'images partagée : `openAt(index, élément touché)` l'ouvre
 * par-dessus la page, `viewer` est à rendre dans le composant.
 */
export function useImageViewer(images: ViewerImage[]): {
  openAt: (index: number, trigger: HTMLElement | null) => void;
  viewer: ReactNode;
} {
  const [opened, setOpened] = useState<{ index: number; trigger: HTMLElement | null } | null>(null);
  const openAt = useCallback(
    (index: number, trigger: HTMLElement | null) => setOpened({ index, trigger }),
    [],
  );
  const viewer = opened ? (
    <ImageViewer
      images={images}
      initialIndex={opened.index}
      returnFocusTo={opened.trigger}
      onClose={() => setOpened(null)}
    />
  ) : null;
  return { openAt, viewer };
}
