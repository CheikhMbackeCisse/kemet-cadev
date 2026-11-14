import * as RadixTabs from "@radix-ui/react-tabs";
import { useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "../../lib/cn.js";
import { useInnerTabSwipe, type SwipeDirection } from "../../lib/navigation/tabSwipe.js";

export interface TabItem {
  value: string;
  label: ReactNode;
  content: ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  /**
   * "start" : onglets serrés à gauche. "centered" : onglets d'une vue
   * principale (le fil), centrés, plus grands, à largeur égale.
   */
  layout?: "start" | "centered";
  /** Onglets plus larges que l'écran : la rangée défile au doigt. */
  scrollable?: boolean;
  /**
   * Sur téléphone, un glissement passe à l'onglet voisin avant la barre du
   * bas, qui ne reprend la main qu'au premier ou au dernier onglet.
   */
  swipeable?: boolean;
  /** Identifiant du libellé qui nomme la rangée d'onglets. */
  labelledBy?: string;
  /**
   * La rangée reste collée en haut de l'écran quand la page défile. Elle
   * déborde de la marge de 16 px de la page pour couvrir le contenu d'un bord
   * à l'autre.
   */
  sticky?: boolean;
}

// Le panneau actif est rendu hors de RadixTabs.Content : son Presence lit
// getComputedStyle au montage, ce qui forçait le recalcul de style de tout
// le contenu (0,42 s pour le fil en CPU x4).
export function Tabs({
  items,
  value,
  onValueChange,
  className,
  layout = "start",
  scrollable = false,
  swipeable = false,
  labelledBy,
  sticky = false,
}: TabsProps) {
  const centered = layout === "centered";
  const baseId = useId();
  const triggerId = (itemValue: string) => `${baseId}-tab-${itemValue}`;
  const panelId = (itemValue: string) => `${baseId}-panel-${itemValue}`;
  const active = items.find((item) => item.value === value);
  const values = useMemo(() => items.map((item) => item.value), [items]);
  // Seul le panneau qui arrive par un glissement s'anime, pas un clic.
  const [swipedIn, setSwipedIn] = useState<{ value: string; direction: SwipeDirection } | null>(
    null,
  );
  useInnerTabSwipe(swipeable, values, value, (next, direction) => {
    setSwipedIn({ value: next, direction });
    onValueChange(next);
  });
  const listRef = useRef<HTMLDivElement>(null);
  // Un onglet ouvert par l'adresse (?onglet=enregistres) peut être hors de la
  // rangée qui défile : on la décale, sans faire défiler la page.
  useLayoutEffect(() => {
    const list = listRef.current;
    const tab = list?.querySelector<HTMLElement>('[data-state="active"]');
    if (!scrollable || !list || !tab) return;
    const listBox = list.getBoundingClientRect();
    const tabBox = tab.getBoundingClientRect();
    if (tabBox.left < listBox.left) list.scrollLeft += tabBox.left - listBox.left;
    else if (tabBox.right > listBox.right) list.scrollLeft += tabBox.right - listBox.right;
  }, [scrollable, value, values]);
  const panelRef = useRef<HTMLDivElement>(null);
  const shownValue = useRef(value);
  // Rangée collée : un autre onglet s'ouvre à son début, pas au milieu de la
  // page où l'on était dans l'onglet précédent.
  useLayoutEffect(() => {
    if (shownValue.current === value) return;
    shownValue.current = value;
    const list = listRef.current;
    const panel = panelRef.current;
    if (!sticky || !list || !panel) return;
    const gap = panel.getBoundingClientRect().top - list.getBoundingClientRect().bottom;
    if (gap < 0) window.scrollBy({ top: gap });
  }, [sticky, value]);
  return (
    <RadixTabs.Root value={value} onValueChange={onValueChange} className={className}>
      <RadixTabs.List
        ref={listRef}
        aria-labelledby={labelledBy}
        className={cn(
          "flex items-end border-b border-border",
          sticky && "sticky top-0 z-20 -mx-4 bg-bg px-4 pt-[env(safe-area-inset-top)]",
          centered ? "justify-center gap-2 [&>*]:after:h-[3px]" : "gap-5",
          // Une rangée qui défile coupe ce qui déborde de sa boîte : le filet est
          // dessiné à l'intérieur et le soulignement de l'onglet actif se pose dessus.
          scrollable &&
            "scrollbar-none overflow-x-auto border-b-0 shadow-[inset_0_-1px_0_0_var(--border)] [&>*]:shrink-0 [&>*]:whitespace-nowrap",
        )}
      >
        {items.map((item) => (
          <RadixTabs.Trigger
            key={item.value}
            value={item.value}
            id={triggerId(item.value)}
            aria-controls={item.value === value ? panelId(item.value) : undefined}
            className={cn(
              "relative rounded-control text-muted transition-colors duration-150 hover:text-text",
              !scrollable && "-mb-px",
              centered
                ? "h-12 min-w-0 max-w-48 flex-1 px-3 text-base font-semibold"
                : "h-control px-1 text-sm font-medium max-md:h-control-mobile",
              "after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary after:opacity-0",
              "data-[state=active]:text-text data-[state=active]:after:opacity-100",
            )}
          >
            {item.label}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {active && (
        <div
          key={swipeable ? active.value : undefined}
          data-swipe-in={swipedIn?.value === active.value ? swipedIn.direction : undefined}
          ref={panelRef}
          role="tabpanel"
          id={panelId(active.value)}
          aria-labelledby={triggerId(active.value)}
          tabIndex={0}
          className="pt-4"
        >
          {active.content}
        </div>
      )}
    </RadixTabs.Root>
  );
}
