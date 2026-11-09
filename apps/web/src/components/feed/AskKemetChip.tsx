import { fr } from "../../i18n/fr.js";
import { KemetSymbol } from "../ui/KemetSymbol.js";

const CHIP_CLASS =
  "inline-flex h-control-compact max-md:h-control-mobile items-center gap-1.5 rounded-full bg-assistant-bg px-3 text-xs font-medium text-text hover:bg-accent-soft";

/**
 * Suggestion posée sous un post technique. Elle ne fait que préparer la
 * question dans le champ de réponse : rien n'est envoyé sans un clic sur
 * Répondre.
 */
export function AskKemetChip({ href, onClick }: { href?: string; onClick?: () => void }) {
  const content = (
    <>
      <KemetSymbol className="size-4" />
      {fr.feed.askKemetExplain}
    </>
  );
  return href ? (
    <a href={href} className={CHIP_CLASS}>
      {content}
    </a>
  ) : (
    <button type="button" onClick={onClick} className={CHIP_CLASS}>
      {content}
    </button>
  );
}
