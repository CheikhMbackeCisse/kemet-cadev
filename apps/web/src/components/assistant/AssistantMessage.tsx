import { ThumbsDown, ThumbsUp } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";
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
  /** Réponse en train d'arriver : jamais repliée, on la lit pendant qu'elle s'écrit. */
  streaming?: boolean;
  className?: string;
}

/** Hauteur d'une réponse repliée : huit lignes de texte courant. */
const COLLAPSED_HEIGHT_PX = 184;
/** Une réponse qui ne dépasse que d'une ou deux lignes reste entière : la replier ne ferait rien gagner. */
const COLLAPSE_MARGIN_PX = 46;

function useLongContent(enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [long, setLong] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!enabled || !node) return;
    const measure = () => setLong(node.scrollHeight > COLLAPSED_HEIGHT_PX + COLLAPSE_MARGIN_PX);
    measure();
    // Les blocs de code se colorent après le premier rendu et changent de hauteur.
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled]);

  return { ref, long: enabled && long };
}

export function AssistantMessage({
  content,
  skill,
  readSummary,
  onFeedback,
  hideFeedback = false,
  initialFeedback = null,
  recorded = false,
  streaming = false,
  className,
}: AssistantMessageProps) {
  const [feedback, setFeedback] = useState<"helpful" | "not-helpful" | null>(initialFeedback);
  const [expanded, setExpanded] = useState(false);
  const body = useLongContent(!streaming);
  const contentId = useId();
  const collapsed = body.long && !expanded;

  // Toucher la réponse repliée la déplie, sauf un lien ou un bouton (Copier) qui gardent leur action.
  function expandFromContent(event: MouseEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("a, button")) return;
    setExpanded(true);
  }

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

      <div
        ref={body.ref}
        id={contentId}
        onClick={collapsed ? expandFromContent : undefined}
        className={cn(
          "mt-3 min-w-0 text-sm leading-relaxed text-text",
          collapsed &&
            "max-h-[184px] cursor-pointer overflow-hidden [mask-image:linear-gradient(to_bottom,black_60%,transparent)]",
        )}
      >
        {content}
      </div>
      {body.long && (
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-controls={contentId}
          onClick={() => setExpanded((current) => !current)}
          className="mt-1 inline-flex h-control-compact items-center text-sm font-medium text-link hover:underline max-md:h-control-mobile"
        >
          {collapsed ? fr.chat.assistantShowMore : fr.chat.assistantShowLess}
        </button>
      )}

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
