import { useCallback, useEffect, useState } from "react";
import type { Space } from "@kemet/shared";
import { Button } from "../ui/Button.js";
import { EmptyState } from "../ui/EmptyState.js";
import { ErrorState } from "../ui/ErrorState.js";
import { Skeleton } from "../ui/Skeleton.js";
import { getOnboardingSpaces, joinSpace, removeSpaceMember } from "../../lib/chat/api.js";
import { fr } from "../../i18n/fr.js";

export interface SpaceSuggestionsProps {
  profileId: string;
  onError: (message: string | null) => void;
}

export function SpaceSuggestions({ profileId, onError }: SpaceSuggestionsProps) {
  const [spaces, setSpaces] = useState<Space[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = useCallback(() => {
    setFailed(false);
    setSpaces(null);
    getOnboardingSpaces()
      .then((result) => setSpaces(result.items))
      .catch(() => setFailed(true));
  }, []);

  useEffect(load, [load]);

  async function toggle(space: Space) {
    onError(null);
    setPendingId(space.id);
    try {
      if (space.role) await removeSpaceMember(space.id, profileId);
      else await joinSpace(space.id);
      setSpaces(
        (current) =>
          current?.map((item) =>
            item.id === space.id
              ? { ...item, role: space.role ? null : "member", memberCount: item.memberCount + (space.role ? -1 : 1) }
              : item,
          ) ?? null,
      );
    } catch {
      onError(fr.onboarding.joinError);
    } finally {
      setPendingId(null);
    }
  }

  if (failed) {
    return <ErrorState message={fr.onboarding.spacesError} retry={{ label: fr.onboarding.retry, onClick: load }} />;
  }
  if (!spaces) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className="h-16 w-full" />
        ))}
      </div>
    );
  }
  if (spaces.length === 0) return <EmptyState message={fr.onboarding.spacesEmpty} />;

  return (
    <ul className="flex flex-col divide-y divide-border">
      {spaces.map((space) => {
        // Un propriétaire ou un administrateur ne quitte pas l'espace depuis ici.
        const manages = space.role === "owner" || space.role === "admin";
        return (
          <li key={space.id} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-text">{space.name}</p>
              {space.description && <p className="line-clamp-2 text-sm text-text-2">{space.description}</p>}
              <p className="text-xs text-subtle">{fr.onboarding.memberCount(space.memberCount)}</p>
            </div>
            <Button
              type="button"
              variant={space.role ? "secondary" : "primary"}
              aria-label={space.role ? fr.onboarding.leaveLabel(space.name) : fr.onboarding.joinLabel(space.name)}
              loading={pendingId === space.id}
              disabled={manages}
              onClick={() => void toggle(space)}
              className="shrink-0"
            >
              {space.role ? fr.onboarding.joined : fr.onboarding.join}
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
