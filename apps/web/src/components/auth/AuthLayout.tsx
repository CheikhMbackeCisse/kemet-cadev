import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { KemetWordmark } from "../ui/KemetWordmark.js";
import { AuthBackground } from "./AuthBackground.js";
import { fr } from "../../i18n/fr.js";

export interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  intro?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

export function AuthLayout({ title, subtitle, intro, footer, children }: AuthLayoutProps) {
  return (
    <div className="relative min-h-viewport w-full">
      <AuthBackground />

      {/* Le fond est sombre dans les deux themes : ce qui flotte dessus est
          ecrit en blanc en dur, jamais avec les tokens de texte. */}
      <div className="auth-on-dark absolute left-4 top-4 z-10 flex flex-col gap-3 sm:left-8 sm:top-6">
        <a href="/fil" className="kemet-on-dark w-fit">
          <KemetWordmark className="h-6 w-auto" />
        </a>
        <a
          href="/fil"
          className="flex w-fit items-center gap-2 text-sm font-medium text-auth-text-muted hover:text-auth-text"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {fr.auth.backToApp}
        </a>
      </div>

      <main className="relative z-10 flex min-h-viewport items-center justify-center px-4 py-24 sm:py-16">
        <div className="flex w-full max-w-md flex-col gap-4">
          {intro && (
            <div className="hidden flex-col items-center gap-2 text-center text-auth-text sm:flex">
              {intro}
            </div>
          )}

          <div className="flex flex-col gap-4 rounded-panel border border-border bg-bg p-6 shadow-floating sm:p-8">
            <div className="text-center">
              <h1 className="text-xl font-bold text-text">{title}</h1>
              {subtitle && (
                <p className={`mt-1 text-sm text-subtle${intro ? " sm:hidden" : ""}`}>{subtitle}</p>
              )}
            </div>
            {children}
          </div>

          <div className="auth-on-dark">{footer}</div>
        </div>
      </main>
    </div>
  );
}
