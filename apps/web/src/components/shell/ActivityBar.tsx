import { useRef, useState, type KeyboardEvent, type ReactElement } from "react";
import { fr } from "../../i18n/fr.js";
import { cn } from "../../lib/cn.js";
import { useMediaQuery } from "../../lib/useMediaQuery.js";
import { useSession } from "../../session/SessionProvider.js";
import { KemetSymbol } from "../ui/KemetSymbol.js";
import { KemetWordmark } from "../ui/KemetWordmark.js";
import { Tooltip } from "../ui/Tooltip.js";
import { ActivityBarDemoNotice } from "./DemoNotice.js";
import {
  MODERATION_NAV,
  RAIL_FOOTER_NAV,
  RAIL_NAV,
  SAVED_NAV,
  SECURITY_NAV,
  SETTINGS_NAV,
  type RailNavItem,
} from "./railNav.js";
import { SidebarAccount } from "./SidebarAccount.js";
import { SIDE_PANEL_ID, useSidePanel } from "./sidePanel.js";

export interface ActivityBarProps {
  activeSection?: string;
  /** Vrai si la page a un panneau latéral : l'icône active le replie alors. */
  hasSidePanel: boolean;
  /** Non-lus par identifiant de section, affichés en pastille sur l'icône. */
  unreadCounts?: Partial<Record<string, number>>;
}

function unreadBadgeText(count: number): string {
  return count > 9 ? "9+" : String(count);
}

// Assez large pour les libellés à côté de la page et de la colonne de droite,
// et assez haut pour la liste entière : un portable de 768 px ne laisse
// qu'environ 650 px au navigateur, la barre y reste resserrée.
const WIDE_QUERY = "(min-width: 1280px) and (min-height: 760px)";

const SHORTCUT_LABEL =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)
    ? "Cmd+B"
    : "Ctrl+B";

/**
 * Barre latérale du bureau, mêmes icônes que la barre du bas du téléphone.
 * Large (icône et libellé) dès 1280 px, sauf sur une page à panneau latéral
 * (Salons, Messages) où elle se resserre en icônes, comme la barre
 * d'activité de VS Code : l'icône de la section ouverte replie ou rouvre
 * alors le panneau.
 */
