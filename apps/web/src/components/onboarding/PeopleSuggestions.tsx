import { useCallback, useEffect, useState } from "react";
import type { PersonSuggestion } from "@kemet/shared";
import { Avatar } from "../ui/Avatar.js";
import { Button } from "../ui/Button.js";
import { GlassState } from "./GlassState.js";
import { Skeleton } from "../ui/Skeleton.js";
import { LevelBadge } from "../ui/LevelBadge.js";
import { followUser, getOnboardingPeople, unfollowUser } from "../../lib/chat/api.js";
import { fr } from "../../i18n/fr.js";

export interface PeopleSuggestionsProps {
  onError: (message: string | null) => void;
}

/** Sur la carte en verre dépoli de l'onboarding : texte blanc dans les deux thèmes. */
export function PeopleSuggestions({ onError }: PeopleSuggestionsProps) {
  const [people, setPeople] = useState<PersonSuggestion[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = useCallback(() => {
    setFailed(false);
    setPeople(null);
    getOnboardingPeople()
      .then((result) => setPeople(result.items))
      .catch(() => setFailed(true));
  }, []);

  useEffect(load, [load]);

  async function toggle(person: PersonSuggestion) {
    onError(null);
    setPendingId(person.profile.id);
    try {
      if (person.isFollowed) await unfollowUser(person.profile.handle);
      else await followUser(person.profile.handle);
      setPeople(
        (current) =>
          current?.map((item) =>
            item.profile.id === person.profile.id
              ? { ...item, isFollowed: !person.isFollowed }
              : item,
          ) ?? null,
      );
    } catch {
      onError(fr.onboarding.followError);
    } finally {
      setPendingId(null);
    }
  }

  if (failed) {
    return <GlassState message={fr.onboarding.peopleError} onRetry={load} />;
  }
  if (!people) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        {[0, 1, 2, 3, 4].map((index) => (
          <Skeleton key={index} className="h-14 w-full bg-auth-skeleton" />
        ))}
      </div>
    );
  }
  if (people.length === 0) return <GlassState message={fr.onboarding.peopleEmpty} />;

  return (
    <ul className="flex flex-col divide-y divide-auth-divider">
      {people.map((person) => (
        <li key={person.profile.id} className="flex items-center gap-3 py-3">
          <Avatar
            name={person.profile.displayName}
            src={person.profile.avatarUrl ?? undefined}
            size={40}
            countryCode={person.profile.country || undefined}
          />
          <div className="min-w-0 flex-1">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate font-medium text-auth-text">
                {person.profile.displayName}
              </span>
              <LevelBadge level={person.level} tone="onDark" />
            </span>
            {person.profile.title && (
              <p className="truncate text-sm text-auth-text-muted">{person.profile.title}</p>
            )}
          </div>
          <Button
            type="button"
            variant={person.isFollowed ? "inverse-ghost" : "inverse"}
            aria-label={fr.onboarding.followLabel(person.profile.displayName)}
            aria-pressed={person.isFollowed}
            loading={pendingId === person.profile.id}
            onClick={() => void toggle(person)}
            className={person.isFollowed ? "shrink-0 border border-auth-glass-border" : "shrink-0"}
          >
            {person.isFollowed ? fr.onboarding.following : fr.onboarding.follow}
          </Button>
        </li>
      ))}
    </ul>
  );
}
