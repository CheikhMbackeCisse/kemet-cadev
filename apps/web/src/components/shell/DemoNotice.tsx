import { FlaskConical } from "lucide-react";
import { useSiteConfig } from "../../lib/useSiteConfig.js";
import { fr } from "../../i18n/fr.js";
import { Tooltip } from "../ui/Tooltip.js";

export const DEMO_DATA_PATH = "/donnees-de-demo";

/** Pied de la barre d'activité : une icône discrète, son sens au survol. */
export function ActivityBarDemoNotice() {
  const config = useSiteConfig();
  if (!config?.demoContentNotice) return null;
  return (
    <Tooltip label={fr.demo.notice} side="right">
      <a
        href={DEMO_DATA_PATH}
        aria-label={fr.demo.notice}
        className="mt-2 inline-flex size-control items-center justify-center rounded-control text-subtle hover:bg-surface-2 hover:text-text"
      >
        <FlaskConical className="size-4" aria-hidden="true" />
      </a>
    </Tooltip>
  );
}

/** Une ligne de texte, pour la page Moi sur téléphone. */
export function DemoNoticeLine({ className }: { className?: string }) {
  const config = useSiteConfig();
  if (!config?.demoContentNotice) return null;
  return (
    <p className={className}>
      <a href={DEMO_DATA_PATH} className="inline-flex items-center gap-1.5 text-xs text-subtle hover:underline">
        <FlaskConical className="size-4" aria-hidden="true" />
        {fr.demo.notice}
      </a>
    </p>
  );
}
