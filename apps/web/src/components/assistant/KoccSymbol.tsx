import { cn } from "../../lib/cn.js";

export type KoccEyes = "pilules" | "points";

/**
 * Yeux du symbole, deux propositions : "pilules", deux petits rectangles
 * arrondis debout ; "points", deux points ronds. Une ligne à changer une
 * fois le choix fait.
 */
export const KOCC_EYES: KoccEyes = "pilules";

/**
 * Symbole de Kocc, dessiné au trait comme une icône Lucide pour suivre le
 * thème : une tête et quatre touffes, clin d'œil à Kocc Barma et à ses
 * quatre maximes, et deux yeux pleins qui disent "assistant" au premier
 * regard. Les yeux sont des formes pleines, sans trait : à 16 px, un trait
 * de 1,75 les aurait bouchés.
 */
export function KoccSymbol({
  className,
  eyes = KOCC_EYES,
}: {
  className?: string;
  eyes?: KoccEyes;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("shrink-0 text-primary", className)}
    >
      <circle cx="12" cy="14.5" r="6.5" />
      <path d="M8.6 8.9 7.4 5.2" />
      <path d="M10.9 8.1 10.5 4" />
      <path d="M13.1 8.1 13.5 4" />
      <path d="M15.4 8.9 16.6 5.2" />
      {eyes === "pilules" ? (
        <g fill="currentColor" stroke="none">
          <rect x="8.7" y="12.4" width="2.3" height="4" rx="1.15" />
          <rect x="13" y="12.4" width="2.3" height="4" rx="1.15" />
        </g>
      ) : (
        <g fill="currentColor" stroke="none">
          <circle cx="9.7" cy="14.3" r="1.45" />
          <circle cx="14.3" cy="14.3" r="1.45" />
        </g>
      )}
    </svg>
  );
}
