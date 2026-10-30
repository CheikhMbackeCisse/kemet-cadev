import { Braces, Code2, GitBranch, Hash, Sparkles, Terminal } from "lucide-react";

/**
 * Fond de marque des ecrans de compte. Degrade et halos : seule exception a la
 * liste « Ce qui est interdit » de DESIGN.md
 * (docs/adr/0019-fond-des-ecrans-de-compte.md). Ne pas reutiliser ailleurs.
 *
 * Purement decoratif : aucun texte, aucune cible de clic, aria-hidden, et pose
 * derriere une carte opaque pour que le contraste du formulaire ne depende
 * jamais du fond.
 */

interface FloatingTile {
  icon: typeof Code2;
  /** Position en pourcentage du viewport, pour suivre toutes les largeurs. */
  top: string;
  left: string;
  size: string;
  rotate: string;
}

const TILES: FloatingTile[] = [
  { icon: Code2, top: "14%", left: "8%", size: "size-14", rotate: "-12deg" },
  { icon: Hash, top: "62%", left: "13%", size: "size-10", rotate: "9deg" },
  { icon: Terminal, top: "78%", left: "5%", size: "size-12", rotate: "-6deg" },
  { icon: Braces, top: "20%", left: "86%", size: "size-12", rotate: "11deg" },
  { icon: GitBranch, top: "55%", left: "91%", size: "size-10", rotate: "-9deg" },
  { icon: Sparkles, top: "82%", left: "82%", size: "size-14", rotate: "7deg" },
];

export function AuthBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{
        backgroundImage: "linear-gradient(160deg, var(--auth-bg-from), var(--auth-bg-to))",
      }}
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

      <ul className="hidden md:block">
        {TILES.map((tile, index) => (
          <li
            key={index}
            className="absolute"
            style={{ top: tile.top, left: tile.left, transform: `rotate(${tile.rotate})` }}
          >
            {/* Aplat opaque, sans transparence : l'exception de DESIGN.md porte
                sur le degrade et les halos, pas sur l'effet verre depoli. */}
            <span
              className={`flex ${tile.size} items-center justify-center rounded-card text-auth-text-muted`}
              style={{ backgroundColor: "var(--auth-tile)" }}
            >
              <tile.icon className="size-1/2" aria-hidden="true" />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
