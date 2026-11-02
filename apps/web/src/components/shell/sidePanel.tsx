import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useMediaQuery } from "../../lib/useMediaQuery.js";

export const SIDE_PANEL_ID = "side-panel";

const STORAGE_KEY = "kemet:side-panel";
const DESKTOP_QUERY = "(min-width: 1024px)";
// Sous cette largeur, le panneau replié par défaut laisse la place au contenu.
const WIDE_QUERY = "(min-width: 1280px)";

export type SidePanelPreference = "open" | "closed";

/** Choix mémorisé, ou null s'il n'y en a pas ou si le stockage est indisponible. */
export function readSidePanelPreference(storage: Storage): SidePanelPreference | null {
  try {
    const stored = storage.getItem(STORAGE_KEY);
    return stored === "open" || stored === "closed" ? stored : null;
  } catch {
    return null;
  }
}

export function writeSidePanelPreference(storage: Storage, preference: SidePanelPreference) {
  try {
    storage.setItem(STORAGE_KEY, preference);
  } catch {
    // Navigation privée ou quota plein : le choix vaut pour la visite seulement.
  }
}

/** Ctrl+B, ou Cmd+B sur Mac, comme dans VS Code. */
export function isToggleSidePanelShortcut(event: KeyboardEvent): boolean {
  return (
    event.key.toLowerCase() === "b" &&
    (event.ctrlKey || event.metaKey) &&
    !event.altKey &&
    !event.shiftKey
  );
}

interface SidePanelContextValue {
  open: boolean;
  toggle: () => void;
}

const SidePanelContext = createContext<SidePanelContextValue | null>(null);

export interface SidePanelProviderProps {
  /** Faux sur une page sans panneau : Ctrl+B garde alors son sens habituel (gras). */
  enabled?: boolean;
  children: ReactNode;
}

export function SidePanelProvider({ enabled = true, children }: SidePanelProviderProps) {
  const isDesktop = useMediaQuery(DESKTOP_QUERY) && enabled;
  const isWide = useMediaQuery(WIDE_QUERY);
  const [preference, setPreference] = useState<SidePanelPreference | null>(() =>
    readSidePanelPreference(window.localStorage),
  );
  const open = preference ? preference === "open" : isWide;

  const toggle = useCallback(() => {
    const next: SidePanelPreference = open ? "closed" : "open";
    setPreference(next);
    writeSidePanelPreference(window.localStorage, next);
  }, [open]);

  useEffect(() => {
    if (!isDesktop) return;
    function handleKeyDown(event: KeyboardEvent) {
      // Touche maintenue : un seul basculement, pas un clignotement.
      if (event.repeat || !isToggleSidePanelShortcut(event)) return;
      event.preventDefault();
      toggle();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDesktop, toggle]);

  const value = useMemo(() => ({ open, toggle }), [open, toggle]);
  return <SidePanelContext.Provider value={value}>{children}</SidePanelContext.Provider>;
}

export function useSidePanel(): SidePanelContextValue {
  const context = useContext(SidePanelContext);
  if (!context) throw new Error("useSidePanel doit être utilisé dans SidePanelProvider");
  return context;
}
