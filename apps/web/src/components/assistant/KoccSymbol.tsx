import { cn } from "../../lib/cn.js";

export type KoccSymbolVariant = "touffes" | "bulle";

/**
 * Symbole de Kocc, dessiné au trait comme une icône Lucide pour suivre le
 * thème. "touffes" : une tête et quatre touffes, clin d'œil à Kocc Barma et
 * à ses quatre maximes ; "bulle" : une bulle de parole qui porte un k.
 */
export const KOCC_SYMBOL_VARIANT: KoccSymbolVariant = "touffes";

export function KoccSymbol({
  className,
  variant = KOCC_SYMBOL_VARIANT,
}: {
  className?: string;
  variant?: KoccSymbolVariant;
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
      {variant === "touffes" ? (
        <>
          <circle cx="12" cy="14.5" r="6.5" />
          <path d="M8.6 8.9 7.4 5.2" />
          <path d="M10.9 8.1 10.5 4" />
          <path d="M13.1 8.1 13.5 4" />
          <path d="M15.4 8.9 16.6 5.2" />
        </>
      ) : (
        <>
          <path d="M20 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z" />
          <path d="M10 6.5v7" />
          <path d="M14.5 6.5 10.5 10l4 3.5" />
        </>
      )}
    </svg>
  );
}
