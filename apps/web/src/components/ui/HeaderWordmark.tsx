import { cn } from "../../lib/cn.js";
import { KemetWordmark } from "./KemetWordmark.js";

/**
 * Mot-symbole des en-têtes de page, décoratif : le nom de la page reste
 * porté par son titre.
 */
export function HeaderWordmark({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn("flex h-control items-center", className)}>
      <KemetWordmark className="h-[22px] w-auto" />
    </span>
  );
}
