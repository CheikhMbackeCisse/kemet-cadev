import { Cpu, Database, Network, SquareTerminal, type LucideIcon } from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
  type CSSProperties,
  type RefObject,
} from "react";
import { deviconUrl, HEAVY_DEVICONS } from "./deviconLogos.js";
import { useStillBackground } from "./ArrivalBackdrop.js";
import {
  UNIVERSE,
  UNIVERSE_SIZES,
  type UniverseDepth,
  type UniverseIcon,
  type UniverseItem,
  type UniverseScreen,
} from "./universeLayout.js";

const ICONS: Record<UniverseIcon, LucideIcon> = {
  terminal: SquareTerminal,
  database: Database,
  network: Network,
  cpu: Cpu,
};

const DEPTHS: readonly UniverseDepth[] = ["back", "middle", "front"];

// Écart de la flottaison, en pixels : le premier plan bouge plus que le fond.
const DRIFT: Record<UniverseDepth, number> = { back: 3, middle: 4, front: 6 };

// Marge entre un élément du premier plan ou du milieu et la carte : plus
// grande que le plus grand mouvement (parallaxe de 18 px et flottaison de 6),
// le test n'étant refait qu'au redimensionnement et au défilement.
const CARD_CLEARANCE = 24;

const DESKTOP_QUERY = "(min-width: 768px)";

function subscribeToScreen(onChange: () => void) {
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function useScreen(): UniverseScreen {
  return useSyncExternalStore(subscribeToScreen, () =>
    window.matchMedia(DESKTOP_QUERY).matches ? "desktop" : "mobile",
  );
}

function ItemView({ item, screen }: { item: UniverseItem; screen: UniverseScreen }) {
  const sizes = UNIVERSE_SIZES[screen][item.depth];
  const { content } = item;
  switch (content.kind) {
    case "logo": {
      const image = (
        <img
          src={deviconUrl(content.name)}
          alt=""
          width={item.depth === "front" ? Math.round(sizes.logo * 0.62) : sizes.logo}
          height={item.depth === "front" ? Math.round(sizes.logo * 0.62) : sizes.logo}
          loading="lazy"
          decoding="async"
          draggable={false}
          className="block"
        />
      );
      // Au premier plan, la pastille blanche de l'accueil : un logo sombre
      // (TypeScript, PostgreSQL) reste lisible sur le bleu.
      return item.depth === "front" ? (
        <span className="arrival-tile" style={{ width: sizes.logo, height: sizes.logo }}>
          {image}
        </span>
      ) : (
        image
      );
    }
    case "icon": {
      const Icon = ICONS[content.name];
      return <Icon size={sizes.icon} strokeWidth={1.5} className="block text-auth-text" />;
    }
    case "code":
      return (
        <span
          className="universe-code block whitespace-nowrap font-mono leading-normal"
          style={{ fontSize: sizes.codeFont }}
        >
          {content.tokens.map((token, index) => (
            <span key={index} data-tone={token.tone}>
              {token.text}
            </span>
          ))}
        </span>
      );
  }
}

function itemStyle(item: UniverseItem, index: number): CSSProperties {
  const drift = DRIFT[item.depth];
  return {
    left: `${item.x}%`,
    top: `${item.y}%`,
    "--drift-x": `${index % 2 === 0 ? drift : -drift}px`,
    "--drift-y": `${index % 3 === 0 ? -drift : drift}px`,
    "--drift-duration": `${item.duration}s`,
    "--drift-delay": `${-((index * 7) % item.duration)}s`,
  } as CSSProperties;
}

/**
 * Légère parallaxe à la souris : chaque profondeur suit le pointeur d'autant
 * plus qu'elle est proche. Rien au toucher, avec moins de mouvement, ni sur
 * connexion lente.
 */
function useParallax(root: RefObject<HTMLDivElement>, enabled: boolean) {
  useEffect(() => {
    const element = root.current;
    if (!enabled || !element) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    let x = 0;
    let y = 0;
    function onMove(event: PointerEvent) {
      if (event.pointerType !== "mouse") return;
      x = (event.clientX / window.innerWidth - 0.5) * 2;
      y = (event.clientY / window.innerHeight - 0.5) * 2;
      if (frame === 0) {
        frame = requestAnimationFrame(() => {
          frame = 0;
          element!.style.setProperty("--parallax-x", x.toFixed(3));
          element!.style.setProperty("--parallax-y", y.toFixed(3));
        });
      }
    }
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, [root, enabled]);
}

/**
 * Un élément du premier plan ne passe jamais derrière la carte : celui qui
 * la toucherait (petit écran, carte qui défile) est caché, sans perdre sa
 * place. L'arrière-plan peut passer derrière le verre.
 */
function useFrontClearOfCard(
  root: RefObject<HTMLDivElement>,
  card: RefObject<HTMLElement>,
  screen: UniverseScreen,
) {
  useLayoutEffect(() => {
    const element = root.current;
    const cardElement = card.current;
    if (!element || !cardElement) return;
    function update() {
      const box = cardElement!.getBoundingClientRect();
      element!.querySelectorAll<HTMLElement>('.universe-item[data-depth="front"], .universe-item[data-depth="middle"]').forEach((item) => {
        const itemBox = item.getBoundingClientRect();
        const clash =
          itemBox.right > box.left - CARD_CLEARANCE &&
          itemBox.left < box.right + CARD_CLEARANCE &&
          itemBox.bottom > box.top - CARD_CLEARANCE &&
          itemBox.top < box.bottom + CARD_CLEARANCE;
        item.toggleAttribute("data-clash", clash);
      });
    }
    let frame = 0;
    function schedule() {
      if (frame === 0) {
        frame = requestAnimationFrame(() => {
          frame = 0;
          update();
        });
      }
    }
    update();
    const observer = new ResizeObserver(schedule);
    observer.observe(cardElement);
    observer.observe(document.documentElement);
    window.addEventListener("scroll", schedule, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      cancelAnimationFrame(frame);
    };
  }, [root, card, screen]);
}

/**
 * Fond vivant de "Complète ton profil" : logos en couleurs, bouts de code et
 * icônes, à trois profondeurs (taille, flou, opacité), qui flottent
 * lentement. Purement décoratif : aucune phrase, aucun nom de personne.
 */
export function ProfileUniverse({ card }: { card: RefObject<HTMLElement> }) {
  const root = useRef<HTMLDivElement>(null);
  const screen = useScreen();
  const still = useStillBackground();
  useParallax(root, !still);
  useFrontClearOfCard(root, card, screen);
  const items = UNIVERSE[screen].filter(
    (item) => !(still && item.content.kind === "logo" && HEAVY_DEVICONS.has(item.content.name)),
  );

  return (
    <div
      ref={root}
      aria-hidden="true"
      className="arrival-universe pointer-events-none fixed inset-0 overflow-hidden"
    >
      {DEPTHS.map((depth) => (
        <div key={depth} className="universe-layer absolute inset-0" data-depth={depth}>
          {items.map((item, index) =>
            item.depth === depth ? (
              <span
                key={index}
                className="universe-item absolute -translate-x-1/2 -translate-y-1/2"
                data-depth={depth}
                style={itemStyle(item, index)}
              >
                <span className="arrival-drift block">
                  <ItemView item={item} screen={screen} />
                </span>
              </span>
            ) : null,
          )}
        </div>
      ))}
    </div>
  );
}
