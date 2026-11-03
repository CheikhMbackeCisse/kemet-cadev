import { useRef, useState, type KeyboardEvent } from "react";
import { fr } from "../../i18n/fr.js";
import { cn } from "../../lib/cn.js";
import { KemetSymbol } from "../ui/KemetSymbol.js";
import { Tooltip } from "../ui/Tooltip.js";
import { AccountMenu } from "./AccountMenu.js";
import { RAIL_FOOTER_NAV, RAIL_NAV, SETTINGS_NAV, type RailNavItem } from "./railNav.js";
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

const TOP_ITEMS = RAIL_NAV;
const BOTTOM_ITEMS = [RAIL_FOOTER_NAV, SETTINGS_NAV];
const ALL_ITEMS = [...TOP_ITEMS, ...BOTTOM_ITEMS];

const SHORTCUT_LABEL =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)
    ? "Cmd+B"
    : "Ctrl+B";

/**
 * Barre d'activité du bureau, sur le modèle de VS Code : une icône par
 * section. L'icône de la section ouverte replie ou rouvre le panneau
 * latéral, quand la page en a un ; sinon elle reste un lien.
 */
export function ActivityBar({ activeSection, hasSidePanel, unreadCounts }: ActivityBarProps) {
  const { open, toggle } = useSidePanel();
  const activeIndex = ALL_ITEMS.findIndex((item) => item.id === activeSection);
  const [rovingIndex, setRovingIndex] = useState(Math.max(activeIndex, 0));
  const itemRefs = useRef<(HTMLElement | null)[]>([]);

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    const count = ALL_ITEMS.length;
    const moves: Partial<Record<string, number>> = {
      ArrowDown: (rovingIndex + 1) % count,
      ArrowUp: (rovingIndex - 1 + count) % count,
      Home: 0,
      End: count - 1,
    };
    const next = moves[event.key];
    if (next === undefined) return;
    event.preventDefault();
    setRovingIndex(next);
    itemRefs.current[next]?.focus();
  }

  function renderItem(item: RailNavItem, index: number) {
    const active = item.id === activeSection;
    const togglesPanel = active && hasSidePanel;
    const unread = unreadCounts?.[item.id] ?? 0;
    const className = cn(
      "relative inline-flex size-control items-center justify-center rounded-control",
      // Comme dans VS Code : l'indicateur marque la page, le fond le panneau ouvert.
      active && (!togglesPanel || open)
        ? "bg-accent-soft text-primary"
        : active
          ? "text-primary hover:bg-surface-2"
          : "text-text-2 hover:bg-surface-2 hover:text-text",
    );
    const common = {
      ref: (element: HTMLElement | null) => {
        itemRefs.current[index] = element;
      },
      tabIndex: index === rovingIndex ? 0 : -1,
      onFocus: () => setRovingIndex(index),
      "aria-label": unread > 0 ? fr.shell.sectionWithUnread(item.label, unread) : item.label,
      "aria-current": active ? ("page" as const) : undefined,
      "data-activity-current": active ? "" : undefined,
      className,
    };
    const icon = (
      <>
        <item.icon className="size-5" aria-hidden="true" />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-medium leading-none text-white tabular-nums"
          >
            {unreadBadgeText(unread)}
          </span>
        )}
      </>
    );

    return (
      <li key={item.id} className="relative flex w-full justify-center">
        {active && (
          <span
            aria-hidden="true"
            className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary"
          />
        )}
        <Tooltip
          label={togglesPanel ? `${item.label} (${SHORTCUT_LABEL})` : item.label}
          side="right"
        >
          {togglesPanel ? (
            <button
              {...common}
              type="button"
              aria-expanded={open}
              aria-controls={SIDE_PANEL_ID}
              aria-keyshortcuts="Control+B Meta+B"
              onClick={toggle}
            >
              {icon}
            </button>
          ) : (
            <a {...common} href={item.href}>
              {icon}
            </a>
          )}
        </Tooltip>
      </li>
    );
  }

  return (
    <div className="sticky top-0 hidden h-viewport w-activity-bar shrink-0 flex-col items-center border-r border-border-strong bg-surface py-3 lg:flex">
      <Tooltip label={fr.shell.home} side="right">
        <a href="/fil" aria-label={fr.shell.home} className="mb-3 rounded-control">
          <KemetSymbol className="size-8" />
        </a>
      </Tooltip>

      <nav
        aria-label={fr.shell.activityBarLabel}
        onKeyDown={handleKeyDown}
        className="flex w-full flex-1 flex-col"
      >
        <ul className="flex w-full flex-col items-center gap-1">
          {TOP_ITEMS.map((item, index) => renderItem(item, index))}
        </ul>
        <ul className="mt-auto flex w-full flex-col items-center gap-1 pt-3">
          {BOTTOM_ITEMS.map((item, index) => renderItem(item, TOP_ITEMS.length + index))}
        </ul>
      </nav>

      <div className="mt-2 flex w-full justify-center">
        <AccountMenu variant="activityBar" />
      </div>
    </div>
  );
}
