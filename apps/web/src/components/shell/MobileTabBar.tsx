import { Flag, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { fr } from "../../i18n/fr.js";
import { cn } from "../../lib/cn.js";
import { useSession } from "../../session/SessionProvider.js";
import { Avatar } from "../ui/Avatar.js";
import { Sheet } from "../ui/Sheet.js";
import { MOBILE_TABS, MOI_SHEET_ITEMS, MOI_TAB_ID, mobileTabHref } from "./mobileTabs.js";

export interface MobileTabBarProps {
  activeTabId: string;
}

/**
 * Barre du bas, sous lg. Un visiteur y voit aussi, juste au-dessus, la
 * seule invitation à créer un compte : elle remplace la carte répétée en
 * haut de chaque page et le bouton d'en-tête. Sa hauteur s'ajoute à la
 * marge basse des pages par `--mobile-visitor-bar` (index.css).
 */
export function MobileTabBar({ activeTabId }: MobileTabBarProps) {
  const { status, profile, isPlatformAdmin, signOut } = useSession();
  const [moiOpen, setMoiOpen] = useState(false);
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
              className="inline-flex h-control-mobile items-center justify-center whitespace-nowrap rounded-control bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover"
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
              isActive ? "text-primary" : "text-muted",
            );
            const content = (
              <>
                <tab.icon className="size-5" aria-hidden="true" />
                {tab.label}
              </>
            );
            // "Moi" ouvre une feuille : c'est un bouton, les autres onglets
            // changent de page et sont donc des liens.
            return tab.id === MOI_TAB_ID ? (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMoiOpen(true)}
                aria-current={isActive ? "true" : undefined}
                aria-haspopup="dialog"
                className={className}
              >
                {content}
              </button>
            ) : (
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

      <Sheet open={moiOpen} onOpenChange={setMoiOpen} side="bottom" title={fr.moi.title}>
        <ul className="flex flex-col">
          {profile && (
            <li>
              <a href={`/u/${profile.handle}`} className={SHEET_ROW_CLASS}>
                <Avatar
                  name={profile.displayName}
                  src={profile.avatarUrl ?? undefined}
                  size={24}
                  className="-mx-0.5"
                />
                {fr.moi.myProfile}
              </a>
            </li>
          )}
          {MOI_SHEET_ITEMS.map((item) => (
            <li key={item.id}>
              <a href={item.href} className={SHEET_ROW_CLASS}>
                <item.icon className="size-5 text-muted" aria-hidden="true" />
                {item.label}
              </a>
            </li>
          ))}
          {isPlatformAdmin && (
            <li>
              <a href="/moderation" className={SHEET_ROW_CLASS}>
                <Flag className="size-5 text-muted" aria-hidden="true" />
                {fr.moderation.navLink}
              </a>
            </li>
          )}
          {/* Seule déconnexion des pages mobiles sans menu de compte dans l'en-tête. */}
          {profile && (
            <li>
              <button
                type="button"
                onClick={() => void signOut()}
                className={`${SHEET_ROW_CLASS} w-full text-danger`}
              >
                <LogOut className="size-5" aria-hidden="true" />
                {fr.auth.signOut}
              </button>
            </li>
          )}
        </ul>
      </Sheet>
    </>
  );
}

const SHEET_ROW_CLASS =
  "flex h-control-mobile items-center gap-3 rounded-control px-2 text-md text-text hover:bg-surface-2";
