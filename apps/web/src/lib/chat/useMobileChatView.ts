import { useCallback, useEffect, useState } from "react";

export type MobileChatView = "list" | "chat";

const STATE_KEY = "mobileChatView";
// Posé sur l'entrée ajoutée à l'ouverture d'un salon : seule celle-là se dépile.
const PUSHED_KEY = "mobileChatPushed";
const MOBILE_QUERY = "(max-width: 1023px)";

function historyState(): Record<string, unknown> | null {
  return window.history.state as Record<string, unknown> | null;
}

function viewFromHistory(): MobileChatView | null {
  const value = historyState()?.[STATE_KEY];
  return value === "list" || value === "chat" ? value : null;
}

function writeView(view: MobileChatView, mode: "push" | "replace") {
  const state = { ...historyState(), [STATE_KEY]: view, [PUSHED_KEY]: mode === "push" };
  if (mode === "push") window.history.pushState(state, "", window.location.href);
  else window.history.replaceState(state, "", window.location.href);
}

/**
 * Liste des salons ou discussion en plein écran, sous lg. Ouvrir un salon
 * ajoute une entrée d'historique : le retour du système (bouton Android,
 * geste de Safari) revient à la liste au lieu de quitter les salons. La vue
 * vit dans l'état de l'historique, pas dans l'adresse : un rechargement
 * garde la vue où on était.
 */
export function useMobileChatView() {
  const [view, setView] = useState<MobileChatView>(() => {
    const saved = viewFromHistory();
    if (saved) return saved;
    // Première arrivée : un lien qui désigne un salon ou un espace l'ouvre.
    const params = new URLSearchParams(window.location.search);
    const initial = params.has("channel") || params.has("space") ? "chat" : "list";
    writeView(initial, "replace");
    return initial;
  });

  useEffect(() => {
    const onPopState = () => setView(viewFromHistory() ?? "list");
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const openChat = useCallback(() => {
    if (window.matchMedia(MOBILE_QUERY).matches) writeView("chat", "push");
    else writeView("chat", "replace");
    setView("chat");
  }, []);

  const backToList = useCallback(() => {
    // Arrivé directement sur un salon (lien partagé) : rien à dépiler, on
    // remplace l'entrée plutôt que de quitter le site.
    if (viewFromHistory() === "chat" && historyState()?.[PUSHED_KEY] === true) {
      window.history.back();
      return;
    }
    writeView("list", "replace");
    setView("list");
  }, []);

  return { view, openChat, backToList };
}
