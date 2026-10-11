import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { MeResponse } from "@kemet/shared";
import { getMe, signOut as apiSignOut } from "../lib/chat/api.js";

export type SessionStatus = "loading" | "visitor" | "incomplete" | "ready";

interface SessionContextValue {
  status: SessionStatus;
  user: MeResponse["user"] | null;
  profile: MeResponse["profile"];
  points: number;
  isPlatformAdmin: boolean;
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

  const refresh = useCallback(async () => {
    try {
      const result = await getMe();
      setMe(result);
      setStatus(statusFor(result));
    } catch {
      setMe(null);
      setStatus("visitor");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    await apiSignOut();
    await refresh();
  }, [refresh]);

  const value = useMemo<SessionContextValue>(
    () => ({
      status,
      user: me?.user ?? null,
      profile: me?.profile ?? null,
      points: me?.points ?? 0,
      isPlatformAdmin: me?.isPlatformAdmin ?? false,
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