export function ActivityBar({ activeSection, hasSidePanel, unreadCounts }: ActivityBarProps) {
  const { open, toggle } = useSidePanel();
  const { status, isPlatformAdmin } = useSession();
  const expanded = useMediaQuery(WIDE_QUERY) && !hasSidePanel;
  const topItems = status === "ready" ? [...RAIL_NAV, SAVED_NAV] : RAIL_NAV;
  const bottomItems = [
    RAIL_FOOTER_NAV,
    SECURITY_NAV,
    SETTINGS_NAV,
    ...(isPlatformAdmin ? [MODERATION_NAV] : []),
  ];
  const allItems = [...topItems, ...bottomItems];
  const activeIndex = allItems.findIndex((item) => item.id === activeSection);
  // Suivi par identifiant : la liste s'allonge quand la session arrive
  // (Enregistrés, Modération), un index gardé tomberait sur la mauvaise ligne.
  const [rovingId, setRovingId] = useState<string | null>(null);
  const rovingFound = rovingId ? allItems.findIndex((item) => item.id === rovingId) : -1;
  const rovingIndex = rovingFound >= 0 ? rovingFound : Math.max(activeIndex, 0);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    const count = allItems.length;
    const moves: Partial<Record<string, number>> = {
      ArrowDown: (rovingIndex + 1) % count,
      ArrowUp: (rovingIndex - 1 + count) % count,
      Home: 0,
      End: count - 1,
    };
    const next = moves[event.key];
    if (next === undefined) return;
    event.preventDefault();
    setRovingId(allItems[next]!.id);
    itemRefs.current[next]?.focus();
  }

  function renderItem(item: RailNavItem, index: number) {
    const active = item.id === activeSection;
    const togglesPanel = active && hasSidePanel;
    const unread = unreadCounts?.[item.id] ?? 0;
    const name = unread > 0 ? fr.shell.sectionWithUnread(item.label, unread) : item.label;
    const className = cn(
      "relative flex items-center rounded-full",
      expanded ? "h-11 w-full gap-4 px-3" : "size-11 justify-center",
      active
        ? // Panneau replié : la section reste marquée, sans le fond plein.
          togglesPanel && !open
          ? "font-bold text-text hover:bg-surface-2"
          : "bg-action-strong font-bold text-on-action-strong"
        : "text-text-2 hover:bg-surface-2 hover:text-text",
    );
    const common = {
      ref: (element: HTMLElement | null) => {
        itemRefs.current[index] = element;
      },
      tabIndex: index === rovingIndex ? 0 : -1,
      onFocus: () => setRovingId(item.id),
      "aria-label": expanded && unread === 0 ? undefined : name,
      "aria-current": active ? ("page" as const) : undefined,
      "data-activity-current": active ? "" : undefined,
      className,
    };
    const content = (
      <>
        <span className="relative flex">
          {/* Section ouverte : icône pleine comme sur téléphone, ou trait épaissi. */}
          <item.icon
            className={cn("size-6", active && item.fillWhenActive && "fill-current")}
            strokeWidth={active && !item.fillWhenActive ? 2.25 : undefined}
            aria-hidden="true"
          />
          {unread > 0 && (
            <span
              aria-hidden="true"
              className="absolute -right-2 -top-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-medium leading-none text-white tabular-nums"
            >
              {unreadBadgeText(unread)}
            </span>
          )}
        </span>
        {expanded && (
          <span className="truncate text-md" aria-hidden={unread > 0 || undefined}>
            {item.label}
          </span>
        )}
      </>
    );
    const control: ReactElement = togglesPanel ? (
      <button
        {...common}
        type="button"
        aria-expanded={open}
        aria-controls={SIDE_PANEL_ID}
        aria-keyshortcuts="Control+B Meta+B"
        onClick={toggle}
      >
        {content}
      </button>
    ) : (
      <a {...common} href={item.href}>
        {content}
      </a>
    );

    return (
      <li key={item.id} className={cn("flex w-full", !expanded && "justify-center")}>
        {expanded ? (
          control
        ) : (
          <Tooltip
            label={togglesPanel ? `${item.label} (${SHORTCUT_LABEL})` : item.label}
            side="right"
          >
            {control}
          </Tooltip>
        )}
      </li>
    );
  }

  const home = (
    <a
      href="/fil"
      aria-label={fr.shell.home}
      className={cn("mb-3 flex items-center rounded-full", expanded ? "h-11 px-3" : "")}
    >
      {expanded ? <KemetWordmark className="h-6 w-auto" /> : <KemetSymbol className="size-8" />}
    </a>
  );

  return (
    <div
      className={cn(
        "sticky top-0 hidden h-viewport shrink-0 flex-col border-r border-border-strong bg-surface py-3 lg:flex",
        expanded ? "w-sidebar px-3" : "w-activity-bar items-center",
      )}
    >
      {expanded ? (
        home
      ) : (
        <Tooltip label={fr.shell.home} side="right">
          {home}
        </Tooltip>
      )}

      <nav
        aria-label={fr.shell.activityBarLabel}
        onKeyDown={handleKeyDown}
        className="-mx-1 flex min-h-0 flex-1 flex-col self-stretch overflow-y-auto px-1 py-0.5"
      >
        <ul className={cn("flex w-full flex-col gap-1", !expanded && "items-center")}>
          {topItems.map((item, index) => renderItem(item, index))}
        </ul>
        <ul className={cn("mt-auto flex w-full flex-col gap-1 pt-3", !expanded && "items-center")}>
          {bottomItems.map((item, index) => renderItem(item, topItems.length + index))}
        </ul>
      </nav>

      <ActivityBarDemoNotice expanded={expanded} />
      <div className={cn("mt-2 flex w-full", !expanded && "justify-center")}>
        <SidebarAccount expanded={expanded} active={activeSection === "moi"} />
      </div>
    </div>
  );
}
