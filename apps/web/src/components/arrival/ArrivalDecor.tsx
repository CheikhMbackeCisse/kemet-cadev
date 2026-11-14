import { Cpu, Network, ShieldCheck, type LucideIcon } from "lucide-react";
import { useState, type CSSProperties } from "react";
import { cn } from "../../lib/cn.js";
import {
  DECOR,
  DECOR_DRIFT,
  DECOR_SIZES,
  type DecorBandSide,
  type DecorContent,
  type DecorIcon,
  type DecorItem,
  type DecorScreen,
} from "./decorLayout.js";
import { deviconUrl, type DeviconName } from "./deviconLogos.js";
import { TECH_LOGOS as SIMPLE_ICONS, type TechLogoName } from "../ui/techLogos.js";
import type { ArrivalMotion } from "./ArrivalBackground.js";

const TECH_LOGOS: Partial<Record<DeviconName, (typeof SIMPLE_ICONS)[TechLogoName]>> = {
  python: SIMPLE_ICONS.python,
  pytorch: SIMPLE_ICONS.pytorch,
  typescript: SIMPLE_ICONS.typescript,
  react: SIMPLE_ICONS.react,
  docker: SIMPLE_ICONS.docker,
};

const ICONS: Record<DecorIcon, LucideIcon> = {
  cpu: Cpu,
  shield: ShieldCheck,
  network: Network,
};

function DecorView({
  content,
  screen,
  vivid,
}: {
  content: DecorContent;
  screen: DecorScreen;
  vivid: boolean;
}) {
  const sizes = DECOR_SIZES[screen];
  switch (content.kind) {
    case "logo": {
      // Écrans calmes : la silhouette blanche de Simple Icons, qui garde les
      // lettres de TS (celle d'un logo Devicon en couleurs serait un
      // carré plein).
      const silhouette = vivid ? null : TECH_LOGOS[content.name];
      if (silhouette) {
        const glyph = Math.round(sizes.tile * 0.54);
        return (
          <span
            className="flex items-center justify-center"
            style={{ width: sizes.tile, height: sizes.tile }}
          >
            <svg viewBox="0 0 24 24" width={glyph} height={glyph} fill="currentColor">
              <path d={silhouette.path} />
            </svg>
          </span>
        );
      }
      const glyph = Math.round(sizes.tile * 0.62);
      return (
        <span className="arrival-tile" style={{ width: sizes.tile, height: sizes.tile }}>
          <img
            src={deviconUrl(content.name)}
            alt=""
            width={glyph}
            height={glyph}
            decoding="async"
            draggable={false}
            className="block"
          />
        </span>
      );
    }
    case "icon": {
      const Icon = ICONS[content.name];
      return <Icon size={sizes.icon} strokeWidth={1.5} className="block" />;
    }
    case "code":
      return (
        <span
          className="block whitespace-nowrap font-mono leading-normal"
          style={{ fontSize: sizes.codeFont }}
        >
          {content.text}
        </span>
      );
  }
}

// Début commun de toutes les dérives : passer d'un écran du parcours à
// l'autre reprend chaque élément là où il en était, sans saut.
const DRIFT_EPOCH = performance.now();

// Chaque élément dérive dans une direction différente de son voisin.
function itemStyle(item: DecorItem, index: number, elapsed: number): CSSProperties {
  return {
    "--drift-x": `${index % 2 === 0 ? DECOR_DRIFT : -DECOR_DRIFT}px`,
    "--drift-y": `${index % 3 === 0 ? -DECOR_DRIFT : DECOR_DRIFT}px`,
    left: `${item.x}%`,
    top: `${item.y}%`,
    "--drift-duration": `${item.duration}s`,
    "--drift-delay": `${(item.delay - elapsed).toFixed(2)}s`,
  } as CSSProperties;
}

function BandItems({
  screen,
  side,
  vivid,
}: {
  screen: DecorScreen;
  side: DecorBandSide;
  vivid: boolean;
}) {
  const [elapsed] = useState(() => (performance.now() - DRIFT_EPOCH) / 1000);
  return (
    <div className="arrival-band-items absolute inset-0" data-screen={screen}>
      {DECOR[screen][side].map((item, index) => (
        <span
          key={index}
          className="arrival-decor-item absolute -translate-x-1/2 -translate-y-1/2"
          style={itemStyle(item, index, elapsed)}
        >
          <span
            className={cn(
              "arrival-drift block",
              item.content.kind === "code" && "arrival-decor-code",
              item.content.kind === "icon" && "arrival-decor-icon",
              !vivid && "arrival-decor-calm",
            )}
          >
            <DecorView content={item.content} screen={screen} vivid={vivid} />
          </span>
        </span>
      ))}
    </div>
  );
}

/**
 * Une bande de décor posée à côté de la carte : au-dessus ou au-dessous sur
 * téléphone, à gauche ou à droite sur ordinateur. Le décor ne peut donc
 * jamais passer sous la carte. Une bande trop petite reste vide (requête de
 * conteneur, voir index.css). Purement décoratif.
 */
export function ArrivalDecorBand({ side, motion }: { side: DecorBandSide; motion: ArrivalMotion }) {
  const vivid = motion === "rich";
  return (
    <div aria-hidden="true" className="arrival-band pointer-events-none relative min-h-0 min-w-0">
      <BandItems screen="mobile" side={side} vivid={vivid} />
      <BandItems screen="desktop" side={side} vivid={vivid} />
    </div>
  );
}
