import { ThumbsDown, ThumbsUp } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import type { SkillCitation } from "@kemet/shared";
import { fr } from "../../i18n/fr.js";
import { cn } from "../../lib/cn.js";
import { Avatar } from "../ui/Avatar.js";
import { Badge } from "../ui/Badge.js";
import { KoccSymbol } from "./KoccSymbol.js";

export interface AssistantSkillReference {
  skillName: string;
  skillHref: string;
  authorName: string;
  authorHref: string;
  authorAvatarUrl?: string | null;
}

/** Skill cité par le serveur, sous la forme affichée par la bulle. */
export function skillReferenceFrom(citation: SkillCitation): AssistantSkillReference {
  return {
    skillName: citation.name,
    skillHref: `/skills/${citation.slug}`,
    authorName: citation.authorDisplayName,
    authorHref: `/u/${citation.authorHandle}`,
    authorAvatarUrl: citation.authorAvatarUrl,
  };
}

export interface AssistantMessageProps {
  content: ReactNode;
  skill?: AssistantSkillReference;
  readSummary?: string;
  onFeedback?: (helpful: boolean) => void;
  hideFeedback?: boolean;
  initialFeedback?: "helpful" | "not-helpful" | null;
  /** Réponse rejouée depuis un enregistrement : toujours signalée, jamais présentée comme générée en direct. */
  recorded?: boolean;
  className?: string;
}

export function AssistantMessage({
  content,
  skill,
  readSummary,
  onFeedback,
  hideFeedback = false,
  initialFeedback = null,
  recorded = false,
  className,
}: AssistantMessageProps) {
  const [feedback, setFeedback] = useState<"helpful" | "not-helpful" | null>(initialFeedback);

  useEffect(() => setFeedback(initialFeedback), [initialFeedback]);

  function handleFeedback(helpful: boolean) {
    setFeedback(helpful ? "helpful" : "not-helpful");
    onFeedback?.(helpful);
  }

  return (
    <div
      className={cn("rounded-card border border-assistant-border bg-assistant-bg p-4", className)}
    >
      <div className="flex items-center gap-2">
        <KoccSymbol className="size-5" />
        <span className="text-sm font-semibold text-text">{fr.chat.assistantName}</span>
        {recorded && <Badge tone="accent">{fr.chat.assistantRecorded}</Badge>}
      </div>

      {skill && (
        <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-text-2">
          <Avatar name={skill.authorName} src={skill.authorAvatarUrl ?? undefined} size={20} />
          <span>
            {fr.chat.assistantCitedFrom}{" "}
            <a href={skill.skillHref} className="font-medium text-link hover:underline">
              {skill.skillName}
            </a>
            , {fr.chat.assistantCitedAuthor}{" "}
            <a href={skill.authorHref} className="font-medium text-link hover:underline">
              {skill.authorName}
            </a>
          </span>
        </p>
      )}

      <div className="mt-3 min-w-0 text-sm leading-relaxed text-text">{content}</div>

      {readSummary && <p className="mt-3 text-xs text-muted">{readSummary}</p>}

      {!hideFeedback && (
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleFeedback(true)}
            aria-pressed={feedback === "helpful"}
            className={cn(
              "inline-flex h-control-compact items-center gap-1.5 rounded-control border border-border-strong px-2.5 text-xs font-medium text-text-2 hover:bg-surface-2",
              feedback === "helpful" && "border-success text-success",
            )}
          >
            <ThumbsUp className="size-3.5" aria-hidden="true" />
            Utile
          </button>
          <button
            type="button"
            onClick={() => handleFeedback(false)}
            aria-pressed={feedback === "not-helpful"}
            className={cn(
              "inline-flex h-control-compact items-center gap-1.5 rounded-control border border-border-strong px-2.5 text-xs font-medium text-text-2 hover:bg-surface-2",
              feedback === "not-helpful" && "border-danger text-danger",
            )}
          >
            <ThumbsDown className="size-3.5" aria-hidden="true" />
            Pas utile
          </button>
        </div>
      )}
    </div>
  );
}
