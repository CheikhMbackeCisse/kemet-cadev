import { BrainCircuit, Cpu, Lock, Shield, Wifi } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";
import { cn } from "../../lib/cn.js";
import { AFRICA_OUTLINE_PATH, AFRICA_OUTLINE_VIEWBOX } from "./africaOutline.js";
import {
  FLOATING_ITEMS,
  type FloatingContent,
  type FloatingItem,
  type FloatingSymbol,
} from "./floatingItems.js";
import { TECH_LOGOS } from "./techLogos.js";
import { AfricaNetwork } from "./AfricaNetwork.js";

/** "rich" pour l'accueil, "calm" pour les questions et les écrans de compte. */
export type ArrivalMotion = "rich" | "calm";

const MOTION: Record<
  ArrivalMotion,
  { amplitude: number; pace: number; low: number; high: number }
> = {
  rich: { amplitude: 1, pace: 1, low: 0.55, high: 0.95 },
  calm: { amplitude: 0.5, pace: 1.8, low: 0.08, high: 0.18 },
};

// Couleurs des trois symboles sur l'accueil, posés sur la même pastille
// claire que les logos : violet pour l'IA, vert pour la sécurité, cyan pour
// l'IoT.
const SYMBOL_COLORS: Record<FloatingSymbol, string> = {
  ai: "var(--auth-symbol-ai)",
  security: "var(--auth-symbol-security)",
  iot: "var(--auth-symbol-iot)",
};

function SymbolIcon({ name, size }: { name: FloatingSymbol; size: number }) {
  switch (name) {
    case "ai":
      return <BrainCircuit size={size} strokeWidth={1.5} />;
    case "security":
      return (
        <span className="relative flex items-center justify-center">
          <Shield size={size} strokeWidth={1.5} />
          <Lock size={size * 0.4} strokeWidth={2} className="absolute" />
        </span>
      );
    case "iot":
      return (
        <span className="relative flex">
          <Cpu size={size} strokeWidth={1.5} />
          <Wifi size={size * 0.5} strokeWidth={2} className="absolute -right-1/3 -top-1/3" />
        </span>
      );
  }
}

/**
 * Sur l'accueil, un logo garde sa couleur officielle, posé sur une pastille
 * claire et translucide : sans elle, Flutter ou Kotlin disparaîtraient sur
 * le bleu nuit. Ailleurs dans le parcours, tout reste blanc et discret.
 */
function FloatingContentView({
  content,
  size,
  colored,
}: {
  content: FloatingContent;
  size: number;
  colored: boolean;
}) {
  switch (content.kind) {
    case "logo": {
      const logo = TECH_LOGOS[content.name];
      const icon = (
        <svg
          viewBox="0 0 24 24"
          width={size}
          height={size}
          fill={colored ? logo.color : "currentColor"}
        >
          <path d={logo.path} />
        </svg>
      );
      return colored ? <span className="arrival-tile">{icon}</span> : icon;
    }
    case "symbol":
      return colored ? (
        <span className="arrival-tile" style={{ color: SYMBOL_COLORS[content.name] }}>
          <SymbolIcon name={content.name} size={size} />
        </span>
      ) : (
        <SymbolIcon name={content.name} size={size} />
      );
    case "code":
      return (
        <span className="whitespace-nowrap font-mono" style={{ fontSize: size }}>
          {content.text}
        </span>
      );
  }
}

/**
 * Place horizontale d'un élément. Sur l'accueil, le continent occupe le tiers
 * central du bureau : les éléments sont repoussés dans les deux bandes de
 * côté. Sur téléphone, il couvre toute la largeur ; on garde seulement les
 * éléments entiers dans l'écran.
 */
function floatLeft(item: FloatingItem, motion: ArrivalMotion): { mobile: number; desktop: number } {
  if (motion === "calm") return { mobile: item.left, desktop: item.left };
  const desktop = item.left < 50 ? 2 + item.left * 0.44 : 76 + (item.left - 50) * 0.4;
  return { mobile: Math.min(item.left, 84), desktop };
}

