import { Plus, Search, Star } from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";
import type { SkillSummary } from "@kemet/shared";
import { RailPage } from "../components/layout/RailPage.js";
import { SkillCard } from "../components/skills/SkillCard.js";
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
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setAppliedQuery(query.trim()), SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  const load = useCallback((search: string) => {
    let current = true;
    setLoading(true);
    setError(false);
    listSkills(search)
      .then((page) => current && setSkills(page.items))
      .catch(() => current && setError(true))
      .finally(() => current && setLoading(false));
    return () => {
      current = false;
    };
  }, []);

  useEffect(() => load(appliedQuery), [appliedQuery, load]);

  return (
    <RailPage activeSection="skills" className="gap-6 px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-text">{fr.skills.title}</h1>
        <a
          href="/skills/nouveau"
          className="inline-flex h-control max-md:h-control-mobile shrink-0 items-center justify-center gap-2 rounded-control bg-primary px-4 text-base font-medium text-white hover:bg-primary-hover"
        >
          <Plus className="size-4" aria-hidden="true" />
          {fr.skills.create}
        </a>
      </div>

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

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-56 w-full rounded-card" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={fr.skills.loadingError} retry={{ label: fr.chat.retry, onClick: () => load(appliedQuery) }} />
      ) : skills.length === 0 ? (
        appliedQuery ? (
          <p className="text-base text-text-2">{fr.skills.searchNoResult(appliedQuery)}</p>
        ) : (
          <EmptyState
            icon={Star}
            message={fr.skills.noSkills}
            action={{
              label: fr.skills.create,
              onClick: () => (window.location.href = "/skills/nouveau"),
            }}
          />
        )
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {skills.map((skill) => (
            <li key={skill.id}>
              <SkillCard skill={skill} />
            </li>
          ))}
        </ul>
      )}
    </RailPage>
  );
}
