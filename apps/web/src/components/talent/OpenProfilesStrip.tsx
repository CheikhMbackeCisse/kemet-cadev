import { useEffect, useId, useState } from "react";
import type { Profile } from "@kemet/shared";
import { listOpenProfiles } from "../../lib/chat/api.js";
import { Avatar } from "../ui/Avatar.js";
import { LevelBadge } from "../ui/LevelBadge.js";
import { fr } from "../../i18n/fr.js";

/**
 * Profils ouverts aux opportunités, en tête du fil "Pour toi" d'un compte RH
 * ou entrepreneur. Rien n'est affiché sans profil à montrer ni en cas
 * d'erreur : le fil reste lisible sans eux.
 */
export function OpenProfilesStrip() {
  const titleId = useId();
  const [profiles, setProfiles] = useState<Profile[]>([]);

  useEffect(() => {
    listOpenProfiles()
      .then((result) => setProfiles(result.items))
      .catch(() => setProfiles([]));
  }, []);

  if (profiles.length === 0) return null;
  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-2 border-b border-border pb-4">
      <h2 id={titleId} className="text-md font-semibold text-text">
        {fr.talent.openProfilesTitle}
      </h2>
      <ul data-no-tab-swipe className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1">
        {profiles.map((profile) => (
          <li key={profile.id} className="w-40 shrink-0 snap-start">
            <a
              href={`/u/${profile.handle}`}
              className="flex h-full flex-col items-center gap-2 rounded-card border border-border p-3 text-center hover:border-border-strong"
            >
              <Avatar
                name={profile.displayName}
                src={profile.avatarUrl ?? undefined}
                size={40}
                countryCode={profile.country}
              />
              <span className="flex items-center gap-1">
                <span className="line-clamp-1 text-sm font-semibold text-text">
                  {profile.displayName}
                </span>
                {profile.level && <LevelBadge level={profile.level} />}
              </span>
              {profile.title && (
                <span className="line-clamp-2 text-xs text-text-2">{profile.title}</span>
              )}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
