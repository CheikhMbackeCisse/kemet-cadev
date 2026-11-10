import { useId } from "react";
import { isDeletedAccountHandle, type FeedProject } from "@kemet/shared";
import { skillDomain } from "../../lib/skills/skillDomain.js";
import { cn } from "../../lib/cn.js";
import { SIGN_UP_PATH } from "../../session/signUpInvite.js";
import { fr } from "../../i18n/fr.js";
import { Avatar } from "../ui/Avatar.js";
import { Badge } from "../ui/Badge.js";
import { Skeleton } from "../ui/Skeleton.js";
import { SkillDomainIcon } from "../skills/SkillDomainIcon.js";

const MAX_STACK_BADGES = 4;
const MAX_ROLES = 2;

const LINK_BUTTON_CLASS =
  "inline-flex h-control max-md:h-control-mobile items-center justify-center rounded-control px-4 text-sm font-medium transition-colors duration-150";

export interface ProjectFeedCardProps {
  project: FeedProject;
  /**
   * "card" dans le fil mélangé, où le cadre distingue le projet des posts
   * qui l'entourent ; "row" dans l'onglet Projets, une liste comme une autre.
   */
  variant: "card" | "row";
  /** `null` pour un visiteur : "Proposer mon aide" mène alors à l'inscription. */
  viewerProfileId: string | null;
}

export function ProjectFeedCard({ project, variant, viewerProfileId }: ProjectFeedCardProps) {
  const nameId = useId();
  // Icône du domaine de la stack, comme celle des skills : un projet n'a pas d'image à lui.
  const domain = skillDomain({
    tags: project.stack,
    name: project.name,
    description: project.pitch,
  });
  const href = `/projets/${project.slug}`;
  const firstRole = project.openRoles[0];
  const isOwner = viewerProfileId === project.ownerId;
  const extraStack = project.stack.length - MAX_STACK_BADGES;
  const extraRoles = project.openRoles.length - MAX_ROLES;

  return (
    <li className="py-4 [content-visibility:auto] [contain-intrinsic-size:auto_260px]">
      <article
        aria-labelledby={nameId}
        className={cn(
          "flex flex-col gap-2",
          variant === "card" && "rounded-card border border-border bg-bg p-4",
        )}
      >
        <div className="flex items-center gap-3">
          <SkillDomainIcon domain={domain} className="size-10 shrink-0 border-0" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <a
              id={nameId}
              href={href}
              className="break-words text-base font-semibold text-text hover:underline"
            >
              {project.name}
            </a>
            <span className="flex items-center gap-1.5 text-xs text-subtle">
              <Avatar
                deleted={isDeletedAccountHandle(project.ownerHandle)}
                name={project.ownerDisplayName}
                src={project.ownerAvatarUrl ?? undefined}
                size={24}
              />
              {fr.feed.projectBy(project.ownerDisplayName)}
            </span>
          </div>
        </div>
        <p className="line-clamp-2 text-base text-text-2">{project.pitch}</p>
        {project.stack.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {project.stack.slice(0, MAX_STACK_BADGES).map((item) => (
              <Badge key={item}>{item}</Badge>
            ))}
            {extraStack > 0 && <Badge>+{extraStack}</Badge>}
          </div>
        )}
        {project.openRoles.length > 0 ? (
          <ul className="flex flex-col gap-0.5 text-base text-text-2">
            {project.openRoles.slice(0, MAX_ROLES).map((role) => (
              <li key={role.id} className="line-clamp-2">
                {fr.feed.projectLooksFor(role.title)}
              </li>
            ))}
            {extraRoles > 0 && (
              <li className="text-xs text-subtle">{fr.feed.projectMoreRoles(extraRoles)}</li>
            )}
          </ul>
        ) : (
          <p className="text-xs text-subtle">{fr.feed.projectNoRoles}</p>
        )}
        <div className="mt-1 flex flex-wrap gap-2">
          {firstRole && !isOwner && (
            <a
              href={viewerProfileId ? `${href}?aider=${firstRole.id}` : SIGN_UP_PATH}
              className={`${LINK_BUTTON_CLASS} bg-primary text-white hover:bg-primary-hover`}
            >
              {viewerProfileId ? fr.feed.offerHelp : fr.feed.offerHelpVisitor}
            </a>
          )}
          <a
            href={href}
            aria-label={fr.feed.viewProjectLabel(project.name)}
            className={`${LINK_BUTTON_CLASS} border border-border-strong text-text hover:bg-surface-2`}
          >
            {fr.feed.viewProject}
          </a>
        </div>
      </article>
    </li>
  );
}

/** Forme d'une carte projet : icône, titre, deux lignes, deux boutons. */
export function ProjectFeedCardSkeleton() {
  return (
    <div className="flex flex-col gap-2 py-4">
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 shrink-0 rounded-card" />
        <Skeleton className="h-4 w-40" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
      <div className="flex gap-2">
        <Skeleton className="h-10 w-36 rounded-control" />
        <Skeleton className="h-10 w-28 rounded-control" />
      </div>
    </div>
  );
}
