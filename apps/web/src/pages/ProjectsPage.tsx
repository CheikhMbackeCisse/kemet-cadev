import { navigate } from "../lib/navigation/navigate.js";
import { FolderGit2, Plus } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { FeedProject, ProjectSummary } from "@kemet/shared";
import { listFeedProjects, listProjects } from "../lib/chat/api.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import { ErrorState } from "../components/ui/ErrorState.js";
import { fr } from "../i18n/fr.js";
import { HeaderActionLink } from "../components/ui/HeaderActionLink.js";
import { RailPage } from "../components/layout/RailPage.js";
import { useSession } from "../session/SessionProvider.js";
import { goToSignUp, SIGN_UP_PATH } from "../session/signUpInvite.js";
import { VisitorBanner } from "../components/shell/VisitorBanner.js";
import { ProjectCard, ProjectCardSkeleton } from "../components/projects/ProjectCard.js";
import { cn } from "../lib/cn.js";

// Le fil des projets donne les rôles ouverts, la liste seulement leur nombre.
const ROLES_SOURCE_LIMIT = 20;

type ProjectFilter = "aide" | "tous";

const FILTERS: { value: ProjectFilter; label: string }[] = [
  { value: "tous", label: fr.projects.filterAll },
  { value: "aide", label: fr.projects.filterLookingForHelp },
];

/** Projets qui cherchent de l'aide d'abord ; les équipes complètes en bas. */
export function sortProjects(projects: ProjectSummary[]): ProjectSummary[] {
  return [...projects].sort(
    (a, b) => Number(b.openHelpRequestCount > 0) - Number(a.openHelpRequestCount > 0),
  );
}

export function ProjectsPage() {
  const { status, profile } = useSession();
  const isVisitor = status === "visitor";
  const [filter, setFilter] = useState<ProjectFilter>("aide");
  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: () => listProjects().then((page) => page.items),
  });
  const rolesQuery = useQuery({
    queryKey: ["feed", "projects", ROLES_SOURCE_LIMIT],
    queryFn: () => listFeedProjects("pour-toi", ROLES_SOURCE_LIMIT),
  });
  const rolesByProject = new Map<string, FeedProject["openRoles"]>(
    (rolesQuery.data?.items ?? []).map((project) => [project.id, project.openRoles]),
  );
  const all = sortProjects(projectsQuery.data ?? []);
  const projects =
    filter === "aide" ? all.filter((project) => project.openHelpRequestCount > 0) : all;
  const loading = projectsQuery.isPending;
  const error = projectsQuery.isError && !projectsQuery.data;
  const load = () => void projectsQuery.refetch();

  return (
    <RailPage activeSection="projets" className="gap-4 px-4 pt-3 lg:pt-6">
      <div className="flex flex-wrap items-center justify-between gap-y-3">
        <h1 className="text-lg font-bold text-text">{fr.projects.title}</h1>
        <div className="flex items-center gap-2">
          <HeaderActionLink href={isVisitor ? SIGN_UP_PATH : "/projets/nouveau"} icon={Plus}>
            {fr.projects.create}
          </HeaderActionLink>
        </div>
      </div>

      {isVisitor && <VisitorBanner />}

      <div
        role="group"
        aria-label={fr.projects.filtersLabel}
        data-no-tab-swipe
        className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4"
      >
        {FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            aria-pressed={filter === item.value}
            onClick={() => setFilter(item.value)}
            className={cn(
              "inline-flex h-9 shrink-0 items-center rounded-full px-4 text-sm font-medium transition-colors duration-150",
              filter === item.value
                ? "bg-action-strong text-on-action-strong"
                : "bg-surface-2 text-text hover:bg-nav-active",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading ? (
        <ul className="post-band-list project-grid flex flex-col lg:grid lg:grid-cols-2 lg:gap-3">
          <ProjectCardSkeleton />
          <ProjectCardSkeleton />
        </ul>
      ) : error ? (
        <ErrorState
          message={fr.projects.loadingError}
          retry={{ label: fr.chat.retry, onClick: load }}
        />
      ) : projects.length === 0 ? (
        <EmptyState
          icon={FolderGit2}
          message={filter === "aide" ? fr.projects.noProjectLookingForHelp : fr.projects.noProjects}
          action={{
            label: fr.projects.createTitle,
            onClick: isVisitor ? goToSignUp : () => navigate("/projets/nouveau"),
          }}
        />
      ) : (
        <ul className="post-band-list project-grid flex flex-col lg:grid lg:grid-cols-2 lg:gap-3">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              openRoles={rolesByProject.get(project.id) ?? []}
              viewerProfileId={profile?.id ?? null}
            />
          ))}
        </ul>
      )}
    </RailPage>
  );
}
