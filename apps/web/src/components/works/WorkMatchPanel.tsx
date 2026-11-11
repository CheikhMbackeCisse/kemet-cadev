import { useQuery } from "@tanstack/react-query";
import { UsersRound } from "lucide-react";
import { useId, useState } from "react";
import type { WorkMatchFallbackReason, WorkMatchResult, WorkMatchSubject } from "@kemet/shared";
import { findWorkMatches, getRelatedPeople } from "../../lib/chat/api.js";
import { useSession } from "../../session/SessionProvider.js";
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

export interface WorkMatch {
  state: "idle" | "loading" | "error" | "done";
  result: WorkMatchResult | null;
  ask: () => void;
}

/**
 * État de l'appel à @kemet, à part du panneau : une page qui affiche le
 * panneau à deux endroits selon la largeur garde un seul résultat.
 */
export function useWorkMatch(subject: WorkMatchSubject): WorkMatch {
  const [state, setState] = useState<WorkMatch["state"]>("idle");
  const [result, setResult] = useState<WorkMatchResult | null>(null);

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

  return { state, result, ask: () => void ask() };
}

export interface WorkMatchPanelProps {
  subject: WorkMatchSubject;
  /** Fourni par la page quand le panneau apparaît à plus d'un endroit. */
  match?: WorkMatch;
  className?: string;
}

/**
 * "Qui a travaillé sur ce sujet ?". Avec un compte, rien n'est demandé à
 * l'assistant tant que le bouton n'est pas pressé. Sans compte, un travail ou
 * un projet montre déjà les personnes rapprochées par tags communs, sans
 * l'assistant.
 */
export function WorkMatchPanel({ subject, match, className }: WorkMatchPanelProps) {
  const { status } = useSession();
  const ownMatch = useWorkMatch(subject);
  const { state, result, ask } = match ?? ownMatch;
  const titleId = useId();

  if (status === "loading") return null;
  if (status !== "ready") {
    if (subject.type === "post")
      return (
        <a
          href="/connexion"
          className={cn(
            "inline-flex h-control items-center gap-2 self-start rounded-control border border-border-strong bg-transparent px-3 text-sm font-medium text-text hover:bg-surface-2 max-md:h-control-mobile",
            className,
          )}
        >
          <UsersRound className="size-4" aria-hidden="true" />
          {fr.works.matchButton}
        </a>
      );
    return (
      <RelatedPeoplePreview subject={subject} signIn={status === "visitor"} className={className} />
    );
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
      {state === "idle" && (
        <Button variant="secondary" onClick={ask} className="self-start">
          <UsersRound className="size-4" aria-hidden="true" />
          {fr.works.matchButton}
        </Button>
      )}

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

function RelatedPeoplePreview({
  subject,
  signIn,
  className,
}: {
  subject: { type: "work" | "project"; slug: string };
  signIn: boolean;
  className?: string;
}) {
  const titleId = useId();
  const query = useQuery({
    queryKey: ["related-people", subject.type, subject.slug],
    queryFn: () => getRelatedPeople(subject).then((response) => response.related),
  });
  const related = query.data;
  // Rien de proche : le bloc disparaît plutôt que d'annoncer un vide sous le titre.
  if (related?.total === 0) return null;

  return (
    <section className={cn("flex flex-col gap-2", className)} aria-labelledby={titleId}>
      <h2 id={titleId} className="text-sm font-semibold text-text">
        {fr.works.matchTitle}
      </h2>
      {query.isPending && <Skeleton className="h-8 w-56" />}
      {query.isError && !related && <p className="text-sm text-subtle">{fr.works.matchError}</p>}
      {related && (
        <>
          <div className="flex items-center gap-3">
            <ul className="flex shrink-0 -space-x-2">
              {related.people.map((person) => (
                <li key={person.id}>
                  <a
                    href={`/u/${person.handle}`}
                    aria-label={person.displayName}
                    title={person.displayName}
                    className="block rounded-full"
                  >
                    <Avatar
                      name={person.displayName}
                      src={person.avatarUrl ?? undefined}
                      size={32}
                      className="ring-2 ring-bg"
                    />
                  </a>
                </li>
              ))}
            </ul>
            <p className="text-sm text-text-2">{fr.works.relatedCount(related.total)}</p>
          </div>
          {signIn && (
            <a href="/connexion" className="self-start text-sm text-link hover:underline">
              {fr.works.relatedSignIn}
            </a>
          )}
        </>
      )}
    </section>
  );
}
