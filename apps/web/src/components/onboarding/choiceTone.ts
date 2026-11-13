import { cn } from "../../lib/cn.js";

/**
 * "page" sur une page ordinaire (onboarding après l'inscription), "glass" sur
 * la carte en verre dépoli du parcours d'arrivée, où le texte est blanc.
 */
export type ChoiceTone = "page" | "glass";

/** Le cadre d'un choix, posé sur un `<span>` qui suit son `<input class="peer sr-only">`. */
export function choiceFrameClass(tone: ChoiceTone): string {
  return tone === "glass"
    ? cn(
        "rounded-control border border-white/25 bg-white/5 text-auth-text md:hover:bg-white/10",
        "peer-checked:border-white peer-checked:bg-white/15 peer-checked:font-medium",
        "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-white",
      )
    : cn(
        "rounded-control border border-border-strong text-text md:hover:bg-surface-2",
        "peer-checked:border-primary peer-checked:bg-surface-2 peer-checked:font-medium",
        "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary",
      );
}

export function choiceIconClass(tone: ChoiceTone): string {
  return tone === "glass" ? "text-auth-text" : "text-text-2";
}

export function choiceCheckClass(tone: ChoiceTone): string {
  return tone === "glass" ? "text-auth-text" : "text-primary";
}
