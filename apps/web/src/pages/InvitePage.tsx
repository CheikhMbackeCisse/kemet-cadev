import { navigate } from "../lib/navigation/navigate.js";
import { useCallback, useEffect, useState } from "react";
import type { InvitePreview } from "@kemet/shared";
import { acceptInvite, previewInvite } from "../lib/chat/api.js";
import { Button } from "../components/ui/Button.js";
import { ErrorState } from "../components/ui/ErrorState.js";
import { Skeleton } from "../components/ui/Skeleton.js";
import { fr } from "../i18n/fr.js";

function readCode(pathname: string): string {
  return pathname.replace(/^\/salons\/invite\//, "");
}

const STATUS_MESSAGE: Record<InvitePreview["status"], (spaceName: string | null) => string> = {
  valid: (spaceName) => fr.invites.statusValid(spaceName ?? ""),
  not_found: () => fr.invites.statusNotFound,
  expired: () => fr.invites.statusExpired,
  revoked: () => fr.invites.statusRevoked,
  exhausted: () => fr.invites.statusExhausted,
};

export function InvitePage() {
  const code = readCode(window.location.pathname);
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [joinError, setJoinError] = useState(false);
  const [joinStatus, setJoinStatus] = useState<InvitePreview["status"] | null>(null);

  const load = useCallback(() => {
    setLoadError(false);
    setPreview(null);
    previewInvite(code)
      .then(setPreview)
      .catch(() => setLoadError(true));
  }, [code]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleJoin() {
    setJoinError(false);
    try {
      const result = await acceptInvite(code);
      if (result.joined && result.spaceId) {
        navigate(`/salons?space=${result.spaceId}`);
        return;
      }
      setJoinStatus((result.status as InvitePreview["status"]) ?? "not_found");
    } catch {
      setJoinError(true);
    }
  }

  if (loadError) {
    return (
      <main className="flex h-viewport flex-col items-center justify-center px-4">
        <ErrorState
          message={fr.invites.loadingError}
          retry={{ label: fr.chat.retry, onClick: load }}
        />
      </main>
    );
  }

  if (!preview) {
    return (
      <main className="flex h-viewport flex-col items-center justify-center gap-4 px-4">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-10 w-32" />
      </main>
    );
  }

  const status = joinStatus ?? preview.status;

  return (
    <main className="flex h-viewport flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-lg text-text">{STATUS_MESSAGE[status](preview.spaceName)}</p>
      {status === "valid" && <Button onClick={handleJoin}>{fr.invites.join}</Button>}
      {joinError && <p className="text-sm text-danger">{fr.spaces.actionError}</p>}
    </main>
  );
}
