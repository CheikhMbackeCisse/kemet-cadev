import { markIntroSeen } from "../lib/intro/introStorage.js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { MeResponse } from "@kemet/shared";
import { useQueryClient } from "@tanstack/react-query";
import { getMe, signOut as apiSignOut } from "../lib/chat/api.js";
import { resetRealtimeConnection } from "../lib/chat/socket.js";
import { clearChannelDrafts } from "../lib/chat/useChannelDraft.js";

export type SessionStatus = "loading" | "visitor" | "incomplete" | "ready";

interface SessionContextValue {
  status: SessionStatus;
  user: MeResponse["user"] | null;
  profile: MeResponse["profile"];
  points: number;
  isPlatformAdmin: boolean;
  isSuspended: boolean;
  onboarding: MeResponse["onboarding"];
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

function statusFor(me: MeResponse | null): SessionStatus {
  if (!me) return "visitor";
  return me.profile ? "ready" : "incomplete";
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [status, setStatus] = useState<SessionStatus>("loading");
  const queryClient = useQueryClient();
  const knownViewerId = useRef<string | null | undefined>(undefined);

  // Les lectures en cache et la connexion temps réel portent l'identité de
  // la personne connectée : un autre compte repart d'un cache vide et d'une
  // nouvelle connexion, avant le premier rendu avec sa session.
  const adoptViewer = useCallback(
    (viewerId: string | null) => {
      if (knownViewerId.current !== undefined && knownViewerId.current !== viewerId) {
        queryClient.clear();
        resetRealtimeConnection();
      }
      knownViewerId.current = viewerId;
    },
    [queryClient],
  );

  const refresh = useCallback(async () => {
    try {
      const result = await getMe();
      adoptViewer(result?.profile?.id ?? null);
      setMe(result);
      setStatus(statusFor(result));
      // Une personne connectée ne voit jamais l'écran d'accueil, même
      // déconnectée plus tard sur ce navigateur.
      if (result) markIntroSeen();
    } catch {
      adoptViewer(null);
      setMe(null);
      setStatus("visitor");
    }
  }, [adoptViewer]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    await apiSignOut();
    clearChannelDrafts();
    await refresh();
  }, [refresh]);

  const value = useMemo<SessionContextValue>(
    () => ({
      status,
      user: me?.user ?? null,
      profile: me?.profile ?? null,
      points: me?.points ?? 0,
      isPlatformAdmin: me?.isPlatformAdmin ?? false,
      isSuspended: me?.isSuspended ?? false,
      onboarding: me?.onboarding ?? null,
      refresh,
      signOut,
    }),
    [status, me, refresh, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession doit être utilisé dans SessionProvider");
  return context;
}
