import { ThumbsDown, ThumbsUp } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { cn } from "../../lib/cn.js";
import { KemetSymbol } from "../ui/KemetSymbol.js";

export interface AssistantSkillReference {
  skillName: string;
  skillHref: string;
  authorName: string;
  authorHref: string;
}

export interface AssistantMessageProps {
  content: ReactNode;
  skill?: AssistantSkillReference;
  readSummary?: string;
  onFeedback?: (helpful: boolean) => void;
  hideFeedback?: boolean;
  initialFeedback?: "helpful" | "not-helpful" | null;
  className?: string;
}

export function AssistantMessage({
  content,
  skill,
  readSummary,
  onFeedback,
  hideFeedback = false,
  initialFeedback = null,
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
      className={cn("rounded-panel border border-assistant-border bg-assistant-bg p-4", className)}
    >
      <div className="flex items-center gap-2">
        <KemetSymbol className="size-5" />
        <span className="text-sm font-semibold text-text">kemet</span>
      </div>

      <div className="mt-3 min-w-0 text-sm leading-relaxed text-text">{content}</div>

      {readSummary && <p className="mt-3 text-xs text-muted">{readSummary}</p>}

      {skill && (
        <p className="mt-2 text-xs text-muted">
          Basé sur le skill{" "}
          <a href={skill.skillHref} className="text-link hover:underline">
            {skill.skillName}
          </a>{" "}
          de{" "}
          <a href={skill.authorHref} className="text-link hover:underline">
            {skill.authorName}
          </a>
        </p>
      )}

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
