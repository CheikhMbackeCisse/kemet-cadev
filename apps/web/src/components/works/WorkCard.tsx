import { BookOpen, MessagesSquare } from "lucide-react";
import { workMediaContentPath, type WorkSummary } from "@kemet/shared";
import { Avatar } from "../ui/Avatar.js";
import { Badge } from "../ui/Badge.js";
import { fr } from "../../i18n/fr.js";
import { WORK_STATUS_LABELS, WORK_TYPE_LABELS } from "./workLabels.js";

const MAX_AVATARS = 4;
const MAX_TAGS = 4;

function authorsLine(work: WorkSummary): string {
  const others = work.coauthors.length + work.externalAuthors.length;
  const publisher = fr.works.byPublisher(work.publisher.displayName);
  return others > 0 ? `${publisher} ${fr.works.andOthers(others)}` : publisher;
}

/**
 * Carte d'un travail dans la grille de /travaux : couverture, titre, avatars
 * des auteurs, tags. Le titre porte le lien étiré sur toute la carte ; les
 * tags restent des boutons de filtre au-dessus de ce lien.
 */
export function WorkCard({
  work,
  onTagClick,
}: {
  work: WorkSummary;
  onTagClick?: (tag: string) => void;
}) {
  const people = [work.publisher, ...work.coauthors].slice(0, MAX_AVATARS);
  return (
    <li className="relative flex h-full flex-col overflow-hidden rounded-card border border-border bg-bg transition-colors duration-150 hover:border-border-strong has-[a:focus-visible]:outline has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-primary">
      {work.coverMediaId ? (
        <img
          src={workMediaContentPath(work.coverMediaId)}
          alt=""
          loading="lazy"
          decoding="async"
          className="aspect-[16/9] w-full border-b border-border bg-surface-2 object-cover"
        />
      ) : (
        <div
          aria-hidden="true"
          className="flex aspect-[16/9] w-full items-center justify-center border-b border-border bg-surface-2 text-subtle"
        >
          <BookOpen className="size-5" />
        </div>
      )}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <span className="text-xs text-subtle">
          {WORK_TYPE_LABELS[work.type]}
          {work.year ? ` · ${work.year}` : ""}
        </span>
        <a
          href={`/travaux/${work.slug}`}
          className="line-clamp-2 break-words text-base font-semibold text-text after:absolute after:inset-0 after:content-[''] hover:underline"
        >
          {work.title}
        </a>
        <div className="flex min-w-0 items-center gap-2">
          <span aria-hidden="true" className="flex shrink-0 -space-x-2">
            {people.map((person) => (
              <Avatar
                key={person.id}
                name={person.displayName}
                src={person.avatarUrl ?? undefined}
                size={24}
                className="ring-2 ring-bg"
              />
            ))}
          </span>
          <span className="truncate text-xs text-muted">{authorsLine(work)}</span>
        </div>
        {work.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {work.tags.slice(0, MAX_TAGS).map((tag) =>
              onTagClick ? (
                <button
                  key={tag}
                  type="button"
                  onClick={() => onTagClick(tag)}
                  aria-label={fr.works.filterByTag(tag)}
                  className="group relative z-10 rounded-full max-md:min-h-control-mobile max-md:min-w-control-mobile"
                >
                  <Badge className="group-hover:bg-accent-soft">{tag}</Badge>
                </button>
              ) : (
                <Badge key={tag}>{tag}</Badge>
              ),
            )}
          </div>
        )}
        {(work.status === "in_progress" || work.messageCount > 0) && (
          <div className="mt-auto flex flex-wrap items-center gap-3 pt-1 text-xs text-subtle">
            {work.status === "in_progress" && (
              <Badge tone="accent">{WORK_STATUS_LABELS.in_progress}</Badge>
            )}
            {work.messageCount > 0 && (
              <span className="inline-flex items-center gap-1">
                <MessagesSquare className="size-4" aria-hidden="true" />
                {fr.works.messageCount(work.messageCount)}
              </span>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
