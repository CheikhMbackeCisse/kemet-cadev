import { Download, FileText } from "lucide-react";
import { lazy, Suspense, type ReactNode } from "react";
import type { Profile, ProfileLibrary as ProfileLibraryData } from "@kemet/shared";
import { cvContentUrl } from "../../lib/chat/api.js";
import { SIGN_UP_PATH } from "../../session/signUpInvite.js";
import { Skeleton } from "../ui/Skeleton.js";
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

/** CV, projets ou liens : la Bibliothèque a au moins une section remplie. */
export function libraryHasContent(profile: Profile, library: ProfileLibraryData): boolean {
  return library.cv !== null || library.projects.length > 0 || profileLinks(profile).length > 0;
}

export interface ProfileLibraryProps {
  profile: Profile;
  isOwnProfile: boolean;
  library: ProfileLibraryData;
}

/**
 * Onglet "Bibliothèque" : CV, projets et liens d'un profil. Seules les
 * sections remplies s'affichent ; ce qui manque sur son propre profil est
 * proposé par la carte "Complète ton profil".
 */
export function ProfileLibrary({ profile, isOwnProfile, library }: ProfileLibraryProps) {
  const { profile: viewer } = useSession();
  const links = profileLinks(profile);
  const { cv, projects } = library;

  return (
    <div className="flex flex-col gap-6">
      {cv && (
        <Section id="library-cv" title={fr.library.cvTitle}>
          {!cv.available ? (
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
          )}
        </Section>
      )}

      {projects.length > 0 && (
        <Section id="library-projects" title={fr.library.projectsTitle}>
          <ul className="grid gap-3 sm:grid-cols-2">
            {projects.map((project) => (
              <ProjectFeedCard
                key={project.id}
                project={project}
                variant="card"
                viewerProfileId={viewer?.id ?? null}
              />
            ))}
          </ul>
        </Section>
      )}

      {links.length > 0 && (
        <Section id="library-links" title={fr.library.linksTitle}>
          <ProfileLinks links={links} />
        </Section>
      )}
    </div>
  );
}
