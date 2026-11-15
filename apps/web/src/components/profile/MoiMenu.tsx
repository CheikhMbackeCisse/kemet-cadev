import {
  BookOpen,
  Briefcase,
  Building2,
  ChevronRight,
  Flag as FlagIcon,
  FlaskConical,
  LogOut,
  Send,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { publishesOffers } from "../../lib/opportunities/publishesOffers.js";
import { useSiteConfig } from "../../lib/useSiteConfig.js";
import { ORGANIZATION_REQUEST_PATH } from "../../lib/navigation/paths.js";
import { useMediaQuery } from "../../lib/useMediaQuery.js";
import { useSession } from "../../session/SessionProvider.js";
import { fr } from "../../i18n/fr.js";
import { DEMO_DATA_PATH } from "../shell/DemoNotice.js";
import { MOI_ITEMS } from "../shell/mobileTabs.js";
import { LanguageSwitch } from "../ui/LanguageSwitch.js";
import { Sheet } from "../ui/Sheet.js";
import { useToast } from "../ui/Toast.js";

interface MenuRow {
  label: string;
  href: string;
  icon: LucideIcon;
}

const ROW_CLASS =
  "flex min-h-control-mobile w-full items-center gap-3 rounded-control px-2 py-2.5 text-base text-text hover:bg-surface-2";

/** Menu de Moi : tout ce qui n'a pas d'onglet dans la barre du bas. */
export function MoiMenu({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { profile, isPlatformAdmin, signOut } = useSession();
  const config = useSiteConfig();
  const toast = useToast();
  const desktop = useMediaQuery("(min-width: 1024px)");

  const rows: MenuRow[] = [
    ...(publishesOffers(profile)
      ? [{ label: fr.opportunities.publish, href: "/opportunites/nouvelle", icon: Briefcase }]
      : []),
    ...(profile
      ? [
          { label: fr.moi.myWorks, href: "/moi/travaux", icon: BookOpen },
          { label: fr.messages.segmentMessages, href: "/messages", icon: Send },
          { label: fr.organizations.refer, href: ORGANIZATION_REQUEST_PATH, icon: Building2 },
        ]
      : []),
    ...MOI_ITEMS,
    { label: fr.moi.pro, href: "/pro", icon: Sparkles },
    ...(isPlatformAdmin
      ? [{ label: fr.moderation.navLink, href: "/moderation", icon: FlagIcon }]
      : []),
    ...(config?.demoContentNotice
      ? [{ label: fr.demo.notice, href: DEMO_DATA_PATH, icon: FlaskConical }]
      : []),
  ];

  function handleSignOut() {
    signOut()
      .then(() => (window.location.href = "/fil"))
      .catch(() => toast.show(fr.auth.signOutError, "danger"));
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      side={desktop ? "right" : "bottom"}
      title={fr.moi.menu}
      className="pb-[calc(1rem+env(safe-area-inset-bottom))]"
    >
      <nav aria-label={fr.moi.menu}>
        <ul className="flex flex-col">
          {rows.map((row) => (
            <li key={row.href}>
              <a href={row.href} className={ROW_CLASS} onClick={() => onOpenChange(false)}>
                <row.icon className="size-5 shrink-0 text-muted" aria-hidden="true" />
                <span className="flex-1">{row.label}</span>
                <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden="true" />
              </a>
            </li>
          ))}
          <li className="mt-1 flex min-h-control-mobile items-center justify-between gap-3 border-t border-border px-2 pt-1">
            <span className="text-base text-text">{fr.common.language}</span>
            <LanguageSwitch />
          </li>
          {profile && (
            <li className="border-t border-border pt-1">
              <button
                type="button"
                onClick={handleSignOut}
                className={`${ROW_CLASS} font-medium text-danger`}
              >
                <LogOut className="size-5 shrink-0" aria-hidden="true" />
                {fr.auth.signOut}
              </button>
            </li>
          )}
        </ul>
      </nav>
    </Sheet>
  );
}
