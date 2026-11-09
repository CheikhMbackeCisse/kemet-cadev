import { Download, FileText, FolderGit2, Link2, Sparkles } from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useState, type ReactNode } from "react";
import type { Profile, ProfileLibrary as ProfileLibraryData } from "@kemet/shared";
import { cvContentUrl, getUserLibrary } from "../../lib/chat/api.js";
import { navigate } from "../../lib/navigation/navigate.js";
import { SIGN_UP_PATH } from "../../session/signUpInvite.js";
import { EmptyState } from "../ui/EmptyState.js";
import { ErrorState } from "../ui/ErrorState.js";
import { Skeleton } from "../ui/Skeleton.js";
import { SkillCard } from "../skills/SkillCard.js";
import { ProfileWorks } from "../works/ProfileWorks.js";
import { ProfileLinks, profileLinks } from "./ProfileLinks.js";
import { ProjectFeedCard } from "../feed/ProjectFeedCard.js";
import { useSession } from "../../session/SessionProvider.js";
import { fr } from "../../i18n/fr.js";

// pdf.js pèse plusieurs centaines de Ko : chargé seulement quand un CV s'affiche.
const CvPreview = lazy(() =>
  import("./CvPreview.js").then((module) => ({ default: module.CvPreview })),
);

const SECONDARY_LINK_CLASS =
  "inline-flex h-control max-md:h-control-mobile items-center justify-center gap-2 rounded-control border border-border-strong px-4 text-sm font-medium text-text hover:bg-surface-2";

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="text-md font-semibold text-text">
        {title}
      </h2>
      {children}
    </section>
  );
}

export interface ProfileLibraryProps {
  profile: Profile;
  isOwnProfile: boolean;
  worksReloadKey: number;
}

/** Onglet "Bibliothèque" : CV, travaux, projets, liens et skills publiés d'un profil. */
export function ProfileLibrary({ profile, isOwnProfile, worksReloadKey }: ProfileLibraryProps) {
  const { profile: viewer } = useSession();
  const [data, setData] = useState<ProfileLibraryData | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setError(false);
    getUserLibrary(profile.handle)
      .then(setData)
      .catch(() => setError(true));
  }, [profile.handle]);

  useEffect(() => load(), [load]);

  const links = profileLinks(profile);
  const cv = data?.cv ?? null;

  const cvContent = !data ? (
    <Skeleton className="h-24 w-full" />
  ) : !cv ? (
    isOwnProfile ? (
      <EmptyState
        icon={FileText}
        message={fr.library.noCv}
        action={{ label: fr.library.addCv, onClick: () => navigate("/parametres/profil#cv") }}
      />
    ) : (
      <p className="text-sm text-subtle">{fr.library.noCv}</p>
    )
  ) : !cv.available ? (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-text-2">{fr.library.cvMembersOnly}</p>
      <a href={SIGN_UP_PATH} className={SECONDARY_LINK_CLASS}>
        {fr.library.cvSignIn}
      </a>
    </div>
  ) : (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <FileText className="size-5 shrink-0 text-text-2" aria-hidden="true" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-text">{cv.originalName}</p>
            <p className="text-xs text-subtle">
              {fr.library.cvUpdated(new Date(cv.updatedAt).toLocaleDateString("fr-FR"))}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {isOwnProfile && (
            <a href="/parametres/profil#cv" className={SECONDARY_LINK_CLASS}>
              {fr.library.manageCv}
            </a>
          )}
          <a
            href={cvContentUrl(profile.handle)}
            download={cv.originalName}
            className={SECONDARY_LINK_CLASS}
          >
            <Download className="size-4" aria-hidden="true" />
            {fr.library.downloadCv}
          </a>
        </div>
      </div>
      {/* Largeur bornée sur bureau : une page A4 en pleine largeur repousserait le reste de la Bibliothèque très bas. */}
      <div className="w-full md:max-w-md">
        <Suspense fallback={<Skeleton className="aspect-[1/1.414] w-full" />}>
          <CvPreview url={cvContentUrl(profile.handle)} ownerName={profile.displayName} />
        </Suspense>
      </div>
    </div>
  );

  if (error) {
    return (
      <ErrorState
        message={fr.library.loadingError}
        retry={{ label: fr.chat.retry, onClick: load }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <Section id="library-cv" title={fr.library.cvTitle}>
        {cvContent}
      </Section>

      <Section id="library-works" title={fr.library.worksTitle}>
        <ProfileWorks
          handle={profile.handle}
          isOwnProfile={isOwnProfile}
          reloadKey={worksReloadKey}
          layout="cards"
        />
      </Section>

      <Section id="library-projects" title={fr.library.projectsTitle}>
        {!data ? (
          <Skeleton className="h-32 w-full" />
        ) : data.projects.length === 0 ? (
          isOwnProfile ? (
            <EmptyState
              icon={FolderGit2}
              message={fr.library.noProjects}
              action={{
                label: fr.feed.publishProject,
                onClick: () => navigate("/projets/nouveau"),
              }}
            />
          ) : (
            <p className="text-sm text-subtle">{fr.library.noProjects}</p>
          )
        ) : (
          <ul className="grid sm:grid-cols-2 sm:gap-x-4">
            {data.projects.map((project) => (
              <ProjectFeedCard
                key={project.id}
                project={project}
                variant="card"
                viewerProfileId={viewer?.id ?? null}
              />
            ))}
          </ul>
        )}
      </Section>

      <Section id="library-links" title={fr.library.linksTitle}>
        {links.length > 0 ? (
          <ProfileLinks links={links} />
        ) : isOwnProfile ? (
          <EmptyState
            icon={Link2}
            message={fr.library.ownEmptyLinks}
            action={{
              label: fr.library.addLinks,
              onClick: () => navigate("/parametres/profil"),
            }}
          />
        ) : (
          <p className="text-sm text-subtle">{fr.library.noLinks}</p>
        )}
      </Section>

      <Section id="library-skills" title={fr.library.skillsTitle}>
        {!data ? (
          <Skeleton className="h-32 w-full" />
        ) : data.skills.length === 0 ? (
          isOwnProfile ? (
            <EmptyState
              icon={Sparkles}
              message={fr.library.noSkills}
              action={{ label: fr.skills.createTitle, onClick: () => navigate("/skills/nouveau") }}
            />
          ) : (
            <p className="text-sm text-subtle">{fr.library.noSkills}</p>
          )
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {data.skills.map((skill) => (
              <li key={skill.id}>
                <SkillCard skill={skill} />
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