function floatStyle(item: FloatingItem, motion: ArrivalMotion): CSSProperties {
  const { amplitude, pace } = MOTION[motion];
  // Les bouts de code restent en retrait des logos, même sur l'accueil.
  const dim = motion === "rich" && item.content.kind === "code" ? 0.45 : 1;
  const low = MOTION[motion].low * dim;
  const high = MOTION[motion].high * dim;
  const left = floatLeft(item, motion);
  return {
    "--float-left": `${left.mobile}%`,
    "--float-left-md": `${left.desktop}%`,
    top: `${item.top}%`,
    "--float-dx": `${item.dx * amplitude}px`,
    "--float-dy": `${item.dy * amplitude}px`,
    "--float-rotate": `${item.rotate * amplitude}deg`,
    "--float-duration": `${item.duration * pace}s`,
    "--float-delay": `${item.delay * pace}s`,
    "--float-opacity-low": low,
    "--float-opacity-high": high,
  } as CSSProperties;
}

/** Vrai tant que l'onglet est visible : un fond animé caché ne doit rien coûter. */
function usePageVisible(): boolean {
  const [visible, setVisible] = useState(() => document.visibilityState !== "hidden");
  useEffect(() => {
    const update = () => setVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return visible;
}

/**
 * Fond du parcours d'arrivée : accueil, questions, connexion et inscription.
 * Dégradé et halos des écrans de compte (docs/adr/0019), l'Afrique, et une
 * vingtaine d'éléments au plus qui dérivent lentement derrière la carte en
 * verre dépoli. Sur l'accueil ("rich"), le continent occupe le centre avec
 * le réseau de ses capitales, et les logos gardent leurs couleurs.
 * Purement décoratif.
 */
export function ArrivalBackground({ motion }: { motion: ArrivalMotion }) {
  const visible = usePageVisible();

  return (
    <div
      aria-hidden="true"
      data-paused={visible ? undefined : ""}
      className="arrival-background pointer-events-none fixed inset-0 overflow-hidden"
      style={{ backgroundImage: "linear-gradient(160deg, var(--auth-bg-from), var(--auth-bg-to))" }}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(var(--auth-grid) 1px, transparent 1px), linear-gradient(90deg, var(--auth-grid) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />
      <div
        className="absolute -left-40 top-1/4 h-96 w-96 rounded-full opacity-25 blur-3xl"
        style={{ backgroundColor: "var(--auth-glow-b)" }}
      />
      <div
        className="absolute -right-32 top-1/3 h-[28rem] w-[28rem] rounded-full opacity-30 blur-3xl"
        style={{ backgroundColor: "var(--auth-glow-a)" }}
      />
      {motion === "rich" ? (
        // Sur téléphone, la largeur décide : le continent entier, Dakar et la
        // Corne compris, soit environ 65 % de la hauteur. Remonté pour que la
        // carte, en bas, ne couvre que l'Afrique australe.
        <div className="absolute inset-0 flex items-center justify-center pb-[14vh] md:pb-[22vh]">
          <AfricaNetwork paused={!visible} className="h-[min(72svh,135vw)] md:h-[72vh]" />
        </div>
      ) : (
        <svg
          viewBox={AFRICA_OUTLINE_VIEWBOX}
          className="absolute -bottom-[12vh] left-1/2 w-[min(120vw,92vh)] -translate-x-1/2 text-white opacity-[0.07]"
          fill="currentColor"
        >
          <path d={AFRICA_OUTLINE_PATH} />
        </svg>
      )}

      {FLOATING_ITEMS.map((item, index) => (
        <span
          key={index}
          className={cn(
            "arrival-float absolute left-[var(--float-left)] text-auth-text md:left-[var(--float-left-md)]",
            !item.mobile && "max-md:hidden",
          )}
          style={floatStyle(item, motion)}
        >
          <FloatingContentView
            content={item.content}
            size={item.size}
            colored={motion === "rich"}
          />
        </span>
      ))}
    </div>
  );
}
