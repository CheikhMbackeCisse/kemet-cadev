import { useEffect } from "react";
import { fr } from "../../i18n/fr.js";
import { cn } from "../../lib/cn.js";
import { useSession } from "../../session/SessionProvider.js";
import { MOBILE_TABS, mobileTabHref } from "./mobileTabs.js";

export interface MobileTabBarProps {
  activeTabId: string;
  /** Messages privés non lus, portés par l'onglet "Salons" qui les contient. */
  privateUnread?: number;
}

/**
 * Barre du bas, sous lg. Un visiteur y voit aussi, juste au-dessus, la
 * seule invitation à créer un compte : elle remplace la carte répétée en
 * haut de chaque page et le bouton d'en-tête. Sa hauteur s'ajoute à la
 * marge basse des pages par `--mobile-visitor-bar` (index.css).
 */
export function MobileTabBar({ activeTabId, privateUnread = 0 }: MobileTabBarProps) {
  const { status } = useSession();
  const isVisitor = status === "visitor";

  useEffect(() => {
    if (!isVisitor) return;
    document.documentElement.dataset.visitorBar = "";
    return () => {
      delete document.documentElement.dataset.visitorBar;
    };
  }, [isVisitor]);

  return (
    <>
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {isVisitor && (
          <section
            aria-label={fr.auth.visitorBarLabel}
            // h-14 plus la bordure : 57 px, reporté dans --mobile-visitor-bar (index.css).
            className="flex h-14 items-center justify-between gap-3 border-b border-border px-4"
          >
            <a
              href="/connexion"
              className="-ml-2 inline-flex h-control-mobile items-center whitespace-nowrap px-2 text-sm font-medium text-link hover:underline"
            >
              {fr.auth.signInCta}
            </a>
            <a
              href="/inscription"
              className="inline-flex h-control-mobile items-center justify-center whitespace-nowrap rounded-control bg-action-strong px-4 text-sm font-medium text-on-action-strong hover:bg-action-strong-hover"
            >
              {fr.auth.visitorBarSignup}
            </a>
          </section>
        )}
        <nav aria-label="Navigation principale" className="flex">
          {MOBILE_TABS.map((tab) => {
            const isActive = tab.id === activeTabId;
            const className = cn(
              "flex h-control-mobile flex-1 flex-col items-center justify-center gap-0.5 text-xs",
              isActive ? "font-semibold text-text" : "text-muted",
            );
            const unread = tab.id === "salons" ? privateUnread : 0;
            const content = (
              <>
                <span className="relative">
                  {/* Onglet actif : icône pleine ; les autres en contour. */}
                  <tab.icon
                    className={cn("size-6", isActive && "fill-current")}
                    aria-hidden="true"
                  />
                  {unread > 0 && (
                    <span
                      aria-hidden="true"
                      className="absolute -right-2.5 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-xs font-medium leading-none text-white tabular-nums"
                    >
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </span>
                {tab.label}
                {unread > 0 && (
                  <span className="sr-only">{fr.messages.unreadPrivateSuffix(unread)}</span>
                )}
              </>
            );
            return (
              <a
                key={tab.id}
                href={mobileTabHref(tab.id)}
                aria-current={isActive ? "page" : undefined}
                className={className}
              >
                {content}
              </a>
            );
          })}
        </nav>
      </div>
    </>
  );
}
