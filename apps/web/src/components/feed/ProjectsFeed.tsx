import { FolderGit2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { listFeedProjects } from "../../lib/chat/api.js";
import { navigate } from "../../lib/navigation/navigate.js";
import { fr } from "../../i18n/fr.js";
import { SIGN_UP_PATH } from "../../session/signUpInvite.js";
import { EmptyState } from "../ui/EmptyState.js";
import { ErrorState } from "../ui/ErrorState.js";
import { ProjectFeedCard, ProjectFeedCardSkeleton } from "./ProjectFeedCard.js";

const PROJECTS_IN_LIST = 20;

/** Onglet Projets du fil : les projets actifs, en lignes, sans les offres. */
export function ProjectsFeed({ viewerProfileId }: { viewerProfileId: string | null }) {
  const projects = useQuery({
    queryKey: ["feed", "projects", PROJECTS_IN_LIST],
    queryFn: () => listFeedProjects("pour-toi", PROJECTS_IN_LIST),
  });

  if (projects.isPending) {
    return (
      <div className="flex flex-col divide-y divide-border">
        <ProjectFeedCardSkeleton />
        <ProjectFeedCardSkeleton />
      </div>
    );
  }
  if (projects.isError) {
    return (
      <ErrorState
        message={fr.projects.loadingError}
        retry={{ label: fr.chat.retry, onClick: () => void projects.refetch() }}
      />
    );
  }
  if (projects.data.items.length === 0) {
    return (
      <EmptyState
        icon={FolderGit2}
        message={fr.projects.noProjects}
        action={
          viewerProfileId
            ? { label: fr.projects.createTitle, onClick: () => navigate("/projets/nouveau") }
            : { label: fr.opportunities.signUpToPublish, onClick: () => navigate(SIGN_UP_PATH) }
        }
      />
    );
  }
  return (
    <ul className="flex flex-col divide-y divide-border">
      {projects.data.items.map((project) => (
        <ProjectFeedCard
          key={project.id}
          project={project}
          variant="row"
          viewerProfileId={viewerProfileId}
        />
      ))}
    </ul>
  );
}
