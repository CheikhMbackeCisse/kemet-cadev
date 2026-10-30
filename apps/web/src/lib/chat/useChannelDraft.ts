import { useCallback, useState } from "react";

const STORAGE_PREFIX = "kemet:draft:";

// sessionStorage plutôt que localStorage : le brouillon survit à un
// rechargement de la page, pas à la fermeture de l'onglet, ce qui évite de le
// laisser traîner sur un poste partagé.
function readStoredDraft(channelId: string): string {
  return window.sessionStorage.getItem(STORAGE_PREFIX + channelId) ?? "";
}

function writeStoredDraft(channelId: string, value: string) {
  if (value) window.sessionStorage.setItem(STORAGE_PREFIX + channelId, value);
  else window.sessionStorage.removeItem(STORAGE_PREFIX + channelId);
}

/** Efface les brouillons de tous les salons, pour qu'ils ne passent pas au compte suivant. */
export function clearChannelDrafts() {
  for (const key of Object.keys(window.sessionStorage)) {
    if (key.startsWith(STORAGE_PREFIX)) window.sessionStorage.removeItem(key);
  }
}

/** Brouillon du composeur, gardé salon par salon. */
export function useChannelDraft(channelId: string | null): [string, (value: string) => void] {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const draft = channelId ? (drafts[channelId] ?? readStoredDraft(channelId)) : "";

  const setDraft = useCallback(
    (value: string) => {
      if (!channelId) return;
      setDrafts((current) => ({ ...current, [channelId]: value }));
      writeStoredDraft(channelId, value);
    },
    [channelId],
  );

  return [draft, setDraft];
}
