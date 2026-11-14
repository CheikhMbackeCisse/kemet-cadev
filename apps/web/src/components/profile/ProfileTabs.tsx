import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { Credential, Profile } from "@kemet/shared";
import { getUserLibrary } from "../../lib/chat/api.js";
import { fr } from "../../i18n/fr.js";
import { SavedPostsList } from "../feed/SavedPostsList.js";
import { libraryHasContent, ProfileLibrary } from "../library/ProfileLibrary.js";
import { profileLinks } from "../library/ProfileLinks.js";
import { SkillCard } from "../skills/SkillCard.js";
import { ErrorState } from "../ui/ErrorState.js";
import { Skeleton } from "../ui/Skeleton.js";
import { Tabs, type TabItem } from "../ui/Tabs.js";
import { ProfileWorks } from "../works/ProfileWorks.js";
import { CompleteProfileCard } from "./CompleteProfileCard.js";
import { CredentialsList } from "./CredentialsList.js";

export type ProfileTab = "travaux" | "bibliotheque" | "skills" | "parcours" | "enregistres";

const TAB_PARAM = "onglet";

function readTab(): string | null {
  return new URLSearchParams(window.location.search).get(TAB_PARAM);
}

export interface ProfileTabsProps {
  profile: Profile;
  /** `null` tant que le profil public n'est pas lu. */
  workCount: number | null;
  credentials: Credential[];
  /** Ajoute l'onglet "Enregistrés", jamais montré sur le profil d'une autre personne. */
  isOwnProfile: boolean;
  worksReloadKey: number;
}

/**
 * Onglets communs à Moi et au profil public. Un onglet vide ne s'affiche
 * pas : sur son propre profil, ce qui manque est proposé par une seule carte.
 */
export function ProfileTabs({
  profile,
  workCount,
  credentials,
  isOwnProfile,
  worksReloadKey,
}: ProfileTabsProps) {
  const libraryQuery = useQuery({
    queryKey: ["library", profile.handle],
    queryFn: () => getUserLibrary(profile.handle),
    // Un CV ou un lien ajouté dans les paramètres doit apparaître au retour.
    staleTime: 0,
  });
  const [selected, setSelected] = useState(readTab);

  if (libraryQuery.isError && !libraryQuery.data) {
    return (
      <ErrorState
        message={fr.library.loadingError}
        retry={{ label: fr.chat.retry, onClick: () => void libraryQuery.refetch() }}
      />
    );
  }
  const library = libraryQuery.data;
  if (!library || workCount === null) {
    return (
      <div className="flex flex-col gap-3" aria-hidden="true">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const items: (TabItem & { value: ProfileTab })[] = [];
  if (workCount > 0) {
    items.push({
      value: "travaux",
      label: fr.profile.tabWorks,
      content: (
        <ProfileWorks
          handle={profile.handle}
          isOwnProfile={isOwnProfile}
          reloadKey={worksReloadKey}
          layout="cards"
        />
      ),
    });
  }
  if (libraryHasContent(profile, library)) {
    items.push({
      value: "bibliotheque",
      label: fr.library.tab,
      content: <ProfileLibrary profile={profile} isOwnProfile={isOwnProfile} library={library} />,
    });
  }
  if (library.skills.length > 0) {
    items.push({
      value: "skills",
      label: fr.profile.tabSkills,
      content: (
        <ul className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          {library.skills.map((skill) => (
            <li key={skill.id} className="min-w-0">
              <SkillCard skill={skill} />
            </li>
          ))}
        </ul>
      ),
    });
  }
  if (credentials.length > 0) {
    items.push({
      value: "parcours",
      label: fr.works.profileCredentialsTab,
      content: <CredentialsList credentials={credentials} />,
    });
  }
  if (isOwnProfile) {
    items.push({ value: "enregistres", label: fr.profile.tabSaved, content: <SavedPostsList /> });
  }

  const active = items.find((item) => item.value === selected) ?? items[0];

  function selectTab(value: string) {
    setSelected(value);
    const url = new URL(window.location.href);
    if (value === items[0]?.value) url.searchParams.delete(TAB_PARAM);
    else url.searchParams.set(TAB_PARAM, value);
    window.history.replaceState(window.history.state, "", url.pathname + url.search);
  }

  return (
    <div className="flex flex-col gap-4">
      {isOwnProfile && (
        <CompleteProfileCard
          gaps={{
            cv: library.cv === null,
            links: profileLinks(profile).length === 0,
            work: workCount === 0,
            skill: library.skills.length === 0,
          }}
        />
      )}
      {active ? (
        <Tabs value={active.value} onValueChange={selectTab} items={items} scrollable swipeable />
      ) : (
        !isOwnProfile && <p className="text-sm text-subtle">{fr.profile.nothingPublished}</p>
      )}
    </div>
  );
}
