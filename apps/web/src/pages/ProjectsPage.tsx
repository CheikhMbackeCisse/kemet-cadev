import { navigate } from "../lib/navigation/navigate.js";
import { FolderGit2, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { listProjects } from "../lib/chat/api.js";
import { Badge } from "../components/ui/Badge.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import { ErrorState } from "../components/ui/ErrorState.js";
import { Skeleton } from "../components/ui/Skeleton.js";
import { fr } from "../i18n/fr.js";
import { HeaderActionLink } from "../components/ui/HeaderActionLink.js";
import { RailPage } from "../components/layout/RailPage.js";
import { useSession } from "../session/SessionProvider.js";
import { goToSignUp, SIGN_UP_PATH } from "../session/signUpInvite.js";
import { VisitorBanner } from "../components/shell/VisitorBanner.js";

export function ProjectsPage() {
  const { status } = useSession();
  const isVisitor = status === "visitor";
  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: () => listProjects().then((page) => page.items),
  });
  const projects = projectsQuery.data ?? [];
  const loading = projectsQuery.isPending;
  const error = projectsQuery.isError && !projectsQuery.data;
  const load = () => void projectsQuery.refetch();

  return (
    <RailPage activeSection="projets" className="gap-6 px-4 pt-3 lg:pt-6">
      <div className="flex flex-wrap items-center justify-between gap-y-3">
        <h1 className="text-lg font-bold text-text">{fr.projects.title}</h1>
        <div className="flex items-center gap-2">
          <HeaderActionLink href={isVisitor ? SIGN_UP_PATH : "/projets/nouveau"} icon={Plus}>
            {fr.projects.create}
          </HeaderActionLink>
        </div>
      </div>

      {isVisitor && <VisitorBanner />}

      {loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : error ? (
        <ErrorState
          message={fr.projects.loadingError}
          retry={{ label: fr.chat.retry, onClick: load }}
        />
      ) : projects.length === 0 ? (
        <EmptyState
          icon={FolderGit2}
          message={fr.projects.noProjects}
          action={{
            label: fr.projects.createTitle,
            onClick: isVisitor ? goToSignUp : () => navigate("/projets/nouveau"),
          }}
        />
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {projects.map((project) => (
            <li key={project.id}>
              <a
                href={`/projets/${project.slug}`}
                className="block -mx-4 px-4 py-4 transition-colors duration-150 lg:-mx-3 lg:px-3 lg:hover:bg-surface-2"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-text">{project.name}</span>
                  <span className="text-xs text-subtle">
                    {fr.projects.openHelpRequests(project.openHelpRequestCount)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-text-2">{project.pitch}</p>
                {project.stack.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {project.stack.map((item) => (
                      <Badge key={item}>{item}</Badge>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-xs text-subtle">
                  {fr.projects.byOwner(project.ownerDisplayName)}
                </p>
              </a>
            </li>
          ))}
        </ul>
      )}
    </RailPage>
  );
}
