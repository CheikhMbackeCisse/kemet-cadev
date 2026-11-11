import { navigate } from "../lib/navigation/navigate.js";
import { Plus, Search, Star } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { HeaderActionLink } from "../components/ui/HeaderActionLink.js";
import { RailPage } from "../components/layout/RailPage.js";
import { SkillCard } from "../components/skills/SkillCard.js";
import { Button } from "../components/ui/Button.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import { ErrorState } from "../components/ui/ErrorState.js";
import { Input } from "../components/ui/Input.js";
import { Skeleton } from "../components/ui/Skeleton.js";
import { listSkills } from "../lib/chat/api.js";
import { fr } from "../i18n/fr.js";

// Attente après la dernière frappe avant d'interroger le serveur.
const SEARCH_DELAY_MS = 250;

export function SkillsPage() {
  const searchId = useId();
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  // Pendant une recherche, les résultats précédents restent affichés.
  const skillsQuery = useQuery({
    queryKey: ["skills", appliedQuery],
    queryFn: () => listSkills(appliedQuery).then((page) => page.items),
    placeholderData: keepPreviousData,
  });
  const skills = skillsQuery.data ?? [];
  const error = skillsQuery.isError && !skillsQuery.data;

  useEffect(() => {
    const timer = window.setTimeout(() => setAppliedQuery(query.trim()), SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  return (
    <RailPage activeSection="skills" className="gap-6 px-4 pt-3 lg:pt-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-text">{fr.skills.title}</h1>
        <HeaderActionLink href="/skills/nouveau" icon={Plus}>
          {fr.skills.create}
        </HeaderActionLink>
      </div>

      <div className="flex flex-col gap-3">
        <div className="relative max-w-xl">
          <label htmlFor={searchId} className="sr-only">
            {fr.skills.searchLabel}
          </label>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <Input
            id={searchId}
            type="search"
            autoComplete="off"
            placeholder={fr.skills.searchPlaceholder}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {skillsQuery.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-56 w-full rounded-card" />
          ))}
        </div>
      ) : error ? (
        <ErrorState
          message={fr.skills.loadingError}
          retry={{ label: fr.chat.retry, onClick: () => void skillsQuery.refetch() }}
        />
      ) : skills.length === 0 ? (
        appliedQuery ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-base text-text-2">{fr.skills.searchNoResult(appliedQuery)}</p>
            <Button variant="secondary" onClick={() => setQuery("")}>
              {fr.skills.clearSearch}
            </Button>
          </div>
        ) : (
          <EmptyState
            icon={Star}
            message={fr.skills.noSkills}
            action={{
              label: fr.skills.create,
              onClick: () => navigate("/skills/nouveau"),
            }}
          />
        )
      ) : (
        <ul className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {skills.map((skill) => (
            <li key={skill.id} className="min-w-0">
              <SkillCard skill={skill} />
            </li>
          ))}
        </ul>
      )}
    </RailPage>
  );
}
