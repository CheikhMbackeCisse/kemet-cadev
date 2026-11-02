import { FolderGit2, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { ProjectSummary } from "@kemet/shared";
import { listProjects } from "../lib/chat/api.js";
import { Badge } from "../components/ui/Badge.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import { ErrorState } from "../components/ui/ErrorState.js";
import { Skeleton } from "../components/ui/Skeleton.js";
import { fr } from "../i18n/fr.js";
import { RailPage } from "../components/layout/RailPage.js";

export function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    listProjects()
      .then((page) => setProjects(page.items))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => load(), [load]);

  return (
    <RailPage activeSection="projets" className="gap-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-y-3">
        <div>
          <h1 className="text-lg font-bold text-text">{fr.projects.title}</h1>
          <p className="text-sm text-subtle">{fr.projects.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/projets/nouveau"
            className="inline-flex h-control max-md:h-control-mobile shrink-0 items-center justify-center gap-2 rounded-control bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover"
          >
            <Plus className="size-4" aria-hidden="true" />
            {fr.projects.create}
          </a>
        </div>
      </div>

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
            onClick: () => (window.location.href = "/projets/nouveau"),
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
