import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { RailPage } from "../layout/RailPage.js";
import { fr } from "../../i18n/fr.js";

export interface SettingsSubPageProps {
  title: string;
  children: ReactNode;
}

/** Une section des paramètres, sur sa propre page, avec le retour vers la liste. */
export function SettingsSubPage({ title, children }: SettingsSubPageProps) {
  return (
    <RailPage activeSection="parametres" className="gap-6 px-4 pt-3 lg:pt-6">
      <div className="flex flex-col gap-2">
        <a
          href="/parametres"
          aria-label={fr.settings.backLabel}
          className="-ml-2 inline-flex h-control w-fit items-center gap-1 rounded-control px-2 text-base font-medium text-text-2 hover:text-text max-md:h-control-mobile"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {fr.settings.back}
        </a>
        <h1 className="text-lg font-bold text-text">{title}</h1>
      </div>
      {children}
    </RailPage>
  );
}
