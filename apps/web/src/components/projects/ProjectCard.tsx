import { useId } from "react";
import { isDeletedAccountHandle, type ProjectSummary } from "@kemet/shared";
import type { FeedProject } from "@kemet/shared";
import { deviconUrl, type DeviconName } from "../arrival/deviconLogos.js";
import { SIGN_UP_PATH } from "../../session/signUpInvite.js";
import { fr } from "../../i18n/fr.js";
import { Avatar } from "../ui/Avatar.js";
import { Badge } from "../ui/Badge.js";
import { Skeleton } from "../ui/Skeleton.js";

const MAX_LOGOS = 3;
const MAX_STACK_TAGS = 3;

// Noms de stack tels que les gens les écrivent, vers les logos Devicon déjà
// livrés avec l'application. Une techno sans logo garde seulement son étiquette.
const DEVICON_BY_STACK: Record<string, DeviconName> = {
  python: "python",
  javascript: "javascript",
  typescript: "typescript",
  react: "react",
  "react native": "react",
  flutter: "flutter",
  dart: "dart",
  "node.js": "nodejs",
  nodejs: "nodejs",
  node: "nodejs",
  go: "go",
  java: "java",
  php: "php",
  html: "html5",
  css: "css3",
  docker: "docker",
  postgresql: "postgresql",
  postgres: "postgresql",
  git: "git",
  pytorch: "pytorch",
};

/** Logos des trois premières technos de la stack qui en ont un, sans doublon. */
export function stackLogos(stack: string[]): { name: string; logo: DeviconName }[] {
  const seen = new Set<DeviconName>();
  const logos: { name: string; logo: DeviconName }[] = [];
  for (const name of stack) {
    const logo = DEVICON_BY_STACK[name.trim().toLowerCase()];
    if (!logo || seen.has(logo)) continue;
    seen.add(logo);
    logos.push({ name, logo });
    if (logos.length === MAX_LOGOS) break;
  }
  return logos;
}

export interface ProjectCardProps {
  project: ProjectSummary;
  /** Rôles ouverts, quand le fil des projets les a donnés. */
  openRoles: FeedProject["openRoles"];
  /** `null` pour un visiteur : "Proposer mon aide" mène alors à l'inscription. */
  viewerProfileId: string | null;
}

/**
 * Carte d'un projet sur /projets : ce que fait le projet, puis ce qu'il
 * cherche, mis en avant. Un projet qui ne cherche personne le dit en petit.
 */
export function ProjectCard({ project, openRoles, viewerProfileId }: ProjectCardProps) {
  const nameId = useId();
  const href = `/projets/${project.slug}`;
  const firstRole = openRoles[0];
  const lookingForHelp = project.openHelpRequestCount > 0;
  const isOwner = viewerProfileId === project.ownerId;
  const logos = stackLogos(project.stack);

  return (
    <li className="py-4 lg:py-0">
      <article
        aria-labelledby={nameId}
        className="flex h-full flex-col gap-3 lg:rounded-card lg:border lg:border-border lg:p-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <a
              id={nameId}
              href={href}
              className="break-words text-md font-semibold text-text hover:underline"
            >
              {project.name}
            </a>
            <p className="text-base text-text-2">{project.pitch}</p>
          </div>
          {logos.length > 0 && (
            <ul className="flex shrink-0 items-center gap-1.5" aria-label={fr.projects.stackLogos}>
              {logos.map((item) => (
                <li key={item.logo}>
                  <img
                    src={deviconUrl(item.logo)}
                    alt={item.name}
                    title={item.name}
                    width={20}
                    height={20}
                    loading="lazy"
                    className="size-5"
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        {lookingForHelp ? (
          <div className="flex flex-col gap-2 rounded-card bg-surface-2 p-3">
            <p className="text-xs font-medium text-muted">
              {fr.projects.lookingFor}
            </p>
            {openRoles.length > 0 ? (
              <ul className="flex flex-col gap-1">
                {openRoles.slice(0, 2).map((role) => (
                  <li key={role.id} className="text-base font-medium text-text">
                    {role.title}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-base font-medium text-text">
                {fr.projects.openHelpRequests(project.openHelpRequestCount)}
              </p>
            )}
            {project.stack.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {project.stack.slice(0, MAX_STACK_TAGS).map((item) => (
                  <Badge key={item} className="bg-bg">
                    {item}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-subtle">{fr.projects.teamComplete}</p>
        )}

        <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
          <a
            href={`/u/${project.ownerHandle}`}
            className="flex min-w-0 items-center gap-2 text-sm text-text-2 hover:underline"
          >
            <Avatar
              deleted={isDeletedAccountHandle(project.ownerHandle)}
              name={project.ownerDisplayName}
              src={project.ownerAvatarUrl ?? undefined}
              size={24}
            />
            <span className="truncate">{project.ownerDisplayName}</span>
          </a>
          {lookingForHelp && !isOwner && (
            <a
              href={
                viewerProfileId
                  ? firstRole
                    ? `${href}?aider=${firstRole.id}`
                    : href
                  : SIGN_UP_PATH
              }
              className="inline-flex h-control items-center justify-center rounded-control bg-action-strong px-4 text-sm font-medium text-on-action-strong transition-colors duration-150 hover:bg-action-strong-hover max-md:h-control-mobile"
            >
              {viewerProfileId ? fr.feed.offerHelp : fr.feed.offerHelpVisitor}
            </a>
          )}
        </div>
      </article>
    </li>
  );
}

export function ProjectCardSkeleton() {
  return (
    <li className="flex flex-col gap-3 py-4 lg:rounded-card lg:border lg:border-border lg:p-4">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-16 w-full rounded-card" />
      <div className="flex justify-between">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-10 w-36 rounded-control" />
      </div>
    </li>
  );
}
