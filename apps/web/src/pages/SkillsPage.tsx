import { Plus, Star } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { SkillSummary } from "@kemet/shared";
import { listSkills } from "../lib/chat/api.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import { ErrorState } from "../components/ui/ErrorState.js";
import { Skeleton } from "../components/ui/Skeleton.js";
import { fr } from "../i18n/fr.js";
import { RailPage } from "../components/layout/RailPage.js";

export function SkillsPage() {
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    listSkills()
      .then((page) => setSkills(page.items))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => load(), [load]);

  return (
    <RailPage activeSection="skills" className="gap-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-text">{fr.skills.title}</h1>
        <a
          href="/skills/nouveau"
          className="inline-flex h-control max-md:h-control-mobile shrink-0 items-center justify-center gap-2 rounded-control bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover"
        >
          <Plus className="size-4" aria-hidden="true" />
          {fr.skills.create}
        </a>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : error ? (
        <ErrorState
          message={fr.skills.loadingError}
          retry={{ label: fr.chat.retry, onClick: load }}
        />
      ) : skills.length === 0 ? (
        <EmptyState
          icon={Star}
          message={fr.skills.noSkills}
          action={{
            label: fr.skills.create,
            onClick: () => (window.location.href = "/skills/nouveau"),
          }}
        />
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {skills.map((skill) => (
            <li key={skill.id}>
              <a
                href={`/skills/${skill.slug}`}
                className="block -mx-4 px-4 py-4 transition-colors duration-150 lg:-mx-3 lg:px-3 lg:hover:bg-surface-2"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-text">{skill.name}</span>
                  <span className="flex items-center gap-1 text-xs text-subtle">
                    <Star className="size-4" aria-hidden="true" />
                    {fr.skills.averageStars(skill.averageStars ?? 0, skill.ratingCount)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-text-2">{skill.description}</p>
                <p className="mt-2 text-xs text-subtle">
                  {fr.skills.byAuthor(skill.authorDisplayName)}
                </p>
              </a>
            </li>
          ))}
        </ul>
      )}
    </RailPage>
  );
}
