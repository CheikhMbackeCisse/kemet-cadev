import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { ArrivalLayout } from "../arrival/ArrivalLayout.js";
import { fr } from "../../i18n/fr.js";

export interface AuthLayoutProps {
  title: string;
  footer?: ReactNode;
  decor?: "bands" | "universe";
  children: ReactNode;
}

/**
 * Écrans de compte : le fond de l'accueil (continent, réseau, logos) et une
 * carte en verre dépoli. "Complète ton profil" garde son propre décor, sur le
 * fond calme.
 */
export function AuthLayout({ title, footer, decor, children }: AuthLayoutProps) {
  return (
    <ArrivalLayout
      motion={decor === "universe" ? "calm" : "rich"}
      decor={decor}
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
