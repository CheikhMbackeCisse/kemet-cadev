import { Database, Network, SquareTerminal, type LucideIcon } from "lucide-react";
import type { CSSProperties } from "react";
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
import { TECH_LOGOS } from "./techLogos.js";
import type { ArrivalMotion } from "./ArrivalBackground.js";

const ICONS: Record<DecorIcon, LucideIcon> = {
  terminal: SquareTerminal,
  database: Database,
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
      const logo = TECH_LOGOS[content.name];
      const glyph = Math.round(sizes.tile * 0.54);
      const icon = (
        <svg
          viewBox="0 0 24 24"
          width={glyph}
          height={glyph}
          fill={vivid ? logo.color : "currentColor"}
        >
          <path d={logo.path} />
        </svg>
      );
      return vivid ? (
        <span className="arrival-tile" style={{ width: sizes.tile, height: sizes.tile }}>
          {icon}
        </span>
      ) : (
        <span
          className="flex items-center justify-center"
          style={{ width: sizes.tile, height: sizes.tile }}
        >
          {icon}
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

// Chaque élément dérive dans une direction différente de son voisin.
function itemStyle(item: DecorItem, index: number): CSSProperties {
  return {
    "--drift-x": `${index % 2 === 0 ? DECOR_DRIFT : -DECOR_DRIFT}px`,
    "--drift-y": `${index % 3 === 0 ? -DECOR_DRIFT : DECOR_DRIFT}px`,
    left: `${item.x}%`,
    top: `${item.y}%`,
    "--drift-duration": `${item.duration}s`,
    "--drift-delay": `${item.delay}s`,
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
  return (
    <div className="arrival-band-items absolute inset-0" data-screen={screen}>
      {DECOR[screen][side].map((item, index) => (
        <span
          key={index}
          className="arrival-decor-item absolute -translate-x-1/2 -translate-y-1/2"
          style={itemStyle(item, index)}
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
