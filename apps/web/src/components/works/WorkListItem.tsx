import { FileText, MessagesSquare } from "lucide-react";
import type { WorkSummary } from "@kemet/shared";
import { Badge } from "../ui/Badge.js";
import { fr } from "../../i18n/fr.js";
import { WORK_STATUS_LABELS, WORK_TYPE_LABELS } from "./workLabels.js";

export interface WorkListItemProps {
  work: WorkSummary;
  /** Sur un profil : "Publié" ou "Coauteur". */
  relationLabel?: string;
  onTagClick?: (tag: string) => void;
}

function authorsLine(work: WorkSummary): string {
  const others = work.coauthors.length + work.externalAuthors.length;
  const publisher = fr.works.byPublisher(work.publisher.displayName);
  return others > 0 ? `${publisher} ${fr.works.andOthers(others)}` : publisher;
}

/** Une ligne dense de la liste des travaux, partagée par /travaux et le profil. */
export function WorkListItem({ work, relationLabel, onTagClick }: WorkListItemProps) {
  const meta = [
    WORK_TYPE_LABELS[work.type],
    work.year ? String(work.year) : null,
    work.institution,
  ].filter(Boolean);
  return (
    <li className="relative -mx-4 px-4 py-3 transition-colors duration-150 lg:-mx-3 lg:px-3 lg:hover:bg-surface-2">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <a
          href={`/travaux/${work.slug}`}
          className="text-sm font-medium text-text after:absolute after:inset-0 after:content-[''] hover:underline"
        >
          {work.title}
        </a>
        {relationLabel && <Badge>{relationLabel}</Badge>}
        {work.status === "in_progress" && (
          <Badge tone="accent">{WORK_STATUS_LABELS.in_progress}</Badge>
        )}
        {work.hasPdf && (
          <span className="inline-flex items-center gap-1 text-xs text-subtle">
            <FileText className="size-3.5" aria-hidden="true" />
            {fr.works.hasPdf}
          </span>
        )}
        {work.messageCount > 0 && (
          <span className="inline-flex items-center gap-1 text-xs text-subtle">
            <MessagesSquare className="size-3.5" aria-hidden="true" />
            {fr.works.messageCount(work.messageCount)}
          </span>
        )}
      </div>
      <p className="mt-0.5 text-xs text-muted">
        {meta.join(" · ")} · {authorsLine(work)}
      </p>
      <p className="mt-1 line-clamp-2 text-sm text-text-2">{work.excerpt}</p>
      {work.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {work.tags.map((tag) =>
            onTagClick ? (
              <button
                key={tag}
                type="button"
                onClick={() => onTagClick(tag)}
                className="relative z-10 rounded-full max-md:min-h-control-mobile"
              >
                <Badge className="hover:bg-accent-soft">{tag}</Badge>
              </button>
            ) : (
              <Badge key={tag}>{tag}</Badge>
            ),
          )}
        </div>
      )}
    </li>
  );
}
