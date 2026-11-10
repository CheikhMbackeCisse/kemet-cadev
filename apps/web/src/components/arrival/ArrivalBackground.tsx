import type { CSSProperties } from "react";
import { cn } from "../../lib/cn.js";
import {
  AFRICA_CAPITALS,
  AFRICA_OUTLINE_HEIGHT,
  AFRICA_OUTLINE_PATH,
  AFRICA_OUTLINE_WIDTH,
} from "./africaOutline.js";

/** "rich" pour l'accueil, "calm" pour les questions et les écrans de compte. */
export type ArrivalMotion = "rich" | "calm";

function percent(value: number, size: number): string {
  return `${((value / size) * 100).toFixed(2)}%`;
}

/**
 * Le continent entier, centré, en filigrane : remplissage très léger et
 * contour fin, d'un pixel quelle que soit sa taille. Sur l'accueil, cinq
 * capitales battent lentement, l'une après l'autre, jamais sous la carte
 * (ArrivalLayout les cache).
 */
function AfricaWatermark({ capitals }: { capitals: boolean }) {
  return (
    // Sur téléphone, la carte d'un écran calme, plus opaque, couvre presque
    // tout le continent : seul un morceau de côte dépasserait. Rien plutôt
    // qu'un fragment.
    <div
      className={cn(
        "absolute inset-0 flex items-center justify-center",
        !capitals && "max-md:hidden",
      )}
    >
      <div
        className="africa-watermark relative"
        style={{ aspectRatio: `${AFRICA_OUTLINE_WIDTH} / ${AFRICA_OUTLINE_HEIGHT}` }}
      >
        <svg
          viewBox={`0 0 ${AFRICA_OUTLINE_WIDTH} ${AFRICA_OUTLINE_HEIGHT}`}
          className="absolute inset-0 size-full overflow-visible"
        >
          <path
            d={AFRICA_OUTLINE_PATH}
            fill="var(--auth-continent-fill)"
            stroke="var(--auth-continent-line)"
            strokeWidth="1"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {capitals &&
          AFRICA_CAPITALS.map((capital, index) => (
            <span
              key={capital.id}
              className="capital-dot"
              style={
                {
                  left: percent(capital.x, AFRICA_OUTLINE_WIDTH),
                  top: percent(capital.y, AFRICA_OUTLINE_HEIGHT),
                  "--pulse-delay": `${index * -1.6}s`,
                } as CSSProperties
              }
            />
          ))}
      </div>
    </div>
  );
}

/**
 * Fond du parcours d'arrivée : accueil, questions, connexion et inscription.
 * Dégradé et halos des écrans de compte (docs/adr/0019), le continent en
 * filigrane derrière la carte. Le décor qui dérive (logos, icônes, code) vit
 * dans les bandes autour de la carte (ArrivalDecor.tsx), pas ici.
 * Mouvement réglé par ArrivalLayout (onglet caché, connexion lente). Purement
 * décoratif.
 */
export function ArrivalBackground({ motion }: { motion: ArrivalMotion }) {
  return (
    <div
      aria-hidden="true"
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
      <AfricaWatermark capitals={motion === "rich"} />
    </div>
  );
}
