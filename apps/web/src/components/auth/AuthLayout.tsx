import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { ArrivalLayout } from "../arrival/ArrivalLayout.js";
import { fr } from "../../i18n/fr.js";

export interface AuthLayoutProps {
  title: string;
  footer?: ReactNode;
  children: ReactNode;
}

/** Écrans de compte : le fond calme du parcours d'arrivée et une carte en verre dépoli. */
export function AuthLayout({ title, footer, children }: AuthLayoutProps) {
  return (
    <ArrivalLayout
      motion="calm"
      footer={footer}
      headerEnd={
        <a
          href="/fil"
          className="flex min-h-control-mobile items-center gap-2 text-sm font-medium text-auth-text-muted hover:text-auth-text md:min-h-control"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {fr.auth.backToApp}
        </a>
      }
    >
      <div className="text-center">
        <h1 className="text-xl font-bold">{title}</h1>
      </div>
      {children}
    </ArrivalLayout>
  );
}
