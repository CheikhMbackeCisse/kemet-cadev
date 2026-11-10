import { UsersRound } from "lucide-react";
import { useId, useState } from "react";
import type { WorkMatchFallbackReason, WorkMatchResult, WorkMatchSubject } from "@kemet/shared";
import { findWorkMatches } from "../../lib/chat/api.js";
import { Avatar } from "../ui/Avatar.js";
import { Badge } from "../ui/Badge.js";
import { Button } from "../ui/Button.js";
import { ErrorState } from "../ui/ErrorState.js";
import { Skeleton } from "../ui/Skeleton.js";
import { UserName } from "../ui/UserName.js";
import { cn } from "../../lib/cn.js";
import { fr } from "../../i18n/fr.js";

const FALLBACK_MESSAGES: Record<WorkMatchFallbackReason, string> = {
  unavailable: fr.works.matchWithoutAssistantUnavailable,
  quota_exceeded: fr.works.matchWithoutAssistantQuota,
  invalid_response: fr.works.matchWithoutAssistantInvalid,
};

export interface WorkMatchPanelProps {
  subject: WorkMatchSubject;
  /** Un visiteur voit le bouton mais est invité à se connecter : l'appel compte dans un quota personnel. */
  signedIn: boolean;
  className?: string;
}

/**
 * "Qui a travaillé sur ce sujet ?" : rien n'est demandé à l'assistant tant
 * que le bouton n'est pas pressé.
 */
export function WorkMatchPanel({ subject, signedIn, className }: WorkMatchPanelProps) {
  const [state, setState] = useState<"idle" | "loading" | "error" | "done">("idle");
  const [result, setResult] = useState<WorkMatchResult | null>(null);
  const titleId = useId();

  async function ask() {
    setState("loading");
    try {
      const response = await findWorkMatches(subject);
      setResult(response.result);
      setState("done");
    } catch {
      setState("error");
    }
  }

  return (
    <section
      className={cn("flex flex-col gap-3", className)}
      aria-labelledby={state === "done" ? titleId : undefined}
    >
      {/* Toujours présente : une zone insérée avec son texte n'est souvent pas annoncée. */}
      <p className="sr-only" aria-live="polite">
        {state === "loading" ? fr.works.matchLoading : ""}
      </p>
      {state === "idle" &&
        (signedIn ? (
          <Button variant="secondary" onClick={ask} className="self-start">
            <UsersRound className="size-4" aria-hidden="true" />
            {fr.works.matchButton}
          </Button>
        ) : (
          <a
            href="/connexion"
            className="inline-flex h-control items-center gap-2 self-start rounded-control border border-border-strong bg-transparent px-3 text-sm font-medium text-text hover:bg-surface-2 max-md:h-control-mobile"
          >
            <UsersRound className="size-4" aria-hidden="true" />
            {fr.works.matchButton}
          </a>
        ))}

      {state === "loading" && (
        <div className="flex flex-col gap-2" aria-busy="true">
          <p className="text-sm text-muted" aria-hidden="true">
            {fr.works.matchLoading}
          </p>
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      )}

      {state === "error" && (
        <ErrorState message={fr.works.matchError} retry={{ label: fr.chat.retry, onClick: ask }} />
      )}

      {state === "done" && result && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id={titleId} className="text-sm font-semibold text-text">
              {fr.works.matchTitle}
            </h2>
            {result.mode === "recorded" && <Badge>{fr.works.matchRecorded}</Badge>}
            {result.mode === "full_text" && result.fallbackReason && (
              <Badge>{fr.works.matchWithoutAssistant}</Badge>
            )}
          </div>
          {result.mode === "recorded" && (
            <p className="text-xs text-subtle">{fr.works.matchRecordedHint}</p>
          )}
          {result.mode === "full_text" && result.fallbackReason && (
            <p className="text-xs text-subtle">{FALLBACK_MESSAGES[result.fallbackReason]}</p>
          )}
          {result.suggestions.length === 0 ? (
            <p className="text-sm text-subtle">{fr.works.matchEmpty}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {result.suggestions.map((suggestion) => (
                <li key={suggestion.person.id} className="flex gap-3 py-3">
                  <a href={`/u/${suggestion.person.handle}`} tabIndex={-1} aria-hidden="true">
                    <Avatar
                      name={suggestion.person.displayName}
                      src={suggestion.person.avatarUrl ?? undefined}
                      size={32}
                      countryCode={suggestion.person.country}
                    />
                  </a>
                  <div className="min-w-0 flex-1">
                    <UserName
                      name={suggestion.person.displayName}
                      handle={suggestion.person.handle}
                      level={suggestion.person.level}
                    />
                    {suggestion.justification && (
                      <p className="mt-0.5 text-sm text-text-2">{suggestion.justification}</p>
                    )}
                    <a
                      href={`/travaux/${suggestion.work.slug}`}
                      className="mt-0.5 block text-xs text-link hover:underline"
                    >
                      {fr.works.matchCites(suggestion.work.title)}
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {result.mode === "assistant" && result.suggestions.length > 0 && (
            <p className="text-xs text-subtle">{fr.works.matchByAssistant}</p>
          )}
        </div>
      )}
    </section>
  );
}
