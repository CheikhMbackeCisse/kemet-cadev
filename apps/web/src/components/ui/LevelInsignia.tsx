import type { Level } from "@kemet/shared";

// Insignes de niveau dessinés pour Kemet, dans une boîte de 24 sur 24 : une
// forme et une couleur par niveau (lisibles même à 16 px, et sans compter
// sur la couleur seule), un motif simple posé dessus. Le motif prend la
// couleur du fond de page : blanc en clair, sombre en sombre, toujours en
// contraste avec la couleur du niveau.

const MOTIF = "var(--bg)";

function Apprenti() {
  return (
    <>
      <circle cx="12" cy="12" r="11" />
      {/* Une graine qui germe : deux feuilles sur une tige. */}
      <g fill={MOTIF}>
        <ellipse cx="12" cy="17.6" rx="3.6" ry="1.7" />
        <rect x="11.2" y="10.5" width="1.6" height="7" rx="0.8" />
        <path d="M11.6 12.4C8.4 12.6 6.7 10.7 6.4 7.8c3 0 5 1.6 5.2 4.6Z" />
        <path d="M12.4 11c.2-3.4 2.3-5.4 5.4-5.4-.1 3.2-2.1 5.2-5.4 5.4Z" />
      </g>
    </>
  );
}

function Artisan() {
  return (
    <>
      <rect x="1.5" y="1.5" width="21" height="21" rx="5.5" />
      {/* Un marteau : la tête, puis le manche. */}
      <g fill={MOTIF}>
        <rect x="5.5" y="5.5" width="11" height="4.6" rx="1.2" />
        <rect x="15.2" y="6.4" width="3.3" height="2.8" rx="0.8" />
        <rect x="10.2" y="9.4" width="3.2" height="9.6" rx="1.4" />
      </g>
    </>
  );
}

function Scribe() {
  return (
    <>
      <path d="M12 1.2 21.6 6.6v10.8L12 22.8 2.4 17.4V6.6Z" strokeLinejoin="round" />
      {/* Une plume, sa nervure en creux. */}
      <path
        fill={MOTIF}
        d="M17.6 5.2c-5.6.6-9.2 4.3-9.8 10.4l-.9 3.6 1.9-2.6c5.9-.3 8.8-4.8 8.8-11.4Z"
      />
      <path
        d="M15.4 8 9 16.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </>
  );
}

function Architecte() {
  return (
    <>
      <path d="M12 1.2 21 4.6V11c0 6-3.9 10-9 11.8C6.9 21 3 17 3 11V4.6Z" />
      {/* Une pyramide : deux faces, l'une plus claire que l'autre. */}
      <path fill={MOTIF} d="M12 5.6 18.2 17H5.8Z" />
      <path d="M12 5.6 13.6 17H12Z" fill="currentColor" opacity="0.35" />
    </>
  );
}

const SUN_POINTS = Array.from({ length: 24 }, (_, index) => {
  const radius = index % 2 === 0 ? 11.5 : 9.2;
  const angle = (Math.PI * index) / 12 - Math.PI / 2;
  return `${(12 + radius * Math.cos(angle)).toFixed(2)},${(12 + radius * Math.sin(angle)).toFixed(2)}`;
}).join(" ");

const SUN_RAYS = Array.from({ length: 8 }, (_, index) => {
  const angle = (Math.PI * index) / 4;
  const from = 5.6;
  const to = 7.6;
  return {
    x1: 12 + from * Math.cos(angle),
    y1: 12 + from * Math.sin(angle),
    x2: 12 + to * Math.cos(angle),
    y2: 12 + to * Math.sin(angle),
  };
});

function Legende() {
  return (
    <>
      <polygon points={SUN_POINTS} strokeLinejoin="round" />
      {/* Un soleil : un disque et huit rayons. */}
      <circle cx="12" cy="12" r="3.6" fill={MOTIF} />
      <g stroke={MOTIF} strokeWidth="1.5" strokeLinecap="round">
        {SUN_RAYS.map((ray, index) => (
          <line key={index} {...ray} />
        ))}
      </g>
    </>
  );
}

const SHAPES: Record<Level, () => JSX.Element> = {
  apprenti: Apprenti,
  artisan: Artisan,
  scribe: Scribe,
  architecte: Architecte,
  legende: Legende,
};

/** Dessin seul, à la couleur du texte courant (`currentColor`) ; décoratif. */
export function LevelInsignia({ level, className }: { level: Level; className?: string }) {
  const Shape = SHAPES[level];
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      data-level={level}
    >
      <Shape />
    </svg>
  );
}
