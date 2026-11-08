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

/** "rich" pour l'accueil, "calm" pour les questions et les écrans de compte. */
export type ArrivalMotion = "rich" | "calm";

const MOTION: Record<
  ArrivalMotion,
  { amplitude: number; pace: number; low: number; high: number }
> = {
  rich: { amplitude: 1, pace: 1, low: 0.16, high: 0.35 },
  calm: { amplitude: 0.5, pace: 1.8, low: 0.08, high: 0.18 },
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

function FloatingContentView({ content, size }: { content: FloatingContent; size: number }) {
  switch (content.kind) {
    case "logo":
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor">
          <path d={TECH_LOGOS[content.name].path} />
        </svg>
      );
    case "symbol":
      return <SymbolIcon name={content.name} size={size} />;
    case "code":
      return (
        <span className="whitespace-nowrap font-mono" style={{ fontSize: size }}>
          {content.text}
        </span>
      );
  }
}

function floatStyle(item: FloatingItem, motion: ArrivalMotion): CSSProperties {
  const { amplitude, pace, low, high } = MOTION[motion];
  return {
    left: `${item.left}%`,
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
 * Dégradé et halos des écrans de compte (docs/adr/0019), silhouette de
 * l'Afrique, et seize éléments au plus qui dérivent lentement derrière la
 * carte en verre dépoli. Purement décoratif.
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
      <svg
        viewBox={AFRICA_OUTLINE_VIEWBOX}
        className="absolute -bottom-[12vh] left-1/2 w-[min(120vw,92vh)] -translate-x-1/2 text-white opacity-[0.07]"
        fill="currentColor"
      >
        <path d={AFRICA_OUTLINE_PATH} />
      </svg>

      {FLOATING_ITEMS.map((item, index) => (
        <span
          key={index}
          className={cn("arrival-float absolute text-auth-text", !item.mobile && "max-md:hidden")}
          style={floatStyle(item, motion)}
        >
          <FloatingContentView content={item.content} size={item.size} />
        </span>
      ))}
    </div>
  );
}
